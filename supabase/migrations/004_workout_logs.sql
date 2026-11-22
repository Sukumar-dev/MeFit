BEGIN;
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise text NOT NULL CHECK (char_length(btrim(exercise)) BETWEEN 1 AND 120),
  performed_on date NOT NULL DEFAULT CURRENT_DATE,
  sets integer NOT NULL CHECK (sets > 0),
  reps integer NOT NULL CHECK (reps >= 0),
  weight_kg numeric NOT NULL CHECK (weight_kg >= 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0)
);
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'workout_logs' AND policyname = 'Owner access') THEN
    CREATE POLICY "Owner access" ON public.workout_logs FOR ALL TO authenticated
      USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
COMMIT;
