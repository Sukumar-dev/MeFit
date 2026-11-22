import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyOtp: vi.fn(),
  refreshSession: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession, verifyOtp: mocks.verifyOtp, refreshSession: mocks.refreshSession, mfa: mocks } }),
}))

const token = 'header.' + btoa(JSON.stringify({ aal: 'aal2', sub: 'subject' })) + '.signature'
const session = { access_token: token, expires_in: 3600, token_type: 'bearer' as const, refresh_token: 'test-refresh', user: { id: 'subject', email: 'person@example.test', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } }

describe('Supabase authenticator lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key')
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
  })

  it('confirms signup with a one-time email token and no local PKCE session', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session }, error: null })
    const { confirmSupabaseSignup } = await import('./supabase')
    await expect(confirmSupabaseSignup('test-token-hash')).resolves.toBeUndefined()
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-token-hash', type: 'email' })
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('rejects a used or expired confirmation link', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: 'otp_expired' } })
    const { confirmSupabaseSignup } = await import('./supabase')
    await expect(confirmSupabaseSignup('test-token-hash')).rejects.toThrow('invalid or expired')
  })

  it('refreshes a profile session, uses the Supabase user ID, and rejects account changes', async () => {
    const { getProfileSession, toAppSession } = await import('./supabase')
    const previous = toAppSession(session)
    previous.user.id = 'linked-api-id'
    const refreshedToken = 'header.' + btoa(JSON.stringify({ aal: 'aal2', sub: 'subject', iat: 2 })) + '.signature'
    mocks.refreshSession.mockResolvedValue({ data: { session: { ...session, access_token: refreshedToken } }, error: null })
    await expect(getProfileSession(previous, true)).resolves.toMatchObject({ accessToken: refreshedToken, user: { id: 'subject' } })
    mocks.refreshSession.mockResolvedValue({ data: { session: { ...session, user: { ...session.user, id: 'different' } } }, error: null })
    await expect(getProfileSession(previous, true)).rejects.toThrow('Sign in again')
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: { code: 'refresh_token_not_found' } })
    await expect(getProfileSession(previous, true)).rejects.toThrow('Sign in again')
  })

  it('reuses a verified factor without enrolling or starting a challenge on page load', async () => {
    mocks.listFactors.mockResolvedValue({ data: { totp: [{ id: 'existing', status: 'verified' }], all: [] }, error: null })
    const { beginMfaChallenge } = await import('./supabase')
    await expect(beginMfaChallenge()).resolves.toEqual({ challenge: { factorId: 'existing' } })
    expect(mocks.enroll).not.toHaveBeenCalled()
    expect(mocks.challengeAndVerify).not.toHaveBeenCalled()
  })

  it.each(['mfa_ip_address_mismatch', 'mfa_challenge_expired'])('gets a fresh challenge after %s', async (code) => {
    mocks.challengeAndVerify.mockResolvedValueOnce({ error: { code } }).mockResolvedValueOnce({ error: null })
    const { verifyMfaChallenge } = await import('./supabase')
    await expect(verifyMfaChallenge({ factorId: 'existing' }, '123456')).resolves.toEqual(session)
    expect(mocks.challengeAndVerify).toHaveBeenCalledTimes(2)
    expect(mocks.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: 'existing', code: '123456' })
  })
})
