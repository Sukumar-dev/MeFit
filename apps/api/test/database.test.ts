import '../src/env.js'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'

describe('PostgreSQL development data', () => {
  afterAll(async () => prisma.$disconnect())

  it('persists the seeded catalog records in PostgreSQL', async () => {
    // The seed owns the shared catalog. Browser tests also create user-authored items.
    const [exerciseCount, workoutCount, programCount] = await Promise.all([
      prisma.exercise.count({ where: { archivedAt: null, creatorId: null } }),
      prisma.workout.count({ where: { archivedAt: null, creatorId: null } }),
      prisma.program.count({ where: { archivedAt: null, creatorId: null } }),
    ])

    expect(exerciseCount).toBe(8)
    expect(workoutCount).toBe(4)
    expect(programCount).toBe(2)
  })
})
