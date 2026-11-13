import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('goal API protection', () => {
  const app = createApp()

  it('requires a verified identity for goal creation and current progress', async () => {
    await request(app).get('/api/goal/current').expect(401)
    await request(app).get('/api/goal').expect(401)
    await request(app).post('/api/goal').send({}).expect(401)
  })

  it('requires authentication before marking a workout complete', async () => {
    const response = await request(app).post('/api/goal/00000000-0000-4000-8000-000000000001/workouts/00000000-0000-4000-8000-000000000002/complete').expect(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('protects contributor writes and administrative review routes', async () => {
    await request(app).post('/api/exercise').send({}).expect(401)
    await request(app).get('/api/contributor/content').expect(401)
    await request(app).get('/api/admin/users').expect(401)
    await request(app).get('/api/admin/contributor-requests').expect(401)
    await request(app).patch('/api/admin/user/00000000-0000-4000-8000-000000000001/roles').send({ roles: ['USER'] }).expect(401)
  })

  it('protects profile read and write operations', async () => {
    await request(app).get('/api/profile').expect(401)
    await request(app).put('/api/profile').send({}).expect(401)
    await request(app).post('/api/contributor-request').send({}).expect(401)
  })
})
