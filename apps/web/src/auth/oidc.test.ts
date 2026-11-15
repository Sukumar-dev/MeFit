import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { startSignIn } from './oidc'

describe('production OIDC cold-start handling', () => {
  beforeEach(() => {
    oidcMocks.createSigninRequest.mockReset()
  })

  it('allows the identity provider time to wake before OIDC requests time out', () => {
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
})
