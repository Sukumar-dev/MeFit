import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import type { AppSession } from '../auth/session'
import { CatalogPage } from './CatalogPage'

const catalogByPath: Record<string, unknown> = {
  '/programs': { groups: [{ category: 'Starter', programs: [{ id: 'p1', name: 'Starter plan', description: 'A plan', _count: { workouts: 1 }, workouts: [] }] }] },
  '/workouts': { groups: [{ type: 'Strength', workouts: [{ id: 'w1', name: 'Leg day', description: 'A workout', _count: { exercises: 1 }, exercises: [{ id: 'e1', name: 'Squat' }] }] }] },
  '/exercises': { groups: [{ target_muscle_group: 'Legs', exercises: [{ id: 'e1', name: 'Squat', description: 'A movement' }] }] },
  '/program/p1': { id: 'p1', name: 'Starter plan', description: 'Plan details', workouts: [] },
}

function makeSession(id = 'catalog-user'): AppSession {
  return {
    accessToken: 'catalog-access-token',
    idToken: 'catalog-id-token',
    expiresAt: Date.now() + 60_000,
    user: { id, email: `${id}@example.test`, displayName: id, roles: ['USER'], hasProfile: true },
  }
}

function mockFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const body = catalogByPath[url.pathname.replace('/api', '')] ?? { groups: [] }
    return { ok: true, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderCatalog(session: AppSession) {
  const value: AuthContextValue = { authReady: true, session, setSession: () => undefined, logout: async () => undefined }
  return render(<MemoryRouter><AuthContext.Provider value={value}><CatalogPage /></AuthContext.Provider></MemoryRouter>)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Movement Library caching', () => {
  it('reuses section and detail data across tab and card navigation', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch()
    renderCatalog(makeSession())

    expect(await screen.findByRole('button', { name: /Starter plan/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Workouts' }))
    expect(await screen.findByRole('button', { name: /Leg day/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Exercises' }))
    expect(await screen.findByRole('button', { name: /Squat/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Workouts' }))
    expect(screen.getByRole('button', { name: /Leg day/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Programs' }))
    await user.click(screen.getByRole('button', { name: /Starter plan/ }))
    expect(await screen.findByText('Plan details')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Starter plan/ }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/programs'))).toHaveLength(1)
      expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/workouts'))).toHaveLength(1)
      expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/exercises'))).toHaveLength(1)
      expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/program/p1'))).toHaveLength(1)
    })
    expect(screen.queryByText('Loading the library…')).not.toBeInTheDocument()
  })

  it('does not refetch when auth context publishes a fresh session object for the same account and token', async () => {
    const fetchMock = mockFetch()
    const firstSession = makeSession('session-refresh-user')
    const view = renderCatalog(firstSession)
    expect(await screen.findByRole('button', { name: /Starter plan/ })).toBeInTheDocument()

    view.rerender(<MemoryRouter><AuthContext.Provider value={{ authReady: true, session: { ...firstSession, user: { ...firstSession.user } }, setSession: () => undefined, logout: async () => undefined }}><CatalogPage /></AuthContext.Provider></MemoryRouter>)
    await new Promise((resolve) => window.setTimeout(resolve, 30))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows the initial loading state only while a section is first fetched', async () => {
    const fetchMock = mockFetch()
    renderCatalog(makeSession('loading-state-user'))
    expect(screen.getByRole('status')).toHaveTextContent('Loading the library…')
    expect(await screen.findByRole('button', { name: /Starter plan/ })).toBeInTheDocument()
    expect(screen.queryByText('Loading the library…')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
