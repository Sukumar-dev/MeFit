import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession, mfa: mocks } }),
}))

const token = 'header.' + btoa(JSON.stringify({ aal: 'aal2', sub: 'subject' })) + '.signature'
const session = { access_token: token, expires_in: 3600, user: { id: 'subject', email: 'person@example.test' } }

describe('Supabase authenticator lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key')
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
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
