import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Apenas administradores podem executar esta ação");
}

function validEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function validPassword(s: string) {
  return typeof s === "string" && s.length >= 8 && s.length <= 72;
}

/**
 * Cria a conta de auth do vendedor com senha provisória definida pelo admin.
 * Marca must_change_password=true para forçar troca no primeiro acesso.
 * Idempotente: se já existir, apenas redefine a senha.
 */
export const createVendedorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string }) => {
    if (!input?.email || !validEmail(input.email)) throw new Error("E-mail inválido");
    if (!validPassword(input.password)) throw new Error("Senha deve ter ao menos 8 caracteres");
    return { email: input.email.toLowerCase().trim(), password: input.password };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let authUserId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr && !/already|registered|exists|duplicate/i.test(createErr.message ?? "")) {
      throw new Error(createErr.message);
    }
    if (createErr) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const u = list?.users?.find((x) => x.email?.toLowerCase() === data.email);
      if (!u) throw new Error("Usuário existente não encontrado");
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
        password: data.password,
        email_confirm: true,
      });
      if (upErr) throw new Error(upErr.message);
      authUserId = u.id;
    } else {
      authUserId = created?.user?.id ?? null;
    }

    await supabaseAdmin
      .from("vendedores")
      .update({ must_change_password: true, ...(authUserId ? { user_id: authUserId } : {}) })
      .eq("email", data.email);

    return { ok: true };
  });

export const resetVendedorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { vendedorId: string; password: string }) => {
    if (!input?.vendedorId) throw new Error("Vendedor inválido");
    if (!validPassword(input.password)) throw new Error("Senha deve ter ao menos 8 caracteres");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v, error: vErr } = await supabaseAdmin
      .from("vendedores")
      .select("email,user_id")
      .eq("id", data.vendedorId)
      .maybeSingle();
    if (vErr || !v) throw new Error("Vendedor não encontrado");

    let userId = v.user_id as string | null;
    if (!userId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = list?.users?.find((x) => x.email?.toLowerCase() === (v.email as string).toLowerCase())?.id ?? null;
    }
    if (!userId) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: v.email as string,
        password: data.password,
        email_confirm: true,
      });
      if (cErr) throw new Error(cErr.message);
      userId = created?.user?.id ?? null;
    } else {
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (upErr) throw new Error(upErr.message);
    }
    await supabaseAdmin
      .from("vendedores")
      .update({ must_change_password: true, ...(userId ? { user_id: userId } : {}) })
      .eq("id", data.vendedorId);
    return { ok: true };
  });
