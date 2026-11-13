import '../src/env.js'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db.js'

describe('API readiness', () => {
  afterAll(async () => prisma.$disconnect())

  it('reports ready only after a successful PostgreSQL query', async () => {
    const response = await request(createApp()).get('/ready')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ready' })
  })
})
