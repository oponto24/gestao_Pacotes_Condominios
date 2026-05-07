# Runbook — Cadastros Admin (tenant-scoped)

> **Stories:** 2.2 (Setor), 2.3 (Unidade), 2.4 (Morador), 2.5 (CSV upload+parse), 2.6 (CSV preview+commit) — fecha Epic 2
> **Owner:** Dev (Dex) | **Última atualização:** 2026-05-07

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

## Importação CSV (story 2.5 — upload + parser + validação)

Tela: **Cadastros → Importar CSV** (`/admin/cadastros/importar`)

### Schema do arquivo

Cabeçalho obrigatório (ordem das colunas é flexível, nomes não):

```csv
bloco,identificador,morador_nome,morador_telefone,morador_email
```

| Coluna | Obrigatório | Notas |
|---|---|---|
| `bloco` | Coluna sim, valor não | Vazio = unidade sem bloco. Ex: `(bloco='', identificador='5')` é distinto de `(bloco='A', identificador='5')` |
| `identificador` | ✅ | Nome/número da unidade dentro do bloco. Ex: `101`, `Casa-3`, `Loja-A` |
| `morador_nome` | ✅ | Min 3 caracteres, max 200. Será o morador **principal** da unidade |
| `morador_telefone` | ✅ | Aceita `(11) 98765-4321` ou `+5511987654321`. Normalizado para E.164 |
| `morador_email` | Coluna sim, valor não | Vazio = sem email |

### Limites

- **1000 linhas** máx por arquivo (anti-DoS)
- **256KB** tamanho máx do arquivo
- **UTF-8** (com ou sem BOM — Excel exporta com BOM por padrão; o parser strip)
- **Aspas duplas** escapam vírgulas internas no nome (RFC 4180): `"Silva, João"`

### Validações

**Por linha:**
- Telefone formato BR válido (regex de `_shared.ts`)
- Nome min 3 chars
- Email formato válido se preenchido
- Identificador min 1 char

**Cross-row (intra-arquivo):**
- `(bloco, identificador)` único — duplicata marca **ambas as linhas** como erro
- `morador_telefone` único — duplicata marca **ambas as linhas** como erro

### Comportamento da tela 2.5

- Apenas **analisa** o arquivo — **não persiste nada** no banco
- Resposta: lista de linhas válidas + lista de linhas com erro (linha + mensagem)
- Resultado salvo em `sessionStorage['csvImportResult']` para a story 2.6 consumir
- Próximo passo (story 2.6): preview detalhado + commit transacional

### Exemplo de arquivo

Template: [`docs/runbooks/exemplos/import-exemplo.csv`](exemplos/import-exemplo.csv)

### LGPD (NFR-030)

Ao subir CSV, o admin **declara ter consentimento** dos moradores listados.
A tela registrará `audit_log` com `actor_user_id`, `count`, `timestamp` (story 8.x).

---

## Confirmação CSV (story 2.6 — preview + commit transacional)

Tela: **Cadastros → Importar CSV → preview** (`/admin/cadastros/importar/preview`)

### Fluxo completo

```
1. Upload (2.5)
   POST /api/admin/csv-import/parse
   → ParseResult { valid, invalid, totalRows }
   → sessionStorage['csvImportResult']

2. Preview (2.6)
   Lê sessionStorage no mount
   → POST /api/admin/csv-import/validate-db { rows: valid }
   → DbValidationResult { okToCreate, conflicting }
   → renderiza tabela com 3 status (válida / conflito / inválida)

3. Commit (2.6)
   Botão "Confirmar importação"
   → POST /api/admin/csv-import/commit { rows: okToCreate }
   → Prisma $transaction: cria N unidades + N moradores principais
   → toast sucesso + redirect /admin/moradores
```

### Validação cross-DB

`validateAgainstDb` faz **2 queries totais** (não N+1):

| Conflito | Detecção | Comportamento |
|---|---|---|
| `UNIDADE_EXISTE` | `(condominio_id, bloco, identificador)` já existe (qualquer estado) | Linha vai para `conflicting`, NÃO bloqueia o batch |
| `TELEFONE_EXISTE` | `(condominio_id, telefone, deleted_at IS NULL)` já existe | Linha vai para `conflicting`. **Soft-deleted NÃO conta** (admin pode reciclar telefone) |

Linhas com qualquer conflito são exibidas mas **não enviadas no commit**. Admin
pode prosseguir com o batch parcial OU baixar CSV de erros para corrigir.

### Commit transacional

`Prisma.$transaction` (via `withTenant`):
- Cria todas as Unidades novas
- Cria todos os Moradores principais (1 por unidade, `is_principal=true`)
- `nome_normalizado` derivado server-side via `normalizarNome`
- Qualquer erro → **rollback completo** (zero gravado)

### Decisões de produto

| Decisão | Motivo |
|---|---|
| Conflitos NÃO bloqueiam | Admin não perde 999 linhas válidas por causa de 1 conflito |
| Sem update via CSV | Linha existente é pulada — edits via UI manual |
| `is_principal=true` para todos | Decisão @po — 1 unidade nova = 1 morador novo principal. Adicionais via UI |
| 2 endpoints (validate-db + commit) | Reduz risco de double-commit. Admin pode re-validar várias vezes |

### Download CSV de erros

Botão "Baixar CSV de erros" (visível se há linhas inválidas OU conflitantes):
- Gera client-side com `Papa.unparse` (sem ida ao server)
- Coluna extra `erro` com motivo
- UTF-8 com BOM (Excel BR abre acentos certos)
- Nome: `import-erros-YYYYMMDDTHH.csv`

### Edge cases

- **sessionStorage vazio** (admin abre nova aba) → preview mostra empty state com CTA "Subir CSV"
- **Browser fecha durante commit** → transação Prisma rolla back automaticamente, nada persiste
- **Race condition** entre 2 admins → `UNIQUE` constraint do DB barra, transação reverte
- **Performance:** 1000 linhas comitam em <2s (medido via tests)

### Endpoints REST

| Método | Path | Propósito |
|---|---|---|
| `POST` | `/api/admin/csv-import/parse` | Parse + validação intra-arquivo (2.5) |
| `POST` | `/api/admin/csv-import/validate-db` | Cross-DB check, retorna split (2.6) |
| `POST` | `/api/admin/csv-import/commit` | Transação atômica (2.6) |

Todos com `requireAdmin()` + `withTenant`.

---

## Próximas stories

- **3.7** — Algoritmo de matching IA usando `nome_normalizado`
- **4.x** — WhatsApp consumindo telefones E.164 importados via CSV
- **8.x** — Audit log do `csv_import` para compliance LGPD
