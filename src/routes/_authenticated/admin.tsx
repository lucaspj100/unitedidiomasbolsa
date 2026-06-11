import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Star,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel · Leads United Idiomas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Lead = {
  id: string;
  nome: string;
  whatsapp: string;
  email: string;
  cidade_estado: string | null;
  profissao: string | null;
  empresa: string | null;
  nivel_ingles: string | null;
  motivo_ingles: string | null;
  impacto_ingles: string | null;
  perdeu_oportunidade: string | null;
  motivo_nao_faz_curso: string | null;
  decisao_entrevista: string | null;
  classificacao_lead: string;
  alta_prioridade: boolean;
  status: string;
  origem: string;
  data_cadastro: string;
  respostas_json: Record<string, unknown>;
};

const STATUSES = [
  "Novo",
  "Encaminhado para agendamento",
  "Entrevista agendada",
  "Contatado no WhatsApp",
  "Sem resposta",
  "Perdido",
  "Convertido",
] as const;

function AdminPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Filters
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterNivel, setFilterNivel] = useState<string>("all");
  const [filterOrigem, setFilterOrigem] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      await supabase.rpc("claim_admin");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await loadLeads();
      else setLoading(false);
    })();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("data_cadastro", { ascending: false });
    if (error) toast.error(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterClass !== "all" && l.classificacao_lead !== filterClass) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterNivel !== "all" && l.nivel_ingles !== filterNivel) return false;
      if (filterOrigem !== "all" && l.origem !== filterOrigem) return false;
      if (filterFrom && new Date(l.data_cadastro) < new Date(filterFrom)) return false;
      if (filterTo && new Date(l.data_cadastro) > new Date(filterTo + "T23:59:59")) return false;
      return true;
    });
  }, [leads, filterClass, filterStatus, filterNivel, filterOrigem, filterFrom, filterTo]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, status } : l)));
    }
  }

  function openWhatsapp(l: Lead) {
    const num = l.whatsapp.replace(/\D/g, "");
    const msg = `Olá, ${l.nome.split(" ")[0]}, tudo bem? Vi que você preencheu a avaliação para o processo de bolsa da United Idiomas.\n\nPelo seu perfil, faz sentido conversarmos para entender seu objetivo com o inglês e verificar se existe uma condição de bolsa disponível para você.\n\nVocê consegue conversar agora ou prefere que eu te chame em outro horário?`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function exportCsv() {
    const cols: Array<keyof Lead> = [
      "data_cadastro",
      "nome",
      "whatsapp",
      "email",
      "cidade_estado",
      "profissao",
      "empresa",
      "nivel_ingles",
      "motivo_ingles",
      "impacto_ingles",
      "perdeu_oportunidade",
      "motivo_nao_faz_curso",
      "decisao_entrevista",
      "classificacao_lead",
      "alta_prioridade",
      "status",
      "origem",
    ];
    const head = cols.join(",");
    const rows = filtered.map((l) =>
      cols
        .map((c) => {
          const v = l[c];
          const s = v === null || v === undefined ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [head, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-united-idiomas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Sua conta ainda não é administradora</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça a um admin existente para liberar seu acesso, ou peça para que excluam todos os admins atuais e cadastre-se novamente.
          </p>
          <Button className="mt-4" onClick={signOut} variant="outline">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">Painel de Leads</h1>
            <p className="text-xs text-muted-foreground">United Idiomas · Assistente de Bolsa</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect label="Classificação" value={filterClass} onChange={setFilterClass} options={["all", "quente", "morno", "frio", "curioso"]} />
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={["all", ...STATUSES]} />
          <FilterSelect label="Nível" value={filterNivel} onChange={setFilterNivel} options={["all", "Básico", "Intermediário", "Avançado", "Não sei avaliar"]} />
          <FilterSelect label="Origem" value={filterOrigem} onChange={setFilterOrigem} options={["all", "LinkedIn", "Instagram", "WhatsApp", "Anúncio", "Indicação"]} />
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-9" />
          </div>
        </div>

        <p className="mb-2 text-xs text-muted-foreground">{filtered.length} lead(s)</p>

        <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Contato</th>
                <th className="px-3 py-2">Nível</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Classif.</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum lead encontrado.</td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-border align-top hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.nome}</div>
                    <div className="text-xs text-muted-foreground">{l.profissao}</div>
                    <div className="text-xs text-muted-foreground">{l.cidade_estado}</div>
                    {l.alta_prioridade && (
                      <Badge className="mt-1 bg-warning/15 text-warning hover:bg-warning/20"><Star className="mr-1 h-3 w-3" />Alta prioridade</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{l.whatsapp}</div>
                    <div className="text-muted-foreground">{l.email}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{l.nivel_ingles}</td>
                  <td className="px-3 py-2 text-xs">{l.motivo_ingles}</td>
                  <td className="px-3 py-2"><ClassifBadge value={l.classificacao_lead} /></td>
                  <td className="px-3 py-2">
                    <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(l.data_cadastro).toLocaleDateString("pt-BR")}<br />
                    {new Date(l.data_cadastro).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openWhatsapp(l)} title="Abrir WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setViewLead(l)} title="Ver respostas">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateStatus(l.id, "Contatado no WhatsApp")}>Marcar como contatado</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(l.id, "Entrevista agendada")}>Marcar entrevista agendada</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(l.id, "Perdido")}>Marcar como perdido</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(l.id, "Convertido")}>Marcar como convertido</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <LeadDetailDialog lead={viewLead} onClose={() => setViewLead(null)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (<SelectItem key={o} value={o} className="text-xs">{o === "all" ? "Todos" : o}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClassifBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    quente: "bg-destructive/15 text-destructive hover:bg-destructive/20",
    morno: "bg-warning/15 text-warning hover:bg-warning/20",
    frio: "bg-accent/15 text-accent hover:bg-accent/20",
    curioso: "bg-muted text-muted-foreground hover:bg-muted",
  };
  return <Badge className={map[value] ?? map.curioso}>{value}</Badge>;
}

function LeadDetailDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{lead?.nome}</DialogTitle></DialogHeader>
        {lead && (
          <div className="grid gap-2 text-sm">
            <Row label="WhatsApp" value={lead.whatsapp} />
            <Row label="E-mail" value={lead.email} />
            <Row label="Cidade/Estado" value={lead.cidade_estado} />
            <Row label="Profissão" value={lead.profissao} />
            <Row label="Empresa" value={lead.empresa} />
            <Row label="Nível de inglês" value={lead.nivel_ingles} />
            <Row label="Motivo do inglês" value={lead.motivo_ingles} />
            <Row label="Impacto no dia a dia" value={lead.impacto_ingles} />
            <Row label="Perdeu oportunidade" value={lead.perdeu_oportunidade} />
            <Row label="Por que não faz curso" value={lead.motivo_nao_faz_curso} />
            <Row label="Decisão entrevista" value={lead.decisao_entrevista} />
            <Row label="Origem" value={lead.origem} />
            <Row label="Status" value={lead.status} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border pb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [link, setLink] = useState("");
  const [wa, setWa] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.from("app_settings").select("key,value");
      const map = new Map((data ?? []).map((r) => [r.key, r.value ?? ""]));
      setLink(map.get("scheduling_link") ?? "");
      setWa(map.get("whatsapp_number") ?? "");
    })();
  }, [open]);

  async function save() {
    setSaving(true);
    const rows = [
      { key: "scheduling_link", value: link },
      { key: "whatsapp_number", value: wa.replace(/\D/g, "") },
    ];
    const { error } = await supabase.from("app_settings").upsert(rows);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Configurações salvas");
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Configurações</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="link">Link de agendamento (Calendly/TidyCal)</Label>
            <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://calendly.com/..." />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wa">WhatsApp do consultor (com DDD)</Label>
            <Input id="wa" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="5511999999999" />
            <p className="text-xs text-muted-foreground">Use o formato internacional, ex: 5511999999999.</p>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
