# Login travado em "Carregando..." — diagnóstico e correção

## O que está acontecendo

O problema não está no código do site. Reproduzi uma tentativa de login direto no servidor:
a requisição de login fica pendurada e nunca responde (esgotou 25 segundos sem resposta).

Verificações feitas agora:

- A porta de entrada do login responde (o serviço está de pé).
- A ligação entre o serviço de login e o banco de dados **não responde** (tempo esgotado).
- A verificação de saúde do banco também não responde.

Ou seja: o serviço de login está aceitando a conexão, mas trava ao consultar o banco.
Como a tela só sai de "Carregando..." quando a resposta chega, ela fica presa para sempre —
para você e para todos os consultores. É o mesmo tipo de instabilidade do episódio anterior,
agora afetando a camada de banco.

## O que farei

1. Reiniciar o servidor do backend (pedirei sua aprovação — o serviço fica alguns minutos indisponível).
   Isso não apaga, altera nem recria nada: leads, consultores, horários, contas e regras de acesso permanecem intactos.
2. Aguardar o backend voltar a ficar saudável, verificando o estado repetidamente.
3. Refazer o teste real de login contra o servidor e confirmar que ele responde em vez de travar.
4. Conferir que os dados continuam lá (contagem de leads, consultores e horários).

## Melhoria opcional na tela de login

Hoje, se o servidor demorar, o botão fica "Carregando..." indefinidamente, sem explicação.
Posso adicionar um limite de espera (cerca de 20 segundos) que mostra uma mensagem clara —
"O servidor não respondeu, tente novamente em instantes" — e libera o botão.
Isso não conserta a causa, mas evita a sensação de travamento total em futuras instabilidades.
Me diga se quer que eu inclua isso junto.

## Detalhes técnicos

- `POST /auth/v1/token?grant_type=password` → sem resposta (timeout 25s, exit 28).
- `GET /auth/v1/health` → 401 rápido (0,08s): gateway vivo.
- `cloud_status` → `backend_unreachable_db: auth→database probe: context deadline exceeded`.
- `db_health` → `metrics_unavailable: Client.Timeout`.
- Ação: `supabase--restart`, depois `cloud_status` em polling até `ACTIVE_HEALTHY`, seguido de
  novo teste de token e `read_query` de contagens. Nenhuma migração, nenhuma alteração de RLS ou auth.
