ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS crm_lead_id text,
  ADD COLUMN IF NOT EXISTS crm_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS crm_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crm_last_sync_error text,
  ADD COLUMN IF NOT EXISTS crm_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_crm_sync_status_idx ON public.leads (crm_sync_status);