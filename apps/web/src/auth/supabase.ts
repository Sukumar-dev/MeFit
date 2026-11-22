import { authenticatedRequest, srsApiUrl } from './api'
import type { Exercise } from '../pages/exerciseFilters'
import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js'
import type { AppSession } from './session'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const useSupabaseAuth = import.meta.env.VITE_AUTH_PROVIDER === 'supabase'
export const supabaseAuthConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export type SupabaseMfaChallenge = {
  factorId: string
  setup?: { qrCode: string; secret: string }
}

export type SupabaseMfaStep = { session: SupabaseSession } | { challenge: SupabaseMfaChallenge }

export type ProfileRow = {
  id: string
  display_name: string
  avatar_url: string | null
  height_cm: number | null
  weight_kg: number | null
  timezone: string
  days_available: number
  minutes_per_workout: number
  current_activity: string
  experience: string
  created_at: string
  updated_at: string
}

type Owned = { id: string; user_id: string }
type Table<Row extends Record<string, unknown>> = {
  Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: []
}

type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>
      weekly_workouts: Table<Owned & { workout_date: string; title: string; completed: boolean; exercise_name?: string | null; target_sets?: number | null; target_reps?: number | null; target_minutes?: number | null }>
      exercise_library: Table<Exercise>
      user_favorites: Table<{ user_id: string; exercise_id: string }>
      fitness_exercises: Table<{ name: string; muscle_group: string; equipment: string }>
      workout_logs: Table<Owned & { exercise: string; performed_on: string; sets: number; reps: number; weight_kg: number; duration_seconds: number }>
      fitness_settings: Table<{ user_id: string; weight_unit: 'kg' | 'lb' }>
      fitness_progress: Table<Owned & { measured_on: string; weight_kg: number; waist_cm: number | null }>
    }
    Views: Record<never, never>
    Functions: Record<never, never>
  }
}

let client: ReturnType<typeof createClient<Database>> | undefined

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error('Supabase sign-in is not configured yet. Please try again later.')
  client ??= createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  })
  return client
}

export function toAppSession(session: SupabaseSession, previous?: AppSession | null): AppSession {
  const sameAccount = previous && matchesSupabaseAccount(previous, session)
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
      displayName: sameAccount
        ? (previous.user.displayName || displayName)
        : displayName,
      firstName,
      lastName,
      roles: sameAccount ? previous.user.roles : [],
      hasProfile: sameAccount ? previous.user.hasProfile : false,
    },
  }
}

function readClaims(token: string): { aal?: unknown; sub?: unknown } | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(base64))
  } catch {
    return null
  }
}

function readAssuranceLevel(token: string): 'aal1' | 'aal2' {
  return readClaims(token)?.aal === 'aal2' ? 'aal2' : 'aal1'
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
    // The SDK puts pending factors only in `all`, even for TOTP.
    for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status === 'unverified' && item.friendly_name === 'MeFit authenticator')) {
      const { error } = await auth.mfa.unenroll({ factorId: factor.id })
      if (error) throw error
    }
    const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MeFit authenticator' })
    if (error) throw error
    factorId = data.id
    setup = { qrCode: data.totp.qr_code, secret: data.totp.secret }
  }
  return { challenge: { factorId, ...(setup ? { setup } : {}) } }
}

export async function verifyMfaChallenge(challenge: SupabaseMfaChallenge, code: string): Promise<SupabaseSession> {
  const auth = getSupabaseClient().auth
  // Create the challenge when the code is submitted, on the device verifying it.
  const params = { factorId: challenge.factorId, code: code.trim() }
  let { error } = await auth.mfa.challengeAndVerify(params)
  if (error?.code === 'mfa_ip_address_mismatch' || error?.code === 'mfa_challenge_expired') {
    const retry = await auth.mfa.challengeAndVerify(params)
    error = retry.error
    if (error?.code === 'mfa_ip_address_mismatch' || error?.code === 'mfa_challenge_expired') {
      throw new Error('Your network changed or verification expired. Stay on one connection and submit a current code to try again.')
    }
  }
  if (error) throw error
  const { data, error: sessionError } = await auth.getSession()
  if (sessionError) throw sessionError
  if (!data.session || readAssuranceLevel(data.session.access_token) !== 'aal2') {
    throw new Error('The second step was not confirmed. Check your authenticator code and try again.')
  }
  return data.session
}

export class AccountLinkRequiredError extends Error {}

export async function readFitnessProfile(session: AppSession, signal?: AbortSignal): Promise<ProfileRow | null> {
  if (srsApiUrl) {
    const response = await authenticatedRequest('/fitness-account/profile', session, signal ? { signal } : {}, '')
    if (!response.ok) throw new Error('Your profile could not be loaded. Please try again.')
    return response.json() as Promise<ProfileRow | null>
  }
  let query = getSupabaseClient().from('profiles').select('*').eq('id', session.user.id)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error('Your profile could not be loaded. Please try again.')
  return data
}

export async function saveFitnessProfile(session: AppSession, profile: Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>) {
  if (srsApiUrl) {
    const response = await authenticatedRequest('/fitness-account/profile', session, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
    }, '')
    if (!response.ok) throw new Error('Your profile could not be saved. Please check your entries and try again.')
    return
  }
  const { error } = await getSupabaseClient().from('profiles').upsert({ ...profile, id: session.user.id })
  if (error) throw new Error('Your profile could not be saved. Please check your entries and try again.')
}

export async function provisionApiUser(session: SupabaseSession): Promise<AppSession> {
  const appSession = toAppSession(session)
  const profile = await readFitnessProfile(appSession)
  let roles: string[] = []
  if (srsApiUrl) {
    const response = await authenticatedRequest('/user', appSession)
    if (response.ok) {
      const user = await response.json() as { roles?: unknown }
      if (Array.isArray(user.roles)) roles = user.roles.filter((role): role is string => ['USER', 'CONTRIBUTOR', 'ADMIN'].includes(role))
    }
  }
  return {
    ...appSession,
    user: {
      ...appSession.user,
      displayName: profile?.display_name || appSession.user.displayName,
      hasProfile: Boolean(profile?.display_name),
      roles,
    },
  }
}

export async function confirmSupabaseSignup(tokenHash: string): Promise<void> {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error || !data.session) throw new Error('This confirmation link is invalid or expired. Request a fresh email, or sign in if your email is already confirmed.')
}

export function matchesSupabaseAccount(previous: AppSession, session: SupabaseSession): boolean {
  return previous.authProvider === 'supabase' && readClaims(previous.accessToken)?.sub === session.user.id
}

export async function getProfileSession(previous: AppSession, refresh = false): Promise<AppSession> {
  if (previous.authProvider !== 'supabase') return previous
  const auth = getSupabaseClient().auth
  const { data, error } = refresh ? await auth.refreshSession() : await auth.getSession()
  if (error || !data.session || !matchesSupabaseAccount(previous, data.session)) {
    throw new Error('Your sign-in session ended. Sign in again to save your profile.')
  }
  const session = toAppSession(data.session, previous)
  if (session.assuranceLevel !== 'aal2') throw new Error('Complete two-step verification again to save your profile.')
  return session
}

export async function completeSupabaseCallback(): Promise<SupabaseSession> {
  const auth = getSupabaseClient().auth
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code)
    if (error?.name === 'AuthPKCECodeVerifierMissingError') {
      throw new Error('This older confirmation link requires the browser you registered with. If your email is already confirmed, sign in to continue.')
    }
    if (error) throw error
  }
  const { data, error } = await auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Your sign-in session was not found. Please sign in again.')
  return data.session
}
