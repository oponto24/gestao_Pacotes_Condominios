# Changelog

Histórico de mudanças do projeto. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

> **Nota:** este histórico é macro (épico/release), não commit-by-commit. Veja `git log` ou as stories em `docs/stories/` pra detalhes finos.

---

## [2026-05-08-pos-deploy] — Etapa 6 Meta WhatsApp + hotfixes deploy

### Added

- Webhook Meta WhatsApp configurado em produção (`/api/webhooks/meta-whatsapp`) — validado por Meta, inscrito em `messages` + `message_template_status_update`
- `META_WEBHOOK_VERIFY_TOKEN` adicionado a `.env.prod`
- Decisões de produto pós-Epic 4 capturadas no PRD (admin levels, palavra-chave, hierarquia, audit, dashboard)

### Fixed (hotfix PR #60)

- `docker-compose.prod.yml` faltava 9 vars Meta novas do Epic 4 — webhook retornava 403 e sendTemplate falhava por env ausente
- App e worker agora propagam `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `APP_URL`, etc.

### Docs (PR #62)

- PRD ganhou §3.8 (hierarquia operacional), §3.9 (lembretes), §3.10 (busca + Torres/Blocos), §3.11 (audit), §3.12 (dashboard)
- Renomeação "código ML" → "palavra-chave" (terminologia operacional)
- Roadmap pós-MVP definido: Epic 10 → 7 → 11 → 12 (~13 dias dev)
- Documentação simplificada -31% linhas (1395 → 959), eliminando duplicação

---

## [2026-05-08] — Epic 4 (PR #59)

### Added — Notificação WhatsApp

- **Cliente Meta Cloud API** (`src/lib/meta-whatsapp/`) com `sendTemplate`, modo mock (`META_DISABLED=true`), `MetaApiError` tipada com mapping de codes Meta (story 4.1)
- **Gerador QR Code 1200×628** (`src/lib/qr/`) com sharp + qrcode + SVG overlay com nome do condomínio. Aspect 1.91:1 evita corte no preview WhatsApp (story 4.2)
- **Worker BullMQ `sendWhatsApp`** com trigger no `organizar` (3.9), retry exponencial 5s/10s/20s/40s, jobId determinístico anti-dup (story 4.3)
- **Webhook Meta** `/api/webhooks/meta-whatsapp` com HMAC-SHA256 timing-safe + processamento async + idempotência por `meta_message_id` (story 4.4)
- **`chooseRecipient`** (`src/lib/whatsapp/recipient.ts`) com matching de nome (exato → fuzzy ≥0.7 → primeiro+último) → fallback principal → adicional (story 4.5)
- **Endpoint reenviar manual** `POST /api/pacotes/{id}/reenviar-whatsapp` com rate limit 3/h por pacote + `forceUnique` no enqueue (story 4.6)
- **UI bloco "Notificações WhatsApp"** em `PacoteDetalheView` com timeline de status (pending/sent/delivered/read/failed), botão Reenviar com loading, telefone mascarado, indicação de matched_by (story 4.6b)
- Smoke scripts: `npm run smoke:meta` (envia template real), `npm run smoke:qr` (gera + abre PNG no Preview)

### Added — Documentação

- `docs/architecture/ARCHITECTURE.md` §2.4.1 — módulo `meta-whatsapp` (estrutura + env vars + modo mock)
- `docs/architecture/ARCHITECTURE.md` §5.2 — fluxo `sendWhatsApp` atualizado com decisões reais Epic 4
- `docs/architecture/ARCHITECTURE.md` §5.3 — fluxo webhook Meta com handlers específicos
- `docs/qa/e2e-specs/reenviar-whatsapp.md` — 6 casos E2E documentados (Playwright execução pendente)
- Setup Meta WhatsApp runbook completo: Etapas 1-5 concluídas (App, System User, token permanente, template `pacote_chegou` em análise)

### Changed

- `Pacote.qr_image_path` adicionado (migration `20260508170000_add_qr_image_path`) — path no storage da imagem 1200×628
- `WhatsAppMessage.template_params` agora inclui `matched_by` pra audit (workaround pra `PacoteEvento.notificacao_fallback` que não existe no enum)
- `enqueueSendWhatsApp` ganhou opção `forceUnique` pra reenvio manual
- `loadPacoteDetail` (story 6.3) estende com `whatsapp_messages[]` (10 campos cada)
- Dockerfile: `npm ci --include=optional` + verificação `require('sharp')` build-time
- `infra/docker/docker-compose.yml` propaga 9 variáveis Meta_*

### Fixed

- `seed.test.ts` env coupling: `runSeed` agora limpa `META_*` do parent env antes do `execSync` — fix 3 falhas pré-existentes (todas relacionadas a expectations de placeholder behavior)

### Pending — Epic 4

- ⏳ Aprovação Meta do template `pacote_chegou` (smoke real)
- ⏳ Etapa 6 do runbook (configurar webhook URL no painel Meta) — só pós-deploy
- ⏳ Chip dedicado WhatsApp pra produção real

### Tests

- Suite full: 387 → **401** tests verde (39 novos Epic 4 + 8 UI 4.6b + 5 seed corrigidos)

---

## [2026-05-08] — Epic 3 fechado, Gemini default

### Added

- **Story 3.12** Deploy VPS — Docker + Nginx + Let's Encrypt + HTTPS em https://condominios.oponto24.com.br
- **Provider IA Gemini Flash-Lite** (default, ~15× mais barato que Anthropic) com fallback automático Anthropic em caso de erro 5xx/timeout
- **Setor TESTE-IA criado em prod** (apto 31, morador Gustavo, porteiro vinculado) pra smoke real
- **Etapa 1 setup Meta WhatsApp** — verificação empresa concluída

### Changed

- Schema Prisma tolerante (campos opcionais em respostas IA, não fail-fast)
- `/chegada` UX redondo: câmera HD, dropdown de lentes, bairro/cidade separados, FAB contextual (vira "Usar foto" após capturar), IA extrai código + auto-submit

### Fixed

- AI client buildtime — não throw quando API key ausente no build (placeholder permite Next standalone build)

### PRs (#45-#58)

14 PRs mergeados nesta onda fechando Epic 3 e preparando Epic 4.

---

## [2026-05-07] — Epic 2 + 5 + 6 fechados

### Added

- **Epic 2** completo (CRUD condomínio, setor, unidade, morador, importação CSV)
- **Epic 5** completo (retirada de pacote: scan QR → confirmação → audit)
- **Epic 6** parcial (lista, busca, detalhe, resolver pendência — 4/5)
- Self-signup desabilitado em main (webhook bloqueia orphan accounts)

---

## [2026-05-06] — Epic 1 fechado

### Added

- Fundação técnica completa (10/10 stories): monorepo, Docker, Prisma, RLS, Clerk, tenant middleware, BullMQ, Pino, storage abstraction, seed
- Multi-tenancy com 3 conexões DB: `app` (SUPERUSER pra migrations), `app_runtime` (RLS), `webhook_worker` (BYPASSRLS pra cross-tenant lookup)

---

## Convenções de versionamento

Pré-MVP — sem semver formal. Releases serão tagueadas após o piloto inicial.
