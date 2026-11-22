import assert from 'node:assert/strict'
import test from 'node:test'
import { createProfileHandler } from '../api/fitness-profile.mjs'

const subject = '00000000-0000-4000-8000-000000000001'
const valid = {
  display_name: 'Taylor', avatar_url: null, height_cm: null, weight_kg: 73,
  timezone: 'UTC', days_available: 3, minutes_per_workout: 30,
  current_activity: 'light', experience: 'beginner',
}

async function call({ authorization = 'Bearer test', method = 'GET', url = '/fitness-api/profile', body, aal = 'aal2', invalid = false } = {}) {
  let request
  const handler = createProfileHandler({
    verify: async () => { if (invalid) throw new Error('invalid'); return { sub: subject, aal } },
    fetchProfile: async (...args) => { request = args; return [{ id: subject }] },
  })
  const response = { setHeader() {}, status(code) { this.code = code; return this }, json(value) { this.value = value } }
  await handler({ headers: { authorization }, method, url, body }, response)
  return { ...response, request }
}

test('SEC-01 profile rejects missing or invalid credentials and requires MFA', async () => {
  assert.equal((await call({ authorization: '' })).code, 401)
  assert.equal((await call({ invalid: true })).code, 401)
  assert.equal((await call({ aal: 'aal1' })).code, 403)
})

test('API-01 rejects query parameters and API-04 uses the authenticated ID', async () => {
  assert.equal((await call({ url: '/fitness-api/profile?id=other' })).code, 400)
  const response = await call({ method: 'PUT', body: valid })
  assert.equal(response.code, 200)
  assert.deepEqual(response.request, [subject, 'test', valid])
})

test('SEC-02 rejects identity overrides and non-HTTPS avatars before issuing a data request', async () => {
  for (const body of [{ ...valid, id: subject }, { ...valid, avatar_url: 'http://example.test/photo' }]) {
    const response = await call({ method: 'PUT', body })
    assert.equal(response.code, 400)
    assert.equal(response.request, undefined)
  }
})

test('SEC-02 passes punctuation and harmless markup as structured profile data', async () => {
  const profile = { ...valid, display_name: "O'Connor <strong>Training</strong>" }
  const response = await call({ method: 'PUT', body: profile })
  assert.equal(response.code, 200)
  assert.deepEqual(response.request, [subject, 'test', profile])
})
