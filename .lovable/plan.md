## Plano de correção

### 1) Horários por vendedor

**Banco** (migração):
- `interview_slots`: adicionar trigger `BEFORE INSERT` que exige `vendedor_id NOT NULL` para novos slots (mantém legados intactos).
- Adicionar índice único `(vendedor_id, scheduled_at) WHERE lead_id IS NULL` para impedir duplicidade do mesmo vendedor.
- Atualizar RPC `get_available_slots` (legado, usado em `/`) para retornar `WHERE vendedor_id IS NULL` apenas (corta o "vazamento" de slots globais para outros vendedores). `get_available_slots_by_vendedor` já filtra corretamente.
- Adicionar coluna `vendedores.must_change_password BOOLEAN DEFAULT true`.

**Admin — aba Horários** (`src/routes/_authenticated/admin.tsx`):
- Adicionar `<Select>` obrigatório "Vendedor" antes de cadastrar horário.
- Listagem passa a mostrar coluna "Vendedor" e a filtrar por vendedor.
- Insert passa `vendedor_id` selecionado.

**Vendedor — Minha disponibilidade**: já correto (insere com `vendedor_id: vendedor.id`). Sem mudanças.

**Link público `/agendar/$slug`**: já busca apenas slots do vendedor via RPC. Sem mudanças.

### 2) Login obrigatório dos vendedores

Substituir o convite por magic-link (que loga sem senha) por **senha provisória** definida pelo admin:

**Server function** (`src/lib/vendedores.functions.ts`):
- Substituir `inviteVendedor` por `createVendedorAccount({ email, password })` usando `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`. Após criar, marca `vendedores.must_change_password = true` (o trigger `link_vendedor_on_signup` já vincula `user_id` por email).
- Nova `resetVendedorPassword({ vendedorId, password })` para admin redefinir.

**Admin — aba Equipe**:
- Trocar botão "Cadastrar e enviar convite" por formulário com campo "Senha provisória" (com botão "Gerar"). Após criar, exibe a senha em destaque com botão copiar e instrução "envie ao vendedor por WhatsApp".
- Ação "Reenviar convite" vira "Resetar senha" (gera nova senha provisória, marca `must_change_password=true`).
- Badge "aguardando definir senha" quando `must_change_password=true`.

**Tela `/auth`**:
- Já é login email+senha. Após login bem-sucedido, se for vendedor com `must_change_password=true`, redirecionar para nova rota `/_authenticated/trocar-senha` (forçada) antes de qualquer outra navegação.
- Bloquear vendedor inativo no login (mensagem "Seu acesso está inativo…").

**Nova rota `/_authenticated/trocar-senha`**: formulário simples (nova senha + confirmação) que chama `supabase.auth.updateUser({ password })` e seta `vendedores.must_change_password=false`. Enquanto `must_change_password=true`, o painel `/vendedor` redireciona para essa rota.

**Proteção de rotas**: `_authenticated/route.tsx` já força login. Sem mudanças (link público `/agendar/$slug` continua aberto).

### Fora de escopo (não pedido explicitamente)
- Migração da tabela `interview_slots` para o novo modelo `disponibilidade_vendedor` (dia da semana + janela recorrente) e tabela separada `bloqueios_agenda`. Mantém o modelo atual de slots individuais, que já satisfaz "cada slot pertence a um vendedor".
- Tela "Esqueci minha senha" pública via email (depende de infra de email). Por enquanto só admin redefine.

### Ordem
1. Migração (trigger, índice único, coluna `must_change_password`, RPC).
2. `vendedores.functions.ts` (create/reset com senha).
3. Admin: aba Horários com vendedor selecionável; aba Equipe com fluxo de senha.
4. `/auth` + rota `/trocar-senha` + redirecionamento.

Confirma?