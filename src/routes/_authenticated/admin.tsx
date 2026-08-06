import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Download, LogOut, MessageCircle, Settings, Star, Eye, Trash2, Plus, CalendarClock, Users, Copy, ExternalLink, Mail,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resendLeadToCrm } from "@/lib/crm-sync.functions";
import { createVendedorAccount, resetVendedorPassword } from "@/lib/vendedores.functions";

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
  prazo_inicio: string | null;
  alinhamento_financeiro: string | null;
  decisao_entrevista: string | null;
  classificacao_lead: string;
  alta_prioridade: boolean;
  status: string;
  origem: string;
  data_cadastro: string;
  ultima_interacao: string | null;
  etapa_atual: string | null;
  scheduled_at: string | null;
  respostas_json: Record<string, unknown>;
  crm_lead_id: string | null;
  crm_sync_status: string | null;
  crm_sync_attempts: number | null;
  crm_last_sync_error: string | null;
  crm_synced_at: string | null;
  crm_last_attempt_at: string | null;
};

type Slot = { id: string; scheduled_at: string; lead_id: string | null; notes: string | null; vendedor_id: string | null };
type VendedorOpt = { id: string; nome: string; ativo: boolean };

const STATUSES = [
  "Cadastro iniciado",
  "Formulário incompleto",
  "Perfil aprovado para entrevista",
  "Entrevista agendada",
  "Aguardando disponibilidade de agenda",
  "Não agendou",
  "Perfil não aprovado",
  "Contatado no WhatsApp",
  "Sem resposta",
  "Perdido",
  "Convertido",
] as const;

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      await supabase.rpc("claim_admin");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Sua conta não está autorizada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas o e-mail principal pode acessar o painel administrativo.
          </p>
          <Button className="mt-4" onClick={signOut} variant="outline"><LogOut className="mr-2 h-4 w-4" />Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">Painel Administrativo</h1>
            <p className="text-xs text-muted-foreground">United Idiomas · Assistente de Bolsa</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {isAdmin && (
          <Tabs defaultValue="leads">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
              <TabsTrigger value="horarios">Horários</TabsTrigger>
              <TabsTrigger value="equipe">Equipe</TabsTrigger>
            </TabsList>
            <TabsContent value="leads"><LeadsTab /></TabsContent>
            <TabsContent value="agendamentos"><AgendamentosTab /></TabsContent>
            <TabsContent value="horarios"><HorariosTab /></TabsContent>
            <TabsContent value="equipe"><EquipeTab /></TabsContent>
          </Tabs>
        )}
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// -------- Leads tab --------
function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterNivel, setFilterNivel] = useState("all");
  const [filterFinanceiro, setFilterFinanceiro] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [viewLead, setViewLead] = useState<Lead | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*").order("ultima_interacao", { ascending: false });
    if (error) toast.error(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  const filtered = useMemo(() => leads.filter((l) => {
    if (filterClass !== "all" && l.classificacao_lead !== filterClass) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterNivel !== "all" && l.nivel_ingles !== filterNivel) return false;
    if (filterFinanceiro !== "all") {
      const v = l.alinhamento_financeiro;
      if (filterFinanceiro === "positivo") {
        if (!v || v === "Hoje não consigo investir esse valor" || v === "Prefiro entender melhor na entrevista") return false;
      } else if (filterFinanceiro === "talvez") {
        if (v !== "Prefiro entender melhor na entrevista") return false;
      } else if (filterFinanceiro === "sem_fit") {
        if (v !== "Hoje não consigo investir esse valor") return false;
      }
    }
    if (filterFrom && new Date(l.data_cadastro) < new Date(filterFrom)) return false;
    if (filterTo && new Date(l.data_cadastro) > new Date(filterTo + "T23:59:59")) return false;
    return true;
  }), [leads, filterClass, filterStatus, filterNivel, filterFinanceiro, filterFrom, filterTo]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, status } : l))); }
  }
  function openWhatsapp(l: Lead) {
    const num = l.whatsapp.replace(/\D/g, "");
    const msg = `Olá, ${l.nome.split(" ")[0]}, tudo bem? Vi que você preencheu a avaliação para o processo de bolsa da United Idiomas.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }
  function exportCsv() {
    const cols: Array<keyof Lead> = ["data_cadastro","ultima_interacao","status","etapa_atual","nome","whatsapp","email","cidade_estado","profissao","empresa","nivel_ingles","motivo_ingles","impacto_ingles","perdeu_oportunidade","motivo_nao_faz_curso","prazo_inicio","alinhamento_financeiro","decisao_entrevista","classificacao_lead","alta_prioridade","scheduled_at","origem"];
    const head = cols.join(",");
    const rows = filtered.map((l) => cols.map((c) => {
      const v = l[c]; const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(","));
    const csv = [head, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <FilterSelect label="Classificação" value={filterClass} onChange={setFilterClass} options={["all", "quente", "morno", "frio", "curioso"]} />
        <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={["all", ...STATUSES]} />
        <FilterSelect label="Nível" value={filterNivel} onChange={setFilterNivel} options={["all", "Básico", "Intermediário", "Avançado", "Não sei avaliar"]} />
        <div>
          <Label className="text-xs">Fit financeiro</Label>
          <Select value={filterFinanceiro} onValueChange={setFilterFinanceiro}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos</SelectItem>
              <SelectItem value="positivo" className="text-xs">Fit positivo</SelectItem>
              <SelectItem value="talvez" className="text-xs">Prefere entender melhor</SelectItem>
              <SelectItem value="sem_fit" className="text-xs">Sem fit financeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">De</Label><Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-9" /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-9" /></div>
        <div className="flex items-end"><Button variant="outline" className="w-full" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button></div>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{filtered.length} lead(s)</p>

      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Nível</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Agendada</th>
              <th className="px-3 py-2">CRM</th>
              <th className="px-3 py-2">Última int.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>)}
            {!loading && filtered.length === 0 && (<tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nenhum lead encontrado.</td></tr>)}
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-border align-top hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{l.nome || "(sem nome)"}</div>
                  <div className="text-xs text-muted-foreground">{l.profissao}</div>
                  <div className="text-xs text-muted-foreground">{l.cidade_estado}</div>
                  {l.alta_prioridade && (<Badge className="mt-1 bg-warning/15 text-warning"><Star className="mr-1 h-3 w-3" />Alta prioridade</Badge>)}
                  <div className="mt-1"><ClassifBadge value={l.classificacao_lead} /></div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{l.whatsapp}</div>
                  <div className="text-muted-foreground">{l.email}</div>
                </td>
                <td className="px-3 py-2 text-xs">{l.nivel_ingles ?? "—"}</td>
                <td className="px-3 py-2">
                  <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                    <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.etapa_atual ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{l.scheduled_at ? fmtDateTime(l.scheduled_at) : "—"}</td>
                <td className="px-3 py-2"><CrmSyncCell lead={l} onDone={() => void load()} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.ultima_interacao ? fmtDateTime(l.ultima_interacao) : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => openWhatsapp(l)} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setViewLead(l)} title="Ver"><Eye className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeadDetailDialog lead={viewLead} onClose={() => setViewLead(null)} />
    </div>
  );
}

// -------- Agendamentos tab --------
function AgendamentosTab() {
  const [rows, setRows] = useState<Array<Slot & { lead: Lead | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data: slotsData } = await supabase.from("interview_slots").select("*").not("lead_id", "is", null).order("scheduled_at");
    const slots = (slotsData ?? []) as Slot[];
    const ids = slots.map((s) => s.lead_id!).filter(Boolean);
    let leadMap = new Map<string, Lead>();
    if (ids.length) {
      const { data: leadsData } = await supabase.from("leads").select("*").in("id", ids);
      leadMap = new Map(((leadsData ?? []) as Lead[]).map((l) => [l.id, l]));
    }
    setRows(slots.map((s) => ({ ...s, lead: s.lead_id ? leadMap.get(s.lead_id) ?? null : null })));
    setLoading(false);
  }

  async function cancel(slot: Slot) {
    if (!confirm("Cancelar este agendamento? O horário ficará livre novamente.")) return;
    const { error: e1 } = await supabase.from("interview_slots").update({ lead_id: null }).eq("id", slot.id);
    if (e1) { toast.error(e1.message); return; }
    if (slot.lead_id) {
      await supabase.from("leads").update({ scheduled_at: null, status: "Não agendou" }).eq("id", slot.lead_id);
    }
    toast.success("Agendamento cancelado");
    await load();
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const todays = rows.filter((r) => { const d = new Date(r.scheduled_at); return d >= today && d < tomorrow; });
  const future = rows.filter((r) => new Date(r.scheduled_at) >= tomorrow);

  return (
    <div className="mt-4 grid gap-6">
      <Section title={`Hoje (${todays.length})`} loading={loading} rows={todays} onCancel={cancel} />
      <Section title={`Próximos (${future.length})`} loading={loading} rows={future} onCancel={cancel} />
    </div>
  );
}

function Section({ title, loading, rows, onCancel }: { title: string; loading: boolean; rows: Array<Slot & { lead: Lead | null }>; onCancel: (s: Slot) => void }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Candidato</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Cidade · Profissão</th>
              <th className="px-3 py-2">Nível</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>)}
            {!loading && rows.length === 0 && (<tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum agendamento.</td></tr>)}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 text-xs">{fmtDateTime(r.scheduled_at)}</td>
                <td className="px-3 py-2"><div className="font-medium">{r.lead?.nome ?? "—"}</div></td>
                <td className="px-3 py-2 text-xs"><div>{r.lead?.whatsapp}</div><div className="text-muted-foreground">{r.lead?.email}</div></td>
                <td className="px-3 py-2 text-xs">{r.lead?.cidade_estado} · {r.lead?.profissao}</td>
                <td className="px-3 py-2 text-xs">{r.lead?.nivel_ingles}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => onCancel(r)} title="Cancelar"><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -------- Horários tab --------
function HorariosTab() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [vendedores, setVendedores] = useState<VendedorOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [times, setTimes] = useState("19:00, 20:00");
  const [vendedorId, setVendedorId] = useState<string>("");
  const [filterVendedor, setFilterVendedor] = useState<string>("all");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: slotsData }, { data: vendData }] = await Promise.all([
      supabase.from("interview_slots").select("*").gte("scheduled_at", new Date().toISOString()).order("scheduled_at"),
      supabase.from("vendedores").select("id,nome,ativo").order("nome"),
    ]);
    setSlots((slotsData ?? []) as Slot[]);
    setVendedores((vendData ?? []) as VendedorOpt[]);
    setLoading(false);
  }

  const vendNameById = useMemo(() => new Map(vendedores.map(v => [v.id, v.nome])), [vendedores]);
  const filteredSlots = useMemo(() => {
    if (filterVendedor === "all") return slots;
    if (filterVendedor === "legacy") return slots.filter(s => !s.vendedor_id);
    return slots.filter(s => s.vendedor_id === filterVendedor);
  }, [slots, filterVendedor]);

  async function add() {
    if (!vendedorId) { toast.error("Selecione o vendedor."); return; }
    if (!date) { toast.error("Selecione uma data."); return; }
    const list = times.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
    if (!list.length) { toast.error("Informe ao menos um horário."); return; }
    const rows = list.map((t) => {
      const [h, m] = t.split(":");
      const d = new Date(`${date}T${(h ?? "0").padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}:00`);
      return { scheduled_at: d.toISOString(), vendedor_id: vendedorId };
    });
    const { error } = await supabase.from("interview_slots").insert(rows);
    if (error) toast.error(error.message);
    else { toast.success(`${rows.length} horário(s) adicionado(s).`); await load(); }
  }

  async function remove(id: string) {
    if (!confirm("Remover este horário?")) return;
    const { error } = await supabase.from("interview_slots").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Horário removido"); setSlots((arr) => arr.filter((s) => s.id !== id)); }
  }

  async function release(id: string) {
    if (!confirm("Liberar este horário (cancela o agendamento atual)?")) return;
    const slot = slots.find((s) => s.id === id);
    const { error } = await supabase.from("interview_slots").update({ lead_id: null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (slot?.lead_id) await supabase.from("leads").update({ scheduled_at: null, status: "Não agendou" }).eq("id", slot.lead_id);
    toast.success("Horário liberado");
    await load();
  }

  return (
    <div className="mt-4 grid gap-6">
      <div className="shadow-card rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2"><CalendarClock className="h-4 w-4" /><h2 className="text-sm font-semibold">Cadastrar horários</h2></div>
        <p className="mb-3 text-xs text-muted-foreground">Cada horário pertence a um vendedor. Os candidatos veem apenas horários livres do consultor cujo link abriram, nos próximos 4 dias.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_1fr_auto]">
          <div>
            <Label className="text-xs">Vendedor</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {vendedores.filter(v => v.ativo).map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">Horários (separados por vírgula)</Label><Input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="19:00, 20:00, 21:00" /></div>
          <div className="flex items-end"><Button onClick={add}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></div>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="w-64">
          <Label className="text-xs">Filtrar por vendedor</Label>
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="legacy">Sem vendedor (legado)</SelectItem>
              {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{filteredSlots.length} horário(s)</p>
      </div>

      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Data e hora</th><th className="px-3 py-2">Vendedor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>)}
            {!loading && filteredSlots.length === 0 && (<tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nenhum horário.</td></tr>)}
            {filteredSlots.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs">{fmtDateTime(s.scheduled_at)}</td>
                <td className="px-3 py-2 text-xs">{s.vendedor_id ? (vendNameById.get(s.vendedor_id) ?? "—") : <span className="text-muted-foreground">— legado —</span>}</td>
                <td className="px-3 py-2">{s.lead_id ? <Badge>Ocupado</Badge> : <Badge variant="secondary">Disponível</Badge>}</td>
                <td className="px-3 py-2 text-right">
                  {s.lead_id ? (
                    <Button size="sm" variant="ghost" onClick={() => release(s.id)}>Liberar</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// -------- Equipe (vendedores) tab --------
type Vendedor = { id: string; nome: string; email: string; whatsapp: string | null; slug: string; ativo: boolean; user_id: string | null; created_at: string; must_change_password: boolean };

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function EquipeTab() {
  const [rows, setRows] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "", slug: "", password: genPassword() });
  const [creating, setCreating] = useState(false);
  const [shownCred, setShownCred] = useState<{ email: string; password: string } | null>(null);
  const createAccount = useServerFn(createVendedorAccount);
  const resetPwd = useServerFn(resetVendedorPassword);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("vendedores").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setRows((data ?? []) as Vendedor[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function slugify(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  }

  async function create() {
    if (!form.nome || !form.email) { toast.error("Preencha nome e e-mail."); return; }
    if (form.password.length < 8) { toast.error("Senha provisória precisa ter ao menos 8 caracteres."); return; }
    const slug = (form.slug || slugify(form.nome)).trim();
    if (!slug) { toast.error("Slug inválido."); return; }
    setCreating(true);
    const email = form.email.toLowerCase().trim();
    try {
      const { error } = await supabase.from("vendedores").insert({
        nome: form.nome, email, whatsapp: form.whatsapp || null, slug, ativo: true,
      });
      if (error) throw error;
      await createAccount({ data: { email, password: form.password } });
      setShownCred({ email, password: form.password });
      toast.success("Vendedor cadastrado. Envie a senha provisória pelo WhatsApp.");
      setForm({ nome: "", email: "", whatsapp: "", slug: "", password: genPassword() });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally { setCreating(false); }
  }

  async function toggleAtivo(v: Vendedor) {
    const { error } = await supabase.from("vendedores").update({ ativo: !v.ativo }).eq("id", v.id);
    if (error) toast.error(error.message); else { toast.success(v.ativo ? "Inativado" : "Ativado"); await load(); }
  }
  async function remove(v: Vendedor) {
    if (!confirm(`Remover ${v.nome}? Leads e agendamentos antigos serão mantidos.`)) return;
    const { error } = await supabase.from("vendedores").delete().eq("id", v.id);
    if (error) toast.error(error.message); else { toast.success("Removido"); await load(); }
  }
  async function resetPassword(v: Vendedor) {
    const pwd = genPassword();
    if (!confirm(`Gerar nova senha provisória para ${v.nome}? A senha atual deixará de funcionar.`)) return;
    try {
      await resetPwd({ data: { vendedorId: v.id, password: pwd } });
      setShownCred({ email: v.email, password: pwd });
      toast.success("Senha redefinida.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao redefinir senha"); }
  }

  return (
    <div className="mt-4 grid gap-6">
      <div className="shadow-card rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="text-sm font-semibold">Cadastrar vendedor</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label className="text-xs">Nome completo</Label><Input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value, slug: f.slug || slugify(e.target.value)}))} /></div>
          <div><Label className="text-xs">E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
          <div><Label className="text-xs">WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp: e.target.value}))} placeholder="(11) 99999-9999" /></div>
          <div><Label className="text-xs">Slug do link</Label><Input value={form.slug} onChange={e => setForm(f => ({...f, slug: slugify(e.target.value)}))} placeholder="maria-souza" /></div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Senha provisória</Label>
            <div className="flex gap-2">
              <Input value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="font-mono" />
              <Button type="button" variant="outline" onClick={() => setForm(f => ({...f, password: genPassword()}))}>Gerar</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">O vendedor será obrigado a trocar a senha no primeiro acesso.</p>
          </div>
        </div>
        <Button className="mt-3" disabled={creating} onClick={create}><Plus className="mr-2 h-4 w-4" />{creating ? "Cadastrando…" : "Cadastrar e criar acesso"}</Button>
      </div>

      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Vendedor</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Link</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhum vendedor cadastrado.</td></tr>}
            {rows.map(v => {
              const link = typeof window !== "undefined" ? `${window.location.origin}/agendar/${v.slug}` : `/agendar/${v.slug}`;
              return (
                <tr key={v.id} className="border-t border-border align-top">
                  <td className="px-3 py-2"><div className="font-medium">{v.nome}</div><div className="text-xs text-muted-foreground">{v.whatsapp ?? "—"}</div></td>
                  <td className="px-3 py-2 text-xs">{v.email}{v.must_change_password && <Badge variant="secondary" className="ml-2">senha provisória</Badge>}</td>
                  <td className="px-3 py-2 text-xs"><span className="font-mono">/agendar/{v.slug}</span></td>
                  <td className="px-3 py-2">{v.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Copiar link" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title="Abrir link" onClick={() => window.open(link, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title="Resetar senha" onClick={() => void resetPassword(v)}><Mail className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleAtivo(v)}>{v.ativo ? "Inativar" : "Ativar"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void remove(v)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!shownCred} onOpenChange={(o) => !o && setShownCred(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Acesso criado</DialogTitle></DialogHeader>
          {shownCred && (
            <div className="grid gap-3 text-sm">
              <p className="text-muted-foreground">Envie estes dados ao vendedor. Esta é a única vez que a senha será exibida.</p>
              <div><Label className="text-xs">E-mail</Label><Input readOnly value={shownCred.email} className="font-mono" /></div>
              <div><Label className="text-xs">Senha provisória</Label><Input readOnly value={shownCred.password} className="font-mono" /></div>
              <Button onClick={() => { void navigator.clipboard.writeText(`E-mail: ${shownCred.email}\nSenha: ${shownCred.password}\nAcesse: ${typeof window !== "undefined" ? window.location.origin : ""}/auth`); toast.success("Copiado"); }}>
                <Copy className="mr-2 h-4 w-4" />Copiar credenciais
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



// -------- Helpers --------
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => (<SelectItem key={o} value={o} className="text-xs">{o === "all" ? "Todos" : o}</SelectItem>))}</SelectContent>
      </Select>
    </div>
  );
}
function ClassifBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    quente: "bg-destructive/15 text-destructive",
    morno: "bg-warning/15 text-warning",
    frio: "bg-accent/15 text-accent",
    curioso: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[value] ?? map.curioso}>{value}</Badge>;
}

function LeadDetailDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lead?.nome || "(sem nome)"}</DialogTitle></DialogHeader>
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
            <Row label="Prazo para começar" value={lead.prazo_inicio} />
            <Row label="Alinhamento financeiro" value={lead.alinhamento_financeiro} />
            <Row label="Decisão entrevista" value={lead.decisao_entrevista} />
            <Row label="Status" value={lead.status} />
            <Row label="Etapa em que parou" value={lead.etapa_atual} />
            <Row label="Última interação" value={lead.ultima_interacao ? fmtDateTime(lead.ultima_interacao) : null} />
            <Row label="Entrevista agendada" value={lead.scheduled_at ? fmtDateTime(lead.scheduled_at) : null} />
            <Row label="Origem" value={lead.origem} />
            <Row label="external_lead_id" value={lead.id} />
            <Row label="CRM · ID" value={lead.crm_lead_id} />
            <Row label="CRM · Sincronização" value={lead.crm_sync_status} />
            <Row label="CRM · Tentativas" value={lead.crm_sync_attempts != null ? String(lead.crm_sync_attempts) : null} />
            <Row label="CRM · Última tentativa" value={lead.crm_last_attempt_at ? fmtDateTime(lead.crm_last_attempt_at) : null} />
            <Row label="CRM · Sincronizado em" value={lead.crm_synced_at ? fmtDateTime(lead.crm_synced_at) : null} />
            <Row label="CRM · Último erro" value={lead.crm_last_sync_error} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CrmSyncCell({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const resend = useServerFn(resendLeadToCrm);
  const [sending, setSending] = useState(false);
  const status = lead.crm_sync_status ?? "pending";
  const tone =
    status === "synced" ? "bg-success/15 text-success"
      : status === "failed" ? "bg-destructive/15 text-destructive"
        : status === "syncing" ? "bg-primary/15 text-primary"
          : "bg-warning/15 text-warning";
  return (
    <div className="text-xs">
      <Badge className={tone}>{status}</Badge>
      {(lead.crm_sync_attempts ?? 0) > 0 && (
        <div className="mt-1 text-muted-foreground">{lead.crm_sync_attempts} tentativa(s)</div>
      )}
      {lead.crm_last_sync_error && (
        <div className="mt-1 max-w-[180px] truncate text-muted-foreground" title={lead.crm_last_sync_error}>
          {lead.crm_last_sync_error}
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="mt-1 h-7 text-xs"
        disabled={sending}
        onClick={() => {
          setSending(true);
          void (async () => {
            try {
              const r = await resend({ data: { leadId: lead.id } });
              if (r?.success) toast.success("Lead reenviado ao CRM");
              else toast.error(`Não foi possível reenviar (${r?.errorCode ?? "erro"})`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha ao reenviar");
            } finally {
              setSending(false);
              onDone();
            }
          })();
        }}
      >
        {sending ? "Enviando…" : "Reenviar ao CRM"}
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 border-b border-border pb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words">{value || "—"}</span>
    </div>
  );
}

// -------- Settings dialog --------
function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [link, setLink] = useState("");
  const [wa, setWa] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandSubtitle, setBrandSubtitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.from("app_settings").select("key,value");
      const map = new Map((data ?? []).map((r) => [r.key, r.value ?? ""]));
      setLink(map.get("scheduling_link") ?? "");
      setWa(map.get("whatsapp_number") ?? "");
      setLogoUrl(map.get("logo_url") ?? "");
      setBrandName(map.get("brand_name") ?? "United Idiomas");
      setBrandSubtitle(map.get("brand_subtitle") ?? "Assistente de Bolsa");
    })();
  }, [open]);

  async function handleFile(file: File) {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      toast.error("Use PNG, JPG, WEBP ou SVG."); return;
    }
    if (file.size > 400_000) {
      toast.error("Imagem grande demais (máx 400KB)."); return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    const rows = [
      { key: "scheduling_link", value: link },
      { key: "whatsapp_number", value: wa.replace(/\D/g, "") },
      { key: "logo_url", value: logoUrl || null },
      { key: "brand_name", value: brandName || "United Idiomas" },
      { key: "brand_subtitle", value: brandSubtitle || "Assistente de Bolsa" },
    ];
    const { error } = await supabase.from("app_settings").upsert(rows);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Configurações salvas"); onClose(); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configurações</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Logo do cabeçalho</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {logoUrl ? <img src={logoUrl} alt="logo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">sem logo</span>}
              </div>
              <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
              {logoUrl && <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remover</Button>}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP ou SVG. Máx 400 KB.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="brand">Nome principal</Label>
            <Input id="brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sub">Subtítulo</Label>
            <Input id="sub" value={brandSubtitle} onChange={(e) => setBrandSubtitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="link">Link externo de agendamento (opcional)</Label>
            <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://calendly.com/…" />
            <p className="text-xs text-muted-foreground">Atualmente o agendamento acontece dentro do chatbot. Mantenha vazio se não usar link externo.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wa">WhatsApp do consultor (com DDI)</Label>
            <Input id="wa" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="5511999999999" />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Unused import keeper to satisfy linter
void Textarea;
