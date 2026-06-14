import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatbotFlow } from "@/components/ChatbotFlow";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/agendar/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agendar entrevista · United Idiomas" },
      { name: "description", content: "Avaliação rápida para o processo de bolsa de inglês da United Idiomas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgendarPage,
});

type VendedorRow = { id: string; nome: string; ativo: boolean };

function AgendarPage() {
  const { slug } = Route.useParams();
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; v: VendedorRow } | { status: "inactive" } | { status: "notfound" }>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data, error } = await supabase.rpc("get_vendedor_by_slug", { p_slug: slug });
      const row = Array.isArray(data) && data[0] ? (data[0] as VendedorRow) : null;
      if (!mounted) return;
      if (error || !row) { setState({ status: "notfound" }); return; }
      if (!row.ativo) { setState({ status: "inactive" }); return; }
      setState({ status: "ok", v: row });
    })();
    return () => { mounted = false; };
  }, [slug]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state.status === "notfound") {
    return <Message title="Link não encontrado" body="Este link de agendamento não foi encontrado. Verifique se o link está correto ou entre em contato com nossa equipe." />;
  }
  if (state.status === "inactive") {
    return <Message title="Link indisponível" body="Este link de agendamento não está disponível no momento. Entre em contato com nossa equipe." />;
  }
  return <ChatbotFlow vendedorId={state.v.id} vendedorNome={state.v.nome} />;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
