import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GraduationCap, Send, MessageCircle, CalendarCheck, CheckCircle2 } from "lucide-react";
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
  type QualificationAnswers,
} from "@/lib/lead-scoring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistente de Bolsa United Idiomas" },
      {
        name: "description",
        content:
          "Avaliação rápida para o processo de bolsa de inglês da United Idiomas. Menos de 2 minutos.",
      },
    ],
  }),
  component: ChatPage,
});

type Step =
  | { kind: "intro" }
  | { kind: "input"; field: keyof QualificationAnswers; label: string; placeholder?: string; type?: string; optional?: boolean }
  | { kind: "choice"; field: keyof QualificationAnswers; label: string; options: string[] }
  | { kind: "done" };

const FLOW: Step[] = [
  { kind: "intro" },
  { kind: "input", field: "nome", label: "Para começar, qual é o seu nome completo?", placeholder: "Seu nome completo" },
  { kind: "input", field: "whatsapp", label: "Qual seu WhatsApp com DDD?", placeholder: "(11) 99999-9999", type: "tel" },
  { kind: "input", field: "email", label: "E qual o seu melhor e-mail?", placeholder: "voce@email.com", type: "email" },
  { kind: "input", field: "cidade_estado", label: "Em qual cidade e estado você mora?", placeholder: "Ex: São Paulo, SP" },
  { kind: "input", field: "profissao", label: "Qual a sua profissão ou área de atuação?", placeholder: "Ex: Analista de Marketing" },
  { kind: "input", field: "empresa", label: "Em qual empresa você trabalha? (opcional)", placeholder: "Pode pular se preferir", optional: true },
  {
    kind: "choice",
    field: "nivel_ingles",
    label: "Como você avalia seu nível atual de inglês?",
    options: ["Básico", "Intermediário", "Avançado", "Não sei avaliar"],
  },
  {
    kind: "choice",
    field: "motivo_ingles",
    label: "Por que o inglês é importante para você hoje?",
    options: [
      "Crescimento profissional",
      "Melhor oportunidade de emprego",
      "Viagem",
      "Vida acadêmica",
      "Objetivo pessoal",
      "Outro",
    ],
  },
  {
    kind: "choice",
    field: "impacto_ingles",
    label: "De que forma o inglês mais influencia ou poderia influenciar seu dia a dia?",
    options: [
      "Tenho dificuldade em entrevistas ou processos seletivos",
      "Preciso para crescer na empresa",
      "Quero trabalhar fora ou com empresas internacionais",
      "Tenho vergonha ou trava para falar",
      "Quero viajar com mais segurança",
      "Quero tirar uma certificação",
      "Outro",
    ],
  },
  {
    kind: "choice",
    field: "perdeu_oportunidade",
    label: "Você já perdeu alguma oportunidade por não ter inglês fluente?",
    options: ["Sim", "Não", "Ainda não, mas sinto que pode acontecer", "Não tenho certeza"],
  },
  {
    kind: "choice",
    field: "motivo_nao_faz_curso",
    label: "Por que você ainda não está fazendo um curso de inglês?",
    options: [
      "Falta de tempo",
      "Valor alto",
      "Já tentei antes e parei",
      "Não encontrei uma metodologia boa",
      "Falta de disciplina",
      "Outro",
    ],
  },
  {
    kind: "choice",
    field: "decisao_entrevista",
    label:
      "Caso seu perfil seja selecionado para a bolsa, você está decidido a conversar em uma entrevista online para entender metodologia, valores e condições?",
    options: ["Sim, tenho interesse real", "Talvez, quero entender melhor", "Não tenho certeza", "Só estava curioso"],
  },
  { kind: "done" },
];

interface BubbleMsg {
  from: "bot" | "user";
  text: string;
}

function ChatPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<QualificationAnswers>>({});
  const [messages, setMessages] = useState<BubbleMsg[]>([]);
  const [textValue, setTextValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ classificacao: Classificacao; settings: { scheduling_link: string | null; whatsapp_number: string | null } } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = FLOW[stepIndex];

  useEffect(() => {
    setMessages([
      {
        from: "bot",
        text: "Olá! Vi que você tem interesse no processo de bolsa da United Idiomas.",
      },
      {
        from: "bot",
        text: "Vou te fazer algumas perguntas rápidas para entender seu perfil e verificar se faz sentido avançarmos para uma entrevista de liberação da bolsa.",
      },
      { from: "bot", text: "Leva menos de 2 minutos." },
    ]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, stepIndex, result]);

  function advanceWith(userText: string, fieldValue: string, field: keyof QualificationAnswers) {
    const next = stepIndex + 1;
    setAnswers((a) => ({ ...a, [field]: fieldValue }));
    setMessages((m) => [...m, { from: "user", text: userText }]);
    setStepIndex(next);
    setTextValue("");
    const nextStep = FLOW[next];
    if (nextStep && nextStep.kind !== "done") {
      const label = (nextStep as { label?: string }).label;
      if (label) setTimeout(() => setMessages((m) => [...m, { from: "bot", text: label }]), 350);
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
      if (step.optional) {
        advanceWith("(pulei)", "", step.field);
      } else {
        toast.error("Por favor, preencha este campo para continuar.");
      }
      return;
    }
    if (step.field === "email" && !validateEmail(v)) {
      toast.error("E-mail inválido. Verifique e tente de novo.");
      return;
    }
    if (step.field === "whatsapp" && !validateWhatsapp(v)) {
      toast.error("WhatsApp inválido. Use DDD + número, ex: (11) 99999-9999.");
      return;
    }
    advanceWith(v, v, step.field);
  }

  function handleChoice(option: string) {
    if (step.kind !== "choice") return;
    advanceWith(option, option, step.field);
  }

  useEffect(() => {
    if (step?.kind === "done" && !result && !submitting) {
      void submitLead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  async function submitLead() {
    setSubmitting(true);
    try {
      const full = answers as QualificationAnswers;
      const classificacao = classifyLead(full);
      const alta = isHighPriority(full);
      const payload = {
        nome: full.nome,
        whatsapp: normalizeWhatsapp(full.whatsapp),
        email: full.email,
        cidade_estado: full.cidade_estado,
        profissao: full.profissao,
        empresa: full.empresa || null,
        nivel_ingles: full.nivel_ingles,
        motivo_ingles: full.motivo_ingles,
        impacto_ingles: full.impacto_ingles,
        perdeu_oportunidade: full.perdeu_oportunidade,
        motivo_nao_faz_curso: full.motivo_nao_faz_curso,
        decisao_entrevista: full.decisao_entrevista,
        classificacao_lead: classificacao,
        alta_prioridade: alta,
        status: "Novo",
        origem: "LinkedIn",
        respostas_json: full as unknown as Record<string, unknown>,
      };
      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;

      const { data: settings } = await supabase.rpc("get_public_settings");
      const s = Array.isArray(settings) && settings[0] ? settings[0] : { scheduling_link: null, whatsapp_number: null };
      setResult({ classificacao, settings: s });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/15 p-2 backdrop-blur-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">United Idiomas</p>
              <p className="text-xs opacity-80 leading-tight">Assistente de Bolsa</p>
            </div>
          </div>
          <Link to="/auth" className="text-xs opacity-80 hover:opacity-100 underline-offset-4 hover:underline">
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col px-3 pb-32 pt-4 sm:px-4">
        <div
          ref={scrollRef}
          className="flex flex-col gap-3 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        >
          {messages.map((m, i) => (
            <Bubble key={i} from={m.from}>
              {m.text}
            </Bubble>
          ))}

          {step?.kind === "done" && submitting && (
            <Bubble from="bot">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                Analisando suas respostas…
              </span>
            </Bubble>
          )}

          {result && <ResultBlock answers={answers as QualificationAnswers} result={result} />}
        </div>
      </main>

      {!result && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-3 py-3 sm:px-4">
            {step?.kind === "intro" && (
              <Button size="lg" className="w-full" onClick={startFlow}>
                Começar avaliação
              </Button>
            )}

            {step?.kind === "input" && (
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <Input
                  autoFocus
                  value={textValue}
                  type={step.type ?? "text"}
                  placeholder={step.placeholder}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="h-12 text-base"
                />
                <Button type="submit" size="lg" className="px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}

            {step?.kind === "choice" && (
              <div className="grid gap-2">
                {step.options.map((opt) => (
                  <Button
                    key={opt}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-3 text-left text-sm font-normal hover:border-primary hover:bg-primary/5"
                    onClick={() => handleChoice(opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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

function ResultBlock({
  answers,
  result,
}: {
  answers: QualificationAnswers;
  result: { classificacao: Classificacao; settings: { scheduling_link: string | null; whatsapp_number: string | null } };
}) {
  const nome = answers.nome?.split(" ")[0] ?? "";
  const { classificacao, settings } = result;

  const schedulingLink = settings.scheduling_link?.trim() || null;
  const wa = settings.whatsapp_number?.replace(/\D/g, "") || null;
  const waUrl = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Olá! Acabei de preencher a avaliação de bolsa da United Idiomas. Meu nome é ${answers.nome}.`,
      )}`
    : null;

  if (classificacao === "quente") {
    return (
      <div className="shadow-card mt-3 rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Perfil aprovado para entrevista
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          Perfeito, <strong>{nome}</strong>. Pelo seu perfil, faz sentido avançarmos para a etapa de entrevista.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A conversa dura cerca de 40 a 45 minutos. É online, sem compromisso, e serve para entender seu momento e verificar se a bolsa pode ser liberada.
        </p>
        <div className="mt-4 grid gap-2">
          <ScheduleButton link={schedulingLink} waUrl={waUrl} />
        </div>
      </div>
    );
  }
  if (classificacao === "morno") {
    return (
      <div className="shadow-card mt-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm leading-relaxed text-foreground">
          Entendi, <strong>{nome}</strong>. Pelo que você respondeu, parece que o inglês pode fazer sentido para o seu momento.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A entrevista serve justamente para tirar dúvidas, entender seu objetivo e verificar se existe uma condição de bolsa compatível com seu perfil.
        </p>
        <div className="mt-4 grid gap-2">
          <ScheduleButton link={schedulingLink} waUrl={waUrl} label="Quero agendar entrevista" />
          {waUrl && (
            <Button asChild variant="outline">
              <a href={waUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Prefiro falar pelo WhatsApp antes
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="shadow-card mt-3 rounded-2xl border border-border bg-card p-5">
      <p className="text-sm leading-relaxed text-foreground">
        Obrigado pelas respostas, <strong>{nome}</strong>. Vou deixar seu cadastro salvo e, caso faça sentido, nossa equipe poderá entrar em contato com você pelo WhatsApp.
      </p>
      <Button className="mt-4 w-full" variant="secondary" onClick={() => window.location.reload()}>
        Finalizar cadastro
      </Button>
    </div>
  );
}

function ScheduleButton({ link, waUrl, label = "Agendar minha entrevista" }: { link: string | null; waUrl: string | null; label?: string }) {
  if (link) {
    return (
      <Button asChild size="lg" className="w-full">
        <a href={link} target="_blank" rel="noreferrer">
          <CalendarCheck className="mr-2 h-4 w-4" /> {label}
        </a>
      </Button>
    );
  }
  if (waUrl) {
    return (
      <Button asChild size="lg" className="w-full">
        <a href={waUrl} target="_blank" rel="noreferrer">
          <MessageCircle className="mr-2 h-4 w-4" /> {label} pelo WhatsApp
        </a>
      </Button>
    );
  }
  return (
    <Button size="lg" className="w-full" disabled>
      Em breve enviaremos seu link de agendamento
    </Button>
  );
}
