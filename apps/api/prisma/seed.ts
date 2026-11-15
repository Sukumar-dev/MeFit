import '../src/env.js'
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/db.js'

const exercises = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Bodyweight Squat', targetMuscleGroup: 'Legs', description: 'Sit hips back and bend knees, then stand with control.', imageUrl: '/images/exercises/bodyweight-squat.webp' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Glute Bridge', targetMuscleGroup: 'Glutes', description: 'Lift hips by squeezing glutes while keeping ribs relaxed.', imageUrl: '/images/exercises/glute-bridge.webp' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Incline Push-up', targetMuscleGroup: 'Chest', description: 'Keep a straight body line and lower the chest toward a sturdy raised surface.', imageUrl: '/images/exercises/incline-push-up.webp' },
  { id: '10000000-0000-4000-8000-000000000004', name: 'Bird Dog', targetMuscleGroup: 'Core', description: 'From hands and knees, extend opposite arm and leg without rotating the hips.', imageUrl: '/images/exercises/bird-dog.webp' },
  { id: '10000000-0000-4000-8000-000000000005', name: 'Dead Bug', targetMuscleGroup: 'Core', description: 'Lower opposite arm and leg while keeping the lower back comfortably supported.', imageUrl: '/images/exercises/dead-bug.webp' },
  { id: '10000000-0000-4000-8000-000000000006', name: 'Step-back Lunge', targetMuscleGroup: 'Legs', description: 'Step one foot back, bend both knees within a comfortable range, then return.', imageUrl: '/images/exercises/step-back-lunge.webp' },
  { id: '10000000-0000-4000-8000-000000000007', name: 'March in Place', targetMuscleGroup: 'Cardio', description: 'March at a comfortable pace while standing tall.', imageUrl: '/images/exercises/march-in-place.webp' },
  { id: '10000000-0000-4000-8000-000000000008', name: 'Wall Push-up', targetMuscleGroup: 'Chest', description: 'Place hands on a wall and bend elbows to bring the chest closer, then press away.', imageUrl: '/images/exercises/wall-push-up.webp' },
]

const workouts = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Foundation Strength A', type: 'Strength', description: 'A gentle whole-body strength session using controlled bodyweight movements.', positions: [0, 2, 1] },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Core and Balance', type: 'Stability', description: 'A low-impact session focused on controlled trunk and balance movements.', positions: [3, 4] },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Low-impact Movement', type: 'Cardio', description: 'A short, adjustable low-impact movement session.', positions: [6, 5] },
  { id: '20000000-0000-4000-8000-000000000004', name: 'Upper Body Basics', type: 'Strength', description: 'An adjustable upper-body session using raised or wall-supported push-ups.', positions: [7, 2] },
]

const programs = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Getting Started', category: 'Beginner', description: 'An introductory program with adjustable, low-impact sessions.', workoutIds: [workouts[0]!.id, workouts[1]!.id, workouts[2]!.id] },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Strength Foundations', category: 'Strength', description: 'Build a repeatable base with basic strength and core sessions.', workoutIds: [workouts[0]!.id, workouts[3]!.id] },
]

async function main() {
  for (const exercise of exercises) {
    await prisma.exercise.upsert({ where: { id: exercise.id }, create: exercise, update: exercise })
  }

  for (const workout of workouts) {
    await prisma.workout.upsert({
      where: { id: workout.id },
      create: {
        id: workout.id,
        name: workout.name,
        type: workout.type,
        description: workout.description,
        exercises: {
          create: workout.positions.map((exercisePosition, position) => ({
            position,
            exercise: { connect: { id: exercises[exercisePosition]!.id } },
            sets: { create: [{ position: 0, repetitions: 8 }] },
          })),
        },
      },
      update: { name: workout.name, type: workout.type, description: workout.description, archivedAt: null },
    })
  }

  for (const program of programs) {
    await prisma.program.upsert({
      where: { id: program.id },
      create: {
        id: program.id,
        name: program.name,
        category: program.category,
        description: program.description,
        workouts: { create: program.workoutIds.map((workoutId, position) => ({ workoutId, position })) },
      },
      update: { name: program.name, category: program.category, description: program.description, archivedAt: null },
    })
  }

  await ensureKeycloakIdentityScopes()

  console.info(`Seeded ${exercises.length} exercises, ${workouts.length} workouts, and ${programs.length} programs.`)
}

async function ensureKeycloakIdentityScopes() {
  await prisma.$transaction(async (tx) => {
    const realms = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM realm WHERE name = 'mefit' LIMIT 1`
    const realmId = realms[0]?.id
    if (!realmId) throw new Error('Keycloak MeFit realm is missing; cannot provision identity scopes.')

    const webClients = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM client WHERE realm_id = ${realmId} AND client_id = 'mefit-web' LIMIT 1
    `
    const clientId = webClients[0]?.id
    if (!clientId) throw new Error('Keycloak mefit-web client is missing; cannot provision identity scopes.')

    const scopeDefinitions = [
      { name: 'profile', mappers: [
        { name: 'mefit-first-name', attribute: 'firstName', claim: 'given_name' },
        { name: 'mefit-last-name', attribute: 'lastName', claim: 'family_name' },
      ] },
      { name: 'email', mappers: [
        { name: 'mefit-email', attribute: 'email', claim: 'email' },
      ] },
    ]

    for (const scopeDefinition of scopeDefinitions) {
      await tx.$executeRaw`
        INSERT INTO client_scope (id, name, realm_id, protocol)
        VALUES (${randomUUID()}, ${scopeDefinition.name}, ${realmId}, 'openid-connect')
        ON CONFLICT (realm_id, name) DO NOTHING
      `
      const scopes = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM client_scope WHERE realm_id = ${realmId} AND name = ${scopeDefinition.name} LIMIT 1
      `
      const scopeId = scopes[0]?.id
      if (!scopeId) throw new Error(`Keycloak ${scopeDefinition.name} scope could not be created.`)

      await tx.$executeRaw`
        INSERT INTO client_scope_attributes (scope_id, name, value)
        VALUES (${scopeId}, 'include.in.token.scope', 'true'), (${scopeId}, 'display.on.consent.screen', 'false')
        ON CONFLICT (scope_id, name) DO UPDATE SET value = EXCLUDED.value
      `
      await tx.$executeRaw`
        INSERT INTO client_scope_client (client_id, scope_id, default_scope)
        VALUES (${clientId}, ${scopeId}, true)
        ON CONFLICT (client_id, scope_id) DO UPDATE SET default_scope = true
      `

      for (const mapper of scopeDefinition.mappers) {
        const existing = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM protocol_mapper WHERE client_scope_id = ${scopeId} AND name = ${mapper.name} LIMIT 1
        `
        const mapperId = existing[0]?.id ?? randomUUID()
        if (!existing[0]) {
          await tx.$executeRaw`
            INSERT INTO protocol_mapper (id, name, protocol, protocol_mapper_name, client_scope_id)
            VALUES (${mapperId}, ${mapper.name}, 'openid-connect', 'oidc-usermodel-property-mapper', ${scopeId})
          `
        }

        const config = [
          ['user.attribute', mapper.attribute],
          ['claim.name', mapper.claim],
          ['jsonType.label', 'String'],
          ['id.token.claim', 'true'],
          ['access.token.claim', 'true'],
          ['userinfo.token.claim', 'true'],
        ] as const
        for (const [name, value] of config) {
          await tx.$executeRaw`
            INSERT INTO protocol_mapper_config (protocol_mapper_id, name, value)
            VALUES (${mapperId}, ${name}, ${value})
            ON CONFLICT (protocol_mapper_id, name) DO UPDATE SET value = EXCLUDED.value
          `
        }
      }
    }
  })
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
