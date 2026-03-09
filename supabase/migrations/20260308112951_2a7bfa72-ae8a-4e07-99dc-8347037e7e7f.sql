ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS unique_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_unique_id_unique_idx
ON public.profiles ((lower(unique_id)))
WHERE unique_id IS NOT NULL;