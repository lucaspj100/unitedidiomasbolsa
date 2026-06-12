
-- 1. Add columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS etapa_atual TEXT,
  ADD COLUMN IF NOT EXISTS ultima_interacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 2. interview_slots table
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at TIMESTAMPTZ NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_slots TO authenticated;
GRANT ALL ON public.interview_slots TO service_role;

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage slots" ON public.interview_slots;
CREATE POLICY "Admins manage slots" ON public.interview_slots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Settings keys
INSERT INTO public.app_settings(key, value) VALUES
  ('logo_url', NULL),
  ('brand_name', 'United Idiomas'),
  ('brand_subtitle', 'Assistente de Bolsa'),
  ('allowed_admin_email', 'lucas_atl@yahoo.com.br')
ON CONFLICT (key) DO NOTHING;

-- 4. Public settings function (with branding)
DROP FUNCTION IF EXISTS public.get_public_settings();
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE(scheduling_link text, whatsapp_number text, logo_url text, brand_name text, brand_subtitle text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (SELECT value FROM public.app_settings WHERE key = 'scheduling_link'),
    (SELECT value FROM public.app_settings WHERE key = 'whatsapp_number'),
    (SELECT value FROM public.app_settings WHERE key = 'logo_url'),
    COALESCE((SELECT value FROM public.app_settings WHERE key = 'brand_name'), 'United Idiomas'),
    COALESCE((SELECT value FROM public.app_settings WHERE key = 'brand_subtitle'), 'Assistente de Bolsa')
$$;
REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- 5. claim_admin restricted to allowed email
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  allowed text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  SELECT value INTO allowed FROM public.app_settings WHERE key = 'allowed_admin_email';
  IF allowed IS NULL OR user_email IS NULL OR lower(user_email) <> lower(allowed) THEN
    RETURN public.has_role(uid, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- 6. Progressive save RPC
CREATE OR REPLACE FUNCTION public.save_lead_progress(p_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO public.leads (
      nome, whatsapp, email, cidade_estado, profissao, empresa,
      nivel_ingles, motivo_ingles, impacto_ingles, perdeu_oportunidade,
      motivo_nao_faz_curso, decisao_entrevista, classificacao_lead,
      alta_prioridade, status, origem, etapa_atual, respostas_json, ultima_interacao
    )
    VALUES (
      COALESCE(p_data->>'nome',''),
      COALESCE(p_data->>'whatsapp',''),
      COALESCE(p_data->>'email',''),
      p_data->>'cidade_estado',
      p_data->>'profissao',
      p_data->>'empresa',
      p_data->>'nivel_ingles',
      p_data->>'motivo_ingles',
      p_data->>'impacto_ingles',
      p_data->>'perdeu_oportunidade',
      p_data->>'motivo_nao_faz_curso',
      p_data->>'decisao_entrevista',
      COALESCE(p_data->>'classificacao_lead','curioso'),
      COALESCE((p_data->>'alta_prioridade')::boolean, false),
      COALESCE(p_data->>'status','Cadastro iniciado'),
      COALESCE(p_data->>'origem','LinkedIn'),
      p_data->>'etapa_atual',
      COALESCE(p_data->'respostas_json', '{}'::jsonb),
      now()
    )
    RETURNING id INTO new_id;
    RETURN new_id;
  ELSE
    UPDATE public.leads SET
      nome = COALESCE(NULLIF(p_data->>'nome',''), nome),
      whatsapp = COALESCE(NULLIF(p_data->>'whatsapp',''), whatsapp),
      email = COALESCE(NULLIF(p_data->>'email',''), email),
      cidade_estado = COALESCE(p_data->>'cidade_estado', cidade_estado),
      profissao = COALESCE(p_data->>'profissao', profissao),
      empresa = COALESCE(p_data->>'empresa', empresa),
      nivel_ingles = COALESCE(p_data->>'nivel_ingles', nivel_ingles),
      motivo_ingles = COALESCE(p_data->>'motivo_ingles', motivo_ingles),
      impacto_ingles = COALESCE(p_data->>'impacto_ingles', impacto_ingles),
      perdeu_oportunidade = COALESCE(p_data->>'perdeu_oportunidade', perdeu_oportunidade),
      motivo_nao_faz_curso = COALESCE(p_data->>'motivo_nao_faz_curso', motivo_nao_faz_curso),
      decisao_entrevista = COALESCE(p_data->>'decisao_entrevista', decisao_entrevista),
      classificacao_lead = COALESCE(p_data->>'classificacao_lead', classificacao_lead),
      alta_prioridade = COALESCE((p_data->>'alta_prioridade')::boolean, alta_prioridade),
      status = COALESCE(p_data->>'status', status),
      etapa_atual = COALESCE(p_data->>'etapa_atual', etapa_atual),
      respostas_json = COALESCE(p_data->'respostas_json', respostas_json),
      ultima_interacao = now()
    WHERE id = p_id;
    RETURN p_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_lead_progress(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_lead_progress(uuid, jsonb) TO anon, authenticated;

-- 7. Get available slots (next 4 days, unbooked)
CREATE OR REPLACE FUNCTION public.get_available_slots()
RETURNS TABLE(id uuid, scheduled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, scheduled_at FROM public.interview_slots
  WHERE lead_id IS NULL
    AND scheduled_at >= now()
    AND scheduled_at <= now() + interval '4 days'
  ORDER BY scheduled_at
$$;
REVOKE ALL ON FUNCTION public.get_available_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots() TO anon, authenticated;

-- 8. Book slot atomically
CREATE OR REPLACE FUNCTION public.book_interview_slot(p_lead_id uuid, p_slot_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE booked_at timestamptz;
BEGIN
  UPDATE public.interview_slots
  SET lead_id = p_lead_id, updated_at = now()
  WHERE id = p_slot_id AND lead_id IS NULL
  RETURNING scheduled_at INTO booked_at;
  IF booked_at IS NULL THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;
  UPDATE public.leads
  SET scheduled_at = booked_at,
      status = 'Entrevista agendada',
      ultima_interacao = now()
  WHERE id = p_lead_id;
  RETURN booked_at;
END;
$$;
REVOKE ALL ON FUNCTION public.book_interview_slot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_interview_slot(uuid, uuid) TO anon, authenticated;
