import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { AuthPage } from './AuthPage'

const { startSignIn } = vi.hoisted(() => ({ startSignIn: vi.fn() }))

vi.mock('../auth/oidc', () => ({ startSignIn }))

describe('authentication retry UI', () => {
  it('offers a clear retry after registration cannot start', async () => {
    const user = userEvent.setup()
    startSignIn.mockRejectedValueOnce(new Error('Secure sign-in is unavailable.'))
    startSignIn.mockResolvedValueOnce(undefined)
    const auth = { session: null, setSession: vi.fn(), logout: vi.fn() }

    render(<MemoryRouter initialEntries={['/register']}><AuthContext.Provider value={auth}><AuthPage initialFlow="register" /></AuthContext.Provider></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Continue to registration' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Secure sign-in is unavailable.')
    const retryButton = screen.getByRole('button', { name: 'Try again' })
    await user.click(retryButton)
    expect(startSignIn).toHaveBeenCalledTimes(2)
  })
})
