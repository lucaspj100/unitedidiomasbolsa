import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LogOut, MessageCircle, CalendarClock, Plus, Trash2, Copy, ExternalLink, Users, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendedor")({
  head: () => ({
    meta: [
      { title: "Meu Painel · United Idiomas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendedorPage,
});

type Vendedor = { id: string; nome: string; email: string; whatsapp: string | null; slug: string; ativo: boolean };
type Lead = {
  id: string; nome: string; whatsapp: string; email: string; cidade_estado: string | null;
  profissao: string | null; nivel_ingles: string | null; status: string; classificacao_lead: string;
  alta_prioridade: boolean; data_cadastro: string; ultima_interacao: string | null; scheduled_at: string | null;
  vendedor_id: string | null; etapa_atual: string | null;
};
type Slot = { id: string; scheduled_at: string; lead_id: string | null; vendedor_id: string | null };

const STATUSES = [
  "Cadastro iniciado","Formulário incompleto","Perfil aprovado para entrevista","Entrevista agendada",
  "Aguardando disponibilidade de agenda","Não agendou","Perfil não aprovado","Contatado no WhatsApp",
  "Sem resposta","Perdido","Convertido",
] as const;

function VendedorPage() {
  const navigate = useNavigate();
  const [v, setV] = useState<Vendedor | null | "denied">(null);

  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("vendedores").select("*").eq("user_id", u.user.id).maybeSingle();
      if (!data) { setV("denied"); return; }
      if (!data.ativo) { setV("denied"); return; }
      setV(data as Vendedor);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (v === null) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  if (v === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Acesso não disponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sua conta não está vinculada a um consultor ativo. Fale com a administração.</p>
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
            <h1 className="text-base font-semibold">Olá, {v.nome.split(" ")[0]}</h1>
            <p className="text-xs text-muted-foreground">Meu painel · United Idiomas</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="dashboard">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="dashboard">Meu painel</TabsTrigger>
            <TabsTrigger value="leads">Meus leads</TabsTrigger>
            <TabsTrigger value="agendamentos">Meus agendamentos</TabsTrigger>
            <TabsTrigger value="disponibilidade">Minha disponibilidade</TabsTrigger>
            <TabsTrigger value="link">Meu link</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><DashboardTab vendedor={v} /></TabsContent>
          <TabsContent value="leads"><MyLeadsTab vendedor={v} /></TabsContent>
          <TabsContent value="agendamentos"><MyAgTab vendedor={v} /></TabsContent>
          <TabsContent value="disponibilidade"><MySlotsTab vendedor={v} /></TabsContent>
          <TabsContent value="link"><MyLinkTab vendedor={v} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function DashboardTab({ vendedor }: { vendedor: Vendedor }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: l } = await supabase.from("leads").select("*").eq("vendedor_id", vendedor.id).order("data_cadastro", { ascending: false });
      setLeads((l ?? []) as Lead[]);
      const { data: s } = await supabase.from("interview_slots").select("*").eq("vendedor_id", vendedor.id).not("lead_id","is",null).order("scheduled_at");
      setSlots((s ?? []) as Slot[]);
    })();
  }, [vendedor.id]);

  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0,0,0,0);
  const startWeek = new Date(startToday); startWeek.setDate(startWeek.getDate() - startWeek.getDay());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const leadsHoje = leads.filter(l => new Date(l.data_cadastro) >= startToday).length;
  const leadsSemana = leads.filter(l => new Date(l.data_cadastro) >= startWeek).length;
  const leadsMes = leads.filter(l => new Date(l.data_cadastro) >= startMonth).length;
  const agHoje = slots.filter(s => { const d = new Date(s.scheduled_at); return d >= startToday && d < new Date(startToday.getTime()+86400000); }).length;
  const proximos = slots.filter(s => new Date(s.scheduled_at) >= now).slice(0, 5);

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Leads (total)" value={leads.length} />
        <Kpi label="Leads hoje" value={leadsHoje} />
        <Kpi label="Leads na semana" value={leadsSemana} />
        <Kpi label="Leads no mês" value={leadsMes} />
        <Kpi label="Reuniões agendadas" value={slots.length} />
        <Kpi label="Reuniões hoje" value={agHoje} />
        <Kpi label="Conversão" value={leads.length ? `${Math.round((slots.length / leads.length) * 100)}%` : "—"} />
      </div>
      <div className="shadow-card rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Próximos agendamentos</h2>
        {proximos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum próximo.</p> : (
          <ul className="grid gap-2 text-sm">
            {proximos.map(s => <li key={s.id} className="flex justify-between border-b border-border pb-1"><span>{fmtDateTime(s.scheduled_at)}</span></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MyLeadsTab({ vendedor }: { vendedor: Vendedor }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").eq("vendedor_id", vendedor.id).order("ultima_interacao", { ascending: false });
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }, [vendedor.id]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => leads.filter(l => fStatus === "all" || l.status === fStatus), [leads, fStatus]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); setLeads((arr) => arr.map(l => l.id === id ? { ...l, status } : l)); }
  }
  function openWhatsapp(l: Lead) {
    const num = l.whatsapp.replace(/\D/g, "");
    const msg = `Olá, ${l.nome.split(" ")[0]}, aqui é ${vendedor.nome.split(" ")[0]} da United Idiomas.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="w-56"><Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="self-end text-xs text-muted-foreground">{filtered.length} lead(s)</p>
      </div>
      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Lead</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Nível</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Agendada</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum lead.</td></tr>}
            {filtered.map(l => (
              <tr key={l.id} className="border-t border-border align-top hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{l.nome || "(sem nome)"}</div>
                  <div className="text-xs text-muted-foreground">{l.profissao}</div>
                  {l.alta_prioridade && <Badge className="mt-1 bg-warning/15 text-warning">Alta prioridade</Badge>}
                </td>
                <td className="px-3 py-2 text-xs"><div>{l.whatsapp}</div><div className="text-muted-foreground">{l.email}</div></td>
                <td className="px-3 py-2 text-xs">{l.nivel_ingles ?? "—"}</td>
                <td className="px-3 py-2">
                  <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                    <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-xs">{l.scheduled_at ? fmtDateTime(l.scheduled_at) : "—"}</td>
                <td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => openWhatsapp(l)}><MessageCircle className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyAgTab({ vendedor }: { vendedor: Vendedor }) {
  const [rows, setRows] = useState<Array<Slot & { lead: Lead | null }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: slotsData } = await supabase.from("interview_slots").select("*").eq("vendedor_id", vendedor.id).not("lead_id", "is", null).order("scheduled_at");
    const slots = (slotsData ?? []) as Slot[];
    const ids = slots.map(s => s.lead_id!).filter(Boolean);
    let leadMap = new Map<string, Lead>();
    if (ids.length) {
      const { data: leadsData } = await supabase.from("leads").select("*").in("id", ids);
      leadMap = new Map(((leadsData ?? []) as Lead[]).map(l => [l.id, l]));
    }
    setRows(slots.map(s => ({ ...s, lead: s.lead_id ? leadMap.get(s.lead_id) ?? null : null })));
    setLoading(false);
  }, [vendedor.id]);

  useEffect(() => { void load(); }, [load]);

  async function cancel(slot: Slot) {
    if (!confirm("Cancelar este agendamento? O horário ficará livre.")) return;
    await supabase.from("interview_slots").update({ lead_id: null }).eq("id", slot.id);
    if (slot.lead_id) await supabase.from("leads").update({ scheduled_at: null, status: "Não agendou" }).eq("id", slot.lead_id);
    toast.success("Cancelado"); await load();
  }

  return (
    <div className="mt-4 shadow-card overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Candidato</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2"></th></tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Sem agendamentos.</td></tr>}
          {rows.map(r => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-2 text-xs">{fmtDateTime(r.scheduled_at)}</td>
              <td className="px-3 py-2 font-medium">{r.lead?.nome ?? "—"}</td>
              <td className="px-3 py-2 text-xs"><div>{r.lead?.whatsapp}</div><div className="text-muted-foreground">{r.lead?.email}</div></td>
              <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => cancel(r)}><Trash2 className="h-4 w-4" /></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MySlotsTab({ vendedor }: { vendedor: Vendedor }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [times, setTimes] = useState("19:00, 20:00");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("interview_slots").select("*").eq("vendedor_id", vendedor.id).gte("scheduled_at", new Date().toISOString()).order("scheduled_at");
    setSlots((data ?? []) as Slot[]); setLoading(false);
  }, [vendedor.id]);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!date) { toast.error("Selecione uma data."); return; }
    const list = times.split(/[,;\s]+/).map(t => t.trim()).filter(Boolean);
    if (!list.length) { toast.error("Informe ao menos um horário."); return; }
    const rows = list.map(t => {
      const [h, m] = t.split(":");
      const d = new Date(`${date}T${(h ?? "0").padStart(2,"0")}:${(m ?? "00").padStart(2,"0")}:00`);
      return { scheduled_at: d.toISOString(), vendedor_id: vendedor.id };
    });
    const { error } = await supabase.from("interview_slots").insert(rows);
    if (error) toast.error(error.message); else { toast.success(`${rows.length} horário(s) adicionado(s)`); await load(); }
  }
  async function remove(id: string) {
    if (!confirm("Remover este horário?")) return;
    const { error } = await supabase.from("interview_slots").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); setSlots(arr => arr.filter(s => s.id !== id)); }
  }

  return (
    <div className="mt-4 grid gap-6">
      <div className="shadow-card rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2"><CalendarClock className="h-4 w-4" /><h2 className="text-sm font-semibold">Cadastrar horários</h2></div>
        <p className="mb-3 text-xs text-muted-foreground">Cada entrevista ocupa 1 hora. Candidatos veem apenas os próximos 4 dias.</p>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
          <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">Horários (separados por vírgula)</Label><Input value={times} onChange={e => setTimes(e.target.value)} placeholder="19:00, 20:00" /></div>
          <div className="flex items-end"><Button onClick={add}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></div>
        </div>
      </div>
      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Data e hora</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {!loading && slots.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nenhum horário cadastrado.</td></tr>}
            {slots.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs">{fmtDateTime(s.scheduled_at)}</td>
                <td className="px-3 py-2">{s.lead_id ? <Badge>Ocupado</Badge> : <Badge variant="secondary">Disponível</Badge>}</td>
                <td className="px-3 py-2 text-right">{!s.lead_id && <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyLinkTab({ vendedor }: { vendedor: Vendedor }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const link = `${origin}/agendar/${vendedor.slug}`;
  return (
    <div className="mt-4 max-w-xl">
      <div className="shadow-card rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="text-sm font-semibold">Meu link de agendamento</h2></div>
        <p className="text-xs text-muted-foreground mb-3">Envie esse link no WhatsApp, LinkedIn ou em qualquer canal. Cada lead que entrar por ele será vinculado a você.</p>
        <Input readOnly value={link} className="font-mono text-xs" />
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <Copy className="mr-2 h-4 w-4" />Copiar
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(link, "_blank")}>
            <ExternalLink className="mr-2 h-4 w-4" />Abrir
          </Button>
        </div>
        {vendedor.ativo && <p className="mt-3 inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" />Link ativo</p>}
      </div>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" });
}
