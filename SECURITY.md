# Segurança

## Modelo de acesso (estado atual)

1. **Autenticação:** Supabase Auth (e-mail/senha + Google OAuth).
2. **Aprovação:** conta nova não tem acesso a dados até um admin aprovar em `/usuarios` (tabela `user_status`).
3. **Autorização:** RLS no Postgres, avaliada via `private.is_approved(auth.uid())` — dado compartilhado entre todas as contas aprovadas (ver `ARCHITECTURE.md`).
4. **Papéis:** `admin` (total) / `user` (operacional, sem dashboard/admin).
5. **Segredos:** `service_role key` só existe no servidor (`client.server.ts`), lida de variável de ambiente, nunca versionada nem enviada ao browser.
6. **Auditoria:** tabela `audit_logs`, populada via trigger `SECURITY DEFINER` — inserção direta pelo client é **negada explicitamente** (só o trigger, rodando como dono da função, ou `service_role`, conseguem inserir).

## Por que as funções `has_role`/`is_approved` vivem no schema `private`

Funções `SECURITY DEFINER` no schema `public` ficam automaticamente expostas via API REST do PostgREST (`supabase.rpc(...)`) — mesmo sendo usadas só internamente por RLS policies. Isso permite que qualquer cliente HTTP as chame diretamente, incluindo usuários não autenticados, vazando metadado (ex.: "esse UUID é admin?"). Mover para um schema não exposto (`private`) fecha esse vetor sem afetar o uso interno pelas policies.

**Detalhe não óbvio de Postgres:** mesmo função `SECURITY DEFINER` exige que o *role que dispara a policy* (`authenticated`) tenha `EXECUTE` concedido sobre ela. `SECURITY DEFINER` muda o contexto de execução (roda como dono), mas não dispensa a checagem de privilégio de chamada. Isso já causou regressão duas vezes neste projeto (ver incidentes abaixo) — qualquer nova função usada dentro de uma RLS policy precisa de `GRANT EXECUTE ... TO authenticated` explícito.

## Modelo de dado compartilhado — risco aceito conscientemente

RLS de `clients`/`appointments`/`procedures` não restringe por `user_id` na leitura/edição, só na criação (`WITH CHECK`). **Qualquer conta aprovada tem acesso total a todos os dados financeiros.** Isso é intencional (ver `ARCHITECTURE.md`), mas significa que o controle de acesso real do sistema é inteiramente a aprovação de conta — não há segunda camada de granularidade. Aprovar alguém em `/usuarios` deve ser tratado com o mesmo cuidado que dar acesso total ao sistema financeiro.

## Dependências — vulnerabilidades conhecidas e tratamento

| Pacote | Vulnerabilidade | Risco real neste projeto | Ação |
|---|---|---|---|
| `xlsx` 0.18.5 | ReDoS (CVE-2024-22363), Prototype Pollution (CVE-2023-30533) — sem correção via npm | Baixo — só usado para **escrever** `.xlsx`, nunca ler arquivo externo (vetor de exploração não é acionado) | Substituído por `exceljs` |
| `@tanstack/react-start` | Ecossistema `@tanstack/*` sofreu incidente de supply-chain em maio/2026 (84 versões maliciosas publicadas e removidas em ~20min) | Baixo se a versão instalada não for uma das comprometidas | Atualizado para versão estável mais recente do registry oficial |

## Práticas obrigatórias para qualquer mudança futura de schema

- Toda função nova usada em RLS policy precisa de `GRANT EXECUTE` explícito para `authenticated` (e nada para `PUBLIC`/`anon`, a menos que deva ser pública de propósito).
- Nunca commitar `.env` (está no `.gitignore`) — só `.env.production` com variáveis `VITE_*` (públicas por design, injetadas no bundle do browser).
- Repositório GitHub fica **privado por padrão**; só é aberto temporariamente para auditoria externa.
- Antes de aceitar qualquer correção de segurança como resolvida, validar lendo o código/migration gerado — não confiar só na descrição do que foi feito.

## Histórico de incidentes e correções

| Data | Problema | Causa | Correção |
|---|---|---|---|
| 2026-07-09 | Painel admin quebrado | `EXECUTE` de `has_role()` revogado de `authenticated` sem necessidade | `GRANT EXECUTE` restaurado |
| 2026-07-11/12 | Sem gate de aprovação | Cadastro aberto dava acesso imediato | Tabela `user_status` + `is_approved()` + bloqueio de rota |
| até 2026-07-12 | `.env` versionado no Git | Nunca esteve no `.gitignore` | Removido do controle de versão, adicionado ao `.gitignore` |
| 2026-07-13 | `is_approved()`/`has_role()` chamáveis por usuário não autenticado (`anon`) | `GRANT EXECUTE` padrão do Postgres para `PUBLIC` nunca revogado na criação da função | `REVOKE` de `PUBLIC`/`anon`, mantido só `authenticated` |
| 2026-07-13 | Linter apontava `audit_logs`/`user_roles` sem policy de escrita | Ausência de policy (deny-by-default) confundida com falha | Policies explícitas de `deny` — mesmo efeito, mas documentado e sem falso-positivo |
| 2026-07-13 | Funções ainda expostas via API pública mesmo após restringir grants | Estarem no schema `public` = expostas ao PostgREST independente de `GRANT` | Movidas para schema `private` (não exposto via API) |
| 2026-07-13 | Publish em produção falhou (`This page didn't load`) | `.env` no `.gitignore` removeu do pipeline as variáveis `VITE_*` necessárias no build de produção | Criado `.env.production` versionado, só com chaves públicas (`VITE_*`) |
| 2026-07-14 | Segunda conta aprovada não via nenhum dado | Modelo original isolava por `user_id`, incompatível com uso multi-conta pretendido | RLS alterada para modelo de dado compartilhado (ver acima) |

## Coisas que **não** foram implementadas (decisão consciente, não esquecimento)

- Verificação formal do app OAuth do Google — desnecessária para uso de conta única (ver seção OAuth em planejamento da agenda/Google Calendar, descartada em favor de agenda interna).
- Trava de `is_approved()`/`has_role()` restringindo consulta só ao próprio `auth.uid()` — hoje qualquer autenticado pode checar status de aprovação de outro UUID (vazamento de metadado, não de dado financeiro). Melhoria possível, não urgente.
- Expiração automática de agendamento vencido sem ação (fica pendente indefinidamente por decisão explícita).
