# Roadmap de Stories — Gestão de Pacotes em Condomínios

> **Owner:** River (AIOX Scrum Master)
> **Última atualização:** 2026-05-07
> **PRD:** `docs/prd/PRD.md` | **Architecture:** `docs/architecture/ARCHITECTURE.md` | **Schema:** `docs/architecture/database/SCHEMA.md` | **UX:** `docs/ux/UX_SPEC.md`

---

## Visão geral

**Total estimado:** 50 stories distribuídas em 8 épicos.
**Esforço total:** 8-12 semanas (1 dev sênior em tempo integral) ou 5-7 semanas (2 devs).

**Convenção de numeração:** `{epic}.{story}` — ex: `1.1`, `3.4`.
**Convenção de branch:** `feature/{epic}.{story}-slug` — ex: `feature/1.1-init-monorepo`.
**Status possíveis:** `Draft` → `Ready` (validada por @po) → `InProgress` → `InReview` → `Done`.

---

## Epic 1 — Fundação Técnica (P0) ✅ Concluído em 2026-05-06

**Objetivo:** Repositório, banco, auth, multi-tenancy e deploy mínimo funcionando antes de qualquer feature de negócio.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 1.1 | Inicializar monorepo Next.js + git + lint/typecheck/test | **Done** ✅ | — |
| 1.2 | Setup Docker Compose dev (postgres + redis + app + worker) | **Done** ✅ | 1.1 |
| 1.3 | Prisma schema + primeira migration aplicada localmente | **Done** ✅ | 1.2 |
| 1.4 | RLS policies aplicadas + role webhook_worker criada | **Done** ✅ | 1.3 |
| 1.5 | Integração Clerk (sign-in/sign-up + webhook user provisioning) | **Done** ✅ | 1.3, 1.4 |
| 1.6 | Middleware de tenant + helper getTenantContext + SET LOCAL no Postgres | **Done** ✅ | 1.4, 1.5 |
| 1.7 | Endpoint /api/health + UptimeRobot configurado | **Done** ✅ | 1.2, 1.3 |
| 1.8 | BullMQ + Redis connection + job de teste | **Done** ✅ | 1.6, 1.7 |
| 1.9 | Logger Pino estruturado + storage abstraction (local) | **Done** ✅ | 1.6, 1.8 |
| 1.10 | Seed inicial (super-admin + whatsapp_number placeholder) | **Ready for Review** 🔍 | 1.3, 1.5, 1.9 |

---

## Epic 2 — Cadastros (P0) ✅ Concluído em 2026-05-07

**Objetivo:** CRUD completo de condomínios, setores, unidades, moradores. Importação CSV.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 2.1 | CRUD Condominio (super-admin only) | **Done** ✅ | 1.6, 1.10 |
| 2.2 | CRUD Setor por condomínio (admin) | **Done** ✅ | 1.6, 2.1, 2.7 |
| 2.3 | CRUD Unidade por condomínio (admin) | **Done** ✅ | 2.2 |
| 2.4 | CRUD Morador (principal + adicionais) por unidade (admin) | **Done** ✅ | 2.3 |
| 2.5 | Importação CSV — upload + parser + validação | **Done** ✅ | 2.4 |
| 2.6 | Importação CSV — preview com erros + commit transacional | **Done** ✅ | 2.5 |
| 2.7 | Layout AdminLayout + navegação cadastros | **Done** ✅ | 1.5, 1.6, 2.1 |

**Merge cumulativo:**
- 2.1, 2.2, 2.3, 2.7 → **PR #13** (merged 2026-05-06)
- 2.4, 2.5, 2.6 → **PR #14** (merged 2026-05-07) — fecha o Epic

---

## Epic 3 — Chegada do Pacote (P0)

**Objetivo:** Bipe + foto + IA Anthropic + casamento automático + classificação + setor.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 3.1 | PWA: layout PortariaLayout + BottomNavBar + manifest.json | **Done** ✅ | 1.5 |
| 3.2 | Componente PhotoCapture (câmera + preview + retake) | **Done** ✅ | 3.1 |
| 3.3 | Componente BarcodeScannerInput (html5-qrcode + fallback) | **Done** ✅ | 3.1 |
| 3.4 | API POST /api/pacotes (cria rascunho + salva foto + enfileira IA job) | **Done** ✅ | 1.6, 1.8, 1.9 |
| 3.5 | Worker extractLabel — Anthropic Haiku + prompt caching + JSON estruturado | **Done** ✅ | 3.4 |
| 3.6 | Tela /chegada (captura) integrada com 3.4 | **Done** ✅ | 3.2, 3.3, 3.4 |
| 3.7 | Algoritmo de matching IA-extraído ↔ unidade/morador (CEP + nome normalizado) | **Done** ✅ | 3.5, 2.4 |
| 3.8 | Tela /chegada/confirmar — formulário IAExtractionForm (FR-014) | **Ready for Review** 🔵 | 3.6, 3.7 |
| 3.9 | Tela /chegada/organizar — tamanho + setor + posição | Draft | 3.8, 2.2 |
| 3.10 | Estado pendente_identificacao + tela /portaria/pendentes | Draft | 3.7 |

---

## Epic 4 — Notificação WhatsApp (P0)

**Objetivo:** Geração de QR + integração Meta Cloud API + tracking de entrega.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 4.1 | Cliente Meta Cloud API + função sendTemplate | Draft | 1.6 |
| 4.2 | Geração de QR Code PNG (lib qrcode) + storage temporário | Draft | 1.9 |
| 4.3 | Worker sendWhatsApp — fluxo completo (carrega pacote, gera QR, envia, salva message) | Draft | 4.1, 4.2 |
| 4.4 | Webhook /api/webhooks/meta-whatsapp — verificação HMAC + handler de status updates | Draft | 4.1 |
| 4.5 | Lógica de fallback destinatário cadastrado → condômino principal (FR-031/032) | Draft | 3.7, 4.3 |
| 4.6 | Retry automático BullMQ (3 tentativas backoff exponencial) + tela "reenviar" no admin | Draft | 4.3 |

---

## Epic 5 — Retirada do Pacote (P0)

**Objetivo:** Scan QR + confirmação destinatário próprio/terceiro + registro auditado.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 5.1 | Tela /retirada — scanner QR + fallback código manual | Draft | 3.1, 3.3 |
| 5.2 | API POST /api/pacotes/{id}/retirar/iniciar — valida token, retorna dados | Draft | 1.6 |
| 5.3 | Sheet de confirmação "destinatário próprio?" (FR-042) | Draft | 5.1, 5.2 |
| 5.4 | API POST /api/pacotes/{id}/retirar/confirmar — registra evento + invalida QR | Draft | 5.3 |

---

## Epic 6 — Painel Administrativo (P0 — mínimo)

**Objetivo:** Lista filtrável, busca, detalhe completo, resolução manual de pendências.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 6.1 | Lista /admin/pacotes — DataTable com filtros (status, unidade, período) | Draft | 2.7, 3.4 |
| 6.2 | Busca textual por morador/apto/código (ILIKE em nome_normalizado) | Draft | 6.1 |
| 6.3 | Página /admin/pacotes/[id] — detalhe completo + PacoteTimeline | Draft | 6.1 |
| 6.4 | Ação "Resolver pendência" — modal escolher unidade/morador (FR-064) | Draft | 6.3, 3.10 |
| 6.5 | Ação "Reenviar WhatsApp" + "Cancelar pacote" no detalhe | Draft | 6.3, 4.6 |

---

## Epic 7 — Código ML via WhatsApp (P1)

**Objetivo:** Morador envia código pelo WhatsApp, sistema vincula ao apartamento, exibe na portaria.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 7.1 | Webhook handler para mensagens inbound — lookup global por telefone (role webhook_worker) | Draft | 1.4, 4.4 |
| 7.2 | Worker processIncomingMessage — extração código (regex + LLM fallback) | Draft | 7.1 |
| 7.3 | Persistência codigo_ml_pendente + resposta automática template "codigo_ml_recebido" | Draft | 7.2, 4.1 |
| 7.4 | Exibição do código pendente na tela /chegada/organizar (banner amarelo) | Draft | 3.9, 7.3 |
| 7.5 | Cron diário expira códigos com expira_em < now (FR-056) | Draft | 7.3 |

---

## Epic 8 — Operação SaaS (P1)

**Objetivo:** Super-admin cria condomínios, impersona, observa.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 8.1 | Layout SuperAdminLayout + lista /super-admin/condominios | Draft | 2.1 |
| 8.2 | Ação "Impersonar condomínio" + banner persistente (FR-071) | Draft | 8.1, 1.6 |
| 8.3 | Audit log de ações sensíveis (impersonate, criação cond., delete) | Draft | 8.2 |
| 8.4 | Setup VPS Hostinger + Caddy + GitHub Actions deploy + backup script (delegado @devops) | Draft | 1.2 |

---

## Sequência sugerida de execução

**Onda 1 (semanas 1-2):** Epic 1 completo (fundação).
**Onda 2 (semanas 3-4):** Epic 2 (cadastros) + Epic 3.1-3.4 (estrutura PWA + API base de pacotes).
**Onda 3 (semana 5):** Epic 3.5-3.10 (IA + telas chegada) + Epic 8.4 (deploy).
**Onda 4 (semana 6):** Epic 4 completo (WhatsApp).
**Onda 5 (semana 7):** Epic 5 + Epic 6 (retirada + admin).
**Onda 6 (semana 8):** Epic 7 (código ML) + Epic 8.1-8.3 (super-admin) + smoke test piloto.

**Buffer de 2-4 semanas** para correções, ajustes de UX após testes reais e burocracia Meta Business Manager.

---

## Próximas ações

1. **@po (Pax):** validar story 1.1 (10-point checklist) — quando criada.
2. **@dev (Dex):** começar implementação da story 1.1 após validação.
3. **Eu (River):** criar próxima story conforme stories anteriores fecham (modelo "create-next-story").

### Backlog UX (descoberto durante smoke 2.6 — 2026-05-07)

- **2.X — Search/filtros em /admin/moradores:** API já aceita `?q=<termo>` (busca em nome OR telefone), `?unidade_id=<uuid>` (filtro por unidade). UI atualmente só tem toggle de arquivados. Adicionar: input de busca textual, dropdown de filtro por unidade (+bloco). Reusa pattern dos toggles existentes. Sugestão @user durante smoke. Estimativa: 0.25 dia.
