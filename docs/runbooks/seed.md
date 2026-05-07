# Runbook — Seed inicial

> **Story:** 1.10 | **Owner:** Dev (Dex) | **Última atualização:** 2026-05-06

## O que o seed faz

`prisma/seed.ts` cria **apenas o mínimo** para o sistema subir:

1. **1 super-admin** (`role=super_admin`, `condominio_id=null`)
2. **1 WhatsApp number compartilhado** (`condominio_id=null`, default inativo)

Tudo idempotente — pode rodar várias vezes sem duplicação ou erro.

## Quando rodar

| Ambiente | Quando | Como |
|---|---|---|
| **Dev** | Primeira instalação | `npm run prisma:seed` |
| **Dev** | Reset completo (drop+recria+seed+RLS) | `npm run db:reset-and-seed` |
| **Staging/Prod** | Primeira instalação | `npm run prisma:seed` (após `prisma migrate deploy`) |
| **CI** | NUNCA contra prod | — |

## Variáveis de ambiente

| Variável | Default | Obrigatória em prod? |
|---|---|---|
| `SUPER_ADMIN_EMAIL` | `gustavs.silvs@gmail.com` | Recomendado override |
| `META_PHONE_NUMBER_ID` | (placeholder) | **SIM** — seed aborta sem isso em `NODE_ENV=production` |
| `META_WABA_ID` | (placeholder) | **SIM** — idem |
| `META_DISPLAY_PHONE` | placeholder | Não |

**Em prod sem `META_PHONE_NUMBER_ID`:** o seed **aborta com erro claro** em vez de criar
placeholder silenciosamente (que quebraria story 4.1 sem aviso).

## Reconciliação Clerk (super-admin)

O seed cria o super-admin com `clerk_id='pending_clerk_link'`. Quando o usuário
faz login pela primeira vez via Clerk, o webhook (`/api/webhooks/clerk`) detecta
que o `clerk_id` real ainda não existe no banco e faz **fallback por email**:

1. Procura user com mesmo email (criado pelo seed)
2. Substitui `pending_clerk_link` pelo `clerk_id` real
3. Preserva `role=super_admin` e `condominio_id`

**Inverso também funciona:** se o usuário logou via Clerk **antes** do seed
rodar (foi criado como `role=porteiro` default), rodar o seed promove para
`super_admin` sem duplicação (match por email).

## Comportamento idempotente

```bash
# Run #1 (DB vazio)
$ npm run prisma:seed
[INFO] iniciando seed
[INFO] super-admin criado pendente
[INFO] whatsapp_number criado
[WARN] ⚠️  WhatsApp number = PLACEHOLDER. Atualizar...
[INFO] seed concluído  summary: { super_admin: 'created', whatsapp_number: 'created' }, created: 2, updated: 0

# Run #2 (já existe)
$ npm run prisma:seed
[INFO] iniciando seed
[INFO] super-admin reconciliado
[INFO] whatsapp_number atualizado
[INFO] seed concluído  summary: { super_admin: 'updated', whatsapp_number: 'updated' }, created: 0, updated: 2
```

## Recuperação parcial

Se o seed falha no meio (ex: erro de conexão), simplesmente rode de novo. A
idempotência garante que o que já foi criado não duplica e o restante completa.

## Reset completo (DEV ONLY)

```bash
npm run db:reset-and-seed
```

Encadeia:
1. **Guard NODE_ENV** — aborta se `production`
2. `prisma migrate reset --force` — DROP do schema, recria, aplica migrations, roda seed
3. `db:apply-rls` — recria roles `app_runtime`/`webhook_worker` e policies RLS

⚠️ **Operação destrutiva.** Apaga TODOS os dados do schema. Use apenas em dev.

## Pós-seed: validação manual

```bash
# Verifica super-admin
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U app gestao_pacotes -c \
  "SELECT email, role, clerk_id FROM \"user\" WHERE role='super_admin';"

# Verifica WhatsApp number
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U app gestao_pacotes -c \
  "SELECT phone_number_id, ativo FROM whatsapp_number;"
```

## Por que o seed roda como SUPERUSER?

`prisma/seed.ts` usa `DATABASE_URL` (role `app`, SUPERUSER), **não** `DATABASE_RUNTIME_URL`.
Isso é correto porque:

- Seed precisa criar registros sem condominio_id (super-admin, WhatsApp shared)
- RLS exige `app.current_condominio` setado para reads/writes — seed bypassa por design
- Em produção, seed roda apenas na primeira instalação (one-shot via deploy)

App em runtime continua usando `DATABASE_RUNTIME_URL` (role `app_runtime`,
NOSUPERUSER, sujeito a RLS).

## Observação RLS

Após o seed, ler o super-admin via `app_runtime` retorna 0 rows (RLS exige
`app.current_condominio`, e super-admin tem `condominio_id=NULL`). Isso é
esperado: super-admin acessa via lógica de aplicação que **não** seta tenant
context (ver `src/server/middleware/tenant.ts`).

## Próximas evoluções

- Story 4.1: validar e ativar `WhatsAppNumber` placeholder com IDs reais Meta
- Story 8.4: integrar seed ao deploy script da VPS (rodar pós-migrate apenas se DB vazio)
