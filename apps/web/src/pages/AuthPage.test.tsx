import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { AuthPage } from './AuthPage'

const { startSignIn } = vi.hoisted(() => ({ startSignIn: vi.fn() }))

vi.mock('../auth/oidc', () => ({ startSignIn }))

const { prewarmKeycloakOnce } = vi.hoisted(() => ({ prewarmKeycloakOnce: vi.fn() }))
vi.mock('../auth/warmup', () => ({ prewarmKeycloakOnce }))

describe('authentication retry UI', () => {
  it('offers a clear retry after registration cannot start', async () => {
    const user = userEvent.setup()
    startSignIn.mockRejectedValueOnce(new Error('Secure sign-in is unavailable.'))
    startSignIn.mockResolvedValueOnce(undefined)
    const auth = { authReady: true, session: null, setSession: vi.fn(), logout: vi.fn() }

    render(<MemoryRouter initialEntries={['/register']}><AuthContext.Provider value={auth}><AuthPage initialFlow="register" /></AuthContext.Provider></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Continue to registration' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Secure sign-in is unavailable.')
    const retryButton = screen.getByRole('button', { name: 'Try again' })
    await user.click(retryButton)
    expect(startSignIn).toHaveBeenCalledTimes(2)
  })

  it('shows the waking state and lets the user cancel while waiting', async () => {
    const user = userEvent.setup()
    let signal: AbortSignal | undefined
    startSignIn.mockImplementationOnce((_flow: string, options: { signal: AbortSignal }) => {
      signal = options.signal
      return new Promise<void>(() => undefined)
    })
    const auth = { authReady: true, session: null, setSession: vi.fn(), logout: vi.fn() }

    render(<MemoryRouter><AuthContext.Provider value={auth}><AuthPage /></AuthContext.Provider></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Continue to sign in' }))
    expect(screen.getByRole('button', { name: 'Checking secure connection…' })).toBeDisabled()

    // Simulate the helper signaling that the first request is slow.
    const options = startSignIn.mock.calls.at(-1)?.[1] as { onWaiting: () => void }
    act(() => options.onWaiting())
    expect(screen.getByText(/Waking up the sign-in server/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(signal?.aborted).toBe(true))
    expect(screen.getByRole('button', { name: 'Continue to sign in' })).toHaveFocus()
  })
})
