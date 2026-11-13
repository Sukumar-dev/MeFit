import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AuthPage } from './pages/AuthPage'

describe('authentication screens', () => {
  it('offers sign-in and a working registration flow switch', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/login']}><AuthProvider><AuthPage /></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Sign in to MeFit' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Create your MeFit account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to registration/i })).toBeEnabled()
  })
})
