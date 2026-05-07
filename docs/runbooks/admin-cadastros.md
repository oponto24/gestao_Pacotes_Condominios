# Runbook — Cadastros Admin (tenant-scoped)

> **Stories:** 2.2 (Setor), 2.3 (Unidade), 2.4 (Morador) — em progresso
> **Owner:** Dev (Dex) | **Última atualização:** 2026-05-06

## Visão geral

CRUDs administrativos do condomínio — apenas role `admin` acessa. Todos
**tenant-scoped** via `withTenant()` (RLS automático).

## Setor (Story 2.2)

Setores agrupam onde os pacotes ficam armazenados (ex: Bloco A, Salão de
Festas, Sala de Triagem).

### UI

`/admin/setores` (acessível pela sidebar do AdminLayout).

### API REST

| Método | Path | Propósito |
|---|---|---|
| `GET` | `/api/admin/setores` | Lista paginada com `_count.pacotes` |
| `GET` | `/api/admin/setores/[id]` | Detalhe |
| `POST` | `/api/admin/setores` | Cria — 409 se nome duplicado no condomínio |
| `PATCH` | `/api/admin/setores/[id]` | Update parcial |
| `DELETE` | `/api/admin/setores/[id]` | Delete físico — 409 se houver pacotes vinculados |

**Query params do list:** `?page=1&pageSize=20&q=<busca>&include_inativos=false`

### Modelo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | gerado |
| `condominio_id` | UUID | injetado do tenant context (não vem do payload) |
| `nome` | string (1-100) | unique composite com `condominio_id` |
| `descricao` | string (max 300) | opcional |
| `capacidade` | int (1-9999) | opcional, sem enforcement em runtime ainda |
| `ativo` | boolean | default `true` |

### Estado: ativo vs deletado

- **Desativar** (`ativo: false`): preserva histórico, esconde da lista por padrão.
  Reversível a qualquer momento.
- **Excluir** (`DELETE`): apenas se `_count.pacotes === 0`. Físico, irreversível.

UI esconde botão "Excluir" quando setor tem pacotes vinculados — admin precisa
desativar.

### Tenant isolation

Todas as queries DB usam `withTenant()` que aplica RLS automático via
`SET LOCAL app.current_condominio` na transação. Setor de tenant A nunca aparece
em queries do tenant B.

**Test crítico:** `tests/integration/setor-api.test.ts` valida isolamento
explicitamente.

## Permissões

| Endpoint | admin | super_admin | porteiro | Anônimo |
|---|---|---|---|---|
| UI `/admin/setores` | ✅ | redirect `/super-admin` | redirect `/` | redirect `/` |
| `/api/admin/setores/*` | ✅ | 403 | 403 | 401 |

Guard centralizado: `src/lib/api/admin-guard.ts` (`requireAdmin()`).

## Unidade (Story 2.3)

Unidades são apartamentos/casas do condomínio. Identificadas por `identificador`
+ `bloco` opcional (ex: "101 Bloco A", "Casa 12 sem bloco").

### UI

`/admin/unidades` (acessível pela sidebar do AdminLayout).

### API REST

| Método | Path | Propósito |
|---|---|---|
| `GET` | `/api/admin/unidades` | Lista paginada com `_count.{moradores, pacotes}` |
| `GET` | `/api/admin/unidades/[id]` | Detalhe |
| `POST` | `/api/admin/unidades` | Cria — 409 se `(identificador, bloco)` duplicado no condomínio |
| `PATCH` | `/api/admin/unidades/[id]` | Update parcial |
| `DELETE` | `/api/admin/unidades/[id]` | Delete físico — 409 se houver morador OU pacote vinculado |

**Query params do list:** `?page=1&pageSize=20&q=<busca>&include_inativas=false`
(busca em identificador OR bloco). `pageSize` máx = 200.

### Modelo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | gerado |
| `condominio_id` | UUID | injetado do tenant context |
| `identificador` | string (1-50) | ex: "101", "Apto 301-B" |
| `bloco` | string (max 50) | opcional, ex: "A" |
| `observacoes` | string (max 500) | opcional |
| `ativo` | boolean | default true |

### Unique composite com bloco NULL

Postgres trata `(condId, '101', NULL)` como **distinto** de outro
`(condId, '101', NULL)` em UNIQUE. Por isso `findUnidadeByIdentificador`
faz match explícito tratando `bloco === null` (Prisma traduz para `IS NULL`).

**Lição:** confiar apenas no DB constraint deixaria duplicatas-NULL
passarem. Sempre check explícito antes do INSERT.

### DELETE com 2 validações

- Se `_count.moradores > 0` → 409 "remova/transfira primeiro"
- Se `_count.pacotes > 0` → 409 "desative em vez de deletar"

UI esconde botão "Excluir" quando qualquer um > 0.

## Próximas stories

- **2.4 — CRUD Morador:** principal + adicionais por unidade
