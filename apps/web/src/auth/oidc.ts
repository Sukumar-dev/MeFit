import { OidcClient, WebStorageStateStore } from 'oidc-client-ts'
import { clearSession, readSession, storeSession, type AppSession } from './session'
import { apiUrl } from './api'

const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/mefit'
export const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`
// Render's free identity and API services can both need time to wake after idle.
const requestTimeoutInSeconds = 90
const issuer = authority.replace(/\/$/, '')
export { apiUrl } from './api'

export const oidcClient = new OidcClient({
  authority,
  metadata: {
    issuer,
    authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
    token_endpoint: `${issuer}/protocol/openid-connect/token`,
    userinfo_endpoint: `${issuer}/protocol/openid-connect/userinfo`,
    end_session_endpoint: `${issuer}/protocol/openid-connect/logout`,
    jwks_uri: `${issuer}/protocol/openid-connect/certs`,
  },
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'mefit-web',
  redirect_uri: redirectUri,
  post_logout_redirect_uri: `${window.location.origin}/login`,
  response_type: 'code',
  scope: 'openid profile email mefit-api-audience',
  requestTimeoutInSeconds,
  stateStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: 'mefit.oidc.' }),
})

export { readSession, type AppSession } from './session'

export async function startSignIn(flow: 'login' | 'register'): Promise<void> {
  let request
  try {
    request = await oidcClient.createSigninRequest({
      request_type: 'si:r',
      nonce: window.crypto.randomUUID(),
      ...(flow === 'register' ? { extraQueryParams: { kc_action: 'register' } } : {}),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new Error('MeFit sign-in is waking up after being idle. Please wait a moment and try again.')
    }
    throw new Error('MeFit could not reach the identity provider. Please check your connection and try again.')
  }
  const requestUrl = new URL(request.url)
  const body = {
    redirect_uri: redirectUri,
    state: requestUrl.searchParams.get('state'),
    nonce: requestUrl.searchParams.get('nonce'),
    code_challenge: requestUrl.searchParams.get('code_challenge'),
    flow,
  }
  let lastError: Error | undefined
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // Each request is bounded below Render's proxy timeout. Retrying lets
      // Keycloak finish waking without leaving one connection open for minutes.
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutInSeconds * 1000),
      })
      const result = await response.json() as { authorization_url?: string; error?: { code?: string; message?: string } }
      if (response.ok && result.authorization_url) {
        window.location.assign(result.authorization_url)
        return
      }
      lastError = new Error(result.error?.message ?? 'Sign-in could not be started. Please try again.')
      const retryable = response.status >= 500 || result.error?.code === 'IDENTITY_UNAVAILABLE'
      if (!retryable || attempt === 2) throw lastError
    } catch (cause) {
      if (cause === lastError) throw cause
      lastError = cause instanceof DOMException && cause.name === 'TimeoutError'
        ? new Error('MeFit is waking up after being idle. Please wait a moment and try signing in again.')
        : new Error('MeFit could not reach the sign-in service. Please check your connection and try again.')
      if (attempt === 2) throw lastError
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
  throw lastError ?? new Error('Sign-in could not be started. Please try again.')
}

export async function finishSignIn(): Promise<AppSession> {
  const result = await oidcClient.processSigninResponse(window.location.href)
  if (!result.access_token || !result.id_token) throw new Error('The identity provider did not return a valid session.')

  let response: Response
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}/user`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${result.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(requestTimeoutInSeconds * 1000),
    })
  } catch {
    throw new Error('Your identity provider sign-in succeeded, but the MeFit API could not be reached. Check that the API is running and try again.')
  }
  const user = await response.json() as { id?: string; email?: string; display_name?: string; first_name?: string | null; last_name?: string | null; roles?: string[]; has_profile?: boolean; error?: { message?: string } }
  if (!response.ok || !user.id || !user.email) {
    throw new Error(`Account setup failed (${response.status}): ${user.error?.message ?? 'Your account could not be set up. Please try signing in again.'}`)
  }

  const session: AppSession = {
    accessToken: result.access_token,
    idToken: result.id_token,
    expiresAt: (result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 300)) * 1000,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name ?? '',
      firstName: user.first_name ?? undefined,
      lastName: user.last_name ?? undefined,
      roles: user.roles ?? ['USER'],
      hasProfile: user.has_profile === true,
    },
  }
  storeSession(session)
  return session
}

export async function endSignInSession(): Promise<void> {
  const session = readSession()
  if (!session) {
    window.location.assign('/login')
    return
  }
  try {
    const request = await oidcClient.createSignoutRequest({ id_token_hint: session.idToken })
    clearSession()
    window.location.assign(request.url)
  } catch {
    clearSession()
    window.location.assign('/login')
  }
}
