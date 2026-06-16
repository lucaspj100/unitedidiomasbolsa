import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  head: () => ({ meta: [{ title: "Trocar senha · United Idiomas" }, { name: "robots", content: "noindex" }] }),
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const admin = (roles ?? []).some(r => r.role === "admin");
      setIsAdmin(admin);
      const { data: v } = await supabase.from("vendedores").select("id,must_change_password").eq("user_id", u.user.id).maybeSingle();
      if (admin && (!v || !v.must_change_password)) navigate({ to: "/admin" });
      if (!admin && v && !v.must_change_password) navigate({ to: "/vendedor", replace: true });
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) { toast.error("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (pwd !== pwd2) { toast.error("As senhas não conferem."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      const { data: completed, error: completeError } = await supabase.rpc("complete_vendedor_password_change");
      if (completeError) throw completeError;
      if (!isAdmin && !completed) throw new Error("Conta de consultor não encontrada ou inativa.");
      toast.success("Senha atualizada.");
      navigate({ to: isAdmin ? "/admin" : "/vendedor", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar senha");
    } finally { setLoading(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="shadow-card w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground"><KeyRound className="h-5 w-5" /></div>
          <div>
            <h1 className="text-base font-semibold">Defina sua senha</h1>
            <p className="text-xs text-muted-foreground">Você precisa criar uma senha pessoal antes de acessar o painel.</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pwd">Nova senha</Label>
            <Input id="pwd" type="password" required minLength={8} value={pwd} onChange={e => setPwd(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pwd2">Confirmar senha</Label>
            <Input id="pwd2" type="password" required minLength={8} value={pwd2} onChange={e => setPwd2(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar e continuar"}</Button>
        </form>
        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
      </div>
    </div>
  );
}
