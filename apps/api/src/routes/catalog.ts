import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'

const router = Router()
const searchSchema = z.string().trim().max(100).optional()
function checkSearch(search: unknown) {
  const parsed = searchSchema.safeParse(search)
  return parsed.success ? parsed.data : null
}
function queryIsValid(query: Record<string, unknown>) {
  return Object.keys(query).every((key) => key === 'search')
}
function groupBy<T>(items: T[], key: (item: T) => string): Array<[string, T[]]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const label = key(item)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups.entries()]
}

router.get('/exercises', async (request, response, next) => {
  if (!queryIsValid(request.query)) return response.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Only the search query parameter is supported.' } })
  const search = checkSearch(request.query.search)
  if (search === null) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Search text must be 100 characters or fewer.' } })
  try {
    const exercises = await prisma.exercise.findMany({ where: { archivedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: [{ targetMuscleGroup: 'asc' }, { name: 'asc' }], select: { id: true, name: true, description: true, targetMuscleGroup: true, imageUrl: true, videoUrl: true } })
    const grouped = groupBy(exercises, (exercise) => exercise.targetMuscleGroup)
    response.json({ groups: grouped.map(([target_muscle_group, items]) => ({ target_muscle_group, exercises: items })), total: exercises.length })
  } catch (error) { next(error) }
})

router.get('/exercises/:exercise_id', async (request, response, next) => {
  try {
    const id = request.params.exercise_id as string
    const exercise = await prisma.exercise.findFirst({ where: { id, archivedAt: null }, select: { id: true, name: true, description: true, targetMuscleGroup: true, imageUrl: true, videoUrl: true } })
    if (!exercise) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested exercise was not found.' } })
    response.json(exercise)
  } catch (error) { next(error) }
})

router.get('/workouts', async (request, response, next) => {
  if (!queryIsValid(request.query)) return response.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Only the search query parameter is supported.' } })
  const search = checkSearch(request.query.search)
  if (search === null) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Search text must be 100 characters or fewer.' } })
  try {
    const workouts = await prisma.workout.findMany({ where: { archivedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: [{ type: 'asc' }, { name: 'asc' }], select: { id: true, name: true, type: true, description: true, _count: { select: { exercises: true } }, exercises: { orderBy: { position: 'asc' }, select: { exercise: { select: { id: true, name: true, imageUrl: true } } } } } })
    const groups = groupBy(workouts, (workout) => workout.type)
    response.json({ groups: groups.map(([type, items]) => ({ type, workouts: items.map(({ exercises, ...workout }) => ({ ...workout, exercises: exercises.map(({ exercise }) => ({ id: exercise.id, name: exercise.name, image_url: exercise.imageUrl })) })) })), total: workouts.length })
  } catch (error) { next(error) }
})

router.get('/workout/:workout_id', async (request, response, next) => {
  try {
    const id = request.params.workout_id as string
    const workout = await prisma.workout.findFirst({ where: { id, archivedAt: null }, include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: true, sets: { orderBy: { position: 'asc' } } } } } })
    if (!workout) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested workout was not found.' } })
    response.json({ id: workout.id, name: workout.name, type: workout.type, description: workout.description, exercises: workout.exercises.map((row) => ({ id: row.exercise.id, name: row.exercise.name, target_muscle_group: row.exercise.targetMuscleGroup, description: row.exercise.description, image_url: row.exercise.imageUrl, position: row.position, sets: row.sets.map((set) => ({ position: set.position, repetitions: set.repetitions, duration_seconds: set.durationSeconds, rest_seconds: set.restSeconds, load_kg: set.loadKg })) })) })
  } catch (error) { next(error) }
})

router.get('/programs', async (request, response, next) => {
  if (!queryIsValid(request.query)) return response.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Only the search query parameter is supported.' } })
  const search = checkSearch(request.query.search)
  if (search === null) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Search text must be 100 characters or fewer.' } })
  try {
    const programs = await prisma.program.findMany({
      where: { archivedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        _count: { select: { workouts: true } },
        workouts: {
          orderBy: { position: 'asc' },
          select: { workout: { select: { id: true, exercises: { orderBy: { position: 'asc' }, take: 1, select: { exercise: { select: { id: true, name: true, imageUrl: true } } } } } } },
        },
      },
    })
    const groups = groupBy(programs, (program) => program.category)
    response.json({ groups: groups.map(([category, items]) => ({ category, programs: items.map(({ workouts, ...program }) => ({ ...program, workouts: workouts.map(({ workout }) => ({ id: workout.id, exercises: workout.exercises.map(({ exercise }) => ({ id: exercise.id, name: exercise.name, image_url: exercise.imageUrl })) })) })) })), total: programs.length })
  } catch (error) { next(error) }
})

router.get('/program/:program_id', async (request, response, next) => {
  try {
    const id = request.params.program_id as string
    const program = await prisma.program.findFirst({ where: { id, archivedAt: null }, include: { workouts: { orderBy: { position: 'asc' }, include: { workout: { include: { exercises: { include: { exercise: true, sets: true } } } } } } } })
    if (!program) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested program was not found.' } })
    response.json({ id: program.id, name: program.name, category: program.category, description: program.description, workouts: program.workouts.map(({ workout, position }) => ({ id: workout.id, name: workout.name, type: workout.type, description: workout.description, position, exercise_count: workout.exercises.length, exercises: workout.exercises.map(({ exercise }) => ({ id: exercise.id, name: exercise.name, image_url: exercise.imageUrl })) })) })
  } catch (error) { next(error) }
})

export default router
