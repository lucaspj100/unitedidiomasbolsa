ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS prazo_inicio text;

CREATE OR REPLACE FUNCTION public.save_lead_progress(p_id uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      motivo_nao_faz_curso, prazo_inicio, alinhamento_financeiro, decisao_entrevista, classificacao_lead,
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
      p_data->>'prazo_inicio',
      p_data->>'alinhamento_financeiro',
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
      prazo_inicio = COALESCE(p_data->>'prazo_inicio', prazo_inicio),
      alinhamento_financeiro = COALESCE(p_data->>'alinhamento_financeiro', alinhamento_financeiro),
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
END $function$;