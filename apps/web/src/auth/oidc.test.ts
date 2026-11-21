import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const oidcMocks = vi.hoisted(() => ({
  settings: undefined as Record<string, unknown> | undefined,
  createSigninRequest: vi.fn(),
}))

vi.mock('oidc-client-ts', () => ({
  OidcClient: class {
    constructor(settings: Record<string, unknown>) {
      oidcMocks.settings = settings
    }
    createSigninRequest(args: unknown) {
      return oidcMocks.createSigninRequest(args)
    }
  },
  WebStorageStateStore: class {},
}))

vi.mock('./warmup', () => ({
  oidcAuthority: 'http://localhost:8080/realms/mefit',
  waitForKeycloak: vi.fn().mockResolvedValue(undefined),
}))

import { startSignIn } from './oidc'

describe('production OIDC cold-start handling', () => {
  afterEach(() => vi.unstubAllGlobals())

  beforeEach(() => {
    oidcMocks.createSigninRequest.mockReset()
  })

  it('allows up to 90 seconds for the existing post-redirect OIDC requests', () => {
    expect(oidcMocks.settings?.requestTimeoutInSeconds).toBe(90)
    const metadata = oidcMocks.settings?.metadata as Record<string, string>
    expect(metadata.authorization_endpoint).toBe('http://localhost:8080/realms/mefit/protocol/openid-connect/auth')
    expect(metadata.token_endpoint).toBe('http://localhost:8080/realms/mefit/protocol/openid-connect/token')
  })

  it('shows a helpful message when Keycloak discovery times out', async () => {
    oidcMocks.createSigninRequest.mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'))

    await expect(startSignIn('login')).rejects.toThrow('MeFit sign-in is waking up after being idle.')
    expect(oidcMocks.createSigninRequest).toHaveBeenCalledOnce()
  })

  it('waits for Keycloak readiness then starts login with the secure OIDC URL', async () => {
    oidcMocks.createSigninRequest.mockResolvedValue({ url: 'https://identity.example.test/authorize?state=secure-state' })
    const assign = vi.fn()
    vi.stubGlobal('window', { crypto: window.crypto, location: { assign } })
    await startSignIn('login')

    expect(assign).toHaveBeenCalledWith('https://identity.example.test/authorize?state=secure-state')
    expect(oidcMocks.createSigninRequest).toHaveBeenCalledWith(expect.objectContaining({ request_type: 'si:r', nonce: expect.any(String) }))
  })

  it('preserves the Keycloak registration prompt in the generated secure request', async () => {
    oidcMocks.createSigninRequest.mockResolvedValue({ url: 'https://identity.example.test/authorize?prompt=create' })
    const assign = vi.fn()
    vi.stubGlobal('window', { crypto: window.crypto, location: { assign } })

    await startSignIn('register')

    expect(oidcMocks.createSigninRequest).toHaveBeenCalledWith(expect.objectContaining({ extraQueryParams: { prompt: 'create' } }))
    expect(assign).toHaveBeenCalledWith('https://identity.example.test/authorize?prompt=create')
  })
})
