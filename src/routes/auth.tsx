import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · United Idiomas" },
      { name: "description", content: "Acesso da equipe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

async function redirectByRole(navigate: ReturnType<typeof useNavigate>) {
  await supabase.rpc("claim_admin");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  if ((roles ?? []).some(r => r.role === "admin")) { navigate({ to: "/admin" }); return; }
  const { data: vend } = await supabase.from("vendedores").select("id, ativo, must_change_password").eq("user_id", u.user.id).maybeSingle();
  if (!vend) { navigate({ to: "/vendedor" }); return; }
  if (!vend.ativo) {
    await supabase.auth.signOut();
    toast.error("Seu acesso está inativo. Entre em contato com o administrador.");
    return;
  }
  if (vend.must_change_password) { navigate({ to: "/trocar-senha" }); return; }
  navigate({ to: "/vendedor" });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void redirectByRole(navigate);
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        toast.success("Conta criada. Faça login para continuar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await redirectByRole(navigate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao autenticar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="shadow-card w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg gradient-hero p-2 text-primary-foreground"><GraduationCap className="h-5 w-5" /></div>
          <div>
            <h1 className="text-base font-semibold">Painel · United Idiomas</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito à equipe.</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Carregando…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <button type="button" onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Primeiro acesso? Criar conta" : "Já tem conta? Entrar"}
        </button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Consultores: use o e-mail cadastrado pela administração. Você foi convidado por e-mail.
        </p>
      </div>
    </div>
  );
}
