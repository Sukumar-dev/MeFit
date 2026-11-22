BEGIN;
SET LOCAL search_path = public;
-- CreateEnum
DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('USER', 'CONTRIBUTOR', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ContributorRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" UUID NOT NULL,
    "oidcSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(6,2),
    "activityLevel" TEXT,
    "fitnessExperience" TEXT,
    "readinessAnswers" JSONB,
    "fitnessLevel" TEXT,
    "evaluationVersion" TEXT,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Address" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "line3" TEXT,
    "postalCode" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Exercise" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetMuscleGroup" TEXT NOT NULL,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" UUID,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Workout" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" UUID,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkoutExercise" (
    "id" UUID NOT NULL,
    "workoutId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExerciseSet" (
    "id" UUID NOT NULL,
    "workoutExerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "repetitions" INTEGER,
    "durationSeconds" INTEGER,
    "restSeconds" INTEGER,
    "loadKg" DECIMAL(7,2),

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Program" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" UUID,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProgramWorkout" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "workoutId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProgramWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Goal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "programId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoalWorkout" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "workoutId" UUID,
    "position" INTEGER NOT NULL,
    "workoutName" TEXT NOT NULL,
    "workoutType" TEXT NOT NULL,
    "prescriptionSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkoutCompletion" (
    "id" UUID NOT NULL,
    "goalWorkoutId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContributorRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "ContributorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_oidcSubject_key" ON "User"("oidcSubject");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_disabledAt_idx" ON "User"("disabledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserRole_role_idx" ON "UserRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Profile_fitnessLevel_idx" ON "Profile"("fitnessLevel");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Address_profileId_key" ON "Address"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Exercise_targetMuscleGroup_name_idx" ON "Exercise"("targetMuscleGroup", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Exercise_creatorId_idx" ON "Exercise"("creatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Exercise_archivedAt_idx" ON "Exercise"("archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workout_type_name_idx" ON "Workout"("type", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workout_creatorId_idx" ON "Workout"("creatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workout_archivedAt_idx" ON "Workout"("archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutExercise_exerciseId_idx" ON "WorkoutExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutExercise_workoutId_position_key" ON "WorkoutExercise"("workoutId", "position");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutExercise_workoutId_exerciseId_key" ON "WorkoutExercise"("workoutId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExerciseSet_workoutExerciseId_position_key" ON "ExerciseSet"("workoutExerciseId", "position");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Program_category_name_idx" ON "Program"("category", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Program_creatorId_idx" ON "Program"("creatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Program_archivedAt_idx" ON "Program"("archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgramWorkout_workoutId_idx" ON "ProgramWorkout"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramWorkout_programId_position_key" ON "ProgramWorkout"("programId", "position");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramWorkout_programId_workoutId_key" ON "ProgramWorkout"("programId", "workoutId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_userId_status_startDate_idx" ON "Goal"("userId", "status", "startDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_programId_idx" ON "Goal"("programId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoalWorkout_workoutId_idx" ON "GoalWorkout"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GoalWorkout_goalId_position_key" ON "GoalWorkout"("goalId", "position");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutCompletion_goalWorkoutId_key" ON "WorkoutCompletion"("goalWorkoutId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutCompletion_userId_completedAt_idx" ON "WorkoutCompletion"("userId", "completedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContributorRequest_userId_status_idx" ON "ContributorRequest"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContributorRequest_status_createdAt_idx" ON "ContributorRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Address" ADD CONSTRAINT "Address_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Workout" ADD CONSTRAINT "Workout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Program" ADD CONSTRAINT "Program_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ProgramWorkout" ADD CONSTRAINT "ProgramWorkout_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ProgramWorkout" ADD CONSTRAINT "ProgramWorkout_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Goal" ADD CONSTRAINT "Goal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GoalWorkout" ADD CONSTRAINT "GoalWorkout_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "GoalWorkout" ADD CONSTRAINT "GoalWorkout_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_goalWorkoutId_fkey" FOREIGN KEY ("goalWorkoutId") REFERENCES "GoalWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ContributorRequest" ADD CONSTRAINT "ContributorRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ContributorRequest" ADD CONSTRAINT "ContributorRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" text, ADD COLUMN IF NOT EXISTS "lastName" text;
ALTER TYPE "GoalStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TABLE "Goal"
  ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT 'Weekly fitness goal',
  ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "objective" text NOT NULL DEFAULT 'GENERAL_FITNESS',
  ADD COLUMN IF NOT EXISTS "workoutFrequency" integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "preferredDuration" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "difficulty" text NOT NULL DEFAULT 'BEGINNER',
  ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS "SupabaseIdentity" (
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupabaseIdentity_pkey" PRIMARY KEY ("issuer", "subject"),
    CONSTRAINT "SupabaseIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupabaseIdentity_userId_key" ON "SupabaseIdentity"("userId");

ALTER TABLE "SupabaseIdentity" ENABLE ROW LEVEL SECURITY;

-- Restrict these tables to the backend connection. Existing browser tables are separate.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Address" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Exercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Workout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutExercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExerciseSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProgramWorkout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GoalWorkout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContributorRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
COMMIT;
