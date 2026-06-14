## Visão geral

Adicionar suporte a múltiplos vendedores sem quebrar o fluxo atual. O chatbot atual em `/` continua funcionando (leads ficam como "legado", sem vendedor). Novos leads entram pela rota `/agendar/{slug}` e ficam vinculados ao vendedor do link.

## Banco de dados (1 migration)

Nova tabela `vendedores`:
- `id` (uuid), `user_id` (FK auth.users, nullable até 1º login), `nome`, `email`, `whatsapp`, `slug` (único), `ativo` (bool), timestamps.

Alterações:
- `leads`: adicionar `vendedor_id` (nullable — leads antigos ficam null).
- `interview_slots`: adicionar `vendedor_id` (nullable para slots legados); slots novos exigem vendedor.

RLS:
- `vendedores`: ADM full; vendedor lê só sua linha.
- `leads`: ADM full; vendedor lê/atualiza só onde `vendedor_id` = seu vendedor.
- `interview_slots`: ADM full; vendedor gerencia só os próprios slots.
- INSERT público de leads continua aberto, mas com checagem: se `vendedor_id` veio preenchido, vendedor precisa estar ativo.

Funções:
- `get_vendedor_by_slug(slug)` — retorna `{id, nome, ativo}` se existir (público).
- `get_available_slots_by_vendedor(vendedor_id)` — slots livres dos próximos 4 dias daquele vendedor.
- `save_lead_progress` ganha `p_vendedor_id`.
- `book_interview_slot` valida que o slot pertence ao vendedor do lead.
- `current_vendedor_id()` security definer — retorna `vendedores.id` do `auth.uid()` (para RLS sem recursão).
- Função `is_admin()` já existe via `has_role`.

## Cadastro de vendedor (convite por email)

Aba **Equipe** no painel ADM:
- Listar/criar/editar/ativar vendedores (nome, email, whatsapp, slug, ativo).
- Botão "Enviar convite" usa server function que chama `supabaseAdmin.auth.admin.inviteUserByEmail()` com redirect para `/auth?invite=1`.
- Quando o usuário aceita e define senha, um trigger (ou server fn no 1º login) liga `vendedores.user_id` ao `auth.users.id` pelo email.
- ADM pode copiar/abrir o link `/agendar/{slug}`.

Emails de convite usam o sistema padrão do Supabase Auth (sem precisar configurar templates customizados agora).

## Rotas frontend

Novas/alteradas:
- `/agendar/$slug` — nova rota pública. Carrega vendedor pelo slug:
  - Vendedor não existe → mensagem "link não encontrado".
  - Vendedor inativo → mensagem "link indisponível".
  - Ativo → renderiza o mesmo componente do chatbot atual, passando `vendedorId` e `vendedorNome`. Slots vêm de `get_available_slots_by_vendedor`.
- `/` — continua como hoje (modo legado, sem vendedor). Sem mudanças visuais.
- `/_authenticated/admin` — adiciona aba **Equipe** + filtro "Vendedor" nas abas Leads/Agendamentos/Horários.
- `/_authenticated/vendedor` — novo painel do vendedor:
  - Aba **Meu painel**: KPIs próprios (leads hoje/semana/mês, agendamentos), próximos agendamentos.
  - Aba **Meus leads**: lista filtrada por `vendedor_id`.
  - Aba **Meus agendamentos**: lista + mudar status (Agendado/Realizado/Remarcado/Cancelado/Não compareceu).
  - Aba **Minha disponibilidade**: gerencia slots próprios (mesmo modelo atual de slots individuais).
  - Aba **Meu link**: mostra `/agendar/{slug}`, copiar/abrir.

Redirecionamento pós-login (`/auth`):
- Se `has_role(admin)` → `/admin`.
- Senão se vendedor ativo → `/vendedor`.
- Senão → mensagem de acesso negado.

## Refatoração do chatbot

Extrair `src/routes/index.tsx` em um componente `src/components/ChatbotFlow.tsx` que aceita `vendedorId?` e `vendedorNome?` como props. Tanto `/` quanto `/agendar/$slug` renderizam esse componente. Slot picker recebe a função de buscar slots como prop (`getAvailableSlots`) para usar o RPC por vendedor quando aplicável.

`save_lead_progress` recebe o `vendedor_id` no payload e grava em `leads.vendedor_id`. Status de "Entrevista agendada" continua funcionando igual.

## O que NÃO entra agora (para manter escopo)

- Disponibilidade recorrente por dia da semana e bloqueios pontuais — você optou por manter o modelo atual de slots individuais por vendedor. Pode evoluir depois.
- Deduplicação de telefone/email normalizado em todos os vendedores — fica para iteração próxima (atualmente só o vendedor vê seus próprios leads, então duplicidade cruzada é menos crítica).
- Ranking de vendedores e taxa de conversão no dashboard do ADM — adiciono KPIs básicos (total leads/agendamentos por vendedor); ranking elaborado pode vir depois se quiser.
- Sub-status de agendamento (Realizado/Remarcado/etc.) — incluo campo `status` no agendamento, mas UI rica só no painel do vendedor.

## Detalhes técnicos

- `vendedores.user_id` é FK opcional para `auth.users(id)`. Trigger `on_auth_user_created` (ou server fn chamada no login) liga vendedor pelo email.
- RLS usa `current_vendedor_id()` security definer para evitar recursão.
- Server functions novas: `inviteVendedor`, `listVendedores`, `upsertVendedor`, `toggleVendedorAtivo` — todas exigem `requireSupabaseAuth` + checagem de admin.
- Rota `/agendar/$slug` é SSR-safe: busca vendedor via RPC público `get_vendedor_by_slug` (não usa admin client).
- `/_authenticated/vendedor` usa `current_vendedor_id()` para todos os queries (RLS protege).

## Ordem de execução

1. Migration (tabelas + RLS + funções).
2. Refatorar chatbot em componente compartilhado.
3. Criar rota `/agendar/$slug`.
4. Criar painel do vendedor `/_authenticated/vendedor`.
5. Adicionar aba Equipe no admin + filtros por vendedor.
6. Ajustar `/auth` para redirecionar por role.
