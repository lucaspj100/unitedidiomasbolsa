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
      { title: "Admin · Assistente de Bolsa United Idiomas" },
      { name: "description", content: "Acesso ao painel administrativo de leads." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowedEmail, setAllowedEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
    void supabase.rpc("get_public_settings").then(({ data }) => {
      const s = Array.isArray(data) && data[0] ? data[0] : null;
      // allowed_admin_email not exposed publicly; we just guard client-side messaging.
      if (s) setAllowedEmail(null);
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
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        const { data: claim } = await supabase.rpc("claim_admin");
        if (!claim) {
          await supabase.auth.signOut();
          throw new Error("Este e-mail não está autorizado para criar uma conta de administrador.");
        }
        toast.success("Conta de administrador criada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await supabase.rpc("claim_admin");
      }
      navigate({ to: "/admin" });
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
          <div className="rounded-lg gradient-hero p-2 text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Painel Admin · United Idiomas</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito à equipe consultora.</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Carregando…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Primeiro acesso? Criar conta" : "Já tem conta? Entrar"}
        </button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Apenas o e-mail autorizado pelo administrador principal pode criar conta.
          {allowedEmail && <> (<span className="font-medium">{allowedEmail}</span>)</>}
        </p>
      </div>
    </div>
  );
}
