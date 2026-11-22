BEGIN;
CREATE TABLE IF NOT EXISTS public.exercise_library (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  body_area text NOT NULL,
  movement_type text NOT NULL,
  equipment text[] NOT NULL,
  level text NOT NULL,
  primary_muscles text[] NOT NULL,
  secondary_muscles text[] NOT NULL,
  instructions text[] NOT NULL,
  image_paths text[] NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  legacy_names text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercise_library FROM anon, authenticated;
GRANT SELECT ON public.exercise_library TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id text NOT NULL REFERENCES public.exercise_library(id),
  PRIMARY KEY (user_id, exercise_id)
);
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'exercise_library' AND policyname = 'Read active exercises') THEN
    CREATE POLICY "Read active exercises" ON public.exercise_library
      FOR SELECT TO authenticated USING (is_active);
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'user_favorites' AND policyname = 'Own favorites') THEN
    CREATE POLICY "Own favorites" ON public.user_favorites
      FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
COMMIT;
