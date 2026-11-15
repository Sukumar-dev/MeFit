import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import '../env.js'

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in requests. Please wait a minute and try again.' } },
})

const loginRequestSchema = z.object({
  redirect_uri: z.string().url(),
  state: z.string().min(20).max(256).regex(/^[A-Za-z0-9._~-]+$/),
  nonce: z.string().min(20).max(256).regex(/^[A-Za-z0-9._~-]+$/),
  code_challenge: z.string().length(43).regex(/^[A-Za-z0-9_-]+$/),
  flow: z.enum(['login', 'register']).default('login'),
}).strict()

const router = Router()

// Keep each response below Render's proxy timeout. The browser retries this
// endpoint, allowing a cold Keycloak boot to span multiple short requests.
const readinessTimeoutMs = 75_000
const readinessRequestTimeoutMs = 5_000
const readinessPollIntervalMs = 1_000

async function waitForIdentityProvider(issuer: string): Promise<boolean> {
  const deadline = Date.now() + readinessTimeoutMs
  const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`

  while (Date.now() < deadline) {
    try {
      const result = await fetch(discoveryUrl, { signal: AbortSignal.timeout(readinessRequestTimeoutMs) })
      if (result.ok) {
        const metadata: unknown = await result.json()
        if (typeof metadata === 'object' && metadata !== null && 'issuer' in metadata && metadata.issuer === issuer.replace(/\/$/, '')) {
          return true
        }
      }
    } catch {
      // A sleeping Render identity service can refuse or time out requests until boot completes.
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(readinessPollIntervalMs, Math.max(0, deadline - Date.now()))))
  }
  return false
}

router.post('/login', loginLimiter, async (request, response) => {
  const parsed = loginRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'The sign-in request is incomplete or malformed.', details: parsed.error.flatten().fieldErrors } })
    return
  }

  const configuredOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173'
  let redirectUri: URL
  try {
    redirectUri = new URL(parsed.data.redirect_uri)
  } catch {
    response.status(400).json({ error: { code: 'INVALID_REDIRECT', message: 'The sign-in redirect is not allowed.' } })
    return
  }
  if (redirectUri.origin !== new URL(configuredOrigin).origin || redirectUri.pathname !== '/auth/callback') {
    response.status(400).json({ error: { code: 'INVALID_REDIRECT', message: 'The sign-in redirect is not allowed.' } })
    return
  }

  const issuer = process.env.OIDC_ISSUER
  if (!issuer) {
    response.status(503).json({ error: { code: 'IDENTITY_UNAVAILABLE', message: 'Sign-in is temporarily unavailable.' } })
    return
  }

  if (process.env.NODE_ENV === 'production' && !(await waitForIdentityProvider(issuer))) {
    response.status(503).json({ error: { code: 'IDENTITY_UNAVAILABLE', message: 'Sign-in is taking longer than expected. Please try again in a moment.' } })
    return
  }

  const authorizationUrl = new URL(`${issuer.replace(/\/$/, '')}/protocol/openid-connect/auth`)
  authorizationUrl.searchParams.set('client_id', process.env.OIDC_CLIENT_ID ?? 'mefit-web')
  authorizationUrl.searchParams.set('redirect_uri', redirectUri.toString())
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('response_mode', 'query')
  authorizationUrl.searchParams.set('scope', 'openid profile email mefit-api-audience')
  authorizationUrl.searchParams.set('state', parsed.data.state)
  authorizationUrl.searchParams.set('nonce', parsed.data.nonce)
  authorizationUrl.searchParams.set('code_challenge', parsed.data.code_challenge)
  authorizationUrl.searchParams.set('code_challenge_method', 'S256')
  if (parsed.data.flow === 'register') authorizationUrl.searchParams.set('prompt', 'create')

  response.status(200).json({ authorization_url: authorizationUrl.toString() })
})

export default router
