import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/i;

function parseInput(input: { leadId: string; publicSlug?: string | null }) {
  if (!input?.leadId || !UUID_RE.test(input.leadId)) throw new Error("Lead inválido");
  const slug = input.publicSlug && SLUG_RE.test(input.publicSlug) ? input.publicSlug.toLowerCase() : null;
  return { leadId: input.leadId, publicSlug: slug };
}

/**
 * Sincroniza o lead com o CRM United. Público (chamado pelo chatbot),
 * mas só aceita um UUID de lead já existente e nunca devolve dados internos.
 */
export const syncScholarshipLeadToCrm = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }) => {
    const { performCrmSync } = await import("@/lib/crm.server");
    const r = await performCrmSync(data.leadId, data.publicSlug);
    return { success: r.success };
  });

/** Reenvio manual pelo painel administrativo (mesmo external_lead_id, sem duplicar). */
export const resendLeadToCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error("Falha ao verificar permissão");
    if (!isAdmin) throw new Error("Apenas administradores podem reenviar leads");
    const { performCrmSync } = await import("@/lib/crm.server");
    const r = await performCrmSync(data.leadId, data.publicSlug);
    return { success: r.success, crmLeadId: r.crmLeadId, errorCode: r.errorCode };
  });
