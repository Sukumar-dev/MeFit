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

  // Building an authorization URL is local work. Let the user's browser
  // initiate the Keycloak request so a sleeping provider can wake on demand
  // without holding this API request open or causing a preflight timeout.
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
