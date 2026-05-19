# Roadmap de Stories — Gestão de Pacotes em Condomínios

> **Owner:** River (AIOX Scrum Master)
> **Última atualização:** 2026-05-19
> **PRD:** `docs/prd/PRD.md` | **Architecture:** `docs/architecture/ARCHITECTURE.md` | **Schema:** `docs/architecture/database/SCHEMA.md` | **UX:** `docs/ux/UX_SPEC.md`

---

## Visão geral

**Total:** 60+ stories distribuídas em 12 épicos.
**Progresso atual (2026-05-19):** **~55 stories Done** · **450+ tests passing** · MVP em produção https://condominios.oponto24.com.br · Epics 1-8, 10-12 completos · Epic 7 parcial (7.1-7.3, 7.5 done) · **Security hardening completo** · **WhatsApp produção ativo** (chip dedicado + template aprovado + envio testado)
**Bloqueios externos restantes:**
- ~~Aprovação Meta do template `pacote_chegou`~~ ✅ Aprovado (2026-05-15)
- ~~Compra de chip dedicado WhatsApp pra produção~~ ✅ Chip +55 11 99440-8930 ativo, WABA `1017715357824074`
- ~~Configurar webhook URL no painel Meta~~ ✅ Webhook ativo e validado
- Rotacionar 6 secrets — deferred para primeiro onboarding
- Migrar Clerk dev → prod (keys de desenvolvimento)
- Backup offsite — hoje só na própria VPS

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
| 1.10 | Seed inicial (super-admin + whatsapp_number placeholder) | **Done** ✅ | 1.3, 1.5, 1.9 |

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
| 3.8 | Tela /chegada/confirmar — formulário IAExtractionForm (FR-014) | **Done** ✅ | 3.6, 3.7 |
| 3.9 | Tela /chegada/organizar — tamanho + setor + posição | **Done** ✅ | 3.8, 2.2 |
| 3.10 | Estado pendente_identificacao + tela /portaria/pendentes | **Done** ✅ | 3.7 |
| 3.11 | Brand Ponto24 — paleta amarela #FDC800 + violet #7C3AED, fundo claro, identidade amigável | **Done** ✅ | 3.10 |
| 3.12 | Deploy MVP Epic 3 na VPS — Docker + Nginx + Let's Encrypt + HTTPS | **Done** ✅ — https://condominios.oponto24.com.br no ar (SSL válido até 2026-08-05) | 3.11 |

---

## Epic 4 — Notificação WhatsApp (P0) ✅ Concluído em 2026-05-08

**Objetivo:** Geração de QR + integração Meta Cloud API + tracking de entrega + reenvio manual.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 4.1 | Cliente Meta Cloud API + helper sendTemplate + MetaApiError tipada + modo mock | **Done** ✅ | 1.6 |
| 4.2 | Gerador QR Code PNG 1200×628 (sharp + qrcode + canvas) + ensureQrForPacote idempotente + migration `qr_image_path` | **Done** ✅ | 1.9 |
| 4.3 | Worker BullMQ sendWhatsApp — orquestra recipient + QR + sendTemplate + WhatsAppMessage + retry exponencial. Trigger no organizar (3.9) | **Done** ✅ | 4.1, 4.2 |
| 4.4 | Webhook `/api/webhooks/meta-whatsapp` — GET verify_token + POST HMAC + processador async com idempotência por meta_message_id | **Done** ✅ | 4.1 |
| 4.5 | chooseRecipient com matching nome (exato → fuzzy ≥0.7 → primeiro+último) → principal → adicional. matched_by registrado em template_params | **Done** ✅ | 3.7, 4.3 |
| 4.6 | Endpoint `POST /api/pacotes/{id}/reenviar-whatsapp` (rate limit 3/h) + retry config validation tests | **Done** ✅ | 4.3 |
| 4.6b | UI bloco "Notificações WhatsApp" no `PacoteDetalheView` — timeline com badges status + botão Reenviar com loading + telefone mascarado + 8 unit tests | **Done** ✅ | 4.6, 6.3 |

**Bundle:** PR #59 (`feature/epic-4-whatsapp`) — 7 stories, 47 unit tests novos, 401/401 suite verde.

**Pendências externas — TODAS RESOLVIDAS (2026-05-15):**
- ✅ Template `pacote_chegou` aprovado pela Meta
- ✅ Webhook configurado e validado em produção
- ✅ Chip dedicado +55 11 99440-8930 (WABA `1017715357824074`) ativo
- ✅ Envio real testado e confirmado (2026-05-15)

**Débitos LOW (registrados nos QA Results das stories):**
- E2E Playwright reenviar fluxo (spec documentado em `docs/qa/e2e-specs/reenviar-whatsapp.md`, falta install Playwright)
- `PacoteEvento.notificacao_fallback` enum sem entrada — `matched_by` registrado em `template_params` da WhatsAppMessage como alternativa

---

## Epic 5 — Retirada do Pacote (P0)

**Objetivo:** Scan QR + confirmação destinatário próprio/terceiro + registro auditado.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 5.1 | Tela /retirada — scanner QR + fallback código manual | **Done** ✅ | 3.1, 3.3 |
| 5.2 | API POST /api/pacotes/retirar/iniciar — valida token, retorna dados | **Done** ✅ | 1.6 |
| 5.3 | Tela /retirada/confirmar/[token] + sheet "próprio destinatário?" (FR-042) | **Done** ✅ | 5.1, 5.2 |
| 5.4 | API PATCH /api/pacotes/{id}/retirar/confirmar — registra evento + invalida QR | **Done** ✅ | 5.3 |

---

## Epic 6 — Painel Administrativo (P0 — mínimo)

**Objetivo:** Lista filtrável, busca, detalhe completo, resolução manual de pendências.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 6.1 | Lista /admin/pacotes — DataTable com filtros (status, unidade, período) | **Done** ✅ | 2.7, 3.4 |
| 6.2 | Busca textual por morador/apto/código (ILIKE) | **Done** ✅ | 6.1 |
| 6.3 | Página /admin/pacotes/[id] — detalhe completo + PacoteTimeline | **Done** ✅ | 6.1 |
| 6.4 | Ação "Resolver pendência" — link pra /chegada/confirmar/[id] (FR-064) | **Done** ✅ | 6.3, 3.10 |
| 6.5 | Ação "Reenviar WhatsApp" + "Cancelar pacote" no detalhe | **Done** ✅ (parcial) — Reenviar coberto pelo bloco UI da 4.6b. Cancelar pacote pendente (decisão de produto: reabrir cancelados? UX?) | 6.3, 4.6 |

---

## Epic 7 — Código ML via WhatsApp (P1)

**Objetivo:** Morador envia código pelo WhatsApp, sistema vincula ao apartamento, exibe na portaria.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 7.1 | Webhook handler para mensagens inbound — lookup global por telefone (role webhook_worker) | **Done** ✅ | 1.4, 4.4 |
| 7.2 | Worker processIncomingMessage — extração código (regex + LLM fallback) | Draft | 7.1 |
| 7.3 | Persistência codigo_ml_pendente + resposta automática template "codigo_ml_recebido" | Draft | 7.2, 4.1 |
| 7.4 | Exibição do código pendente na tela /chegada/organizar (banner amarelo) | Draft | 3.9, 7.3 |
| 7.5 | Cron diário expira códigos com expira_em < now (FR-056) | **Done** ✅ | 7.3 |

---

## Epic 8 — Operação SaaS (P1)

**Objetivo:** Super-admin cria condomínios, impersona, observa.

| # | Story | Status | Dependência |
|---|-------|--------|-------------|
| 8.1 | Layout SuperAdminLayout + lista /super-admin/condominios | **Done** ✅ | 2.1 |
| 8.2 | Ação "Impersonar condomínio" + banner persistente (FR-071) | **Done** ✅ | 8.1, 1.6 |
| 8.3 | Audit log de ações sensíveis (impersonate, criação cond., delete) | **Done** ✅ | 8.2 |
| 8.4 | Setup VPS Hostinger + Caddy + GitHub Actions deploy + backup script (delegado @devops) | **Done** ✅ — coberto pela story 3.12 (Docker + Nginx + Let's Encrypt). CI/CD GitHub Actions e backup automatizado postgres ficam como tech debt da Epic 8.4-extended | 1.2 |
| 8.5 | Tela super-admin cadastrar admin de cond (cadastro direto) | **Done** ✅ | 8.1 |
| 8.6 | Tela admin /admin/equipe — admin cadastra outros admins do mesmo cond | **Done** ✅ | 8.5 |
| 8.7 | Tela admin /admin/funcionarios — admin cadastra porteiros do cond | **Done** ✅ | 8.6 |
| 8.8 | Distinção admin master vs admin comum — **supersedido pela story 10.1** | N/A | — |

> **Epic 9 — Cobrança/Billing**: backlog não-iniciado. Decisões pendentes (gateway, preço, trial). Adiado deliberadamente até MVP estar 100% funcional + primeiros clientes manuais validarem produto.

---

## Epics pós-MVP (capturados em 2026-05-08)

> **Detalhe completo:** PRD §3.8-§3.12 + decisões em `docs/planning/2026-05-08-decisoes.md`.

### Epic 7 — Palavra-chave de entrega via WhatsApp (P1 atual)

**Objetivo:** morador cadastrado envia palavra-chave (ex: ML) via WhatsApp; aparece pra portaria quando entregador pede.

| # | Story | Status |
|---|-------|--------|
| 7.1 | Worker `processIncomingMessage` consome `WhatsAppMessage inbound` (4.4) e extrai palavra-chave via regex+LLM | **Done** ✅ |
| 7.2 | Persiste `palavra_chave_pendente` + auto-reply via template aprovado | **Done** ✅ (implementado junto com 7.1) |
| 7.3 | Tela `/portaria/palavras-chave` com filtros (apto, bloco, morador, data) — aba admin read-only | **Done** ✅ (UI portaria implementada) |
| 7.4 | Banner sugestão durante chegada do pacote ("vincular palavra-chave?") | **Done** ✅ |
| 7.5 | Cron diário expira palavras-chave > 30d | **Done** ✅ |
| 7.6 | Templates Meta `palavra_chave_recebida` + `morador_nao_cadastrado` submetidos | Blocked (externo — aguarda submissão Meta) |

### Epic 10 — Hierarquia operacional (recomendado primeiro pós-MVP)

**Objetivo:** introduzir `admin_master` + `admin_funcionario` + flag `condominio.tem_administracao` que altera fluxo da chegada.

| # | Story | Status |
|---|-------|--------|
| 10.1 | Refactor enum `Role`: `admin` → `admin_master`, novo `admin_funcionario`. Migration de dados + atualização de guards | **Done** ✅ |
| 10.2 | Schema: `condominio.tem_administracao` + status `aguardando_organizacao` + status `em_administracao` | **Done** ✅ |
| 10.3 | Toggle no formulário super-admin de criação/edição de condomínio | **Done** ✅ |
| 10.4 | Fluxo bifurcado na chegada: porteiro confirma → vai pra admin organizar (se com adm) ou organiza direto (sem adm) | **Done** ✅ |
| 10.5 | Tela `/administracao/organizar` (admin escolhe setor/posição → dispara WhatsApp) | **Done** ✅ |
| 10.6 | Botão "Enviar pra administração" no detalhe do pacote (transição pra `em_administracao`) + tela `/administracao/em-transito` | **Done** ✅ |
| 10.7 | Bipe entrega flexível: porteiro pode bipar pacote `em_administracao` com aviso de confirmação | **Done** ✅ |

### Epic 11 — UX admin refinado

**Objetivo:** Torres/Blocos como entidade + busca global + filtros padronizados.

| # | Story | Status |
|---|-------|--------|
| 11.1 | Modelo `Bloco` (entidade) + migration extraindo de `unidade.bloco` string | **Done** ✅ |
| 11.2 | UI `/admin/blocos` hierárquica (lista de blocos → drill down apartamentos → moradores) | **Done** ✅ |
| 11.3 | Renomear menu "Unidades" → "Torres/Blocos" | **Done** ✅ |
| 11.4 | Componente `<GlobalSearch />` com `⌘K`/`Ctrl+K` no header admin | **Done** ✅ |
| 11.5 | Filtros padronizados em todas as listas admin | **Done** ✅ |

### Epic 12 — Operação SaaS madura (renomeado de "9")

**Objetivo:** Dashboard cross-tenant + governança completa de condomínios + audit log abrangente.

| # | Story | Status |
|---|-------|--------|
| 12.1 | Dashboard `/super-admin` com KPIs (condomínios ativos, admins ativos, pacotes pendentes 24h, usuários por role) | **Done** ✅ |
| 12.2 | Desativar/reativar condomínio (super-admin) + bloqueio de login dos users vinculados | **Done** ✅ |
| 12.3 | CRUD usuários (super-admin) — listar cross-tenant, criar admin_master de qualquer cond, editar role, soft delete | **Done** ✅ |
| 12.4 | Audit log abrangente — helpers auditCreate/Update/Delete com before/after diff | **Done** ✅ |
| 12.5 | UI `/super-admin/audit` com filtros (ator, ação, recurso, período, condomínio) | **Done** ✅ |
| 12.6 | UI `/admin/audit` (admin_master vê só do próprio condomínio) | **Done** ✅ |

### Security Hardening (2026-05-19) ✅ Completo

Audit de segurança completo com remediação de todos os itens CRITICAL, HIGH e MEDIUM.

| Item | Severidade | Status |
|------|-----------|--------|
| Redis auth + non-root worker + Docker network isolation | CRITICAL/HIGH | **Done** ✅ |
| CSP + HSTS + X-Frame-Options + Permissions-Policy headers | HIGH | **Done** ✅ |
| GitHub Actions permissions mínimas | HIGH | **Done** ✅ |
| CASCADE→RESTRICT em 9 FKs | HIGH | **Done** ✅ |
| X-Powered-By removido | HIGH | **Done** ✅ |
| AI provider timeouts 30s | HIGH | **Done** ✅ |
| SQL injection fix em promote-user.sh | HIGH | **Done** ✅ |
| BullMQ job validation com Zod | HIGH | **Done** ✅ |
| CSRF Origin validation middleware | MEDIUM | **Done** ✅ |
| UUID param validation (16 rotas) | MEDIUM | **Done** ✅ |
| Impersonate rate limit 20/hr | MEDIUM | **Done** ✅ |
| Audit log RLS policies | MEDIUM | **Done** ✅ |
| parseIdParam compartilhado | MEDIUM | **Done** ✅ |

**Commits:** `96dc97e`, `25a8d70`, `17bf6ee`, `f353f99`, `a6434d7`
**Detalhes:** `memory/security-audit-2026-05-19.md`

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

## Próximas ações (2026-05-19)

### Concluído desde 2026-05-15
- ✅ Epic 8 completo (8.1-8.7): super-admin layout, impersonar, audit base, equipe, funcionários
- ✅ Epic 10 completo (10.1-10.7): admin_master/admin_funcionario, rota administração
- ✅ Epic 11 completo (11.1-11.5): blocos, UI hierárquica, busca Cmd+K, filtros
- ✅ Epic 12 completo (12.1-12.6): dashboard KPIs, desativar condomínio, CRUD users, audit log abrangente, UI audit
- ✅ Epic 7 quase completo (7.1-7.3, 7.5 Done): webhook inbound, persistência+reply, UI portaria, cron expiração
- ✅ **Security hardening completo** — audit CRITICAL/HIGH/MEDIUM zerado (5 commits, 13 items)
- ✅ Documentação sync: stories, SCHEMA.md, PRD.md, ROADMAP.md, ARCHITECTURE.md, CHANGELOG.md atualizados

### Ações pendentes (prioridade)
1. **Rotacionar 6 secrets** — deferred para primeiro onboarding de cliente
2. **Migrar Clerk dev → prod** — keys de desenvolvimento, limite MAU, branding
3. **Backup offsite** — hoje backup só na própria VPS
4. **Naming do produto** — brainstorm em `docs/planning/naming-brainstorm-2026-05-15.md`, pendente decisão com sócios

### Próximas frentes de dev

- **Epic 7** (7.4, 7.6): banner durante chegada, templates Meta (bloqueio externo)
- **API integration tests** — auth guards, tenant isolation, audit assertions (pendente)

### Backlog UX (descoberto durante smoke 2.6 — 2026-05-07)

- **2.X — Search/filtros em /admin/moradores:** API já aceita `?q=<termo>` (busca em nome OR telefone), `?unidade_id=<uuid>` (filtro por unidade). UI atualmente só tem toggle de arquivados. Adicionar: input de busca textual, dropdown de filtro por unidade (+bloco). Reusa pattern dos toggles existentes. Sugestão @user durante smoke. Estimativa: 0.25 dia.

### Débitos técnicos rastreados

- **Cancelar pacote** (parte da 6.5) — decisão de produto + UX
- **E2E Playwright** (4.6b) — install + transcrever spec de `docs/qa/e2e-specs/reenviar-whatsapp.md`
- **PacoteEvento enum** — adicionar `notificacao_fallback` se admin precisar de log dedicado (atualmente em `template_params.matched_by`)
- **CI/CD GitHub Actions + backup automático Postgres** (Epic 8.4-extended)
