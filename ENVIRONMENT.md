# Variáveis de Ambiente

## Públicas (client-side, prefixo `VITE_`)

Injetadas no bundle do browser pelo Vite em build time. **São seguras de expor** — a `anon key` do Supabase é projetada para ser pública; a segurança real vem da RLS, não de esconder essa chave.

| Variável | Onde é usada | Onde configurar |
|---|---|---|
| `VITE_SUPABASE_URL` | Client Supabase (browser) | `.env.production` (versionado) e ambiente de Preview do Lovable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client Supabase (browser) — chave `anon` | idem |
| `VITE_SUPABASE_PROJECT_ID` | Referência ao projeto Supabase | idem |

Arquivo: **`.env.production`** — commitado no repositório de propósito, contém só essas três chaves públicas. Necessário para o build de produção do Vite ter acesso a elas (diferente do `.env` genérico, que está no `.gitignore` e não é usado no pipeline de publish).

## Sensíveis (server-only, sem prefixo `VITE_`)

**Nunca** devem estar em nenhum arquivo versionado. Existem só como variáveis de ambiente configuradas diretamente no ambiente de execução do Lovable Cloud (produção) e, localmente, em `.env` (ignorado pelo Git).

| Variável | Onde é usada | Risco se vazada |
|---|---|---|
| `SUPABASE_URL` | `client.server.ts` (admin client) | Baixo sozinha, mas confirma o projeto alvo |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts` — **ignora RLS completamente** | **Crítico** — acesso total e irrestrito a todos os dados |

## Incidente relacionado

Em 2026-07-13, o primeiro publish em produção falhou (`This page didn't load`) porque `.env` havia sido removido do controle de versão (correção de segurança correta) mas **nenhum substituto versionado existia** para o pipeline de build de produção — as variáveis `VITE_*` simplesmente não estavam disponíveis no momento do build. Corrigido criando `.env.production` só com as chaves públicas. Ver `SECURITY.md` para o histórico completo.

## Checklist ao adicionar uma nova variável de ambiente

1. É usada no browser (client)? → prefixo `VITE_`, vai em `.env.production` (versionado).
2. É usada só no servidor e é sensível (chave, secret, token)? → **nunca** versionar, configurar direto no painel do Lovable Cloud para produção, e em `.env` local (já ignorado) para desenvolvimento.
3. Depois de adicionar, testar o build de produção (`Publish` no Lovable) antes de considerar concluído — variável ausente só se manifesta nesse momento, não no preview.
