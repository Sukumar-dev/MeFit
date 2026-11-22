import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/fitness-batch.mjs'
import { matchRoute, routes } from '../server/fitness-contract.mjs'

const base = process.env.SRS_PREVIEW_URL
async function request(method, url) {
  if (base) {
    const response = await fetch(new URL(url, base), { method, redirect: 'manual', signal: AbortSignal.timeout(12000) })
    assert.match(response.headers.get('content-type'), /application\/json/)
    return response.status
  }
  const response = { setHeader() {}, status(code) { this.code = code; return this }, json() {} }
  await handler({ url, method, headers: {} }, response)
  return response.code
}

for (const [method, path, role] of routes) {
  test(`Anonymous ${method} /fitness-api/${path}`, async () => {
    const concrete = path.replace(/:\w+/g, '00000000-0000-4000-8000-000000000001')
    assert.equal(matchRoute(method, concrete)?.[2], role)
    assert.equal(await request(method, '/fitness-api/' + concrete), role === 'public' ? 200 : 401)
  })
}

test('API-01 rejects query parameters on health', async () => {
  assert.equal(await request('GET', '/fitness-api/health?unsupported=true'), 400)
})

test('API-08 unknown routes return JSON 404', async () => {
  assert.equal(await request('GET', '/fitness-api/unknown'), 404)
})
