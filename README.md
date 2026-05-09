# Ponto 24 — Gestão de Pacotes em Condomínios

PWA mobile-first **com identidade Ponto24** (amarelo `#FDC800` + violet `#7C3AED`) para gerenciar a chegada e retirada de encomendas em condomínios, com notificação ao morador via WhatsApp e extração automática de dados de etiqueta por IA (Gemini Flash-Lite default + Claude Haiku 4.5 fallback, ambos com vision).

> **Status (2026-05-09):** Em produção em [https://condominios.oponto24.com.br](https://condominios.oponto24.com.br). **312/312 unit tests passando**. Epics 1-7, 10, parcial 11/12 entregues. Pipeline real: foto → IA → matching apto+bloco+nome → confirmação (porteiro ou admin) → organização → **notificação WhatsApp + QR + lembrete 24h automático** → scan QR → retirada com auditoria completa. Suporta condomínios com **administração dedicada** (rota separada porteiro vs admin) ou só portaria.
>
> **Pendências externas:** aprovação Meta do template `pacote_chegou` + submissão dos templates `palavra_chave_recebida` e `morador_nao_cadastrado`, chip dedicado WhatsApp pra produção real. Detalhes no runbook [`docs/runbooks/setup-meta-whatsapp.md`](docs/runbooks/setup-meta-whatsapp.md).

**Documentação completa:**
- 📋 PRD: [`docs/prd/PRD.md`](docs/prd/PRD.md)
- 🏛️ Arquitetura: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- 🗄️ Schema do banco: [`docs/architecture/database/SCHEMA.md`](docs/architecture/database/SCHEMA.md)
- 🎨 UX Spec: [`docs/ux/UX_SPEC.md`](docs/ux/UX_SPEC.md)
- 🌊 Roadmap de stories: [`docs/stories/ROADMAP.md`](docs/stories/ROADMAP.md)
- 🛠️ Runbooks operacionais: [`docs/runbooks/`](docs/runbooks/)

---

## Pré-requisitos

- **Node.js ≥ 20** (recomendado: Node 22 LTS ou 25.x)
- **npm 10+** (vem com Node)
- **Docker** + **Docker Compose v2** (postgres, redis, app, worker)
- **git** 2.40+
- macOS, Linux ou WSL2

## Primeira instalação

```bash
git clone <repo-url> && cd gestao_Pacotes_Condominios
cp .env.app.example .env.local        # ajuste DATABASE_*, CLERK_*, SUPER_ADMIN_EMAIL
npm install
docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d
npm run prisma:migrate                # aplica schema
npm run db:apply-rls                  # cria roles app_runtime/webhook_worker + policies RLS
npm run prisma:seed                   # super-admin + WhatsApp placeholder
```

App em `http://localhost:3000`. Verificar saúde:

```bash
curl http://localhost:3000/api/health    # agregado db + redis + uptime
```

Para resetar tudo em dev: `npm run db:reset-and-seed` (destrutivo, bloqueado em prod).

Detalhes do seed (variáveis, idempotência, reconciliação Clerk) em [`docs/runbooks/seed.md`](docs/runbooks/seed.md).

## Scripts npm

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento Next.js (porta 3000) |
| `npm run build` | Build de produção otimizado |
| `npm run start` | Roda o build de produção |
| `npm run lint` | ESLint (Next.js + Prettier) |
| `npm run format` | Formata código com Prettier |
| `npm run typecheck` | Verificação TypeScript estrita |
| `npm test` | Vitest run-once |
| `npm run test:watch` | Vitest em watch mode |
| `npm run worker:dev` | Worker BullMQ em modo dev (tsx) |
| `npm run prisma:migrate` | Aplica migrations Prisma |
| `npm run prisma:seed` | Seed inicial idempotente |
| `npm run prisma:studio` | UI do Prisma para inspecionar dados |
| `npm run db:apply-rls` | Aplica roles + policies RLS |
| `npm run db:reset-and-seed` | DEV: drop + migrate + seed + RLS (destrutivo) |

## Stack atual

- **Next.js 15.1** (App Router) + **React 19** + **TypeScript estrito**
- **Tailwind CSS 3.4** + **shadcn/ui**
- **Prisma 6** + **PostgreSQL 16** com **RLS (Row-Level Security)** — 3 roles (`app`, `app_runtime`, `webhook_worker`)
- **Clerk** (auth) + webhook user provisioning
- **BullMQ** + **Redis 7** (jobs assíncronos)
- **Pino** (logger estruturado JSON em prod, pretty em dev)
- **Storage abstraction** local (volume Docker) — trocável por S3/R2 sem refactor
- **IA dual-provider:** **Google Gemini Flash-Lite** (default, ~15× mais barato) + **Anthropic Claude Haiku 4.5** (fallback) — vision + extração estruturada
- **Meta WhatsApp Cloud API** — template messages com header de imagem (QR), webhook HMAC, retry exponencial via BullMQ
- **Vitest** + **Testing Library** (401 testes — unit + integration tenant-scoped + UI components)
- **Docker Compose** dev: postgres + redis + app + worker

## Estrutura

```
src/
├── app/            # Next.js App Router (rotas, layouts, API routes)
├── components/     # Componentes React (ui/ = shadcn base)
├── lib/            # logger, db, redis, storage, queue helpers
├── server/         # tenant context, errors, db-tenant (RLS-aware)
└── middleware.ts   # Clerk auth middleware

workers/            # BullMQ worker (entry point)
prisma/             # schema, migrations, seed
tests/              # Vitest (unit + integration)
infra/
├── docker/         # docker-compose.yml + Dockerfile
└── scripts/        # apply-rls.sh, promote-user.sh
docs/
├── prd/            # PRD do produto
├── architecture/   # ARCHITECTURE, SCHEMA
├── ux/             # UX spec
├── stories/        # Stories AIOX (1.1 .. 8.4)
├── qa/             # QA gates
└── runbooks/       # observability, storage, seed, jobs, uptimerobot
```

## Variáveis de ambiente

Variáveis específicas da aplicação: [`.env.app.example`](.env.app.example) → copiar para `.env.local`.

Categorias:
- `DATABASE_*` (3 conexões: SUPERUSER, app_runtime sujeito a RLS, webhook_worker BYPASSRLS)
- `REDIS_URL`, `CLERK_*`, `STORAGE_*`, `LOG_LEVEL`, `SUPER_ADMIN_EMAIL`
- **IA:** `EXTRACT_LABEL_PROVIDER` (default `gemini`), `EXTRACT_LABEL_FALLBACK` (default `anthropic`), `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`
- **WhatsApp Meta:** `META_APP_ID`, `META_APP_SECRET`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`, `META_ACCESS_TOKEN`, `META_API_VERSION` (`v25.0`), `META_WEBHOOK_VERIFY_TOKEN`, `META_DISABLED` (modo mock pra dev/CI)

## Convenções

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- **Branches:** `feature/{epic}.{story}-slug` (ex: `feature/1.10-seed-inicial`)
- **Stories:** `docs/stories/{epic}.{story}.{slug}.story.md`
- **Push:** delegado ao `@devops` (Gage) — devs fazem `git commit` local apenas
- **Pendências de cliente:** nunca commitar — sempre via story workflow AIOX

## Status

Epics 1-6 concluídos (MVP funcional ponta-a-ponta + Epic 4 WhatsApp). Detalhes vivos em [`docs/stories/ROADMAP.md`](docs/stories/ROADMAP.md). Roadmap pós-MVP capturado no PRD §6.

**Pipeline end-to-end (em produção):**

```
Foto → Worker IA Gemini Flash-Lite (fallback Anthropic) → Matching (CEP + nome + complemento)
  ├─ matched: rascunho → confirmar → organizar → aguardando_retirada
  └─ pending: pendente_identificacao → /portaria/pendentes → resolver → confirmar → organizar
                                                                                  ↓
                              ┌────────────────────────────────────────────────────┘
                              ↓
            Worker sendWhatsApp BullMQ → ensureQrForPacote (QR 1200×628)
                                       → chooseRecipient (nome→principal→adicional)
                                       → Meta Cloud API sendTemplate `pacote_chegou`
                                       → registra WhatsAppMessage (status pending)
                              ↓
            Webhook Meta /api/webhooks/meta-whatsapp
                                       → HMAC válido? → enfileira processWhatsappWebhook
                                       → atualiza status sent/delivered/read/failed
                              ↓
            scan QR pelo porteiro (mostra a imagem do morador) ← /retirada
                ↓
            confirmar destinatário (próprio / terceiro) → status retirado + audit
                ↓
            admin lista + busca + detalhe com timeline + bloco notificações WhatsApp
                + botão Reenviar (rate limit 3/h) em /admin/pacotes/[id]
```

**Custos por condomínio (estimativa):** ~R$ 5-7/mês (IA Gemini ~R$ 0,5 + WhatsApp utility ~R$ 4 + VPS rateada).

Detalhes completos em [`docs/stories/ROADMAP.md`](docs/stories/ROADMAP.md).
Setup Meta WhatsApp passo-a-passo: [`docs/runbooks/setup-meta-whatsapp.md`](docs/runbooks/setup-meta-whatsapp.md).
Decisão IA dual-provider: [`docs/decisions/ai-model-comparison.md`](docs/decisions/ai-model-comparison.md).
