BEGIN;
CREATE TABLE IF NOT EXISTS public.weekly_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  completed boolean NOT NULL DEFAULT false
);
ALTER TABLE public.weekly_workouts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_workouts TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'weekly_workouts' AND policyname = 'Owner access') THEN
    CREATE POLICY "Owner access" ON public.weekly_workouts FOR ALL TO authenticated
      USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
COMMIT;
