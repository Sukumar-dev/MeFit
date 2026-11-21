import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js'
import type { AppSession } from './session'
import { apiUrl } from './api'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const useSupabaseAuth = import.meta.env.VITE_AUTH_PROVIDER === 'supabase'
export const supabaseAuthConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export type SupabaseMfaChallenge = {
  factorId: string
  challengeId: string
  setup?: { qrCode: string; secret: string }
}

export type SupabaseMfaStep = { session: SupabaseSession } | { challenge: SupabaseMfaChallenge }

let client: ReturnType<typeof createClient> | undefined

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error('Supabase sign-in is not configured yet. Please try again later.')
  client ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  })
  return client
}

export function toAppSession(session: SupabaseSession, previous?: AppSession | null): AppSession {
  const metadata = session.user.user_metadata ?? {}
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : undefined
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : undefined
  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name : [firstName, lastName].filter(Boolean).join(' ')
  return {
    authProvider: 'supabase',
    assuranceLevel: readAssuranceLevel(session.access_token),
    accessToken: session.access_token,
    expiresAt: (session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in) * 1000,
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
      displayName: previous?.authProvider === 'supabase' && previous.user.id === session.user.id
        ? (previous.user.displayName || displayName)
        : displayName,
      firstName,
      lastName,
      roles: previous?.authProvider === 'supabase' && previous.user.id === session.user.id ? previous.user.roles : [],
      hasProfile: previous?.authProvider === 'supabase' && previous.user.id === session.user.id ? previous.user.hasProfile : false,
    },
  }
}

function readAssuranceLevel(token: string): 'aal1' | 'aal2' {
  try {
    const payload = token.split('.')[1]
    if (!payload) return 'aal1'
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(window.atob(base64)) as { aal?: unknown }
    return claims.aal === 'aal2' ? 'aal2' : 'aal1'
  } catch {
    return 'aal1'
  }
}

export async function beginMfaChallenge(): Promise<SupabaseMfaStep> {
  const auth = getSupabaseClient().auth
  const { data: sessionResult, error: sessionError } = await auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionResult.session) throw new Error('Your sign-in session expired. Please start again.')
  const { data: assurance, error: assuranceError } = await auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError) throw assuranceError
  if (assurance.currentLevel === 'aal2') return { session: sessionResult.session }

  const { data: factors, error: factorsError } = await auth.mfa.listFactors()
  if (factorsError) throw factorsError
  let factorId = factors.totp.find((factor) => factor.status === 'verified')?.id
  let setup: SupabaseMfaChallenge['setup']
  if (!factorId) {
    // A user may have left during enrollment. Remove the unverified orphan so
    // retrying sign-in does not accumulate unusable factors or hit factor limits.
    for (const factor of factors.totp.filter((item) => item.status !== 'verified')) {
      const { error } = await auth.mfa.unenroll({ factorId: factor.id })
      if (error) throw error
    }
    const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MeFit authenticator' })
    if (error) throw error
    factorId = data.id
    setup = { qrCode: data.totp.qr_code, secret: data.totp.secret }
  }
  const { data: challenge, error: challengeError } = await auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError
  return { challenge: { factorId, challengeId: challenge.id, ...(setup ? { setup } : {}) } }
}

export async function verifyMfaChallenge(challenge: SupabaseMfaChallenge, code: string): Promise<SupabaseSession> {
  const auth = getSupabaseClient().auth
  const { error } = await auth.mfa.verify({ factorId: challenge.factorId, challengeId: challenge.challengeId, code: code.trim() })
  if (error) throw error
  const { data, error: sessionError } = await auth.getSession()
  if (sessionError) throw sessionError
  if (!data.session || readAssuranceLevel(data.session.access_token) !== 'aal2') {
    throw new Error('The second step was not confirmed. Check your authenticator code and try again.')
  }
  return data.session
}

export async function provisionApiUser(session: SupabaseSession): Promise<AppSession> {
  const appSession = toAppSession(session)
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/user`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(90_000),
  })
  const user = await response.json() as { id?: string; email?: string; display_name?: string; first_name?: string | null; last_name?: string | null; roles?: string[]; has_profile?: boolean; error?: { message?: string } }
  if (!response.ok || !user.id || !user.email) throw new Error(user.error?.message ?? `Account setup failed (${response.status}). Please try again.`)
  return {
    ...appSession,
    user: {
      ...appSession.user,
      email: user.email,
      displayName: user.display_name ?? appSession.user.displayName,
      firstName: user.first_name ?? undefined,
      lastName: user.last_name ?? undefined,
      roles: user.roles ?? ['USER'],
      hasProfile: user.has_profile === true,
    },
  }
}

export async function completeSupabaseCallback(): Promise<SupabaseSession> {
  const auth = getSupabaseClient().auth
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code)
    if (error) throw error
  }
  const { data, error } = await auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Your sign-in session was not found. Please sign in again.')
  return data.session
}
