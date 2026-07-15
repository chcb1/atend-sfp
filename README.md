# Fisio App — Controle de Atendimentos

App pessoal de gestão financeira de atendimentos (clientes, procedimentos, atendimentos e agenda), construído no [Lovable](https://lovable.dev) e publicado em `atend-sfp.lovable.app`.

## Stack

- **Frontend/SSR:** TanStack Start (React + Vite + Nitro, SSR real — não é SPA estática)
- **Deploy target:** Cloudflare Workers (via Nitro)
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Hospedagem:** Lovable Cloud (infra nativa do Lovable, não migrado para infra própria)

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Estrutura do app, rotas, decisões de design |
| [`SECURITY.md`](./SECURITY.md) | Modelo de RLS, papéis, aprovação de usuários, histórico de correções |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Dicionário de dados — tabelas, colunas, enums |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md) | Variáveis de ambiente e onde configurar cada uma |

## Como o projeto é mantido

Este projeto é desenvolvido via prompt no editor do Lovable, não por edição direta de código. O repositório GitHub (`chcb1/atend-sfp`) é um espelho em sync bidirecional — qualquer alteração no Lovable aparece aqui automaticamente, e vice-versa.

**Importante:** o repositório fica **privado por padrão**. Ele só é temporariamente tornado público para permitir auditoria de código externa (ex.: revisão de segurança). Sempre voltar para privado depois.

## Ambientes

- **Preview:** editor do Lovable, usado durante desenvolvimento.
- **Produção:** `atend-sfp.lovable.app`, publicado manualmente via botão "Publish" no Lovable. Ver [`ENVIRONMENT.md`](./ENVIRONMENT.md) para variáveis exigidas nesse ambiente — um publish já falhou por variável ausente em produção (ver `SECURITY.md`, incidente de 2026-07-13).
