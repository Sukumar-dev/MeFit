import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

const validRequest = {
  redirect_uri: 'http://localhost:5173/auth/callback',
  state: 'state_abcdefghijklmnopqrstuvwxyz012345',
  nonce: 'nonce_abcdefghijklmnopqrstuvwxyz0123',
  code_challenge: 'a'.repeat(43),
  flow: 'login',
}

describe('OIDC login bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('waits for the identity provider to finish a cold start in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const providerMetadata = { issuer: 'http://localhost:8080/realms/mefit' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('starting', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(providerMetadata), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(createApp()).post('/api/login').send(validRequest)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(response.body.authorization_url).toContain('/protocol/openid-connect/auth?')
  })

  it('returns an authorization-code URL with the supplied PKCE challenge', async () => {
    const response = await request(createApp()).post('/api/login').send(validRequest)
    expect(response.status).toBe(200)
    const authorizationUrl = new URL(response.body.authorization_url as string)
    expect(authorizationUrl.origin).toBe('http://localhost:8080')
    expect(authorizationUrl.searchParams.get('client_id')).toBe('mefit-web')
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code')
    expect(authorizationUrl.searchParams.get('scope')).toBe('openid profile email mefit-api-audience')
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe(validRequest.code_challenge)
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(validRequest.redirect_uri)
  })

  it('starts the provider registration action when requested', async () => {
    const response = await request(createApp()).post('/api/login').send({ ...validRequest, flow: 'register' })
    expect(response.status).toBe(200)
    expect(new URL(response.body.authorization_url as string).searchParams.get('prompt')).toBe('create')
  })

  it('rejects an untrusted callback URL', async () => {
    const response = await request(createApp()).post('/api/login').send({ ...validRequest, redirect_uri: 'https://attacker.example/callback' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REDIRECT')
  })

  it('rejects malformed PKCE input', async () => {
    const response = await request(createApp()).post('/api/login').send({ ...validRequest, code_challenge: 'not-a-valid-challenge' })
    expect(response.status).toBe(400)
  })
})
