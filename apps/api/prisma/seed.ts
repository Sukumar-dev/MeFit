import '../src/env.js'
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

  console.info(`Seeded ${exercises.length} exercises, ${workouts.length} workouts, and ${programs.length} programs.`)
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
