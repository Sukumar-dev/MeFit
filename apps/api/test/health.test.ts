import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('API foundation', () => {
  it('returns a liveness response with security headers', async () => {
    const response = await request(createApp()).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })

  it('returns a consistent not-found response for unknown routes', async () => {
    const response = await request(createApp()).get('/unknown')
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})
