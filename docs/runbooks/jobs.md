# Runbook — Jobs / BullMQ workers (Story 1.8)

Padrões e operação da camada de filas. Use esse runbook ao adicionar novo job ou debugar processamento.

---

## Arquitetura

```
┌─────────────┐  enqueue        ┌────────┐   consume    ┌──────────────┐
│ App / API   │ ───────────────▶│ Redis  │◀────────────│ Worker (sep.) │
│ (Server     │  defaultQueue   │ stream │  pgrep node  │  processo     │
│  Action /   │                 │ BullMQ │              │  workers/     │
│  Route)     │                 │        │              │  index.ts     │
└─────────────┘                 └────────┘              └──────────────┘
                                                                 │
                                                                 ▼
                                                        ┌──────────────┐
                                                        │ JOB_PROCESSORS│
                                                        │  (registry)   │
                                                        │   ├ ping      │
                                                        │   ├ extract...│
                                                        │   └ ...       │
                                                        └──────────────┘
```

- **Fila padrão:** `default` (1 fila no MVP — adicionar mais quando virar dor)
- **Connection:** `redis` singleton de `@/lib/redis` (`maxRetriesPerRequest: null`)
- **Worker:** processo separado (Docker service `worker`), 5 jobs paralelos
- **Defaults:** 3 attempts, backoff exponencial 1s/2s/4s, GC após 1h ou 100 jobs

---

## Adicionar novo job — passo a passo

### 1. Criar arquivo do job

`src/lib/queue/jobs/<nome>.ts`:

```typescript
import type { Job } from 'bullmq';

export type MyJobPayload = {
  someId: string;
  condominioId?: string;  // se job tocar dados tenant-scoped
  // ...
};

export type MyJobResult = {
  ok: true;
  // ...
};

export const MY_JOB_NAME = 'my-job' as const;

export async function processMyJob(job: Job<MyJobPayload>): Promise<MyJobResult> {
  console.log(`[my-job] processing job=${job.id} ...`);

  // Trabalho real aqui

  return { ok: true };
}
```

### 2. Registrar no map

`src/lib/queue/jobs/index.ts`:

```typescript
import { processMyJob, MY_JOB_NAME } from './my-job';

export const JOB_PROCESSORS: Record<string, AnyProcessor> = {
  [PING_JOB_NAME]: processPing,
  [MY_JOB_NAME]: processMyJob,  // ← adicione aqui
};

export { MY_JOB_NAME };
export type { MyJobPayload, MyJobResult } from './my-job';
```

### 3. Enfileirar de algum lugar (route handler, service, etc.)

```typescript
import { enqueue } from '@/lib/queue/queues';
import { MY_JOB_NAME } from '@/lib/queue/jobs';

await enqueue(MY_JOB_NAME, { someId: '...', condominioId: ctx.condominioId });
```

Pronto. Worker pega o `job.name` e despacha pro `processMyJob` automaticamente. Sem mudar `workers/index.ts`.

---

## Pattern: jobs com tenant context (DB tenant-scoped)

Workers **não têm auth Clerk**. Quando o job precisa escrever em tabelas tenant-scoped (ex: `pacote`, `morador`, `whatsapp_message`), o **payload deve carregar `condominioId`** e o processor usa `withTenantContext` direto.

```typescript
import type { Job } from 'bullmq';
import { withTenantContext } from '@/server/db-tenant';
import type { TenantContext } from '@/server/middleware/tenant';

export type ExtractLabelPayload = {
  pacoteId: string;
  condominioId: string;  // OBRIGATÓRIO se vai tocar tabela tenant-scoped
  fotoPath: string;
};

export async function processExtractLabel(job: Job<ExtractLabelPayload>) {
  const ctx: TenantContext = {
    kind: 'tenant',
    userId: 'system',                    // jobs não têm user humano
    condominioId: job.data.condominioId, // do payload
    role: 'admin',                        // jobs operam com privilégio admin do tenant
  };

  return withTenantContext(ctx, async (tx) => {
    // tx.pacote.update(...) — RLS aplica automaticamente
    // tx.pacote_evento.create(...) — também
  });
}
```

**NÃO use `withTenant(callback)` em jobs** — `withTenant` chama `getTenantContext()` que depende de `auth()` Clerk (sem request, falha com `UnauthorizedError`).

---

## Operação dia-a-dia

### Enfileirar manualmente (debug/admin)

Endpoint admin (super_admin only):
```bash
curl -X POST http://localhost:3000/api/admin/queue/enqueue-ping \
  -H "Cookie: __session=..." \
  -d '{"message":"hello"}'
```

Direto via Node script (sem auth, dev only):
```bash
node -e "
const {Queue} = require('bullmq');
const IORedis = require('ioredis');
const redis = new IORedis(process.env.REDIS_URL, {maxRetriesPerRequest: null});
const q = new Queue('default', {connection: redis});
q.add('ping', {message: 'manual'}).then(j => {
  console.log('id:', j.id);
  process.exit(0);
});
"
```

### Inspecionar fila via Redis CLI

```bash
docker compose -f infra/docker/docker-compose.yml exec redis redis-cli

# Jobs ativos:
> LRANGE bull:default:active 0 -1

# Jobs em failed (debug):
> LRANGE bull:default:failed 0 -1

# Detalhe de um job:
> HGETALL bull:default:<job_id>

# Contagem por estado:
> LLEN bull:default:waiting
> LLEN bull:default:active
> LLEN bull:default:completed
> LLEN bull:default:failed
```

### Logs do worker

```bash
docker compose -f infra/docker/docker-compose.yml logs -f worker
```

⚠️ **Gotcha conhecido (story 1.2/1.8):** logs do `npm run worker:dev` ficam vazios em alguns casos por buffering do npm + tini. Funcionalmente o worker roda — verificar via `docker exec gestao-pacotes-dev-worker-1 ps aux`. Workaround pra próximas stories: trocar pra `tsx workers/index.ts` direto sem npm wrapper.

### Reenfileirar job failed

Via BullMQ programático:
```javascript
const job = await queue.getJob('<job_id>');
await job.retry();
```

Ou drenar todos failed:
```javascript
await queue.clean(0, 1000, 'failed');
// (cuidado: apaga, não retenta)
```

---

## Troubleshooting

### "Worker iniciado mas job nunca processa"

1. Verificar se worker está conectado no mesmo Redis: `docker exec gestao-pacotes-dev-worker-1 env | grep REDIS_URL`
2. Verificar se a fila do enqueue é a mesma do worker: ambos `default`
3. Verificar se `job.name` casa com chave de `JOB_PROCESSORS`
4. Inspecionar Redis: `LRANGE bull:default:waiting 0 -1` (se tem job esperando, worker não está consumindo)

### "Job vai pra failed sem causa óbvia"

1. `LRANGE bull:default:failed 0 -1` → pega `<job_id>`
2. `HGETALL bull:default:<job_id>` → ver `failedReason` e `stacktrace`
3. Logs do worker durante o processamento

### "Memory leak no Redis crescendo"

1. Verificar `removeOnComplete` configurado em `connection.ts`
2. Manualmente: `await queue.clean(86400000, 0, 'completed')` (limpa completed mais velhos que 24h)

### "Worker não pega lock após restart"

Lock duration 60s. Se worker crashou em meio de job, próximo worker espera 60s antes de pegar. Pra forçar: `redis-cli DEL bull:default:<job_id>:lock`.

---

## Jobs registrados (atualizado 2026-05-08)

| Story | Job name | Payload | Retry config | Notas |
|-------|----------|---------|--------------|-------|
| 1.8 | `ping` | `{ ts: number }` | default (3 attempts, 1s/2s/4s) | sanity check |
| 3.5 | `extractLabel` | `{ pacote_id, condominio_id }` | default | Worker carrega foto principal, chama Gemini (fallback Anthropic), atualiza pacote + cria evento `ia_processou` |
| 4.3 | `sendWhatsApp` | `{ pacote_id, condominio_id }` | **4 attempts**, backoff exp **5s/10s/20s/40s** | jobId determinístico `sendWhatsApp:{pacote_id}` (anti-dup); `forceUnique=true` no reenvio manual (4.6) |
| 4.4 | `processWhatsappWebhook` | `{ value: MetaWebhookValue }` | default | Cross-tenant — bypassa RLS; idempotência via `meta_message_id @unique` + STATUS_RANK |

### Próximas stories que vão adicionar jobs

| Story | Job | Payload (esboço) |
|-------|-----|------------------|
| 7.2 | `processIncomingMessage` | `{ whatsapp_message_id }` — consome inserts inbound da 4.4, extrai código ML via regex+LLM |
| 7.5 | `expireCodigoMl` | cron diário, sem payload |

---

## Referências

- BullMQ docs: https://docs.bullmq.io
- Story relacionada: 1.8 — BullMQ queue + worker real + ping job
- Heads-up tenant context: 1.6 (gate file)
