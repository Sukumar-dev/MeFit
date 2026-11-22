import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const oidcMocks = vi.hoisted(() => ({
  settings: undefined as Record<string, unknown> | undefined,
  createSigninRequest: vi.fn(),
  readSigninResponseState: vi.fn(),
  processSigninResponse: vi.fn(),
}))

vi.mock('oidc-client-ts', () => ({
  OidcClient: class {
    constructor(settings: Record<string, unknown>) {
      oidcMocks.settings = settings
    }
    readSigninResponseState(url: string) {
      return oidcMocks.readSigninResponseState(url)
    }
    processSigninResponse(url: string) {
      return oidcMocks.processSigninResponse(url)
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

import { finishLegacyAccountLink, startLegacyAccountLink, startSignIn } from './oidc'

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

describe('legacy sign-in for account linking', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    oidcMocks.readSigninResponseState.mockReset()
    oidcMocks.processSigninResponse.mockReset()
  })

  it('requests fresh Keycloak authentication with dedicated, account-bound OAuth state', async () => {
    oidcMocks.createSigninRequest.mockResolvedValue({ url: 'https://identity.example.test/authorize' })
    const assign = vi.fn()
    vi.stubGlobal('window', { crypto: window.crypto, location: { assign, origin: 'https://app.example.test' } })

    await startLegacyAccountLink('supabase-subject')

    expect(oidcMocks.createSigninRequest).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'login', request_type: 'account-link', scope: 'openid mefit-api-audience',
      redirect_uri: 'https://app.example.test/auth/link/callback',
      state: { supabaseSubject: 'supabase-subject' },
    }))
    expect(assign).toHaveBeenCalledWith('https://identity.example.test/authorize')
  })

  it('refuses to exchange a code if the Supabase account changed', async () => {
    oidcMocks.readSigninResponseState.mockResolvedValue({
      state: { request_type: 'account-link', data: { supabaseSubject: 'previous-account' } },
    })
    await expect(finishLegacyAccountLink('https://app.example.test/auth/link/callback', 'new-account')).rejects.toThrow('different session')
    expect(oidcMocks.processSigninResponse).not.toHaveBeenCalled()
  })

  it('exchanges an authorization code for the original Supabase account', async () => {
    const callback = 'https://app.example.test/auth/link/callback'
    oidcMocks.readSigninResponseState.mockResolvedValue({
      state: { request_type: 'account-link', data: { supabaseSubject: 'supabase-subject' } },
    })
    oidcMocks.processSigninResponse.mockResolvedValue({ access_token: 'test-legacy-token' })

    await expect(finishLegacyAccountLink(callback, 'supabase-subject')).resolves.toBe('test-legacy-token')
    expect(oidcMocks.processSigninResponse).toHaveBeenCalledWith(callback)
  })
})
