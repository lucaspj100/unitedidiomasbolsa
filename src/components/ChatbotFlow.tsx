import { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Send, CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  classifyLead,
  isHighPriority,
  normalizeWhatsapp,
  validateEmail,
  validateWhatsapp,
  type Classificacao,
  canSchedule,
  classifyFinanceiro,
  type QualificationAnswers,
} from "@/lib/lead-scoring";

type Step =
  | { kind: "intro" }
  | { kind: "input"; field: keyof QualificationAnswers; label: string; placeholder?: string; type?: string; optional?: boolean; pre?: string[] }
  | { kind: "choice"; field: keyof QualificationAnswers; label: string; options: string[]; pre?: string[] }
  | { kind: "evaluating" }
  | { kind: "schedule" }
  | { kind: "done" };

const FLOW: Step[] = [
  { kind: "intro" },
  { kind: "input", field: "nome", label: "Para começarmos, como você se chama? (nome completo)", placeholder: "Seu nome completo" },
  { kind: "input", field: "whatsapp", label: "Prazer, tudo bem? Qual o seu WhatsApp com DDD? É por lá que confirmamos tudo com você.", placeholder: "(11) 99999-9999", type: "tel" },
  { kind: "input", field: "email", label: "E qual o seu melhor e-mail?", placeholder: "voce@email.com", type: "email" },
  { kind: "input", field: "cidade_estado", label: "Em qual cidade e estado você mora?", placeholder: "Ex: São Paulo, SP" },
  { kind: "input", field: "profissao", label: "Agora me conta um pouco do seu momento: qual a sua profissão ou área de atuação?", placeholder: "Ex: Analista de Marketing" },
  { kind: "input", field: "empresa", label: "Em qual empresa você trabalha hoje? (se preferir, pode pular)", placeholder: "Pode pular se preferir", optional: true },
  { kind: "choice", field: "nivel_ingles", label: "Sendo bem sincero(a), como está o seu inglês hoje?", options: ["Básico", "Intermediário", "Avançado", "Não sei avaliar"] },
  { kind: "choice", field: "motivo_ingles", label: "E o que faz o inglês ser importante para você neste momento da sua vida?", options: ["Crescimento profissional", "Melhor oportunidade de emprego", "Viagem", "Vida acadêmica", "Objetivo pessoal", "Outro"] },
  { kind: "choice", field: "impacto_ingles", label: "Na prática, onde o inglês mais pesa (ou poderia ajudar) no seu dia a dia?", options: ["Tenho dificuldade em entrevistas ou processos seletivos","Preciso para crescer na empresa","Quero trabalhar fora ou com empresas internacionais","Tenho vergonha ou trava para falar","Quero viajar com mais segurança","Quero tirar uma certificação","Outro"] },
  { kind: "choice", field: "perdeu_oportunidade", label: "Você já deixou passar alguma oportunidade por causa do inglês?", options: ["Sim", "Não", "Ainda não, mas sinto que pode acontecer", "Não tenho certeza"] },
  { kind: "choice", field: "motivo_nao_faz_curso", label: "E o que te impediu de resolver isso até agora?", options: ["Falta de tempo", "Valor alto", "Já tentei antes e parei", "Não encontrei uma metodologia boa", "Falta de disciplina", "Outro"] },
  {
    kind: "choice",
    field: "prazo_inicio",
    label: "Se a bolsa for liberada para o seu perfil, em quanto tempo você pretende começar?",
    options: ["O quanto antes, quero começar agora", "Nas próximas semanas", "Nos próximos 2 ou 3 meses", "Ainda não tenho previsão"],
    pre: ["Entendi. Faz muito sentido, e é justamente por isso que existe esse processo de bolsa."],
  },
  {
    kind: "choice",
    field: "alinhamento_financeiro",
    label: "Considerando isso, esse investimento estaria dentro do que faz sentido para você hoje?",
    options: ["Sim, se a condição fizer sentido", "Sim, consigo investir nessa faixa", "Consigo investir até um pouco mais, dependendo da proposta", "Hoje não consigo investir esse valor", "Prefiro entender melhor na entrevista"],
    pre: [
      "Antes de seguir, preciso ser transparente com você para não tomarmos o tempo de ninguém à toa.",
      "O curso completo da United Idiomas custa cerca de R$750 por mês. Com a bolsa e a ajuda de custo, os alunos aprovados normalmente ficam entre R$290 e R$350 por mês, dependendo da condição liberada no seu caso.",
      "Ou seja: a bolsa reduz bastante o valor, mas o curso não é gratuito.",
    ],
  },
  {
    kind: "choice",
    field: "decisao_entrevista",
    label: "Se o seu perfil for selecionado, você topa participar de uma entrevista online de 40 a 45 minutos para entender metodologia, valores e condições da bolsa?",
    options: ["Sim, tenho interesse real", "Talvez, quero entender melhor", "Não tenho certeza", "Só estava curioso"],
    pre: ["Ótimo, obrigado pela sinceridade. Última pergunta:"],
  },
  { kind: "evaluating" },
  { kind: "schedule" },
  { kind: "done" },
];


interface BubbleMsg { from: "bot" | "user"; text: string }
interface Slot { id: string; scheduled_at: string }
interface Branding {
  logo_url: string | null;
  brand_name: string;
  brand_subtitle: string;
  whatsapp_number: string | null;
}

export interface ChatbotFlowProps {
  vendedorId?: string | null;
  vendedorNome?: string | null;
}

export function ChatbotFlow({ vendedorId = null, vendedorNome = null }: ChatbotFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<QualificationAnswers>>({});
  const [messages, setMessages] = useState<BubbleMsg[]>([]);
  const [textValue, setTextValue] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [, setClassificacao] = useState<Classificacao | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookedAt, setBookedAt] = useState<string | null>(null);
  const [noSlotsMessage, setNoSlotsMessage] = useState(false);
  const [branding, setBranding] = useState<Branding>({
    logo_url: null, brand_name: "United Idiomas", brand_subtitle: "Assistente de Bolsa", whatsapp_number: null,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = FLOW[stepIndex];

  useEffect(() => {
    const intro = vendedorNome
      ? `Olá! Vi que você tem interesse no processo de bolsa da United Idiomas. Você será atendido(a) por ${vendedorNome}.`
      : "Olá! Vi que você tem interesse no processo de bolsa da United Idiomas.";
    setMessages([
      { from: "bot", text: intro },
      { from: "bot", text: "Sou o assistente responsável pela pré-seleção. Antes de qualquer coisa, quero entender o seu momento e ver se a bolsa realmente faz sentido para você." },
      { from: "bot", text: "São poucas perguntas, leva menos de 2 minutos, e no final eu já te digo se seu perfil segue para a entrevista." },
    ]);

    void (async () => {
      const { data } = await supabase.rpc("get_public_settings");
      const s = Array.isArray(data) && data[0] ? data[0] : null;
      if (s) {
        setBranding({
          logo_url: s.logo_url ?? null,
          brand_name: s.brand_name ?? "United Idiomas",
          brand_subtitle: s.brand_subtitle ?? "Assistente de Bolsa",
          whatsapp_number: s.whatsapp_number ?? null,
        });
      }
    })();
  }, [vendedorNome]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(id);
  }, [messages, stepIndex, slots, bookedAt]);

  const persist = useCallback(async (extra: Partial<QualificationAnswers>, opts?: { status?: string; etapa?: string; classificacao?: Classificacao; alta?: boolean }) => {
    const merged = { ...answers, ...extra } as QualificationAnswers;
    const required = merged.nome && merged.whatsapp && merged.email;
    if (!required) return;
    const payload: Record<string, unknown> = {
      nome: merged.nome,
      whatsapp: normalizeWhatsapp(merged.whatsapp),
      email: merged.email,
      cidade_estado: merged.cidade_estado ?? null,
      profissao: merged.profissao ?? null,
      empresa: merged.empresa ?? null,
      nivel_ingles: merged.nivel_ingles ?? null,
      motivo_ingles: merged.motivo_ingles ?? null,
      impacto_ingles: merged.impacto_ingles ?? null,
      perdeu_oportunidade: merged.perdeu_oportunidade ?? null,
      motivo_nao_faz_curso: merged.motivo_nao_faz_curso ?? null,
      prazo_inicio: merged.prazo_inicio ?? null,
      alinhamento_financeiro: merged.alinhamento_financeiro ?? null,

      decisao_entrevista: merged.decisao_entrevista ?? null,
      origem: vendedorId ? `link:${vendedorNome ?? vendedorId}` : "LinkedIn",
      respostas_json: merged as unknown as Record<string, unknown>,
      status: opts?.status ?? "Formulário incompleto",
      etapa_atual: opts?.etapa ?? null,
      vendedor_id: vendedorId,
    };
    if (opts?.classificacao) payload.classificacao_lead = opts.classificacao;
    if (opts?.alta !== undefined) payload.alta_prioridade = opts.alta;
    try {
      const args = { p_id: leadId, p_data: payload } as unknown as { p_id: string; p_data: never };
      const { data, error } = await supabase.rpc("save_lead_progress", args);
      if (error) throw error;
      if (typeof data === "string" && !leadId) setLeadId(data);
    } catch (e) {
      console.error("save_lead_progress", e);
    }
  }, [answers, leadId, vendedorId, vendedorNome]);

  function advanceWith(userText: string, fieldValue: string, field: keyof QualificationAnswers) {
    const next = stepIndex + 1;
    const newAnswers = { ...answers, [field]: fieldValue };
    setAnswers(newAnswers);
    setMessages((m) => [...m, { from: "user", text: userText }]);
    setStepIndex(next);
    setTextValue("");
    const nextStep = FLOW[next];
    void persist({ [field]: fieldValue } as Partial<QualificationAnswers>, { etapa: String(field) });
    if (nextStep && "label" in nextStep && nextStep.label) {
      const pre = "pre" in nextStep && nextStep.pre ? nextStep.pre : [];
      pre.forEach((text, i) => {
        setTimeout(() => setMessages((m) => [...m, { from: "bot", text }]), 350 + i * 700);
      });
      setTimeout(() => setMessages((m) => [...m, { from: "bot", text: nextStep.label! }]), 350 + pre.length * 700);
    }
  }


  function startFlow() {
    setStepIndex(1);
    setMessages((m) => [...m, { from: "user", text: "Começar avaliação" }]);
    const first = FLOW[1] as { label: string };
    setTimeout(() => setMessages((m) => [...m, { from: "bot", text: first.label }]), 300);
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "input") return;
    const v = textValue.trim();
    if (!v) {
      if (step.optional) { advanceWith("(pulei)", "", step.field); }
      else { toast.error("Por favor, preencha este campo para continuar."); }
      return;
    }
    if (step.field === "email" && !validateEmail(v)) { toast.error("E-mail inválido. Verifique e tente de novo."); return; }
    if (step.field === "whatsapp" && !validateWhatsapp(v)) { toast.error("WhatsApp inválido. Use DDD + número, ex: (11) 99999-9999."); return; }
    advanceWith(v, v, step.field);
  }

  function handleChoice(option: string) {
    if (step.kind !== "choice") return;
    advanceWith(option, option, step.field);
  }

  useEffect(() => {
    if (step?.kind !== "evaluating") return;
    const full = answers as QualificationAnswers;
    const cls = classifyLead(full);
    const alta = isHighPriority(full);
    const fit = classifyFinanceiro(full.alinhamento_financeiro);
    const allowSchedule = canSchedule(full);
    setClassificacao(cls);
    void (async () => {
      setMessages((m) => [...m, { from: "bot", text: "Analisando suas respostas…" }]);
      if (fit === "sem_fit") {
        await persist({}, { status: "Sem fit financeiro no momento", etapa: "financeiro_sem_fit", classificacao: cls, alta });
        setTimeout(() => {
          setMessages((m) => [
            ...m,
            { from: "bot", text: "Entendi. Neste momento, talvez a entrevista de bolsa não seja o melhor próximo passo, porque mesmo com ajuda de custo existe um investimento mensal mínimo." },
            { from: "bot", text: "Mas seu cadastro foi registrado, e podemos manter seu contato para futuras condições, conteúdos gratuitos ou novas oportunidades." },
          ]);
        }, 400);
        setStepIndex(FLOW.length - 1);
      } else if (allowSchedule) {
        await persist({}, { status: "Perfil aprovado para entrevista", etapa: "aprovado", classificacao: cls, alta });
        setStepIndex((i) => i + 1);
      } else {
        await persist({}, { status: cls === "frio" ? "Perfil não aprovado" : "Não agendou", etapa: "encerrado", classificacao: cls, alta });
        setStepIndex(FLOW.length - 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    if (step?.kind !== "schedule" || bookedAt) return;
    setLoadingSlots(true);
    void (async () => {
      const nome = (answers.nome ?? "").split(" ")[0];
      setMessages((m) => [
        ...m,
        { from: "bot", text: `Perfeito, ${nome}! Seu perfil foi aprovado para a etapa de entrevista.` },
        { from: "bot", text: "A conversa dura cerca de 40 a 45 minutos, é online e sem compromisso. Escolha abaixo um horário disponível nos próximos dias para concluir sua pré-aprovação." },
      ]);
      const rpc = vendedorId
        ? supabase.rpc("get_available_slots_by_vendedor", { p_vendedor_id: vendedorId })
        : supabase.rpc("get_available_slots");
      const { data, error } = await rpc;
      if (error) console.error(error);
      const list = (data ?? []) as Slot[];
      setSlots(list);
      if (list.length === 0) {
        setNoSlotsMessage(true);
        setMessages((m) => [...m, { from: "bot", text: "No momento, os horários disponíveis para os próximos dias foram preenchidos. Nossa equipe entrará em contato para liberar uma nova agenda." }]);
        await persist({}, { status: "Aguardando disponibilidade de agenda", etapa: "aguardando_agenda" });
      }
      setLoadingSlots(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  async function bookSlot(slot: Slot) {
    if (!leadId) { toast.error("Sessão expirada. Recarregue a página."); return; }
    setBooking(true);
    try {
      const { data, error } = await supabase.rpc("book_interview_slot", { p_lead_id: leadId, p_slot_id: slot.id });
      if (error) throw error;
      const at = (data as string) ?? slot.scheduled_at;
      setBookedAt(at);
      const formatted = formatSlot(at);
      setMessages((m) => [
        ...m,
        { from: "user", text: `Agendar para ${formatted}` },
        { from: "bot", text: `Perfeito, ${(answers.nome ?? "").split(" ")[0]}. Sua entrevista foi agendada para ${formatted}.` },
        { from: "bot", text: "A conversa dura cerca de 40 a 45 minutos, é online e serve para entendermos melhor seu momento, explicar a metodologia, os valores e verificar se a bolsa pode ser liberada." },
        { from: "bot", text: "Em breve você receberá as informações para participar." },
      ]);
      setStepIndex(FLOW.length - 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível agendar.";
      toast.error(msg);
      const rpc = vendedorId
        ? supabase.rpc("get_available_slots_by_vendedor", { p_vendedor_id: vendedorId })
        : supabase.rpc("get_available_slots");
      const { data: fresh } = await rpc;
      setSlots((fresh ?? []) as Slot[]);
    } finally {
      setBooking(false);
    }
  }

  const isDone = step?.kind === "done";
  const showControls = !isDone;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="gradient-hero text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/15 backdrop-blur-sm">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.brand_name} className="h-full w-full object-contain" />
              ) : (
                <GraduationCap className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{branding.brand_name}</p>
              <p className="text-xs opacity-80 leading-tight">{branding.brand_subtitle}{vendedorNome ? ` · ${vendedorNome}` : ""}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 sm:px-4 min-h-0">
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
          {messages.map((m, i) => (<Bubble key={i} from={m.from}>{m.text}</Bubble>))}

          {step?.kind === "schedule" && !bookedAt && (
            <div className="shadow-card mt-3 rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Perfil aprovado para entrevista
              </div>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando horários disponíveis…
                </div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {noSlotsMessage ? "Seu cadastro foi registrado. Em breve entraremos em contato pelo WhatsApp para combinar um novo horário." : "Nenhum horário disponível."}
                </div>
              ) : (
                <SlotPicker slots={slots} disabled={booking} onPick={(s) => void bookSlot(s)} />
              )}
            </div>
          )}

          {showControls && <div aria-hidden className="shrink-0" style={{ height: "1rem" }} />}
        </div>

        {showControls && (
          <div className="-mx-3 border-t border-border bg-card/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4">
            {step?.kind === "intro" && (
              <Button size="lg" className="w-full" onClick={startFlow}>Começar avaliação</Button>
            )}

            {step?.kind === "input" && (
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <Input autoFocus value={textValue} type={step.type ?? "text"} placeholder={step.placeholder}
                  onChange={(e) => setTextValue(e.target.value)} className="h-12 text-base" />
                <Button type="submit" size="lg" className="px-4"><Send className="h-4 w-4" /></Button>
              </form>
            )}

            {step?.kind === "choice" && (
              <div className="grid max-h-[40vh] gap-2 overflow-y-auto">
                {step.options.map((opt) => (
                  <Button key={opt} variant="outline"
                    className="h-auto justify-start whitespace-normal py-3 text-left text-sm font-normal hover:border-primary hover:bg-primary/5"
                    onClick={() => handleChoice(opt)}>
                    {opt}
                  </Button>
                ))}
              </div>
            )}

            {step?.kind === "evaluating" && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
              </div>
            )}

            {step?.kind === "schedule" && (
              <p className="text-center text-xs text-muted-foreground">
                {bookedAt ? "Entrevista confirmada." : slots.length === 0 ? "Aguardando liberação de novos horários." : "Para concluir sua pré-aprovação, escolha um dos horários disponíveis."}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Bubble({ from, children }: { from: "bot" | "user"; children: React.ReactNode }) {
  if (from === "bot") {
    return (
      <div className="flex max-w-[85%] items-start gap-2">
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full gradient-hero text-primary-foreground">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div className="shadow-bubble rounded-2xl rounded-tl-sm bg-bot-bubble px-4 py-2.5 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="ml-auto flex max-w-[85%] justify-end">
      <div className="rounded-2xl rounded-tr-sm bg-user-bubble px-4 py-2.5 text-sm text-user-bubble-foreground shadow-bubble">
        {children}
      </div>
    </div>
  );
}

function SlotPicker({ slots, disabled, onPick }: { slots: Slot[]; disabled: boolean; onPick: (s: Slot) => void }) {
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    const d = new Date(s.scheduled_at);
    const key = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return (
    <div className="grid gap-3">
      {Array.from(groups.entries()).map(([day, list]) => (
        <div key={day}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground capitalize">{day}</p>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => (
              <Button key={s.id} variant="outline" size="sm" disabled={disabled}
                className="h-9 hover:border-primary hover:bg-primary/5"
                onClick={() => onPick(s)}>
                <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
                {new Date(s.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatSlot(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const hour = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} às ${hour}`;
}
