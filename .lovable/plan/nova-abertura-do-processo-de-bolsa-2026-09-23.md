# Nova abertura do Processo de Bolsa

## Resultado
Substituir apenas a apresentação de `step.kind === "intro"` por uma experiência curta e institucional, alinhada ao site oficial da United Idiomas. Depois do clique, o chatbot atual continua sem mudanças.

## O que será construído
- Preservar o cabeçalho atual, o logo configurado no branding, “Assistente de Bolsa” e o nome do consultor.
- Criar um card branco central com o título “Processo de Bolsa United Idiomas” e o texto introdutório fornecido.
- Incorporar o vídeo vertical enviado em um player nativo, centralizado e limitado em tamanho, com controles, sem autoplay e sem início automático de áudio.
- Apresentar “Inglês executivo para adultos” e os cinco diferenciais em uma grade compacta com ícones discretos.
- Adicionar os indicadores “Menos de 2 minutos” e “Pré-seleção online”.
- Adicionar “Visitar site oficial” como ação secundária, abrindo `https://www.unitedidiomas.com/` em nova aba com proteção adequada.
- Destacar “Começar avaliação” como ação principal azul, chamando o mesmo `startFlow()` existente.

## Identidade visual
- Fundo branco/cinza azulado muito claro, card branco, azul-marinho profundo e azul vivo.
- Logo oficial carregado pelo branding dinâmico; nenhum símbolo novo ou letra “U” genérica.
- Sombra discreta, bordas suaves, espaçamento compacto e sem faixa multicolorida.
- Aparência institucional e mobile-first, sem alongar a página como uma landing page.

## Preservação do formulário
Não alterar scoring, classificação, perguntas, respostas, persistência, CRM, agendamento, slots, regras financeiras, vendedor/slug, branding dinâmico ou confirmação. A informação de 40 a 45 minutos permanece somente nos pontos atuais do fluxo.

## Validação
- Conferir desktop e mobile.
- Confirmar logo e nome do consultor no link personalizado.
- Confirmar controles do vídeo e ausência de autoplay.
- Confirmar abertura do site oficial em nova aba.
- Confirmar que o CTA executa o mesmo `startFlow()` e que o fluxo segue até o agendamento.

## Dependência
O arquivo de vídeo precisa ser anexado para que o player definitivo seja conectado e validado.
