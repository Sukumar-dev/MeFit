import '../src/env.js'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'

describe('PostgreSQL development data', () => {
  afterAll(async () => prisma.$disconnect())

  it('persists the seeded catalog records in PostgreSQL', async () => {
    const [exerciseCount, workoutCount, programCount] = await Promise.all([
      prisma.exercise.count({ where: { archivedAt: null } }),
      prisma.workout.count({ where: { archivedAt: null } }),
      prisma.program.count({ where: { archivedAt: null } }),
    ])

    expect(exerciseCount).toBe(8)
    expect(workoutCount).toBe(4)
    expect(programCount).toBe(2)
  })
})
