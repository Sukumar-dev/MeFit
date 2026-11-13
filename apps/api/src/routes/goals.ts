import { Router } from 'express'
import { GoalStatus, Prisma } from '../generated/prisma/client.js'
import { requireAuth } from '../auth/authorization.js'
import { prisma } from '../db.js'
import { z } from 'zod'

const router = Router()
const customWorkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().min(2).max(60),
  description: z.string().trim().min(3).max(1000),
}).strict()

const editableGoalFields = z.object({
  name: z.string().trim().min(2).max(120).default('Weekly fitness goal'),
  description: z.string().trim().max(1000).default(''),
  objective: z.enum(['WEIGHT_LOSS', 'MUSCLE_GAIN', 'STRENGTH', 'ENDURANCE', 'FLEXIBILITY', 'GENERAL_FITNESS']).default('GENERAL_FITNESS'),
  start_date: z.string().date(),
  end_date: z.string().date(),
  timezone: z.string().min(1).max(80),
  workout_frequency: z.number().int().min(1).max(7).default(3),
  preferred_duration: z.number().int().min(10).max(180).default(30),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  notes: z.string().trim().max(3000).default(''),
  program_id: z.string().uuid().nullable().optional(),
  workout_ids: z.array(z.string().uuid()).max(30).default([]),
  custom_workouts: z.array(customWorkoutSchema).max(30).default([]),
}).strict()
const editableGoalSchema = editableGoalFields
  .refine((value) => {
    const span = Date.parse(`${value.end_date}T00:00:00Z`) - Date.parse(`${value.start_date}T00:00:00Z`)
    return span >= 0 && span <= 365 * 86_400_000
  }, { path: ['end_date'], message: 'The target date must be within one year of the start date.' })
  .refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); return true } catch { return false }
  }, { path: ['timezone'], message: 'Provide a valid IANA time zone.' })

const updateGoalSchema = editableGoalFields.partial()
const statusSchema = z.object({ status: z.enum([GoalStatus.ACTIVE, GoalStatus.PAUSED, GoalStatus.COMPLETED]) }).strict()
type EditableGoal = z.infer<typeof editableGoalSchema>
type GoalDetails = Prisma.GoalGetPayload<{ include: { workouts: { include: { completion: true } }; program: true } }>

function isoDate(date: Date) { return date.toISOString().slice(0, 10) }
function assignmentKey(value: { workoutId: string | null; workoutName: string; workoutType: string }) {
  return value.workoutId ? `workout:${value.workoutId}` : `custom:${value.workoutName}:${value.workoutType}`
}

function serializeGoal(goal: GoalDetails) {
  const completedWorkouts = goal.workouts.filter((item) => item.completion).length
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    objective: goal.objective,
    start_date: isoDate(goal.startDate),
    end_date: isoDate(goal.endDate),
    timezone: goal.timezone,
    status: goal.status,
    workout_frequency: goal.workoutFrequency,
    preferred_duration: goal.preferredDuration,
    difficulty: goal.difficulty,
    notes: goal.notes,
    program_id: goal.programId,
    program_name: goal.program?.name ?? null,
    workout_ids: goal.workouts.flatMap((item) => item.workoutId ? [item.workoutId] : []),
    custom_workouts: goal.workouts.filter((item) => !item.workoutId).map((item) => ({
      name: item.workoutName,
      type: item.workoutType,
      description: (item.prescriptionSnapshot as { description?: string }).description ?? '',
    })),
    total_workouts: goal.workouts.length,
    completed_workouts: completedWorkouts,
    progress_percent: goal.workouts.length ? Math.round(completedWorkouts / goal.workouts.length * 100) : 0,
    workouts: goal.workouts.map((item) => ({
      id: item.id,
      name: item.workoutName,
      type: item.workoutType,
      prescription: item.prescriptionSnapshot,
      completed_at: item.completion?.completedAt ?? null,
    })),
  }
}

async function buildAssignments(input: EditableGoal, fitnessLevel: string | null) {
  const workoutIds = new Set(input.workout_ids)
  let programId: string | null = input.program_id ?? null
  let programWorkoutIds: string[] = []
  if (programId) {
    const program = await prisma.program.findFirst({ where: { id: programId, archivedAt: null }, include: { workouts: { orderBy: { position: 'asc' }, select: { workoutId: true } } } })
    if (!program) throw Object.assign(new Error('The requested program was not found.'), { status: 404, code: 'PROGRAM_NOT_FOUND' })
    programWorkoutIds = program.workouts.map(({ workoutId }) => workoutId)
    programWorkoutIds.forEach((id) => workoutIds.add(id))
  }
  const workouts = workoutIds.size ? await prisma.workout.findMany({
    where: { id: { in: [...workoutIds] }, archivedAt: null },
    include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: true, sets: { orderBy: { position: 'asc' } } } } },
  }) : []
  if (workouts.length !== workoutIds.size) throw Object.assign(new Error('One or more selected workouts are unavailable.'), { status: 400, code: 'INVALID_WORKOUT' })
  const orderedIds = [...programWorkoutIds, ...input.workout_ids]
  workouts.sort((left, right) => {
    const leftIndex = orderedIds.indexOf(left.id)
    const rightIndex = orderedIds.indexOf(right.id)
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
  })
  const assignments: Array<{ key: string; workoutId: string | null; workoutName: string; workoutType: string; prescriptionSnapshot: Prisma.InputJsonValue }> = workouts.map((workout) => {
    const snapshot = {
      description: workout.description,
      fitness_level: fitnessLevel,
      exercises: workout.exercises.map((row) => ({
        name: row.exercise.name,
        target_muscle_group: row.exercise.targetMuscleGroup,
        description: row.exercise.description,
        sets: row.sets.map((set) => ({ repetitions: set.repetitions, duration_seconds: set.durationSeconds, rest_seconds: set.restSeconds, load_kg: set.loadKg?.toString() })),
      })),
    }
    return { key: `workout:${workout.id}`, workoutId: workout.id, workoutName: workout.name, workoutType: workout.type, prescriptionSnapshot: snapshot }
  })
  for (const [position, workout] of input.custom_workouts.entries()) {
    assignments.push({
      key: `custom:${workout.name}:${workout.type}`,
      workoutId: null,
      workoutName: workout.name,
      workoutType: workout.type,
      prescriptionSnapshot: { description: workout.description, fitness_level: fitnessLevel, custom: true, position },
    })
  }
  if (!assignments.length) throw Object.assign(new Error('Select at least one program, workout, or custom workout.'), { status: 400, code: 'EMPTY_GOAL' })
  return { programId, assignments }
}

function errorResponse(response: import('express').Response, error: unknown) {
  const cause = error as { status?: number; code?: string; message?: string }
  if (!cause.status || !cause.code) return false
  response.status(cause.status).json({ error: { code: cause.code, message: cause.message ?? 'The goal could not be saved.' } })
  return true
}

const includeGoal = { workouts: { orderBy: { position: 'asc' as const }, include: { completion: true } }, program: true }

router.get('/goal/current', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, include: { profile: { select: { timezone: true } } } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const timezone = user.profile?.timezone ?? 'UTC'
    const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
    const today = new Date(`${localToday}T00:00:00Z`)
    const goal = await prisma.goal.findFirst({ where: { userId: user.id, status: GoalStatus.ACTIVE, endDate: { gte: today } }, include: includeGoal, orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }] })
      ?? await prisma.goal.findFirst({ where: { userId: user.id, status: GoalStatus.COMPLETED, startDate: { lte: today }, endDate: { gte: today } }, include: includeGoal, orderBy: { createdAt: 'desc' } })
    response.json({ today: localToday, goal: goal ? { ...serializeGoal(goal), days_left: Math.max(0, Math.ceil((goal.endDate.getTime() - today.getTime()) / 86_400_000)) } : null })
  } catch (error) { next(error) }
})

router.get('/goal', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const goals = await prisma.goal.findMany({ where: { userId: user.id }, include: includeGoal, orderBy: [{ createdAt: 'desc' }] })
    response.json({ goals: goals.map(serializeGoal) })
  } catch (error) { next(error) }
})

router.post('/goal', requireAuth, async (request, response, next) => {
  const parsed = editableGoalSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Provide valid goal details and a date range.', details: parsed.error.flatten().fieldErrors } })
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, include: { profile: { select: { fitnessLevel: true, timezone: true, readinessAnswers: true } } } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    if (!user.profile) return response.status(409).json({ error: { code: 'PROFILE_REQUIRED', message: 'Complete your fitness profile before setting a goal.' } })
    const { programId, assignments } = await buildAssignments(parsed.data, user.profile.fitnessLevel)
    const startDate = new Date(`${parsed.data.start_date}T00:00:00Z`)
    const endDate = new Date(`${parsed.data.end_date}T00:00:00Z`)
    const overlap = await prisma.goal.findFirst({ where: { userId: user.id, status: GoalStatus.ACTIVE, startDate: { lte: endDate }, endDate: { gte: startDate } } })
    if (overlap) return response.status(409).json({ error: { code: 'GOAL_OVERLAP', message: 'This date range overlaps another active goal. Pause it or choose different dates.' } })
    const goal = await prisma.goal.create({ data: {
      userId: user.id, programId, name: parsed.data.name, description: parsed.data.description, objective: parsed.data.objective,
      workoutFrequency: parsed.data.workout_frequency, preferredDuration: parsed.data.preferred_duration, difficulty: parsed.data.difficulty, notes: parsed.data.notes,
      startDate, endDate, timezone: parsed.data.timezone || user.profile.timezone,
      workouts: { create: assignments.map(({ key: _key, ...assignment }, position) => ({ ...assignment, position })) },
    }, include: includeGoal })
    response.status(201).location(`${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/goal/${goal.id}`).json({ ...serializeGoal(goal), suitability_warning: (user.profile.readinessAnswers as { limitations?: boolean } | null)?.limitations ? 'You reported a limitation; review each movement and select a comfortable variation.' : null })
  } catch (error) { if (errorResponse(response, error)) return; next(error) }
})

router.get('/goal/:goal_id', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const goal = await prisma.goal.findFirst({ where: { id: request.params.goal_id as string, userId: user.id }, include: includeGoal })
    if (!goal) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested goal was not found.' } })
    response.json(serializeGoal(goal))
  } catch (error) { next(error) }
})

router.patch('/goal/:goal_id', requireAuth, async (request, response, next) => {
  const patch = updateGoalSchema.safeParse(request.body)
  if (!patch.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Provide valid goal details.', details: patch.error.flatten().fieldErrors } })
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, include: { profile: { select: { fitnessLevel: true, timezone: true } } } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    if (!user.profile) return response.status(409).json({ error: { code: 'PROFILE_REQUIRED', message: 'Complete your fitness profile before editing goals.' } })
    const previous = await prisma.goal.findFirst({ where: { id: request.params.goal_id as string, userId: user.id }, include: { workouts: { include: { completion: true } } } })
    if (!previous) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested goal was not found.' } })
    const oldCustom = previous.workouts.filter((item) => !item.workoutId).map((item) => ({ name: item.workoutName, type: item.workoutType, description: (item.prescriptionSnapshot as { description?: string }).description ?? '' }))
    const merged = editableGoalSchema.safeParse({
      name: previous.name, description: previous.description, objective: previous.objective,
      start_date: isoDate(previous.startDate), end_date: isoDate(previous.endDate), timezone: previous.timezone,
      workout_frequency: previous.workoutFrequency, preferred_duration: previous.preferredDuration, difficulty: previous.difficulty, notes: previous.notes,
      program_id: previous.programId, workout_ids: previous.workouts.flatMap((item) => item.workoutId ? [item.workoutId] : []), custom_workouts: oldCustom,
      ...patch.data,
    })
    if (!merged.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Provide valid goal details and a date range.', details: merged.error.flatten().fieldErrors } })
    const input: EditableGoal = merged.data
    const { programId, assignments } = await buildAssignments(input, user.profile.fitnessLevel)
    const startDate = new Date(`${input.start_date}T00:00:00Z`)
    const endDate = new Date(`${input.end_date}T00:00:00Z`)
    if (previous.status === GoalStatus.ACTIVE) {
      const overlap = await prisma.goal.findFirst({ where: { id: { not: previous.id }, userId: user.id, status: GoalStatus.ACTIVE, startDate: { lte: endDate }, endDate: { gte: startDate } } })
      if (overlap) return response.status(409).json({ error: { code: 'GOAL_OVERLAP', message: 'This date range overlaps another active goal. Pause it or choose different dates.' } })
    }
    const existingByKey = new Map(previous.workouts.map((item) => [assignmentKey(item), item]))
    const desiredKeys = new Set(assignments.map(({ key }) => key))
    await prisma.$transaction(async (tx) => {
      await tx.goal.update({ where: { id: previous.id }, data: {
        name: input.name, description: input.description, objective: input.objective, startDate, endDate, timezone: input.timezone,
        workoutFrequency: input.workout_frequency, preferredDuration: input.preferred_duration, difficulty: input.difficulty, notes: input.notes, programId,
      } })
      for (const item of previous.workouts) {
        if (!desiredKeys.has(assignmentKey(item))) await tx.goalWorkout.delete({ where: { id: item.id } })
        else await tx.goalWorkout.update({ where: { id: item.id }, data: { position: -item.position - 1 } })
      }
      for (const [position, assignment] of assignments.entries()) {
        const previousItem = existingByKey.get(assignment.key)
        const { key: _key, ...data } = assignment
        if (previousItem && desiredKeys.has(assignment.key)) await tx.goalWorkout.update({ where: { id: previousItem.id }, data: { ...data, position } })
        else await tx.goalWorkout.create({ data: { ...data, goalId: previous.id, position } })
      }
    })
    const updated = await prisma.goal.findUniqueOrThrow({ where: { id: previous.id }, include: includeGoal })
    response.json(serializeGoal(updated))
  } catch (error) { if (errorResponse(response, error)) return; next(error) }
})

router.patch('/goal/:goal_id/status', requireAuth, async (request, response, next) => {
  const parsed = statusSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Choose Active, Paused, or Completed.' } })
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const goal = await prisma.goal.findFirst({ where: { id: request.params.goal_id as string, userId: user.id }, include: { workouts: { include: { completion: true } } } })
    if (!goal) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested goal was not found.' } })
    if (parsed.data.status === GoalStatus.ACTIVE) {
      const overlap = await prisma.goal.findFirst({ where: { id: { not: goal.id }, userId: user.id, status: GoalStatus.ACTIVE, startDate: { lte: goal.endDate }, endDate: { gte: goal.startDate } } })
      if (overlap) return response.status(409).json({ error: { code: 'GOAL_OVERLAP', message: 'Another active goal overlaps these dates. Pause it or choose different dates first.' } })
    }
    const updated = await prisma.goal.update({ where: { id: goal.id }, data: { status: parsed.data.status }, include: includeGoal })
    response.json(serializeGoal(updated))
  } catch (error) { next(error) }
})

router.delete('/goal/:goal_id', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const deleted = await prisma.goal.deleteMany({ where: { id: request.params.goal_id as string, userId: user.id } })
    if (!deleted.count) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested goal was not found.' } })
    response.sendStatus(204)
  } catch (error) { next(error) }
})

router.post('/goal/:goal_id/workouts/:goal_workout_id/complete', requireAuth, async (request, response, next) => {
  try {
    const goalId = request.params.goal_id as string
    const assignmentId = request.params.goal_workout_id as string
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const assignment = await prisma.goalWorkout.findFirst({ where: { id: assignmentId, goalId, goal: { userId: user.id, status: GoalStatus.ACTIVE } }, include: { completion: true } })
    if (!assignment) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'This active goal workout was not found.' } })
    const completion = await prisma.workoutCompletion.upsert({ where: { goalWorkoutId: assignment.id }, create: { goalWorkoutId: assignment.id, userId: user.id }, update: {} })
    const [remaining, total] = await Promise.all([prisma.goalWorkout.count({ where: { goalId, completion: null } }), prisma.goalWorkout.count({ where: { goalId } })])
    if (remaining === 0) await prisma.goal.update({ where: { id: goalId }, data: { status: GoalStatus.COMPLETED } })
    response.status(assignment.completion ? 200 : 201).json({ goal_workout_id: assignment.id, completed_at: completion.completedAt, completed_workouts: total - remaining, total_workouts: total, goal_status: remaining === 0 ? 'COMPLETED' : 'ACTIVE' })
  } catch (error) { next(error) }
})

export default router
