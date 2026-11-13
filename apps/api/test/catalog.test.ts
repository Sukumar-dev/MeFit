import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('public fitness catalog', () => {
  const app = createApp()

  it('returns exercises grouped by target muscle with search only as a query option', async () => {
    const response = await request(app).get('/api/exercises').expect(200)
    expect(response.body.total).toBeGreaterThanOrEqual(8)
    expect(response.body.groups[0].target_muscle_group).toBeTruthy()
    expect(response.body.groups[0].exercises[0]).toHaveProperty('name')
    await request(app).get('/api/exercises?unknown=yes').expect(400)
    const filtered = await request(app).get('/api/exercises?search=Squat').expect(200)
    expect(filtered.body.total).toBe(1)
  })

  it('returns workout detail including ordered exercise sets', async () => {
    const list = await request(app).get('/api/workouts').expect(200)
    const id = list.body.groups[0].workouts[0].id as string
    const detail = await request(app).get(`/api/workout/${id}`).expect(200)
    expect(detail.body.exercises.length).toBeGreaterThan(0)
    expect(detail.body.exercises[0].sets[0]).toHaveProperty('repetitions')
  })

  it('returns programs grouped by category with ordered workout details', async () => {
    const list = await request(app).get('/api/programs').expect(200)
    expect(list.body.total).toBeGreaterThanOrEqual(2)
    const id = list.body.groups[0].programs[0].id as string
    const detail = await request(app).get(`/api/program/${id}`).expect(200)
    expect(detail.body.workouts.length).toBeGreaterThan(0)
    expect(detail.body.workouts[0].position).toBe(0)
  })
})
