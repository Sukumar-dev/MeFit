import express from 'express'
import request from 'supertest'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../src/env.js'
import { createAuthMiddleware, hasRole, requireRole } from '../src/auth/authorization.js'

const issuer = process.env.OIDC_ISSUER ?? 'http://localhost:8080/realms/mefit'
const audience = process.env.OIDC_AUDIENCE ?? 'mefit-api'

describe('bearer authentication and role authorization', () => {
  let privateKey: CryptoKey
  let middleware: ReturnType<typeof createAuthMiddleware>

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256')
    privateKey = pair.privateKey
    const publicJwk = await exportJWK(pair.publicKey)
    publicJwk.kid = 'test-key'
    publicJwk.alg = 'RS256'
    publicJwk.use = 'sig'
    middleware = createAuthMiddleware(createLocalJWKSet({ keys: [publicJwk] }))
  })

  afterAll(() => undefined)

  async function token(roles: string[] = ['USER'], tokenAudience = audience, identity: Record<string, string> = { name: 'Test Person', given_name: 'Test', family_name: 'Person' }) {
    return new SignJWT({ email: 'person@example.test', ...identity, email_verified: true, realm_access: { roles } })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(tokenAudience)
      .setSubject('test-subject')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)
  }

  function testApp() {
    const app = express()
    app.get('/protected', middleware, (request_, response) => response.json({ subject: request_.auth?.subject, email: request_.auth?.email, displayName: request_.auth?.displayName, firstName: request_.auth?.firstName, lastName: request_.auth?.lastName, roles: request_.auth?.roles }))
    app.get('/contributor', middleware, requireRole('CONTRIBUTOR'), (_request, response) => response.sendStatus(204))
    app.get('/admin', middleware, requireRole('ADMIN'), (_request, response) => response.sendStatus(204))
    return app
  }

  it('rejects requests without a bearer token', async () => {
    const response = await request(testApp()).get('/protected')
    expect(response.status).toBe(401)
  })

  it('verifies a signed token and extracts the user identity and roles', async () => {
    const response = await request(testApp()).get('/protected').set('Authorization', `Bearer ${await token()}`)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ subject: 'test-subject', email: 'person@example.test', displayName: 'Test Person', firstName: 'Test', lastName: 'Person', roles: ['USER'] })
  })

  it('keeps an absent provider name empty instead of substituting the email address', async () => {
    const response = await request(testApp()).get('/protected').set('Authorization', `Bearer ${await token(['USER'], audience, {})}`)
    expect(response.status).toBe(200)
    expect(response.body.displayName).toBe('')
    expect(response.body.firstName).toBeUndefined()
  })

  it('rejects a token for a different API audience', async () => {
    const response = await request(testApp()).get('/protected').set('Authorization', `Bearer ${await token(['USER'], 'another-api')}`)
    expect(response.status).toBe(401)
  })

  it('allows admins to use contributor routes but denies regular users', async () => {
    expect(hasRole(['ADMIN'], 'CONTRIBUTOR')).toBe(true)
    expect((await request(testApp()).get('/contributor').set('Authorization', `Bearer ${await token(['USER'])}`)).status).toBe(403)
    expect((await request(testApp()).get('/contributor').set('Authorization', `Bearer ${await token(['ADMIN'])}`)).status).toBe(204)
  })

  it('restricts administrator operations to administrators', async () => {
    expect((await request(testApp()).get('/admin').set('Authorization', `Bearer ${await token(['CONTRIBUTOR'])}`)).status).toBe(403)
    expect((await request(testApp()).get('/admin').set('Authorization', `Bearer ${await token(['ADMIN'])}`)).status).toBe(204)
  })
})
