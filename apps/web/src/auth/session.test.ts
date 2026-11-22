import { describe, expect, it } from 'vitest'
import { clearSession, fullNameForUser, readSession, storeSession } from './session'

describe('fullNameForUser', () => {
  it('combines identity-provider first and last names', () => {
    expect(fullNameForUser({ email: 'sukumar@gmail.com', displayName: '', firstName: 'Sukumar', lastName: 'Singarapu', id: '1', roles: [], hasProfile: true })).toBe('Sukumar Singarapu')
  })

  it('uses the stored full name when separate profile claims are unavailable', () => {
    expect(fullNameForUser({ email: 'sukumar@gmail.com', displayName: 'Sukumar Singarapu', id: '1', roles: [], hasProfile: true })).toBe('Sukumar Singarapu')
  })

  it('never returns email as the full name', () => {
    expect(fullNameForUser({ email: 'sukumar@gmail.com', displayName: 'sukumar@gmail.com', id: '1', roles: [], hasProfile: true })).toBe('')
  })
})

it('retains expired Supabase account metadata only for provider-verified restoration', () => {
  const expired = {
    authProvider: 'supabase' as const,
    accessToken: 'expired-token',
    expiresAt: Date.now() - 1,
    user: { id: 'account-id', email: 'qa@example.test', displayName: 'QA', roles: ['USER'], hasProfile: true },
  }
  try {
    storeSession(expired)
    expect(readSession({ allowExpiredSupabase: true })).toEqual(expired)
    expect(readSession()).toBeNull()
    storeSession({ ...expired, authProvider: 'keycloak' })
    expect(readSession({ allowExpiredSupabase: true })).toBeNull()
  } finally {
    clearSession()
  }
})
