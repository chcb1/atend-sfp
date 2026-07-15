# Arquitetura

## Visão geral

```
Browser (React) ──SSR/RPC──> TanStack Start server functions ──> Supabase (Postgres + Auth)
                                        │
                                        └─ usa service_role key (server-only)
                                           para ações administrativas
```

O app **não é uma SPA estática**. TanStack Start renderiza no servidor (Nitro, target Cloudflare Workers) e expõe *server functions* (`createServerFn`) que rodam no backend, com acesso a segredos que nunca chegam ao browser.

## Papéis de usuário

| Papel | Acesso |
|---|---|
| `admin` | Total: clientes, atendimentos, procedimentos, dashboard consolidado, `/usuarios` (aprovação e gestão de papéis), `/auditoria` |
| `user` | Clientes, atendimentos, procedimentos (CRUD completo, valores financeiros visíveis) — **sem** acesso ao dashboard consolidado nem às telas administrativas |

Papel é atribuído manualmente por um admin existente, na tela `/usuarios`. Não há auto-promoção.

## Fluxo de aprovação de conta

Cadastro (e-mail/senha ou Google OAuth) é aberto a qualquer visitante, mas **não concede acesso automático**:

1. Conta criada → sem linha em `user_status` → tratada como não aprovada por padrão.
2. Usuário loga, mas `_authenticated/route.tsx` intercepta e mostra tela de "aguardando aprovação" em vez do app.
3. Admin aprova/rejeita em `/usuarios` (grava `status = 'approved'` em `user_status`).
4. A partir daí, a função `private.is_approved(auth.uid())` passa a retornar `true`, liberando o acesso via RLS.

## Modelo de dados compartilhado (decisão deliberada)

`clients`, `appointments` e `procedures` **não são isolados por usuário**. Qualquer conta aprovada (`admin` ou `user`) vê e edita todos os registros, independente de quem criou. A coluna `user_id` em cada tabela registra só a autoria (quem criou), não controla visibilidade.

**Por quê:** é um app de uso interno de um negócio pequeno (ex.: clínica), onde todas as contas aprovadas devem operar sobre a mesma base de clientes/agenda — não é um SaaS multi-tenant. Essa decisão foi tomada conscientemente em 2026-07-14, revertendo o modelo inicial (isolado por `user_id`), que impedia uma segunda conta de ver os dados já cadastrados pela primeira.

**Trade-off aceito:** aprovar uma conta = dar acesso total a todos os dados financeiros do negócio. Não há granularidade parcial hoje (ex.: "user vê só os próprios atendimentos"). Ver `SECURITY.md` para detalhes de RLS.

## Rotas principais

```
/                          → dashboard (admin only)
/auth                      → login/cadastro (e-mail/senha + Google OAuth)
/clientes                  → CRUD de clientes
/atendimentos              → listagem + exportação .xlsx
/atendimentos/novo         → criar atendimento
/atendimentos/:id/editar   → editar atendimento
/procedimentos             → CRUD de procedimentos (catálogo/preços)
/usuarios                  → (admin) aprovação de contas + gestão de papéis
/auditoria                 → (admin) log de ações (audit_logs)
```

## Funções de servidor (SECURITY DEFINER)

Vivem no schema `private` (não exposto via API REST/PostgREST — só acessíveis dentro de queries SQL do próprio Postgres, como dentro de RLS policies):

- `private.has_role(uuid, app_role)` — checa se um usuário tem determinado papel.
- `private.is_approved(uuid)` — checa se um usuário está aprovado (admin sempre é `true`).

Ambas exigem `GRANT EXECUTE ... TO authenticated` para que as RLS policies consigam avaliá-las — ver `SECURITY.md` para o histórico de por que isso não é opcional mesmo sendo `SECURITY DEFINER`.

## Ações administrativas (client.server.ts)

Ações sensíveis (listar usuários, aprovar/rejeitar, promover a admin, excluir conta) usam um client Supabase separado, instanciado só no servidor (`src/integrations/supabase/client.server.ts`), autenticado com a `service_role key` — nunca exposta ao browser. É importado **dinamicamente** (`await import(...)`) dentro das server functions administrativas, nunca de forma estática, para garantir que não seja incluído no bundle do client.

## Exportação de dados

`src/lib/xlsx-export.ts` gera `.xlsx` a partir dos dados já carregados no client — **só escreve**, nunca lê/parseia arquivo externo. Isso é relevante porque a lib `xlsx` tem CVEs conhecidas de parsing (ver `SECURITY.md`); o uso atual não expõe esse vetor.

## Agenda (em construção)

Feature em desenvolvimento: transformar `appointments` em base de agenda, adicionando `status` (`agendado`/`concluido`/`cancelado`), `scheduled_at` e `duration_minutes`. Dashboard passa a ter uma view de "provisão futura" (soma de `agendado`) separada do consolidado (`concluido`). Ver histórico de planejamento para detalhes de fases.
