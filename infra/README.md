# Infra — Runbook operacional

Este diretório contém toda a infraestrutura de execução do sistema:
ambiente de desenvolvimento local (Docker Compose) e, futuramente, a
configuração de produção da VPS Hostinger (story 8.4).

## Pré-requisitos

Você precisa de **um** runtime Docker instalado no host:

| Opção | Recomendado para | Como instalar |
|-------|------------------|---------------|
| **OrbStack** | macOS (escolha desta equipe) | https://orbstack.dev |
| **Docker Desktop** | macOS / Windows | https://www.docker.com/products/docker-desktop |
| **Colima** | macOS via brew, sem GUI | `brew install colima docker docker-compose && colima start` |
| **Docker Engine** | Linux | https://docs.docker.com/engine/install |

Confirmar instalação:

```bash
docker --version           # ≥ 24.x
docker compose version     # ≥ v2 (note o espaço, não é docker-compose)
```

## Estrutura

```
infra/
├── README.md                       # este arquivo
└── docker/
    ├── Dockerfile                  # multi-stage: dev / builder / production
    └── docker-compose.yml          # stack de desenvolvimento local
```

## Configurando o `.env.local` (uma vez)

Antes de subir o stack, copie o template e preencha:

```bash
cp .env.app.example .env.local
```

Os valores **mínimos** pra subir o stack agora (story 1.2):

```bash
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://app:dev_secret@postgres:5432/gestao_pacotes
DATABASE_WEBHOOK_URL=postgresql://webhook_worker:dev_secret@postgres:5432/gestao_pacotes
REDIS_URL=redis://redis:6379
LOG_LEVEL=info
```

Demais variáveis (Clerk, Anthropic, Meta) podem ficar vazias — não são
exercitadas até as stories 1.5, 3.5 e 4.1 respectivamente.

> **Importante:** `.env.local` está gitignored. Nunca commit.

## Comandos do dia a dia

Todos os comandos abaixo rodam **da raiz do projeto** (não de `infra/`).

### Subir o stack
```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d --build
```

Primeira execução leva 60-180s (build da imagem + pull de postgres/redis).
Execuções subsequentes são quase instantâneas.

### Ver o status
```bash
docker compose -f infra/docker/docker-compose.yml ps
```

Saída esperada (4 services com status `running` e healthcheck `healthy`):

```
NAME                            IMAGE                  STATUS
gestao-pacotes-dev-app-1        gestao-pacotes:dev     Up (running)
gestao-pacotes-dev-postgres-1   postgres:16-alpine     Up (healthy)
gestao-pacotes-dev-redis-1      redis:7.4-alpine       Up (healthy)
gestao-pacotes-dev-worker-1     gestao-pacotes:dev     Up (running)
```

### Acompanhar logs

```bash
# todos os serviços, follow
docker compose -f infra/docker/docker-compose.yml logs -f

# só um serviço
docker compose -f infra/docker/docker-compose.yml logs -f app
docker compose -f infra/docker/docker-compose.yml logs -f worker
```

### Acessar o Postgres

```bash
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U app -d gestao_pacotes
```

### Acessar o Redis

```bash
docker compose -f infra/docker/docker-compose.yml exec redis redis-cli
```

### Derrubar o stack

```bash
# para os containers, mantém volumes (dados preservados)
docker compose -f infra/docker/docker-compose.yml down

# para tudo E apaga volumes (reset completo do banco)
docker compose -f infra/docker/docker-compose.yml down -v
```

### Rebuild forçado (após mudar Dockerfile ou package.json)

```bash
docker compose -f infra/docker/docker-compose.yml build --no-cache
```

## Atalho recomendado (opcional)

Para encurtar comandos, adicione no seu `~/.zshrc`:

```bash
alias dc='docker compose -f infra/docker/docker-compose.yml --env-file .env.local'
```

Aí você usa: `dc up -d`, `dc logs -f app`, `dc down` etc.

## Troubleshooting

### "Port 5432/6379/3000 já está em uso"

Você tem um Postgres/Redis local rodando no host. Duas opções:

1. **Parar o serviço local** — `brew services stop postgresql` (ou similar)
2. **Mudar o port mapping** no `docker-compose.yml` (ex: `'5433:5432'`).
   Não recomendado — quebra a paridade com produção.

### "Volume node_modules está corrompido / dependência não encontrada"

Quando você instala uma nova dependência via `npm install` no host, o
`node_modules` do volume nomeado fica desatualizado. Solução:

```bash
docker compose -f infra/docker/docker-compose.yml down -v
docker compose -f infra/docker/docker-compose.yml up -d --build
```

(O `down -v` apaga também `pgdata`/`redisdata` — tudo volta do zero.)

### Build muito lento no macOS

Se estiver usando Docker Desktop, considere migrar para **OrbStack** —
file sharing 2-5x mais rápido. Bind mounts do projeto inteiro (~1.2GB
incluindo `.aiox-core/`) ficam dolorosos no Docker Desktop padrão.

### Container "exited (137)" no logs

OOM kill — o container excedeu o limite de RAM. No OrbStack: ajustar
em Settings → Resources → Memory. Padrão de 4GB deveria sobrar.

### Logs não aparecem em tempo real

Adicionar `-f` ao comando: `docker compose ... logs -f`. Sem `-f`,
mostra apenas o que já foi gerado.

## Comandos Prisma

Todos rodam **da raiz do projeto, no host** (não dentro do container). O Prisma CLI conecta no Postgres via `localhost:5432` (porta exposta pelo Docker) — por isso o `.env.local` define `DATABASE_URL=postgresql://app:dev_secret@localhost:5432/...`. Dentro do container, o `docker-compose.yml` sobrescreve com `postgres:5432` via `environment:`.

| Comando | O que faz |
|---------|-----------|
| `npm run prisma:generate` | Gera `node_modules/@prisma/client` baseado no schema (rodado automaticamente após `npm install` via postinstall) |
| `npm run prisma:migrate` | Cria nova migration a partir de mudanças no schema e aplica (`prisma migrate dev`) |
| `npm run prisma:migrate:deploy` | Aplica migrations existentes sem gerar novas (usado em produção) |
| `npm run prisma:studio` | Abre GUI web do Prisma em `localhost:5555` para inspeção do banco |
| `npm run prisma:seed` | Roda `prisma/seed.ts` (idempotente — pode rodar várias vezes) |
| `npm run prisma:reset` | **DESTRUTIVO**: dropa tudo, recria do zero, aplica migrations + seed (só em dev!) |

**Recovery rápido** se o banco entrar em estado inconsistente:

```bash
npm run prisma:reset
```

## Aplicar RLS policies (Story 1.4)

Após `prisma:migrate`, aplicar a camada de defesa em profundidade (RLS):

```bash
# 1. Gerar senhas (uma vez, nunca commitar)
openssl rand -hex 32  # use como APP_RUNTIME_DB_PASSWORD em .env.local
openssl rand -hex 32  # use como WEBHOOK_WORKER_DB_PASSWORD em .env.local

# 2. Aplicar (idempotente — safe pra rerun)
npm run db:apply-rls
```

O script:
- Aplica `prisma/migrations/20260506200212_initial_schema/rls_policies.sql`
- Cria roles `app_runtime` (NOSUPERUSER, sujeito a RLS) e `webhook_worker` (BYPASSRLS, grants mínimos)
- Define senhas via `ALTER ROLE` (nunca em arquivo committed)
- Valida com 2 contadores (8 tabelas RLS, 2 roles ativas)

**Após `apply-rls`, recreie containers** pra que o app pegue `DATABASE_RUNTIME_URL`:
```bash
docker compose -f infra/docker/docker-compose.yml stop app worker
docker compose -f infra/docker/docker-compose.yml rm -f app worker
docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d app worker
```

**Testes RLS:** rodam automaticamente em `npm run test` (pulam se DB não acessível).

## Promover usuário a admin de condomínio (DEV)

**Story 1.6** introduziu `infra/scripts/promote-user.sh` para acelerar testes manuais do middleware tenant em DEV. **Não usar em produção** — em prod, admin associa user via UI (story futura).

```bash
# Pré-requisitos: stack rodando + user já cadastrou via Clerk
bash infra/scripts/promote-user.sh oponto24@gmail.com
```

O script é idempotente:
- Cria condomínio fixture "Edifício Teste 1.6" se não existir
- Atualiza `user.condominio_id` e `user.role = 'admin'`
- Mostra a linha resultante para validação

Após rodar, `curl http://localhost:3000/api/me` (com cookie Clerk válido) retorna `{ kind: 'tenant', condominioId, role: 'admin' }`.

## Monitoramento externo (Story 1.7)

App expõe endpoints health pra monitor externo:

| Endpoint | Cobertura | Status code |
|----------|-----------|-------------|
| `GET /api/health` | Agregado: db + redis + uptime + version | 200 ok / 503 degraded ou down |
| `GET /api/health/db` | Postgres (legado da story 1.3) | 200 / 503 |
| `GET /api/health/redis` | Redis (ping + set/get round-trip) | 200 / 503 |

**Healthcheck Docker** ativo em `app` e `worker` services do compose — `docker compose ps` mostra `(healthy)` quando ok.

**UptimeRobot** (monitor externo gratuito) — setup em `docs/runbooks/uptimerobot-setup.md`. Recomendado: 2 monitors (`/api/health` + `/`) com alerta por e-mail/Telegram em <5 min.

## Jobs assíncronos / BullMQ (Story 1.8)

Worker BullMQ real consome jobs da fila `default` em Redis. Cada job tem
um processor registrado em `src/lib/queue/jobs/index.ts`.

**Adicionar novo job, debugar, ou entender pattern de tenant context →** consulte `docs/runbooks/jobs.md`.

**Endpoint admin smoke:** `POST /api/admin/queue/enqueue-ping` (super_admin only) enfileira ping pra validar round-trip.

## Logger estruturado e Storage (Story 1.9)

- **Logger Pino:** `src/lib/logger.ts` — singleton + helpers `loggerForRequest`, `loggerForJob`, `loggerForTenant`. Detalhes em `docs/runbooks/observability.md`.
- **Storage abstraction:** `src/lib/storage/` — `LocalStorageDriver` hoje (volume nomeado `storage` em compose), trocável por S3/R2 sem refactor de callers. Detalhes em `docs/runbooks/storage.md`.
- **Endpoint admin smoke storage:** `POST /api/admin/storage/test` (super_admin only) executa put → get → delete e retorna metadata.

## Cadastros admin (Stories 2.2-2.4)

CRUDs tenant-scoped administráveis pelo síndico/admin: Setor (✅ 2.2),
Unidade (futuro 2.3), Morador (futuro 2.4). Detalhes em
[`docs/runbooks/admin-cadastros.md`](../docs/runbooks/admin-cadastros.md).

## Admin (Story 2.7)

Layout `/admin/*` com sidebar lateral + header sticky + drawer mobile. Rotas
stub para Pacotes/Setores/Unidades/Moradores aguardam implementação nas
stories 2.2-2.4 e 6.1. Detalhes (estrutura, permissões, como adicionar
páginas/items): [`docs/runbooks/admin-layout.md`](../docs/runbooks/admin-layout.md).

## Super-admin (Story 2.1)

UI de gestão de condomínios em `/super-admin/condominios` (apenas role
`super_admin`). Detalhes (API REST, validação Zod, soft delete, permissões):
[`docs/runbooks/super-admin.md`](../docs/runbooks/super-admin.md).

## Seed inicial (Story 1.10)

Cria super-admin + WhatsApp number placeholder. Idempotente, com reconciliação Clerk por email.

```bash
npm run prisma:seed          # primeira instalação (dev/staging/prod)
npm run db:reset-and-seed    # DEV ONLY — drop + migrate + seed + RLS (destrutivo)
```

Detalhes (variáveis, reconciliação Clerk, recuperação): `docs/runbooks/seed.md`.

## Próximas mudanças (stories futuras)

| Story | Mudança nesta infra |
|-------|---------------------|
| 1.3 | Postgres recebe migrations Prisma + RLS policies |
| 1.4 | Role `webhook_worker` BYPASSRLS criada via SQL |
| 1.8 | Worker deixa de ser placeholder (BullMQ + jobs reais) |
| 1.9 | Volume `storage` bind para fotos das etiquetas |
| 8.4 | `docker-compose.prod.yml` separado + Caddy + secrets |
