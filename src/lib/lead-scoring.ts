export type Classificacao = "quente" | "morno" | "frio" | "curioso";

export interface QualificationAnswers {
  nome: string;
  whatsapp: string;
  email: string;
  cidade_estado: string;
  profissao: string;
  empresa?: string;
  nivel_ingles: string;
  motivo_ingles: string;
  impacto_ingles: string;
  perdeu_oportunidade: string;
  motivo_nao_faz_curso: string;
  alinhamento_financeiro: string;
  decisao_entrevista: string;
}

export const FINANCEIRO_POSITIVO = [
  "Sim, se a condição fizer sentido",
  "Sim, consigo investir nessa faixa",
  "Consigo investir até um pouco mais, dependendo da proposta",
] as const;

export const FINANCEIRO_TALVEZ = "Prefiro entender melhor na entrevista";
export const FINANCEIRO_SEM_FIT = "Hoje não consigo investir esse valor";

export type FinanceiroFit = "positivo" | "talvez" | "sem_fit";

export function classifyFinanceiro(v: string | undefined | null): FinanceiroFit {
  if (!v) return "talvez";
  if (v === FINANCEIRO_SEM_FIT) return "sem_fit";
  if (v === FINANCEIRO_TALVEZ) return "talvez";
  return "positivo";
}

function isStrongProfile(a: Partial<QualificationAnswers>): boolean {
  const motivosFortes = ["Crescimento profissional", "Melhor oportunidade de emprego"];
  const impactosFortes = [
    "Tenho dificuldade em entrevistas ou processos seletivos",
    "Preciso para crescer na empresa",
    "Quero trabalhar fora ou com empresas internacionais",
    "Quero tirar uma certificação",
  ];
  if (a.perdeu_oportunidade === "Sim") return true;
  if (a.motivo_ingles && motivosFortes.includes(a.motivo_ingles)) return true;
  if (a.impacto_ingles && impactosFortes.includes(a.impacto_ingles)) return true;
  if (a.decisao_entrevista === "Sim, tenho interesse real") return true;
  return false;
}

export function classifyLead(a: Partial<QualificationAnswers>): Classificacao {
  const fit = classifyFinanceiro(a.alinhamento_financeiro);
  if (fit === "sem_fit") return "frio";

  const baseByDecisao = (): Classificacao => {
    switch (a.decisao_entrevista) {
      case "Sim, tenho interesse real": return "quente";
      case "Talvez, quero entender melhor": return "morno";
      case "Não tenho certeza": return "frio";
      default: return "curioso";
    }
  };

  const base = baseByDecisao();
  const strong = isStrongProfile(a);

  if (fit === "positivo") {
    // bom fit financeiro mantém ou melhora se houver perfil forte
    if (base === "morno" && strong) return "quente";
    if (base === "frio" && strong) return "morno";
    if (base === "curioso" && strong) return "morno";
    return base;
  }

  // talvez: depende do perfil
  if (strong) {
    if (base === "quente") return "morno"; // cautela: hesitação financeira
    if (base === "morno") return "morno";
    return "frio";
  }
  // sem perfil forte + indefinição financeira
  return base === "curioso" ? "curioso" : "frio";
}

export function isHighPriority(a: Partial<QualificationAnswers>): boolean {
  const fit = classifyFinanceiro(a.alinhamento_financeiro);
  if (fit === "sem_fit") return false;
  if (a.perdeu_oportunidade === "Sim") return true;
  if (a.motivo_ingles === "Crescimento profissional") return true;
  if (a.motivo_ingles === "Melhor oportunidade de emprego") return true;
  const i = a.impacto_ingles;
  return (
    i === "Tenho dificuldade em entrevistas ou processos seletivos" ||
    i === "Preciso para crescer na empresa" ||
    i === "Quero trabalhar fora ou com empresas internacionais" ||
    i === "Quero tirar uma certificação"
  );
}

/**
 * Decide se o lead deve ver a tela de agendamento.
 */
export function canSchedule(a: Partial<QualificationAnswers>): boolean {
  const fit = classifyFinanceiro(a.alinhamento_financeiro);
  if (fit === "sem_fit") return false;
  const cls = classifyLead(a);
  if (cls === "frio" || cls === "curioso") return false;
  if (fit === "talvez") return isStrongProfile(a);
  return true; // positivo + quente/morno
}

export function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function validateWhatsapp(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

export function normalizeWhatsapp(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}
