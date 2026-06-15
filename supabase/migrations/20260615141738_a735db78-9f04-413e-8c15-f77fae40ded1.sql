
-- 1) Trigger to enforce vendedor_id on new slots (legacy rows untouched)
CREATE OR REPLACE FUNCTION public.tg_require_slot_vendedor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.vendedor_id IS NULL THEN
    RAISE EXCEPTION 'vendedor_id é obrigatório para novos horários';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS require_slot_vendedor ON public.interview_slots;
CREATE TRIGGER require_slot_vendedor
  BEFORE INSERT ON public.interview_slots
  FOR EACH ROW EXECUTE FUNCTION public.tg_require_slot_vendedor();

-- 2) Unique index: same vendor cannot duplicate free slots at same time
CREATE UNIQUE INDEX IF NOT EXISTS interview_slots_vendedor_time_unique
  ON public.interview_slots (vendedor_id, scheduled_at)
  WHERE vendedor_id IS NOT NULL;

-- 3) Restrict legacy RPC to only legacy (null vendor) slots, so it can never
--    leak slots that belong to a specific vendor.
CREATE OR REPLACE FUNCTION public.get_available_slots()
RETURNS TABLE(id uuid, scheduled_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, scheduled_at FROM public.interview_slots
   WHERE vendedor_id IS NULL
     AND lead_id IS NULL
     AND scheduled_at >= now()
     AND scheduled_at <= now() + interval '4 days'
   ORDER BY scheduled_at
$$;

-- 4) Vendor must change password flag (default true for new + existing accounts
--    so they are forced to set their own password after first admin reset).
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
