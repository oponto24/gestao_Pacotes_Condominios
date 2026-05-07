# Sistema de Gestão de Pacotes em Condomínios

PWA mobile-first para gerenciar a chegada e retirada de encomendas em condomínios, com notificação ao morador via WhatsApp e extração automática de dados de etiqueta por IA (Claude Haiku 4.5 com vision).

**Documentação completa:**
- 📋 PRD: [`docs/prd/PRD.md`](docs/prd/PRD.md)
- 🏛️ Arquitetura: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- 🗄️ Schema do banco: [`docs/architecture/database/SCHEMA.md`](docs/architecture/database/SCHEMA.md)
- 🎨 UX Spec: [`docs/ux/UX_SPEC.md`](docs/ux/UX_SPEC.md)
- 🌊 Roadmap de stories: [`docs/stories/ROADMAP.md`](docs/stories/ROADMAP.md)

---

## Primeira instalação

```bash
git clone <repo-url> && cd gestao_Pacotes_Condominios
cp .env.app.example .env.local        # ajuste DATABASE_*, CLERK_*, SUPER_ADMIN_EMAIL
npm install
docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d
npm run prisma:migrate                # aplica schema
npm run db:apply-rls                  # cria roles + policies RLS
npm run prisma:seed                   # super-admin + WhatsApp placeholder
```

App em `http://localhost:3000`. Detalhes do seed (variáveis, idempotência, reconciliação Clerk) em [`docs/runbooks/seed.md`](docs/runbooks/seed.md).

Para resetar tudo em dev: `npm run db:reset-and-seed` (destrutivo, bloqueado em prod).

---

## Pré-requisitos

- **Node.js ≥ 20** (recomendado: Node 22 LTS ou 25.x)
- **npm 10+** (vem com Node)
- **git** 2.40+
- macOS, Linux ou WSL2

> **Próximas stories** trarão dependências adicionais: Docker (1.2), Postgres + Prisma (1.3), Redis (1.8), Clerk (1.5).

## Setup

```bash
# Clone (se ainda não clonou)
git clone <repo-url>
cd gestao_Pacotes_Condominios

# Instalar dependências
npm install

# Configurar variáveis (uma vez)
cp .env.app.example .env.local

# Subir stack Docker (postgres + redis + app + worker)
docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d

# Aplicar migrations + seed inicial
npm run prisma:migrate    # cria/aplica migrations
npm run prisma:seed       # popula super-admin + placeholder WhatsApp
```

O app sobe em `http://localhost:3000`. Verificar saúde com `curl http://localhost:3000/api/health/db` (deve retornar `{"ok":true,"db":"up"}`).

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Sobe servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção otimizado |
| `npm run start` | Roda o build de produção |
| `npm run lint` | ESLint (Next.js + Prettier) |
| `npm run format` | Formata código com Prettier |
| `npm run typecheck` | Verificação TypeScript estrita (sem emitir JS) |
| `npm test` | Vitest run-once |
| `npm run test:watch` | Vitest em watch mode |

## Stack (atual no MVP)

- **Next.js 15.1** (App Router) + **React 19** + **TypeScript estrito**
- **Tailwind CSS 3.4** + **shadcn/ui** (componentes acessíveis)
- **Vitest** + **Testing Library** (testes unitários)
- **Prisma** + **PostgreSQL** (próximas stories)

## Estrutura

```
src/
├── app/            # Next.js App Router (rotas, layouts)
├── components/     # Componentes React
│   └── ui/         # Atomic design (shadcn base)
└── lib/            # Helpers e utilitários (ex: cn())

tests/              # Testes (Vitest)
docs/               # Toda documentação do projeto
prisma/             # Schema, migrations, seed (story 1.3+)
modelos_de_etiquetas/  # Etiquetas reais para benchmark IA
```

## Variáveis de ambiente

Variáveis específicas da aplicação estão em [`.env.app.example`](.env.app.example).
Variáveis do framework AIOX estão em [`.env.example`](.env.example).

Para começar:
```bash
cp .env.app.example .env.local
# preencha os valores conforme as stories progridem
```

## Convenções

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- **Branches:** `feature/{epic}.{story}-slug` (ex: `feature/1.1-init-monorepo`)
- **Stories:** `docs/stories/{epic}.{story}.{slug}.story.md`
- **Push:** delegado ao `@devops` (Gage) — devs fazem `git commit` local apenas

## Status atual

✅ **Story 1.1 — Init monorepo concluída** (2026-05-06)

Próximo: Story 1.2 — Docker Compose dev.
