# RLS-001 — Ligar Row Level Security em prod

**Status:** Done
**Severidade:** Alta — bloqueador pra multi-tenant real
**Encontrado em:** Auditoria 2026-05-10 (Orion)

## Problema

Em produção, RLS está **desabilitado** em todas as tabelas tenant-scoped:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename IN ('pacote','morador','unidade','setor','codigo_ml_pendente','pacote_evento','pacote_foto','whatsapp_message');
-- todas: rowsecurity = false
```

**Pior**: o role `app` em prod é **SUPERUSER + Bypass RLS**. Mesmo se RLS for ligado nas tabelas, o role bypassaria.

As policies existem (criadas pelo `prisma/migrations/20260506200212_initial_schema/rls_policies.sql`), mas o `prisma migrate deploy` só executa `migration.sql` — `rls_policies.sql` precisa ser invocado manualmente. Em prod isso nunca aconteceu.

**Hoje só existe 1 tenant** (TESTE-IA), então não há vazamento real. Mas no momento que entrar o 2º cliente, qualquer query do app lê dados dos dois.

## Estado em local (validado)

`docker exec ... psql` no DB local:
```
relname  | rowsecurity | relforcerowsecurity
pacote   | t           | t   (8/8 tabelas tenant)
```

Roles:
- `app` — Superuser + Bypass RLS (Prisma migrate, scripts ops)
- `app_runtime` — sem bypass (runtime do app — sujeito a RLS)
- `webhook_worker` — Bypass RLS (lookup cross-tenant pelo telefone)

`.env.local`: `DATABASE_RUNTIME_URL=postgresql://app_runtime:<senha>@localhost:5432/...`

**431/434 testes passam sob essa configuração.** Os 14 PRs anteriores (#78, #80, #82) já garantiram que workers/dashboards usem `withSuperAdmin`/`withTenant` corretamente.

## Plano executável

### 1. Pré-requisito — código preparado ✅

PRs #78, #80, #82 já asseguram que workers cross-tenant usem bypass explícito (helper `withSuperAdmin`). Confirmado por 431 testes passando local com role `app_runtime` (sem bypass).

### 2. Migration nova ✅

`prisma/migrations/20260510160000_enable_rls_prod/migration.sql` — replica integralmente o conteúdo de `rls_policies.sql`. Idempotente (todos `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS`).

Conteúdo:
- `CREATE OR REPLACE FUNCTION app_current_condominio()` e `app_is_super_admin()`
- 8 `ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY` + policies
- `CREATE ROLE app_runtime` + GRANTs + default privileges
- `CREATE ROLE webhook_worker` + GRANTs

### 3. Setup operacional em prod (manual, fora da migration)

**3.1 — Gerar senhas fortes pros roles novos.** Sugestão em zsh:
```bash
APP_RUNTIME_PASSWORD=$(openssl rand -hex 32)
WEBHOOK_WORKER_PASSWORD=$(openssl rand -hex 32)
echo "APP_RUNTIME=$APP_RUNTIME_PASSWORD"
echo "WEBHOOK_WORKER=$WEBHOOK_WORKER_PASSWORD"
```

**3.2 — Atualizar `.env.prod` na VPS** (`/opt/gestao-pacotes/.env.prod`):
```env
DATABASE_URL=postgresql://app:<senha-app>@postgres:5432/gestao_pacotes        # Prisma migrate
DATABASE_RUNTIME_URL=postgresql://app_runtime:<APP_RUNTIME_PASSWORD>@postgres:5432/gestao_pacotes
DATABASE_WEBHOOK_URL=postgresql://webhook_worker:<WEBHOOK_WORKER_PASSWORD>@postgres:5432/gestao_pacotes
```

**3.3 — Aplicar senhas via psql** (primeira vez, depois das migration):
```bash
ssh -i ~/.ssh/ponto24_pacotes_deploy root@<vps-ip>
docker exec -it docker-postgres-1 psql -U app -d gestao_pacotes <<EOF
ALTER ROLE app_runtime WITH PASSWORD '<APP_RUNTIME_PASSWORD>';
ALTER ROLE webhook_worker WITH PASSWORD '<WEBHOOK_WORKER_PASSWORD>';
EOF
```

**3.4 — Restart containers app+worker** (não precisa postgres):
```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod restart app worker
```

### 4. Smoke test pós-deploy

```bash
# Health endpoint
curl -s https://condominios.oponto24.com.br/api/health

# Verifica que RLS está ligado
docker exec docker-postgres-1 psql -U app -d gestao_pacotes -c "
  SELECT tablename, rowsecurity, relforcerowsecurity FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE schemaname='public' AND tablename IN ('pacote','morador','unidade');
"

# Login real como porteiro TESTE-IA → /chegada → tirar foto → confirmar → ver pacote em /admin
```

### 5. Rollback (se algo quebrar)

A migration é só DDL e GRANTs. Pra desligar emergencialmente:
```sql
ALTER TABLE pacote DISABLE ROW LEVEL SECURITY;
ALTER TABLE morador DISABLE ROW LEVEL SECURITY;
-- ... (todas as 8)
```

E `.env.prod` volta `DATABASE_RUNTIME_URL` pra usar role `app` (com bypass).

## Critérios de Aceitação

1. ✅ Migration criada e revisada
2. ✅ Senhas geradas e armazenadas
3. ✅ `.env.prod` atualizado (DATABASE_RUNTIME_URL com app_runtime)
4. ✅ Migration aplicada em prod (2026-05-10)
5. ✅ ALTER ROLE PASSWORDS aplicados via psql
6. ✅ Containers restartados com app_runtime
7. ✅ Smoke test verde (2026-05-21: app_runtime retorna 0 rows sem context, app retorna 6)
8. ✅ Verificação `pg_tables.rowsecurity = true` em prod (8/8 tabelas)

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Endpoint não-coberto retorna vazio | Média | Smoke test cobre fluxo principal — restantes aparecem em uso real, fix incremental |
| Senha do `.env.prod` errada → app não conecta | Baixa | Validar `psql -U app_runtime` antes de restartar |
| Migration parcial (CREATE ROLE OK, ENABLE RLS falha) | Baixa | Migration é idempotente — re-run completa |
| Performance regression | Baixa | Policies são simples (1 comparação UUID) |

## Já endereçado por PRs anteriores

| PR | Workers/queries com `withSuperAdmin` ou `withTenant` |
|---|---|
| #78 | `chooseRecipient`, `ensureQrForPacote`, `dashboard-admin`, `dashboard-super-admin` |
| #80 | Webhook Meta (`processWhatsappWebhook`) |
| #82 | `enviarLembretes` (cron 1h), `processPalavraChave` (Epic 7) |

## Não escopo

- Rebuild dos testes integration que assumem role `app` (não há nenhum identificado)
- Adicionar audit log de bypass — próxima story
- Migrar webhook Meta pra usar `webhook_worker` ao invés de `withSuperAdmin` (otimização — atual funciona)
