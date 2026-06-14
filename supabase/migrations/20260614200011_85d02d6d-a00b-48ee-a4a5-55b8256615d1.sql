
-- 1) Tabela de vendedores
CREATE TABLE public.vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  whatsapp text,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores TO authenticated;
GRANT ALL ON public.vendedores TO service_role;

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- 2) Função helper: id do vendedor do usuário atual (SECURITY DEFINER evita recursão)
CREATE OR REPLACE FUNCTION public.current_vendedor_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.vendedores WHERE user_id = auth.uid() AND ativo = true LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_vendedor_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_vendedor_id() TO authenticated;

-- 3) Políticas vendedores
CREATE POLICY "Admins manage vendedores" ON public.vendedores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendedor reads self" ON public.vendedores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER vendedores_updated_at
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Trigger: ao criar usuário em auth, vincular vendedor pelo email
CREATE OR REPLACE FUNCTION public.link_vendedor_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vendedores
     SET user_id = NEW.id, updated_at = now()
   WHERE lower(email) = lower(NEW.email)
     AND user_id IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_link_vendedor ON auth.users;
CREATE TRIGGER on_auth_user_link_vendedor
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_vendedor_on_signup();

-- 6) Adicionar vendedor_id em leads e interview_slots
ALTER TABLE public.leads
  ADD COLUMN vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL;
CREATE INDEX leads_vendedor_id_idx ON public.leads(vendedor_id);

ALTER TABLE public.interview_slots
  ADD COLUMN vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL;
CREATE INDEX interview_slots_vendedor_id_idx ON public.interview_slots(vendedor_id);

-- 7) Atualiza RLS de leads: vendedor vê/edita só os seus
CREATE POLICY "Vendedor reads own leads" ON public.leads
  FOR SELECT TO authenticated
  USING (vendedor_id IS NOT NULL AND vendedor_id = public.current_vendedor_id());

CREATE POLICY "Vendedor updates own leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (vendedor_id IS NOT NULL AND vendedor_id = public.current_vendedor_id())
  WITH CHECK (vendedor_id = public.current_vendedor_id());

-- 8) RLS de interview_slots: vendedor gerencia só os seus
CREATE POLICY "Vendedor manages own slots" ON public.interview_slots
  FOR ALL TO authenticated
  USING (vendedor_id IS NOT NULL AND vendedor_id = public.current_vendedor_id())
  WITH CHECK (vendedor_id = public.current_vendedor_id());

-- 9) Função pública: buscar vendedor pelo slug
CREATE OR REPLACE FUNCTION public.get_vendedor_by_slug(p_slug text)
RETURNS TABLE(id uuid, nome text, ativo boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, ativo FROM public.vendedores WHERE slug = p_slug LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_vendedor_by_slug(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_vendedor_by_slug(text) TO anon, authenticated;

-- 10) Slots disponíveis por vendedor
CREATE OR REPLACE FUNCTION public.get_available_slots_by_vendedor(p_vendedor_id uuid)
RETURNS TABLE(id uuid, scheduled_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.scheduled_at
    FROM public.interview_slots s
    JOIN public.vendedores v ON v.id = s.vendedor_id AND v.ativo = true
   WHERE s.vendedor_id = p_vendedor_id
     AND s.lead_id IS NULL
     AND s.scheduled_at >= now()
     AND s.scheduled_at <= now() + interval '4 days'
   ORDER BY s.scheduled_at
$$;

REVOKE ALL ON FUNCTION public.get_available_slots_by_vendedor(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_available_slots_by_vendedor(uuid) TO anon, authenticated;

-- 11) save_lead_progress aceita vendedor_id; valida vendedor ativo se informado
CREATE OR REPLACE FUNCTION public.save_lead_progress(p_id uuid, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_vendedor uuid := NULLIF(p_data->>'vendedor_id','')::uuid;
  v_ativo boolean;
BEGIN
  IF v_vendedor IS NOT NULL THEN
    SELECT ativo INTO v_ativo FROM public.vendedores WHERE id = v_vendedor;
    IF v_ativo IS NULL OR v_ativo = false THEN
      RAISE EXCEPTION 'Vendedor indisponível';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.leads (
      nome, whatsapp, email, cidade_estado, profissao, empresa,
      nivel_ingles, motivo_ingles, impacto_ingles, perdeu_oportunidade,
      motivo_nao_faz_curso, decisao_entrevista, classificacao_lead,
      alta_prioridade, status, origem, etapa_atual, respostas_json,
      vendedor_id, ultima_interacao
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
      v_vendedor,
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
      vendedor_id = COALESCE(v_vendedor, vendedor_id),
      ultima_interacao = now()
    WHERE id = p_id;
    RETURN p_id;
  END IF;
END $$;

-- 12) book_interview_slot: garantir mesmo vendedor entre slot e lead
CREATE OR REPLACE FUNCTION public.book_interview_slot(p_lead_id uuid, p_slot_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booked_at timestamptz;
  lead_vendedor uuid;
  slot_vendedor uuid;
BEGIN
  SELECT vendedor_id INTO lead_vendedor FROM public.leads WHERE id = p_lead_id;
  SELECT vendedor_id INTO slot_vendedor FROM public.interview_slots WHERE id = p_slot_id;

  -- legado: ambos null OK; novo: precisam bater
  IF (lead_vendedor IS NOT NULL OR slot_vendedor IS NOT NULL)
     AND COALESCE(lead_vendedor::text,'') <> COALESCE(slot_vendedor::text,'') THEN
    RAISE EXCEPTION 'Horário não pertence ao consultor deste lead';
  END IF;

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
END $$;
