# Finance Tracker de Atendimentos

App web para registrar atendimentos, calcular lucro líquido e visualizar em dashboard, com base no seu arquivo `Atendimentos.numbers`. Arquitetura pensada para escalar (novas entidades, relatórios, multi-usuário).

## Idioma
Interface em **Português**.

## Modelo de dados de um atendimento

Colunas do formulário e da tabela:
- **Data**
- **Cliente** (selecionado do cadastro de clientes)
- **Procedimento**
- **Valor Bruto** (entrada)
- **Despesas** (entrada, default 0)
- **Imposto / Taxa** (entrada, default 0)
- **Valor Líquido** = `Valor Bruto − Despesas − Imposto/Taxa` (calculado automaticamente, coluna gerada no banco)

## Funcionalidades (v1)

### 1. CRUD de Atendimentos
- Formulário com os campos acima; Valor Líquido mostrado em tempo real
- Listagem em tabela com busca, filtro por período/procedimento/cliente, ordenação
- Editar e remover cada registro (com confirmação)

### 2. Cadastro de Clientes
- Página `/clientes` com CRUD (nome, telefone, email, observações)
- Select de cliente no formulário de atendimento com busca; opção "＋ Novo cliente" abre modal sem sair do formulário
- Ao remover cliente, atendimentos existentes preservam o nome (soft link)

### 3. Dashboard
- KPIs com filtro de período (mês atual, mês passado, ano, custom):
  - Receita Bruta, Despesas, Impostos, **Lucro Líquido**
  - Nº de atendimentos, Ticket médio (líquido), Nº de clientes ativos
- Gráfico de Lucro Líquido por mês (barras)
- Gráfico de receita por procedimento (donut)
- Top clientes por lucro líquido
- Últimos atendimentos

### 4. Exportar para Excel
- Botão "Exportar Excel" na lista de atendimentos e no dashboard
- Gera `.xlsx` respeitando os filtros ativos, com colunas: Data, Cliente, Procedimento, Valor Bruto, Despesas, Imposto/Taxa, Valor Líquido
- Linha de totais no rodapé
- Feito no navegador com `xlsx` (SheetJS) — sem round-trip no servidor

### 5. Autenticação
- Login por email/senha (Lovable Cloud). Cada usuário vê apenas seus próprios dados (RLS).

## Preparado para escalar

- Banco relacional (Postgres via Lovable Cloud), não localStorage
- Tabela `user_roles` + função `has_role()` já provisionadas para admin/secretária futuros
- Rotas modulares: fácil acrescentar `/despesas-fixas`, `/relatorios`, `/agenda`
- Camada de dados via TanStack Query + server functions — mesmo padrão para toda nova entidade
- Estrutura espelha seu Numbers, então importação de CSV depois é direta

## Detalhes técnicos

**Stack**: TanStack Start + Lovable Cloud (Postgres + Auth) + shadcn/ui + Recharts + SheetJS (`xlsx`).

**Tabela `clients`**
```
id uuid pk, user_id uuid, name text not null,
phone text, email text, notes text,
created_at, updated_at
```

**Tabela `appointments`**
```
id uuid pk, user_id uuid,
date date not null,
client_id uuid references clients(id) on delete set null,
client_name text not null,          -- snapshot para preservar histórico
procedure text not null,
gross_value numeric(10,2) not null,
expenses   numeric(10,2) not null default 0,
tax        numeric(10,2) not null default 0,
net_value  numeric GENERATED ALWAYS AS
           (gross_value - coalesce(expenses,0) - coalesce(tax,0)) STORED,
created_at, updated_at
```
Índices em `(user_id, date)`, `(user_id, client_id)`. RLS: `user_id = auth.uid()` em SELECT/INSERT/UPDATE/DELETE. GRANTs para `authenticated` + `service_role`.

**Tabela `user_roles`** com enum `app_role` (admin, user) + função `public.has_role()` security definer.

**Rotas**
- `/auth` — login/signup
- `/_authenticated/` layout gate
  - `/` dashboard
  - `/atendimentos` lista + filtros + exportar
  - `/atendimentos/novo`, `/atendimentos/$id/editar`
  - `/clientes` lista + CRUD

**Server functions** (`src/lib/*.functions.ts`, todas com `requireSupabaseAuth`):
- `listAppointments`, `getAppointment`, `createAppointment`, `updateAppointment`, `deleteAppointment`
- `listClients`, `createClient`, `updateClient`, `deleteClient`
- `getDashboardStats`

**Exportação**: `bun add xlsx`. Utilitário `exportAppointmentsToXlsx(rows, filename)` roda no cliente.

**Design**: tema claro, foco em legibilidade dos números; cards de KPI no topo do dashboard, gráficos abaixo. Sem gradientes genéricos.

## Fora do escopo desta v1 (fácil adicionar depois)
- Cadastro separado de procedimentos (hoje texto livre com autocomplete a partir do histórico)
- Despesas fixas mensais
- Importação do `.numbers`/CSV
- Exportar PDF
- Agenda / lembretes

Se estiver ok, é só aprovar que eu implemento.
