ALTER TYPE "GoalStatus" ADD VALUE 'PAUSED';

ALTER TABLE "Goal"
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Weekly fitness goal',
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "objective" TEXT NOT NULL DEFAULT 'GENERAL_FITNESS',
ADD COLUMN "workoutFrequency" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "preferredDuration" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

UPDATE "Goal" AS goal
SET "name" = program.name
FROM "Program" AS program
WHERE goal."programId" = program.id;
