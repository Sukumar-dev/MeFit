BEGIN;
CREATE TABLE IF NOT EXISTS public.fitness_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_on date NOT NULL,
  weight_kg numeric NOT NULL CHECK (weight_kg BETWEEN 25 AND 350),
  waist_cm numeric CHECK (waist_cm BETWEEN 30 AND 300),
  UNIQUE (user_id, measured_on)
);
ALTER TABLE public.fitness_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_progress TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'fitness_progress' AND policyname = 'Owner access') THEN
    CREATE POLICY "Owner access" ON public.fitness_progress FOR ALL TO authenticated
      USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.fitness_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_unit text NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb'))
);
ALTER TABLE public.fitness_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.fitness_settings TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'fitness_settings' AND policyname = 'Owner access') THEN
    CREATE POLICY "Owner access" ON public.fitness_settings FOR ALL TO authenticated
      USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
COMMIT;
