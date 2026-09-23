import { createFileRoute } from "@tanstack/react-router";
import { ChatbotFlow } from "@/components/ChatbotFlow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistente de Bolsa United Idiomas" },
      { name: "description", content: "Avaliação rápida para o processo de bolsa de inglês da United Idiomas. Menos de 2 minutos." },
      { property: "og:title", content: "Processo de Bolsa United Idiomas" },
      { property: "og:description", content: "Faça sua pré-seleção online para o processo de bolsa da United Idiomas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ChatbotFlow />,
});
