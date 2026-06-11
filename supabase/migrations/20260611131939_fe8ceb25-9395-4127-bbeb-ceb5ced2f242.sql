
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Bootstrap: first signed-in user becomes admin if no admin exists
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(uid, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

-- Leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text NOT NULL,
  cidade_estado text,
  profissao text,
  empresa text,
  nivel_ingles text,
  motivo_ingles text,
  impacto_ingles text,
  perdeu_oportunidade text,
  motivo_nao_faz_curso text,
  decisao_entrevista text,
  classificacao_lead text NOT NULL DEFAULT 'curioso',
  alta_prioridade boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Novo',
  origem text NOT NULL DEFAULT 'LinkedIn',
  respostas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_cadastro timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leads_data_cadastro_idx ON public.leads (data_cadastro DESC);
CREATE INDEX leads_classificacao_idx ON public.leads (classificacao_lead);
CREATE INDEX leads_status_idx ON public.leads (status);

GRANT INSERT ON public.leads TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Anyone (chatbot visitors) can create a lead
CREATE POLICY "Anyone can insert leads"
  ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read/update/delete
CREATE POLICY "Admins can read leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- App settings (key/value)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public function exposing only the safe settings the chatbot needs
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (scheduling_link text, whatsapp_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT value FROM public.app_settings WHERE key = 'scheduling_link'),
    (SELECT value FROM public.app_settings WHERE key = 'whatsapp_number')
$$;

GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

INSERT INTO public.app_settings (key, value) VALUES
  ('scheduling_link', ''),
  ('whatsapp_number', '')
ON CONFLICT DO NOTHING;
