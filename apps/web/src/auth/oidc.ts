import { OidcClient, WebStorageStateStore } from 'oidc-client-ts'
import { clearSession, readSession, storeSession, type AppSession } from './session'
import { apiUrl } from './api'

const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/mefit'
export const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`
export { apiUrl } from './api'

export const oidcClient = new OidcClient({
  authority,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'mefit-web',
  redirect_uri: redirectUri,
  post_logout_redirect_uri: `${window.location.origin}/login`,
  response_type: 'code',
  scope: 'openid profile email mefit-api-audience',
  stateStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: 'mefit.oidc.' }),
})

export { readSession, type AppSession } from './session'

export async function startSignIn(flow: 'login' | 'register'): Promise<void> {
  const request = await oidcClient.createSigninRequest({
    request_type: 'si:r',
    nonce: window.crypto.randomUUID(),
    ...(flow === 'register' ? { extraQueryParams: { kc_action: 'register' } } : {}),
  })
  const requestUrl = new URL(request.url)
  const body = {
    redirect_uri: redirectUri,
    state: requestUrl.searchParams.get('state'),
    nonce: requestUrl.searchParams.get('nonce'),
    code_challenge: requestUrl.searchParams.get('code_challenge'),
    flow,
  }
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
  const result = await response.json() as { authorization_url?: string; error?: { message?: string } }
  if (!response.ok || !result.authorization_url) {
    throw new Error(result.error?.message ?? 'Sign-in could not be started. Please try again.')
  }
  window.location.assign(result.authorization_url)
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
    signal: AbortSignal.timeout(7000),
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
