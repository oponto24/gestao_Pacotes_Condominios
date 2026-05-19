# Runbook: Deploy RLS em Produção

> **Status:** Pendente
> **Bloqueador:** Sem RLS, 2º cliente vê dados do 1º
> **Tempo estimado:** 15 minutos
> **Risco:** BAIXO (migration idempotente, rollback possível)

---

## Pré-requisitos

- Acesso SSH à VPS como user `deploy`
- Containers postgres/app/worker rodando

## Passo a passo

### 1. SSH na VPS

```bash
ssh deploy@<IP_VPS>
cd /opt/gestao-pacotes
git pull origin main
```

### 2. Gerar senhas dos roles

```bash
export APP_RUNTIME_DB_PASSWORD=$(openssl rand -hex 32)
export WEBHOOK_WORKER_DB_PASSWORD=$(openssl rand -hex 32)
echo "APP_RUNTIME_DB_PASSWORD=$APP_RUNTIME_DB_PASSWORD"
echo "WEBHOOK_WORKER_DB_PASSWORD=$WEBHOOK_WORKER_DB_PASSWORD"
```

**Anote essas senhas** — vão pro `.env.prod`.

### 3. Rodar migration Prisma (aplica o SQL de RLS)

```bash
COMPOSE="docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod"
$COMPOSE run --rm --entrypoint "" worker sh -c 'cd /app && ./node_modules/.bin/prisma migrate deploy'
```

### 4. Setar senhas dos roles via SQL

```bash
$COMPOSE exec -T postgres psql -U app -d gestao_pacotes -c \
  "ALTER ROLE app_runtime WITH PASSWORD '$APP_RUNTIME_DB_PASSWORD';
   ALTER ROLE webhook_worker WITH PASSWORD '$WEBHOOK_WORKER_DB_PASSWORD';"
```

### 5. Aplicar RLS na tabela Bloco (não coberta pela migration original)

```bash
$COMPOSE exec -T postgres psql -U app -d gestao_pacotes -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE bloco ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloco FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bloco_tenant_isolation ON bloco;
CREATE POLICY bloco_tenant_isolation ON bloco
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON bloco TO app_runtime;
SQL
```

### 6. Atualizar `.env.prod` com os novos roles

```bash
# Editar .env.prod — substituir a DATABASE_URL do app e worker
# ANTES (superuser pra tudo):
#   DATABASE_URL=postgresql://app:<senha>@postgres:5432/gestao_pacotes
#
# DEPOIS (separar runtime vs migration):
nano .env.prod
```

Adicionar/alterar:

```env
# Migration (superuser — só usado por prisma migrate deploy)
DATABASE_URL=postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/gestao_pacotes

# Runtime da app (sujeito a RLS)
DATABASE_RUNTIME_URL=postgresql://app_runtime:${APP_RUNTIME_DB_PASSWORD}@postgres:5432/gestao_pacotes
```

> **ATENÇÃO:** O docker-compose.prod.yml já tem `DATABASE_RUNTIME_URL` mas hoje aponta pro mesmo user superuser. Ao trocar pra `app_runtime`, o app passa a respeitar RLS.

### 7. Reiniciar containers

```bash
$COMPOSE restart app worker
```

### 8. Validar

```bash
# Verificar que RLS está ativo em 9 tabelas (8 originais + bloco)
$COMPOSE exec -T postgres psql -U app -d gestao_pacotes -tAc \
  "SELECT count(*) FROM pg_tables WHERE rowsecurity=true AND schemaname='public';"
# Esperado: 9

# Verificar roles
$COMPOSE exec -T postgres psql -U app -d gestao_pacotes -tAc \
  "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('app_runtime','webhook_worker');"
# Esperado:
#   app_runtime|f|f
#   webhook_worker|f|t

# Smoke test — app deve funcionar normal
curl -s https://condominios.oponto24.com.br/api/health
# Esperado: {"status":"ok",...}
```

### 9. Testar isolamento (opcional mas recomendado)

```bash
# Conectar como app_runtime SEM setar tenant context
$COMPOSE exec -T postgres psql -U app_runtime -d gestao_pacotes -c \
  "SELECT count(*) FROM setor;"
# Esperado: 0 (RLS bloqueia sem context)

# Conectar com tenant context
$COMPOSE exec -T postgres psql -U app_runtime -d gestao_pacotes -c \
  "SET LOCAL app.current_condominio = '<UUID_DO_CONDOMINIO>';
   SELECT count(*) FROM setor;"
# Esperado: N (setores do condomínio)
```

## Rollback (se algo der errado)

```bash
# Voltar .env.prod pro user superuser original
# DATABASE_RUNTIME_URL=postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/gestao_pacotes
$COMPOSE restart app worker
```

RLS continua ativo na tabela mas é ignorado pelo superuser — zero impacto.
