-- Optional training targets for the planner. Existing rows remain unchanged.
ALTER TABLE public.weekly_workouts
  ADD COLUMN IF NOT EXISTS exercise_name text,
  ADD COLUMN IF NOT EXISTS target_sets integer CHECK (target_sets BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS target_reps integer CHECK (target_reps BETWEEN 0 AND 200),
  ADD COLUMN IF NOT EXISTS target_minutes integer CHECK (target_minutes BETWEEN 1 AND 180);
