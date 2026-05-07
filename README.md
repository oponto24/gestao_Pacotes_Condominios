# Ponto 24 — Gestão de Pacotes em Condomínios

PWA mobile-first **com identidade Ponto24** (amarelo `#FDC800` + violet `#7C3AED`) para gerenciar a chegada e retirada de encomendas em condomínios, com notificação ao morador via WhatsApp e extração automática de dados de etiqueta por IA (Claude Haiku 4.5 com vision).

> **Status:** MVP funcional ponta-a-ponta localmente. 335/335 tests passing. Pipeline real validado: foto → IA Anthropic → matching CEP+nome+complemento → confirmação → organização → notificação (Epic 4 pendente) → scan QR → retirada com auditoria completa. Falta apenas deploy VPS (DNS pendente) e integração WhatsApp Business.

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
- **Anthropic Claude Haiku 4.5** (vision + prompt caching) — extração estruturada de etiqueta
- **Vitest** + **Testing Library** (335+ testes — unit + integration tenant-scoped)
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

Categorias: `DATABASE_*`, `REDIS_URL`, `CLERK_*`, `ANTHROPIC_*`, `META_*`, `STORAGE_*`, `LOG_LEVEL`, `SUPER_ADMIN_EMAIL`.

## Convenções

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- **Branches:** `feature/{epic}.{story}-slug` (ex: `feature/1.10-seed-inicial`)
- **Stories:** `docs/stories/{epic}.{story}.{slug}.story.md`
- **Push:** delegado ao `@devops` (Gage) — devs fazem `git commit` local apenas
- **Pendências de cliente:** nunca commitar — sempre via story workflow AIOX

## Status do roadmap

| Epic | Status |
|---|---|
| **Epic 1 — Fundação Técnica** | ✅ Concluído (2026-05-06) — 10/10 stories |
| **Epic 2 — Cadastros** (CRUDs + CSV) | ✅ Concluído (2026-05-07) — 7/7 stories |
| **Epic 3 — Chegada do Pacote** (PWA + IA + matching) | ✅ Funcional (11/12) — falta 3.12 deploy VPS (aguardando DNS) |
| Epic 4 — Notificação WhatsApp (Meta Cloud API) | ⏳ Pendente — aguardando criação Meta Business Manager |
| **Epic 5 — Retirada do Pacote** | ✅ Concluído (2026-05-07) — 4/4 stories |
| **Epic 6 — Painel Administrativo** | ✅ 4/5 (lista, busca, detalhe, resolver pendência); 6.5 depende Epic 4 |
| Epic 7 — Código ML via WhatsApp | ⏳ P1 — futuro |
| Epic 8 — Operação SaaS (deploy VPS) | ⏳ P1 — VPS provisionada (`2.24.82.192`), aguarda DNS apontar `condominios.oponto24.com.br` |

**Pipeline end-to-end (local):**

```
Foto → Worker IA Haiku 4.5 → Matching auto (CEP + nome + complemento)
  ├─ matched: rascunho → confirmar → organizar → aguardando_retirada
  └─ pending: pendente_identificacao → /portaria/pendentes → resolver → confirmar → organizar
                                                                                  ↓
            scan QR (ou digita) ← /retirada ← aguardando_retirada
                ↓
            confirmar destinatário (próprio / terceiro) → status retirado + audit
                ↓
            admin lista + busca + detalhe com timeline em /admin/pacotes
```

**Custo de IA por foto:** ~R$ 0,013 (4× abaixo do NFR-041 < R$ 0,05).

Detalhes completos em [`docs/stories/ROADMAP.md`](docs/stories/ROADMAP.md).
Para retomar deploy VPS: [`docs/stories/3.12-PENDENCIAS.md`](docs/stories/3.12-PENDENCIAS.md).
