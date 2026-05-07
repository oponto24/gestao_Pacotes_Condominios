# Runbook — Observabilidade (Logger Pino)

> **Story:** 1.9 | **Owner:** Dev (Dex) | **Última atualização:** 2026-05-06

## Contexto

Toda aplicação (app + workers + scripts) usa **Pino** como logger raiz. Em
desenvolvimento, saída é colorizada via `pino-pretty`; em produção, JSON
estruturado para ingestão por agregador (Loki, Datadog, etc).

## Como usar

```ts
// Logger raiz (sem contexto)
import { logger } from '@/lib/logger';
logger.info({ foo: 1 }, 'mensagem');

// Em route handler HTTP — gera/propaga request_id
import { loggerForRequest } from '@/lib/logger';
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'minha-rota' });
  log.info({ ... }, 'evento');
}

// Em job BullMQ
import { loggerForJob } from '@/lib/logger';
const log = loggerForJob(job); // inclui job_id e job_name

// Em código com tenant context
import { loggerForTenant } from '@/lib/logger';
const ctx = await getTenantContext();
const log = loggerForTenant(ctx); // inclui condominio_id, role, user_id
```

## Variáveis

| Variável | Default | Descrição |
|---|---|---|
| `LOG_LEVEL` | `info` | `trace` < `debug` < `info` < `warn` < `error` < `fatal` |
| `NODE_ENV` | — | Em `production` desabilita `pino-pretty` (saída JSON) |

## Campos padronizados

| Campo | Onde | Origem |
|---|---|---|
| `request_id` | rotas HTTP | header `x-request-id` ou UUID v4 gerado |
| `job_id`, `job_name` | workers | `loggerForJob(job)` |
| `condominio_id`, `role`, `user_id` | tenant scope | `loggerForTenant(ctx)` |

## Redaction (defesa contra leak)

`logger.ts` aplica `redact` automático em paths comuns:
`password`, `secret`, `token`, `authorization`, `headers.authorization`,
`headers.cookie` — substituídos por `[REDACTED]`.

**Nunca logue:**
- Headers `Authorization`/`Cookie` brutos
- Body de webhook contendo HMAC signature
- Secrets de env var

## Como mudar o nível em runtime (dev)

```bash
# Set no .env.local e reinicie containers:
LOG_LEVEL=debug
docker compose -f infra/docker/docker-compose.yml restart app worker
```

## Troubleshooting

### `Module not found: Can't resolve 'pino'` no app container

Volume `node_modules` está stale. Rode dentro do container:

```bash
docker compose -f infra/docker/docker-compose.yml exec app npm install
docker compose -f infra/docker/docker-compose.yml restart app worker
```

### Logs sem cores / fora do formato esperado em dev

Confirme `NODE_ENV=development`. Em prod (`NODE_ENV=production`) a saída
é sempre JSON pra ingestão.

## Próximas evoluções

- Story 1.10: usar logger em scripts de seed
- Story 4.x: adicionar `correlation_id` end-to-end (HTTP → job → resposta WhatsApp)
- Story 8.x: integrar Sentry/Loki para agregação central
