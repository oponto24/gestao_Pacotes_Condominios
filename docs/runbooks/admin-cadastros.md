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

## Morador (Story 2.4)

Moradores vinculados a unidades. **1 principal por unidade** (recebe
notificações WhatsApp como fallback) + N adicionais.

### UI

`/admin/moradores` (sidebar do AdminLayout).

### API REST

| Método | Path | Propósito |
|---|---|---|
| `GET` | `/api/admin/moradores` | Lista paginada com `_count.pacotes_destinatario` + `unidade` |
| `GET` | `/api/admin/moradores/[id]` | Detalhe |
| `POST` | `/api/admin/moradores` | Cria — invariante 1-principal aplicado em transação |
| `PATCH` | `/api/admin/moradores/[id]` | Update parcial — **NÃO aceita `unidade_id`** |
| `DELETE` | `/api/admin/moradores/[id]` | **Soft delete LGPD** (NFR-031) — seta `deleted_at`, NÃO físico |
| `POST` | `/api/admin/moradores/[id]/restore` | Reverte soft delete |

**Query params do list:** `?page=1&pageSize=20&q=<busca>&unidade_id=<uuid>&include_inativos=false&include_arquivados=false`

### Modelo

| Campo | Tipo | Notas |
|---|---|---|
| `condominio_id` | UUID | injetado do tenant context |
| `unidade_id` | UUID | FK obrigatória — **NÃO mudável via PATCH** |
| `nome` | string (3-200) | trim |
| `nome_normalizado` | string (200) | **derivado** server-side via `normalizarNome(nome)` (matching IA story 3.7) |
| `telefone` | string (E.164) | **UNIQUE composite com condominio_id** — mesmo telefone em condomínios diferentes coexiste |
| `email` | string (max 200) | opcional, sem unique |
| `is_principal` | boolean | **invariante: 1 por unidade** (transação) |
| `ativo` | boolean | desativação reversível |
| `deleted_at` | DateTime? | **soft delete LGPD** (NFR-031) — preserva FKs históricas |

### Invariante "1 principal por unidade"

Aplicado em transação no CREATE e PATCH. Antes do INSERT/UPDATE com
`is_principal=true`, faz `updateMany({ unidade_id, is_principal: true,
deleted_at: null }, { is_principal: false })`.

**Soft delete também desmarca `is_principal`** (admin precisa re-marcar
explicitamente após restore).

### Soft delete vs DELETE físico (LGPD)

- **Por que soft:** preserva FKs históricos (`pacote.destinatario_id`,
  `whatsapp_message.morador_id`)
- `deleted_at IS NOT NULL` esconde da lista por padrão; restore reverte
- **Restore NÃO restaura `is_principal`:** evita conflito silencioso

### `nome_normalizado` (matching IA da 3.7)

Calculado server-side via `normalizarNome(nome)`: lowercase + remove acentos
(`João` → `joao`) + trim + colapsa espaços. Será consumido pelo algoritmo
de matching IA-extraído ↔ morador.

### Telefone E.164

Helpers em `src/lib/validators/_shared.ts` (extraídos da 2.1 para reuso).
Aceita `(11) 98765-4321` ou `+5511987654321` no input, normaliza para
`+5511987654321` antes do save. Será usado pela story 4.x (Meta WhatsApp).

## Próximas stories

- **2.5/2.6** — Importação CSV (upload + parser + validação + commit)
- **3.7** — Algoritmo de matching IA usando `nome_normalizado`
