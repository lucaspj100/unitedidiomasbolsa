import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Apenas administradores podem executar esta ação");
}

export const inviteVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; redirectTo?: string }) => {
    if (!input?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new Error("E-mail inválido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) {
      // se já existe, é ok — apenas reenviamos
      const msg = error.message || "";
      if (!/already|registered|exists/i.test(msg)) {
        throw new Error(msg);
      }
    }
    return { ok: true };
  });
