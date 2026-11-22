import { OidcClient, WebStorageStateStore } from 'oidc-client-ts'
import { clearSession, readSession, storeSession, type AppSession } from './session'
import { apiUrl } from './api'
import { oidcAuthority, waitForKeycloak } from './warmup'

const authority = oidcAuthority
export const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`
// Allow up to 90 seconds for OIDC token exchange and API account setup after Keycloak redirects back.
// This does not time-limit the browser's initial navigation while Render wakes Keycloak.
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

export async function startSignIn(
  flow: 'login' | 'register',
  options: { signal?: AbortSignal; onWaiting?: () => void; onElapsed?: (elapsedMs: number) => void } = {},
): Promise<void> {
  try {
    await waitForKeycloak(options)
    const request = await oidcClient.createSigninRequest({
      request_type: 'si:r',
      nonce: window.crypto.randomUUID(),
      ...(flow === 'register' ? { extraQueryParams: { prompt: 'create' } } : {}),
    })
    if (!request.url) throw new Error('The identity provider did not return a sign-in URL.')

    // OIDC builds the URL locally with a fresh state, nonce, and PKCE verifier.
    // Redirect straight to Keycloak instead of waiting on the API's readiness
    // probe and retry loop before the identity provider can start waking up.
    window.location.assign(request.url)
  } catch (cause) {
    if (options.signal?.aborted) throw cause
    if (cause instanceof Error && cause.name === 'KeycloakWarmupTimeoutError') throw cause
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new Error('MeFit sign-in is waking up after being idle. Please wait a moment and try again.')
    }
    throw new Error('MeFit could not start secure sign-in. Check your connection and try again.')
  }
}

export const accountLinkCallbackPath = '/auth/link/callback'

export async function startLegacyAccountLink(supabaseSubject: string) {
  await waitForKeycloak()
  const request = await oidcClient.createSigninRequest({
    redirect_uri: `${window.location.origin}${accountLinkCallbackPath}`,
    request_type: 'account-link',
    scope: 'openid mefit-api-audience',
    nonce: window.crypto.randomUUID(),
    prompt: 'login',
    state: { supabaseSubject },
  })
  window.location.assign(request.url)
}

export async function finishLegacyAccountLink(callbackUrl: string, supabaseSubject: string) {
  const { state } = await oidcClient.readSigninResponseState(callbackUrl)
  if (state.request_type !== 'account-link' || typeof state.data !== 'object' || !state.data ||
      !('supabaseSubject' in state.data) || state.data.supabaseSubject !== supabaseSubject) {
    throw new Error('This sign-in was started for a different session. Start the account link again.')
  }
  const result = await oidcClient.processSigninResponse(callbackUrl)
  if (!result.access_token) throw new Error('Sign in again with your existing MeFit account.')
  return result.access_token
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
    throw new Error('Your identity provider sign-in succeeded, but the MeFit API could not be reached. Check your connection and try again.')
  }
  const user = await response.json() as { id?: string; email?: string; display_name?: string; first_name?: string | null; last_name?: string | null; roles?: string[]; has_profile?: boolean; error?: { message?: string } }
  if (!response.ok || !user.id || !user.email) {
    throw new Error(`Account setup failed (${response.status}): ${user.error?.message ?? 'Your account could not be set up. Please try signing in again.'}`)
  }

  const session: AppSession = {
    authProvider: 'keycloak',
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
