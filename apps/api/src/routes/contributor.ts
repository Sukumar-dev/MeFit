import { Router } from 'express'
import { requireAuth, requireRole } from '../auth/authorization.js'
import { prisma } from '../db.js'
import { z } from 'zod'

const router = Router()
const secureUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Media URLs must use HTTPS.')
const exerciseSchema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(2000), target_muscle_group: z.string().trim().min(2).max(80), image_url: secureUrl.optional(), video_url: secureUrl.optional() }).strict()
const setSchema = z.object({ repetitions: z.number().int().min(1).max(500).nullable().optional(), duration_seconds: z.number().int().min(1).max(7200).nullable().optional(), rest_seconds: z.number().int().min(0).max(3600).nullable().optional(), load_kg: z.number().min(0).max(1000).nullable().optional() }).strict()
const workoutSchema = z.object({ name: z.string().trim().min(2).max(120), type: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(2000), exercises: z.array(z.object({ exercise_id: z.string().uuid(), position: z.number().int().min(0).max(99), sets: z.array(setSchema).min(1).max(30) }).strict()).min(1).max(100) }).strict()
const programSchema = z.object({ name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(2000), workout_ids: z.array(z.string().uuid()).min(1).max(100) }).strict()

async function mayEdit(type: 'exercise' | 'workout' | 'program', id: string, actorId: string, isAdmin: boolean) {
  const record = type === 'exercise'
    ? await prisma.exercise.findUnique({ where: { id }, select: { id: true, creatorId: true } })
    : type === 'workout'
      ? await prisma.workout.findUnique({ where: { id }, select: { id: true, creatorId: true } })
      : await prisma.program.findUnique({ where: { id }, select: { id: true, creatorId: true } })
  return { exists: Boolean(record), allowed: Boolean(record && (isAdmin || record.creatorId === actorId)) }
}

function invalid(response: Parameters<Parameters<typeof router.post>[1]>[1], message: string) {
  return response.status(400).json({ error: { code: 'INVALID_INPUT', message } })
}

router.post('/exercise', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  const parsed = exerciseSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check the exercise fields and HTTPS media links.')
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const item = await prisma.exercise.create({ data: { name: parsed.data.name, description: parsed.data.description, targetMuscleGroup: parsed.data.target_muscle_group, imageUrl: parsed.data.image_url ?? null, videoUrl: parsed.data.video_url ?? null, creatorId: actor.id } })
    response.status(201).location(`${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/exercises/${item.id}`).json({ id: item.id, name: item.name })
  } catch (error) { next(error) }
})

router.get('/contributor/content', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const [exercises, workouts, programs] = await Promise.all([
      prisma.exercise.findMany({ where: { creatorId: actor.id }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, targetMuscleGroup: true, archivedAt: true } }),
      prisma.workout.findMany({ where: { creatorId: actor.id }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, type: true, archivedAt: true } }),
      prisma.program.findMany({ where: { creatorId: actor.id }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, category: true, archivedAt: true } }),
    ])
    response.json({ exercises, workouts, programs })
  } catch (error) { next(error) }
})

router.patch('/exercise/:id', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  const parsed = exerciseSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check the exercise fields and HTTPS media links.')
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const { exists, allowed } = await mayEdit('exercise', request.params.id as string, actor.id, request.auth!.roles.includes('ADMIN'))
    if (!exists) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested exercise was not found.' } })
    if (!allowed) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may edit only exercises you contributed.' } })
    const item = await prisma.exercise.update({ where: { id: request.params.id as string }, data: { name: parsed.data.name, description: parsed.data.description, targetMuscleGroup: parsed.data.target_muscle_group, imageUrl: parsed.data.image_url ?? null, videoUrl: parsed.data.video_url ?? null } })
    response.json({ id: item.id, name: item.name })
  } catch (error) { next(error) }
})

router.delete('/exercise/:id', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const { exists, allowed } = await mayEdit('exercise', request.params.id as string, actor.id, request.auth!.roles.includes('ADMIN'))
    if (!exists) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested exercise was not found.' } })
    if (!allowed) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may archive only exercises you contributed.' } })
    await prisma.exercise.update({ where: { id: request.params.id as string }, data: { archivedAt: new Date() } })
    response.sendStatus(204)
  } catch (error) { next(error) }
})

router.post('/workout', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  const parsed = workoutSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check workout details, exercise IDs, positions, and sets.')
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const item = await prisma.workout.create({ data: { name: parsed.data.name, type: parsed.data.type, description: parsed.data.description, creatorId: actor.id, exercises: { create: parsed.data.exercises.map((exercise) => ({ position: exercise.position, exerciseId: exercise.exercise_id, sets: { create: exercise.sets.map((set, position) => ({ position, repetitions: set.repetitions ?? null, durationSeconds: set.duration_seconds ?? null, restSeconds: set.rest_seconds ?? null, loadKg: set.load_kg ?? null })) } })) } } })
    response.status(201).location(`${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/workout/${item.id}`).json({ id: item.id, name: item.name })
  } catch (error) { next(error) }
})

router.patch('/workout/:id', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  const parsed = workoutSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check workout details, exercise IDs, positions, and sets.')
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const { exists, allowed } = await mayEdit('workout', request.params.id as string, actor.id, request.auth!.roles.includes('ADMIN'))
    if (!exists) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested workout was not found.' } })
    if (!allowed) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may edit only workouts you contributed.' } })
    const item = await prisma.$transaction(async (tx) => {
      await tx.workoutExercise.deleteMany({ where: { workoutId: request.params.id as string } })
      return tx.workout.update({
        where: { id: request.params.id as string },
        data: {
          name: parsed.data.name,
          type: parsed.data.type,
          description: parsed.data.description,
          archivedAt: null,
          exercises: {
            create: parsed.data.exercises.map((exercise) => ({
              position: exercise.position,
              exerciseId: exercise.exercise_id,
              sets: {
                create: exercise.sets.map((set, position) => ({
                  position,
                  repetitions: set.repetitions ?? null,
                  durationSeconds: set.duration_seconds ?? null,
                  restSeconds: set.rest_seconds ?? null,
                  loadKg: set.load_kg ?? null,
                })),
              },
            })),
          },
        },
      })
    })
    response.json({ id: item.id, name: item.name })
  } catch (error) { next(error) }
})

router.delete('/workout/:id', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const { exists, allowed } = await mayEdit('workout', request.params.id as string, actor.id, request.auth!.roles.includes('ADMIN'))
    if (!exists) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested workout was not found.' } })
    if (!allowed) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may archive only workouts you contributed.' } })
    await prisma.workout.update({ where: { id: request.params.id as string }, data: { archivedAt: new Date() } })
    response.sendStatus(204)
  } catch (error) { next(error) }
})

router.post('/program', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  const parsed = programSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check the program fields and select at least one workout.')
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const workouts = await prisma.workout.count({ where: { id: { in: parsed.data.workout_ids }, archivedAt: null } })
    if (workouts !== new Set(parsed.data.workout_ids).size) return invalid(response, 'One or more selected workouts are unavailable.')
    const item = await prisma.program.create({ data: { name: parsed.data.name, category: parsed.data.category, description: parsed.data.description, creatorId: actor.id, workouts: { create: [...new Set(parsed.data.workout_ids)].map((workoutId, position) => ({ workoutId, position })) } } })
    response.status(201).location(`${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/program/${item.id}`).json({ id: item.id, name: item.name })
  } catch (error) { next(error) }
})

router.patch('/program/:id', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  const parsed = programSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check the program fields and select at least one workout.')
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const { exists, allowed } = await mayEdit('program', request.params.id as string, actor.id, request.auth!.roles.includes('ADMIN'))
    if (!exists) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested program was not found.' } })
    if (!allowed) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may edit only programs you contributed.' } })
    const uniqueIds = [...new Set(parsed.data.workout_ids)]
    const workouts = await prisma.workout.count({ where: { id: { in: uniqueIds }, archivedAt: null } })
    if (workouts !== uniqueIds.length) return invalid(response, 'One or more selected workouts are unavailable.')
    const item = await prisma.$transaction(async (tx) => {
      await tx.programWorkout.deleteMany({ where: { programId: request.params.id as string } })
      return tx.program.update({ where: { id: request.params.id as string }, data: { name: parsed.data.name, category: parsed.data.category, description: parsed.data.description, archivedAt: null, workouts: { create: uniqueIds.map((workoutId, position) => ({ workoutId, position })) } } })
    })
    response.json({ id: item.id, name: item.name })
  } catch (error) { next(error) }
})

router.delete('/program/:id', requireAuth, requireRole('CONTRIBUTOR'), async (request, response, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const { exists, allowed } = await mayEdit('program', request.params.id as string, actor.id, request.auth!.roles.includes('ADMIN'))
    if (!exists) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested program was not found.' } })
    if (!allowed) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may archive only programs you contributed.' } })
    await prisma.program.update({ where: { id: request.params.id as string }, data: { archivedAt: new Date() } })
    response.sendStatus(204)
  } catch (error) { next(error) }
})

export default router
