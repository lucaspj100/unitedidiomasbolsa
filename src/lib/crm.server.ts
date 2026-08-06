/**
 * Integração server-only com o CRM United.
 * O segredo (SCHOLARSHIP_WEBHOOK_SECRET) é lido apenas aqui, nunca vai ao navegador,
 * nunca é logado e nunca é persistido no banco.
 */

const CRM_ENDPOINT = "https://crmunited.lovable.app/api/public/receive-scholarship-lead";
const TIMEOUT_MS = 10_000;

export type CrmSyncResult = {
  success: boolean;
  crmLeadId: string | null;
  currentStatus: string | null;
  errorCode: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/i;

function txt(v: unknown, max = 500): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizeWhatsapp(v: unknown): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Mensagem técnica curta e sem dados sensíveis, segura para persistir/exibir. */
function sanitizeError(code: string, detail?: string): string {
  const clean = (detail ?? "")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return clean ? `${code}: ${clean}` : code;
}

type LeadRow = Record<string, unknown>;

export function buildCrmPayload(lead: LeadRow, publicSlug: string) {
  const respostas = lead["respostas_json"];
  const concluido = ["aprovado", "encerrado", "financeiro_sem_fit", "aguardando_agenda"].includes(
    String(lead["etapa_atual"] ?? ""),
  ) || Boolean(lead["scheduled_at"]);

  return {
    external_lead_id: String(lead["id"]),
    public_slug: publicSlug,
    nome: txt(lead["nome"], 160),
    whatsapp: normalizeWhatsapp(lead["whatsapp"]),
    email: txt(lead["email"], 254),
    cidade_estado: txt(lead["cidade_estado"], 120),
    profissao: txt(lead["profissao"], 120),
    empresa: txt(lead["empresa"], 120),
    nivel_ingles: txt(lead["nivel_ingles"], 60),
    motivo_ingles: txt(lead["motivo_ingles"], 200),
    impacto_ingles: txt(lead["impacto_ingles"], 200),
    perdeu_oportunidade: txt(lead["perdeu_oportunidade"], 200),
    motivo_nao_faz_curso: txt(lead["motivo_nao_faz_curso"], 200),
    prazo_inicio: txt(lead["prazo_inicio"], 120),
    alinhamento_financeiro: txt(lead["alinhamento_financeiro"], 200),
    decisao_entrevista: txt(lead["decisao_entrevista"], 200),
    classificacao: txt(lead["classificacao_lead"], 20),
    alta_prioridade: Boolean(lead["alta_prioridade"]),
    status_formulario: txt(lead["status"], 120),
    etapa_formulario: txt(lead["etapa_atual"], 120),
    respostas_json:
      respostas && typeof respostas === "object" && !Array.isArray(respostas) ? respostas : {},
    entrevista_solicitada_para: isoOrNull(lead["scheduled_at"]),
    formulario_concluido: concluido,
    origem: "Processo bolsista",
    source_system: "unitedidiomasbolsa",
  };
}

async function postToCrm(payload: unknown): Promise<CrmSyncResult> {
  const secret = process.env["SCHOLARSHIP_WEBHOOK_SECRET"];
  if (!secret) {
    return { success: false, crmLeadId: null, currentStatus: null, errorCode: "MISSING_SECRET" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CRM_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-scholarship-secret": secret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }
    if (!res.ok) {
      const code =
        res.status === 401 || res.status === 403
          ? "CRM_UNAUTHORIZED"
          : res.status >= 500
            ? "CRM_UNAVAILABLE"
            : "CRM_REJECTED";
      return {
        success: false,
        crmLeadId: null,
        currentStatus: null,
        errorCode: sanitizeError(code, `${res.status} ${txt(body["error"], 80) ?? ""}`),
      };
    }
    const id = body["lead_id"] ?? body["id"] ?? body["crm_lead_id"] ?? null;
    return {
      success: true,
      crmLeadId: id ? String(id) : null,
      currentStatus: txt(body["status"], 60),
      errorCode: null,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      success: false,
      crmLeadId: null,
      currentStatus: null,
      errorCode: aborted ? "CRM_TIMEOUT" : "CRM_UNAVAILABLE",
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sincroniza (cria ou atualiza) o lead no CRM de forma idempotente,
 * sempre com o mesmo external_lead_id (o UUID local do lead).
 */
export async function performCrmSync(leadId: string, slugHint?: string | null): Promise<CrmSyncResult> {
  if (!UUID_RE.test(leadId)) {
    return { success: false, crmLeadId: null, currentStatus: null, errorCode: "INVALID_LEAD_ID" };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: LeadRow | null }> };
      };
      update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<unknown> };
    };
  };

  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) {
    return { success: false, crmLeadId: null, currentStatus: null, errorCode: "LEAD_NOT_FOUND" };
  }

  // Slug público: prioriza o slug do link; fallback para o cadastro do vendedor.
  let slug = slugHint && SLUG_RE.test(slugHint) ? slugHint.toLowerCase() : null;
  if (!slug && lead["vendedor_id"]) {
    const { data: v } = await db
      .from("vendedores")
      .select("slug")
      .eq("id", String(lead["vendedor_id"]))
      .maybeSingle();
    const s = txt(v?.["slug"], 60);
    if (s && SLUG_RE.test(s)) slug = s.toLowerCase();
  }
  if (!slug) {
    const err = sanitizeError("INVALID_SLUG", "lead sem slug público de vendedor");
    await db
      .from("leads")
      .update({
        crm_sync_status: "failed",
        crm_last_sync_error: err,
        crm_last_attempt_at: new Date().toISOString(),
        crm_sync_attempts: Number(lead["crm_sync_attempts"] ?? 0) + 1,
      })
      .eq("id", leadId);
    return { success: false, crmLeadId: null, currentStatus: null, errorCode: "INVALID_SLUG" };
  }

  const payload = buildCrmPayload(lead, slug);
  if (!payload.nome || !payload.whatsapp || !payload.email || !EMAIL_RE.test(payload.email)) {
    return { success: false, crmLeadId: null, currentStatus: null, errorCode: "INCOMPLETE_LEAD" };
  }

  await db.from("leads").update({ crm_sync_status: "syncing" }).eq("id", leadId);

  // Tentativa imediata + retentativa curta com backoff (sem bloquear o candidato).
  let result = await postToCrm(payload);
  if (!result.success && result.errorCode !== "CRM_REJECTED") {
    await sleep(3000);
    result = await postToCrm(payload);
  }

  const now = new Date().toISOString();
  if (result.success) {
    await db
      .from("leads")
      .update({
        crm_sync_status: "synced",
        crm_lead_id: result.crmLeadId,
        crm_synced_at: now,
        crm_last_attempt_at: now,
        crm_last_sync_error: null,
      })
      .eq("id", leadId);
  } else {
    const attempts = Number(lead["crm_sync_attempts"] ?? 0) + 1;
    await db
      .from("leads")
      .update({
        crm_sync_status: attempts >= 5 ? "failed" : "pending",
        crm_sync_attempts: attempts,
        crm_last_attempt_at: now,
        crm_last_sync_error: sanitizeError(result.errorCode ?? "CRM_ERROR"),
      })
      .eq("id", leadId);
    console.error("[crm-sync] lead", leadId, "->", result.errorCode);
  }
  return result;
}
