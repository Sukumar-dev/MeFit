BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 120),
  avatar_url text CHECK (avatar_url LIKE 'https://%'),
  height_cm numeric CHECK (height_cm BETWEEN 80 AND 250),
  weight_kg numeric CHECK (weight_kg BETWEEN 25 AND 350),
  timezone text NOT NULL DEFAULT 'UTC',
  days_available integer NOT NULL DEFAULT 3 CHECK (days_available BETWEEN 1 AND 7),
  minutes_per_workout integer NOT NULL DEFAULT 30 CHECK (minutes_per_workout BETWEEN 5 AND 180),
  current_activity text NOT NULL DEFAULT 'light',
  experience text NOT NULL DEFAULT 'beginner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'profiles' AND policyname = 'Read own profile') THEN
    CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = id);
    CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = id);
    CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mefit_touch_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mefit_provision_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.mefit_provision_profile() FROM PUBLIC;

CREATE OR REPLACE TRIGGER mefit_touch_profile
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.mefit_touch_profile();

CREATE OR REPLACE TRIGGER mefit_provision_profile
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.mefit_provision_profile();

COMMIT;
