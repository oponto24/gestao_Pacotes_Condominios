# Runbook — Pacotes API (story 3.4+)

> **Owner:** Dev (Dex) | **Última atualização:** 2026-05-07 (story 3.4)

## Endpoints

| Método | Path | Story | Propósito |
|---|---|---|---|
| `POST` | `/api/pacotes` | **3.4** | Cria rascunho + salva foto + enfileira IA |
| `PATCH` | `/api/pacotes/{id}/confirmar` | 3.8 | Admin confirma dados extraídos pela IA |
| `PATCH` | `/api/pacotes/{id}/organizar` | 3.9 | Define tamanho + setor + posição |
| `POST` | `/api/pacotes/{id}/retirar/iniciar` | 5.2 | Inicia retirada por QR |
| `POST` | `/api/pacotes/{id}/retirar/confirmar` | 5.4 | Confirma entrega ao morador |
| `GET` | `/api/admin/pacotes` | 6.1 | Lista admin com filtros |

## POST /api/pacotes (story 3.4)

### Auth

`requirePorteiro()` — aceita roles `porteiro` e `admin`. Super-admin é redirecionado.

### Request

`Content-Type: multipart/form-data`

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `file` | Blob | ✅ | JPEG ou PNG, max 5MB |
| `codigo_rastreio` | string | ❌ | Max 100 chars, apenas alfanumérico + `.-/ ` |

### Response

**201 Created:**
```json
{
  "pacote_id": "uuid",
  "foto_storage_path": "pacotes/{cond}/{pacote_id}/original.jpg",
  "status": "rascunho"
}
```

**400** validação · **401** sem auth · **403** role inválido · **500** erro interno

### Fluxo interno

1. Auth + multipart parse
2. Validação: file size, mime, codigo_rastreio (Zod)
3. Pré-gera UUID provisório → calcula path determinístico
4. **`storage.put`** salva foto em `pacotes/{cond}/{pacote_id}/original.{ext}`
5. **Transação Prisma** (`withTenant`):
   - `pacote.create` (status=`rascunho`, qr_token gerado, recebido_em=now, funcionario_recebedor_id=userId)
   - `pacote_foto.create` (is_principal=true, hash_sha256)
   - `pacote_evento.create` (tipo=`criado`, user_id, metadata={foto_path, bytes, codigo_rastreio})
6. **Enqueue job** `extractLabel` com `jobId=pacote_id` (idempotência BullMQ)
7. Retorna 201

**Cleanup best-effort:** se DB falha após `storage.put`, foto é deletada via `deletePacoteFoto`. Storage e DB não são transacionais juntos — aceitar arquivos órfãos como tech debt MVP.

### Storage

- Driver: `local` (NFS/disco local; story 8.x adiciona S3/R2)
- Path: `pacotes/{condominio_id}/{pacote_id}/original.{jpg|png}`
- Permite cleanup fácil (admin deleta pacote → deleta dir)

### Job extractLabel (stories 3.5 + 3.7 ✅ implementadas)

Payload: `{ pacote_id, condominio_id }`
jobId: `pacote_id` (idempotência via 3.4)

**Pipeline completo (3.5 IA + 3.7 matching):**

1. Worker carrega pacote + foto + condominio + **unidades + moradores ativos** (super-admin bypass de RLS, filtra por tenant)
2. Lê foto via `storage.get`
3. Chama Claude Haiku 4.5 vision → JSON estruturado (Zod validado)
4. **Roda `matchUnidadeMorador()`** — função pura, custo zero:
   - Parse de complemento via regex BR (`AP 1304 Bloco 3` → `{apto:'1304', bloco:'3'}`)
   - Busca unidade pelo número + bloco (se extraído)
   - Match de nome via Levenshtein ≥ 0.7 contra moradores da unidade
   - Fallback: morador `is_principal=true`
5. Atualiza pacote em transação:
   - **Sempre:** `ia_extracao_raw`, `ia_confianca`, `ia_processada_em`, campos textuais (`nome_destinatario_etiqueta`, `cep_etiqueta`, `complemento_etiqueta`, `remetente`)
   - **Matched:** `unidade_id`, `destinatario_id`, `destinatario_resolvido_via`; status fica `rascunho` (3.8 confirma)
   - **Pending:** `status = pendente_identificacao` (FR-021); pode ter `unidade_id` se achou unidade mas sem morador

**Resultados de matching (`MatchResult.kind`):**

| Resultado | status | unidade_id | destinatario_id | resolvido_via |
|---|---|---|---|---|
| `matched` (destinatário) | rascunho | UUID | UUID | `destinatario_cadastrado` |
| `matched` (fallback) | rascunho | UUID | UUID principal | `fallback_principal` |
| `pending/no_complemento` | pendente_identificacao | null | null | null |
| `pending/unidade_nao_encontrada` | pendente_identificacao | null | null | null |
| `pending/ambiguous_unidade` | pendente_identificacao | null | null | null |
| `pending/no_morador` | pendente_identificacao | UUID | null | null |

**Worker** lê foto via `storage.get`, chama **Claude Haiku 4.5 vision** com prompt caching ephemeral, valida JSON com Zod, e atualiza:
- `pacote.ia_extracao_raw` (JSON com 6 campos: nome, endereço, CEP, complemento, transportadora, remetente)
- `pacote.ia_confianca` (0.0 a 1.0)
- `pacote.ia_processada_em` (timestamp)

Status do pacote **permanece `rascunho`** (story 3.7/3.8 movem para `pendente_identificacao` ou outro depois do matching/confirmação).

**Custo medido:** ~$0.003/foto sem cache hit, ~$0.001/foto com cache hit. Atinge NFR-041 (<R$0.05) com folga.

**Telemetria de tokens** registrada em `pacote_evento.metadata`:
```json
{
  "model": "claude-haiku-4-5-20251001",
  "confianca": 0.35,
  "duration_ms": 1672,
  "input_tokens": 1853,
  "output_tokens": 76,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 0
}
```

**Em caso de falha da IA** (rate limit, network, schema inválido):
- Erro de API → `throw` → BullMQ retry 3x com backoff
- JSON inválido → fallback graceful: `ia_confianca = 0` + `ia_extracao_raw = { error: ... }`
- Schema falha → mesmo fallback
- Pacote permanece em `rascunho` em qualquer caso

**Como reprocessar manualmente:** enfileirar via Redis CLI ou script direto:
```bash
docker compose exec worker npx tsx -e "
import { enqueue } from '@/lib/queue/queues';
await enqueue('extractLabel', { pacote_id: 'UUID', condominio_id: 'UUID' });
"
```

### Limites

| Limite | Valor | Motivo |
|---|---|---|
| Tamanho da foto | 5MB | PhotoCapture comprime ~300KB típico, 5MB cobre iPhone Pro |
| `codigo_rastreio` | 100 chars | Cobre Correios + Mercado Livre + SEDEX |
| Mime aceito | jpeg, png | Outros formatos rejeitados (PRD não exige WebP/HEIC) |

### Tech debt registrado

- **Validação magic bytes da imagem** (lib `file-type`) — Content-Type é fácil de spoofar. MVP confia no auth+role
- **Idempotency-Key header** — UUID client + Redis cache evita pacotes duplicados em retry
- **Cleanup de fotos órfãs** — job futuro detecta arquivos sem `pacote_foto` correspondente
- **Width/height no `pacote_foto.metadata`** — facilita debug visual (Json field permite)

### Smoke test (curl)

Não funciona sem auth Clerk via cookie. Use playground em `/chegada` com `oponto24@gmail.com` logado.

### Como reprocessar pacote em rascunho

Se IA falhar (Redis down quando criou):
- Pacote fica em `status='rascunho'`
- Admin pode re-enfileirar manualmente via tela admin (story futura)
- Por ora, manualmente: `redis-cli` ou job admin via `BullBoard` UI
