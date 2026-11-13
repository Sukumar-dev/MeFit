import { describe, expect, it } from 'vitest'
import { fullNameForUser } from './session'

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
