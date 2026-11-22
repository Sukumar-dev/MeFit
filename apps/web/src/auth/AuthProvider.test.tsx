import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './AuthContext'
import { clearSession, storeSession } from './session'

const { previous, getSession, signOut } = vi.hoisted(() => ({
  previous: {
    authProvider: 'supabase' as const,
    assuranceLevel: 'aal2' as const,
    accessToken: 'isolated-test-token',
    expiresAt: Date.now() + 60_000,
    user: { id: 'initial-id', email: 'qa@example.test', displayName: 'QA', roles: ['USER'], hasProfile: false },
  },
  getSession: vi.fn().mockResolvedValue({ data: { session: {} } }),
  signOut: vi.fn(),
}))

vi.mock('./supabase', () => ({
  useSupabaseAuth: true,
  supabaseAuthConfigured: true,
  getSupabaseClient: () => ({
    auth: {
      getSession,
      signOut,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
  toAppSession: () => previous,
  matchesSupabaseAccount: () => true,
}))

function AccountStatus() {
  const { session } = useAuth()
  return <span>{session?.user.id} {session?.user.roles.join(',')} {String(session?.user.hasProfile)}</span>
}

it('refreshes account identity, roles and profile status from the authenticated API after restoration', async () => {
  storeSession(previous)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'canonical-id', display_name: 'QA', roles: ['USER', 'CONTRIBUTOR'], has_profile: true }),
  }))
  try {
    render(<AuthProvider><AccountStatus /></AuthProvider>)
    expect(await screen.findByText('canonical-id USER,CONTRIBUTOR true')).toBeInTheDocument()
  } finally {
    clearSession()
    vi.unstubAllGlobals()
  }
})

it('reports a sign-out failure when the provider session is still active', async () => {
  const failure = new Error('Sign-out unavailable')
  signOut.mockResolvedValueOnce({ error: failure })
  const onFailure = vi.fn()

  function SignOutButton() {
    const { logout } = useAuth()
    return <button onClick={() => void logout().catch(onFailure)}>Sign out</button>
  }

  const view = render(<AuthProvider><SignOutButton /></AuthProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith(failure))
  view.unmount()
})
