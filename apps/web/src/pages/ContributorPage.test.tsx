import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { ContributorPage } from './ContributorPage'

it('offers workout and program authoring to contributors and reserves exercise authoring for admins', () => {
  const context = {
    authReady: true,
    session: {
      accessToken: 'isolated-test-token',
      expiresAt: Date.now() + 60_000,
      user: { id: 'qa-id', email: 'qa@example.test', displayName: 'QA', hasProfile: true, roles: ['CONTRIBUTOR'] },
    },
    setSession: vi.fn(),
    logout: vi.fn(),
  }
  const page = (roles: string[]) => (
    <MemoryRouter>
      <AuthContext.Provider value={{ ...context, session: { ...context.session, user: { ...context.session.user, roles } } }}>
        <ContributorPage />
      </AuthContext.Provider>
    </MemoryRouter>
  )
  const view = render(page(['CONTRIBUTOR']))
  expect(screen.getByRole('heading', { name: 'Add workout' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'exercises' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'programs' })).toBeInTheDocument()
  view.rerender(page(['ADMIN']))
  expect(screen.getByRole('heading', { name: 'Add exercise' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'exercises', pressed: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'workouts', pressed: false })).toBeInTheDocument()
})
