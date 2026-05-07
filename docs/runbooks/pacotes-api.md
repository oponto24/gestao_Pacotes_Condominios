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

### Job extractLabel (story 3.5)

Payload: `{ pacote_id, condominio_id }`
jobId: `pacote_id` (idempotência)
Worker (story 3.5) lê foto → Claude Haiku vision → preenche `pacote.ia_extracao_raw` + `ia_confianca` + move status para `pendente_identificacao` ou outro.

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
