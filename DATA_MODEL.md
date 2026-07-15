# Modelo de Dados

> Reflete o estado do schema após a migration de 2026-07-14 (dado compartilhado). Consulte `supabase/migrations/` para o histórico completo e exato — este documento descreve o estado atual, não a evolução linha a linha.

## `clients`

Cadastro de clientes. Visível/editável por qualquer conta aprovada.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Quem criou o registro (autoria, não controla visibilidade) |
| `name` | text | |
| ... | | demais campos de contato/cadastro |

## `procedures`

Catálogo de procedimentos oferecidos, com preço de referência — usado para pré-preencher valor estimado ao criar um atendimento/agendamento.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Autoria |
| `name` | text | |
| `price` | numeric | Valor de referência |

## `appointments`

Registro financeiro de atendimentos. Em transição para também representar agendamentos futuros (feature "Agenda", ver `ARCHITECTURE.md`).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Autoria (quem criou/agendou) |
| `client_id` | uuid | FK → `clients` |
| `client_name` | text | Denormalizado para exibição/exportação |
| `procedure` | text | |
| `date` | date | Data do atendimento (sem hora — legado, pré-agenda) |
| `gross_value` | numeric | Valor bruto |
| `expenses` | numeric | Custos |
| `tax` | numeric | Impostos |
| `net_value` | numeric | Valor líquido |
| `notes` | text | |
| `status` *(planejado)* | enum | `agendado` \| `concluido` \| `cancelado` |
| `scheduled_at` *(planejado)* | timestamptz | Data + hora do agendamento |
| `duration_minutes` *(planejado)* | integer | Duração prevista |

## `user_roles`

| Coluna | Tipo | Observação |
|---|---|---|
| `user_id` | uuid | FK → `auth.users` |
| `role` | `app_role` enum (`admin`, `user`) | Atribuído manualmente via `/usuarios` |

Sem policy de INSERT/UPDATE/DELETE para `authenticated`/`anon` — escrita só via `service_role` (server function), previne auto-promoção.

## `user_status`

| Coluna | Tipo | Observação |
|---|---|---|
| `user_id` | uuid | FK → `auth.users` |
| `status` | enum (`pending`, `approved`, `rejected`) | Default `pending`; ausência de linha = tratado como não aprovado |

## `audit_logs`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Quem realizou a ação |
| `user_email` | text | Denormalizado |
| `action` | text, `CHECK IN` | `INSERT`, `UPDATE`, `DELETE` (+ `LOGIN`, `LOGIN`/`LOGOUT` planejados) |
| `entity` | text | Nome da tabela/entidade afetada |
| `entity_id` | uuid | Registro afetado |
| `changes` | jsonb | Diff da alteração |
| `created_at` | timestamptz | |

Populada via trigger `SECURITY DEFINER` (`private.log_audit_event`, roda como dono, ignora RLS). Inserção direta pelo client é negada por policy explícita.

## Funções (schema `private`, não expostas via API)

- `private.has_role(user_id uuid, role app_role) → boolean`
- `private.is_approved(user_id uuid) → boolean` — `true` se `has_role(user_id, 'admin')` OU `user_status.status = 'approved'`

## Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```
