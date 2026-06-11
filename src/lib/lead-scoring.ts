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
  decisao_entrevista: string;
}

export function classifyLead(a: Pick<QualificationAnswers, "decisao_entrevista">): Classificacao {
  switch (a.decisao_entrevista) {
    case "Sim, tenho interesse real":
      return "quente";
    case "Talvez, quero entender melhor":
      return "morno";
    case "Não tenho certeza":
      return "frio";
    default:
      return "curioso";
  }
}

export function isHighPriority(a: Pick<QualificationAnswers,
  "perdeu_oportunidade" | "motivo_ingles" | "impacto_ingles">): boolean {
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
