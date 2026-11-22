import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import request from 'supertest'
import { expect, it, vi } from 'vitest'

it('links both sign-ins without changing account data and preserves access through Keycloak', async () => {
  const database = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost')
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname)
  const keycloakKey = await generateKeyPair('RS256')
  const supabaseKey = await generateKeyPair('ES256')
  const keycloakJwk = { ...await exportJWK(keycloakKey.publicKey), kid: 'legacy', alg: 'RS256' }
  const supabaseJwk = { ...await exportJWK(supabaseKey.publicKey), kid: 'supabase', alg: 'ES256' }
  const legacySubject = randomUUID()
  const supabaseSubject = randomUUID()
  const email = `account-link-${legacySubject}@example.test`
  let confirmedAt: string | null = null
  const provider = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/legacy/protocol/openid-connect/certs') return res.end(JSON.stringify({ keys: [keycloakJwk] }))
    if (req.url === '/auth/v1/.well-known/jwks.json') return res.end(JSON.stringify({ keys: [supabaseJwk] }))
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: supabaseSubject, email, email_confirmed_at: confirmedAt }))
    res.writeHead(404).end()
  })
  await new Promise<void>((resolve, reject) => {
    provider.once('error', reject)
    provider.listen(0, '127.0.0.1', resolve)
  })
  const origin = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`
  const legacyIssuer = `${origin}/legacy`
  vi.stubEnv('AUTH_PROVIDER', 'dual')
  vi.stubEnv('OIDC_ISSUER', legacyIssuer)
  vi.stubEnv('OIDC_AUDIENCE', 'mefit-api')
  vi.stubEnv('SUPABASE_URL', origin)
  vi.stubEnv('SUPABASE_JWT_ISSUER', `${origin}/auth/v1`)
  vi.stubEnv('SUPABASE_JWT_AUDIENCE', 'authenticated')
  vi.stubEnv('SUPABASE_JWKS_URL', `${origin}/auth/v1/.well-known/jwks.json`)
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'local-test-publishable-key')

  const makeSupabaseToken = (subject: string, tokenEmail: string, aal = 'aal2') =>
    new SignJWT({ email: tokenEmail, aal, user_metadata: { display_name: 'Replacement name' } })
      .setProtectedHeader({ alg: 'ES256', kid: 'supabase' }).setIssuer(`${origin}/auth/v1`)
      .setAudience('authenticated').setSubject(subject).setExpirationTime('5m').sign(supabaseKey.privateKey)

  const legacyToken = await new SignJWT({ email, realm_access: { roles: ['USER'] } })
    .setProtectedHeader({ alg: 'RS256', kid: 'legacy' }).setIssuer(legacyIssuer)
    .setAudience('mefit-api').setSubject(legacySubject).setExpirationTime('5m').sign(keycloakKey.privateKey)
  const legacyAuth = `Bearer ${legacyToken}`
  const supabaseAuth = `Bearer ${await makeSupabaseToken(supabaseSubject, email.toUpperCase())}`
  const freshSubject = randomUUID()
  const freshAuth = `Bearer ${await makeSupabaseToken(freshSubject, `${freshSubject}@example.test`)}`
  const profile = {
    timezone: 'UTC',
    readiness: { days_available: 3, minutes_per_session: 30, activity_level: 'light', experience: 'beginner', limitations: false },
  }
  const { prisma } = await import('../src/db.js')
  let rollbackDb: typeof prisma | undefined
  try {
    await prisma.user.create({
      data: {
        oidcSubject: legacySubject, email, displayName: 'Original name',
        roles: { create: { role: 'USER' } },
        profile: { create: { timezone: 'UTC', address: { create: { line1: 'Test address', city: 'Test city', country: 'Test country' } } } },
      },
    })
    const snapshot = () => prisma.user.findUniqueOrThrow({
      where: { oidcSubject: legacySubject },
      include: { roles: true, profile: { include: { address: true } } },
    })
    const before = await snapshot()
    const api = request((await import('../src/app.js')).createApp())
    const link = (legacyAccessToken = legacyToken) =>
      api.post('/api/user/link').set('Authorization', supabaseAuth).send({ legacy_access_token: legacyAccessToken })

    expect((await api.get('/ready')).status).toBe(200)
    expect((await api.get('/api/profile').set('Authorization', legacyAuth)).body.id).toBe(before.profile?.id)
    expect((await api.get('/api/profile')).status).toBe(401)
    const expiredLegacyToken = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'RS256', kid: 'legacy' }).setIssuer(legacyIssuer)
      .setAudience('mefit-api').setSubject(legacySubject).setExpirationTime('1 minute ago').sign(keycloakKey.privateKey)
    expect((await api.get('/api/profile').set('Authorization', `Bearer ${expiredLegacyToken}`)).status).toBe(401)

    for (const overrides of [
      { issuer: legacyIssuer, audience: 'mefit-api', expiration: '5m' },
      { issuer: `${origin}/auth/v1`, audience: 'mefit-api', expiration: '5m' },
      { issuer: `${origin}/auth/v1`, audience: 'authenticated', expiration: '2 minutes ago' },
      { issuer: `${origin}/untrusted`, audience: 'authenticated', expiration: '5m' },
    ]) {
      const wrongToken = await new SignJWT({ email, aal: 'aal2' })
        .setProtectedHeader({ alg: 'ES256', kid: 'supabase' }).setIssuer(overrides.issuer)
        .setAudience(overrides.audience).setSubject(supabaseSubject).setExpirationTime(overrides.expiration)
        .sign(supabaseKey.privateKey)
      expect((await api.get('/api/profile').set('Authorization', `Bearer ${wrongToken}`)).status).toBe(401)
    }
    expect((await api.post('/api/user').set('Authorization', supabaseAuth)).body.error.code).toBe('ACCOUNT_LINK_REQUIRED')
    expect((await api.get('/api/profile').set('Authorization', supabaseAuth)).status).toBe(404)
    expect((await link('invalid')).status).toBe(401)
    expect((await link()).body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED')
    confirmedAt = new Date().toISOString()
    const oneFactor = await makeSupabaseToken(supabaseSubject, email, 'aal1')
    expect((await api.post('/api/user/link').set('Authorization', `Bearer ${oneFactor}`)
      .send({ legacy_access_token: legacyToken })).status).toBe(403)

    const concurrentLinks = await Promise.all([link(), link()])
    expect(concurrentLinks.map(({ status }) => status)).toEqual([204, 204])
    const otherAuth = `Bearer ${await makeSupabaseToken(randomUUID(), email)}`
    expect((await api.post('/api/user/link').set('Authorization', otherAuth)
      .send({ legacy_access_token: legacyToken })).status).toBe(409)
    const existing = await api.post('/api/user').set('Authorization', supabaseAuth)
    expect(existing.status).toBe(200)
    expect(existing.body).toMatchObject({ id: before.id, display_name: 'Original name', has_profile: true })
    const linkedProfile = await api.get('/api/profile').set('Authorization', supabaseAuth)
    expect(linkedProfile.status).toBe(200)
    expect(linkedProfile.body.id).toBe(before.profile?.id)
    expect(await snapshot()).toEqual(before)
    expect((await api.get('/api/admin/users').set('Authorization', legacyAuth)).status).toBe(403)
    expect((await api.get('/api/admin/users').set('Authorization', supabaseAuth)).status).toBe(403)

    expect((await api.post('/api/user').set('Authorization', freshAuth)).status).toBe(201)
    const created = await api.post('/api/profile').set('Authorization', freshAuth).send(profile)
    expect(created.status).toBe(200)
    const changed = await api.put('/api/profile').set('Authorization', freshAuth).send({ ...profile, timezone: 'Europe/London' })
    expect(changed.status).toBe(200)
    expect((await api.get('/api/profile').set('Authorization', freshAuth)).body)
      .toMatchObject({ id: created.body.id, timezone: 'Europe/London' })

    expect((await api.patch(`/api/user/${freshSubject}`).set('Authorization', freshAuth)
      .send({ display_name: 'Rollback frontend name' })).status).toBe(200)
    expect((await api.patch(`/api/user/${supabaseSubject}`).set('Authorization', freshAuth)
      .send({ display_name: 'Wrong account' })).status).toBe(404)

    const restored = request((await import('../src/app.js')).createApp())
    expect((await restored.get('/api/profile').set('Authorization', freshAuth)).body)
      .toMatchObject({ id: created.body.id, timezone: 'Europe/London' })
    expect((await restored.get('/api/profile').set('Authorization', legacyAuth)).body).toEqual(linkedProfile.body)
    expect((await restored.get('/api/profile').set('Authorization', supabaseAuth)).body).toEqual(linkedProfile.body)
    expect(await prisma.supabaseIdentity.count({ where: { subject: { in: [supabaseSubject, freshSubject] } } })).toBe(2)

    const freshOwner = await prisma.supabaseIdentity.findFirstOrThrow({ where: { subject: freshSubject } })
    const review = await prisma.contributorRequest.create({ data: { userId: freshOwner.userId } })
    await prisma.userRole.create({ data: { userId: freshOwner.userId, role: 'ADMIN' } })
    const decisions = await Promise.all(['APPROVED', 'REJECTED'].map(status =>
      api.patch(`/api/admin/contributor-requests/${review.id}`).set('Authorization', freshAuth).send({ status }),
    ))
    expect(decisions.map(({ status }) => status).sort()).toEqual([200, 409])
    const decision = decisions.find(({ status }) => status === 200)!.body.status
    expect(await prisma.contributorRequest.findUnique({ where: { id: review.id } })).toMatchObject({ status: decision })
    expect(await prisma.userRole.count({ where: { userId: freshOwner.userId, role: 'CONTRIBUTOR' } }))
      .toBe(decision === 'APPROVED' ? 1 : 0)

    vi.stubEnv('AUTH_PROVIDER', 'keycloak')
    vi.resetModules()
    rollbackDb = (await import('../src/db.js')).prisma
    const rollback = request((await import('../src/app.js')).createApp())
    const legacyProfile = await rollback.get('/api/profile').set('Authorization', legacyAuth)
    expect(legacyProfile.status).toBe(200)
    expect(legacyProfile.body).toEqual(linkedProfile.body)
    expect(await snapshot()).toEqual(before)
  } finally {
    await prisma.user.deleteMany({ where: { OR: [{ oidcSubject: legacySubject }, { supabaseIdentity: { subject: freshSubject } }] } })
    await Promise.all([prisma.$disconnect(), rollbackDb?.$disconnect()])
    vi.unstubAllEnvs()
    await new Promise<void>((resolve) => provider.close(() => resolve()))
  }
}, 20_000)
