ALTER TABLE public.interview_slots DROP CONSTRAINT IF EXISTS interview_slots_scheduled_at_key;
DROP INDEX IF EXISTS public.interview_slots_scheduled_at_key;
CREATE UNIQUE INDEX IF NOT EXISTS interview_slots_vendedor_scheduled_at_unique
  ON public.interview_slots (vendedor_id, scheduled_at);