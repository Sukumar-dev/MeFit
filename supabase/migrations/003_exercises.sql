BEGIN;
CREATE TABLE IF NOT EXISTS public.fitness_exercises (
  name text PRIMARY KEY, muscle_group text NOT NULL, equipment text NOT NULL
);
ALTER TABLE public.fitness_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fitness_exercises FROM anon, authenticated;
GRANT SELECT ON public.fitness_exercises TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'fitness_exercises' AND policyname = 'Authenticated library') THEN
    CREATE POLICY "Authenticated library" ON public.fitness_exercises
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
INSERT INTO public.fitness_exercises (name, muscle_group, equipment) VALUES
  ('Squat', 'legs', 'Bodyweight'),
  ('Reverse lunge', 'legs', 'Bodyweight'),
  ('Forward lunge', 'legs', 'Bodyweight'),
  ('Lateral lunge', 'legs', 'Bodyweight'),
  ('Glute bridge', 'legs', 'Bodyweight'),
  ('Single-leg glute bridge', 'legs', 'Bodyweight'),
  ('Calf raise', 'legs', 'Bodyweight'),
  ('Wall sit', 'legs', 'Bodyweight'),
  ('Step-up', 'legs', 'Bodyweight'),
  ('Split squat', 'legs', 'Bodyweight'),
  ('Goblet squat', 'legs', 'Dumbbell'),
  ('Romanian deadlift', 'legs', 'Dumbbell'),
  ('Dumbbell step-up', 'legs', 'Dumbbell'),
  ('Dumbbell split squat', 'legs', 'Dumbbell'),
  ('Dumbbell calf raise', 'legs', 'Dumbbell'),
  ('Wall push-up', 'push', 'Bodyweight'),
  ('Incline push-up', 'push', 'Bodyweight'),
  ('Push-up', 'push', 'Bodyweight'),
  ('Close-grip push-up', 'push', 'Bodyweight'),
  ('Decline push-up', 'push', 'Bodyweight'),
  ('Pike push-up', 'push', 'Bodyweight'),
  ('Floor press', 'push', 'Dumbbell'),
  ('Bench press', 'push', 'Dumbbell'),
  ('Incline press', 'push', 'Dumbbell'),
  ('Shoulder press', 'push', 'Dumbbell'),
  ('Lateral raise', 'push', 'Dumbbell'),
  ('Front raise', 'push', 'Dumbbell'),
  ('Overhead triceps extension', 'push', 'Dumbbell'),
  ('Triceps kickback', 'push', 'Dumbbell'),
  ('Chest fly', 'push', 'Dumbbell'),
  ('Bent-over row', 'pull', 'Dumbbell'),
  ('One-arm row', 'pull', 'Dumbbell'),
  ('Reverse fly', 'pull', 'Dumbbell'),
  ('Biceps curl', 'pull', 'Dumbbell'),
  ('Hammer curl', 'pull', 'Dumbbell'),
  ('Concentration curl', 'pull', 'Dumbbell'),
  ('Incline curl', 'pull', 'Dumbbell'),
  ('Shrug', 'pull', 'Dumbbell'),
  ('Band row', 'pull', 'Band'),
  ('Band pull-apart', 'pull', 'Band'),
  ('Band face pull', 'pull', 'Band'),
  ('Band curl', 'pull', 'Band'),
  ('Band lat pulldown', 'pull', 'Band'),
  ('Pull-up', 'pull', 'Bar'),
  ('Chin-up', 'pull', 'Bar'),
  ('Dead bug', 'core', 'Bodyweight'),
  ('Bird dog', 'core', 'Bodyweight'),
  ('Front plank', 'core', 'Bodyweight'),
  ('Side plank', 'core', 'Bodyweight'),
  ('Mountain climber', 'core', 'Bodyweight'),
  ('Reverse crunch', 'core', 'Bodyweight'),
  ('Bicycle crunch', 'core', 'Bodyweight'),
  ('Hollow hold', 'core', 'Bodyweight'),
  ('Heel tap', 'core', 'Bodyweight'),
  ('Bear crawl', 'core', 'Bodyweight'),
  ('Suitcase carry', 'core', 'Dumbbell'),
  ('Farmer carry', 'core', 'Dumbbell'),
  ('Weighted dead bug', 'core', 'Dumbbell'),
  ('Pallof press', 'core', 'Band'),
  ('Band wood chop', 'core', 'Band')
ON CONFLICT (name) DO NOTHING;
COMMIT;
