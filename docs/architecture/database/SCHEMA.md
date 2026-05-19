# Schema do Banco de Dados — Gestão de Pacotes em Condomínios

> **Versão:** 2.0 (pós-Epic 12)
> **Owner:** Dara (AIOX Data Engineer)
> **Última atualização:** 2026-05-19
> **Arquivo Prisma:** `prisma/schema.prisma`
> **RLS:** `prisma/migrations/20260506_initial_schema/rls_policies.sql`

---

## 1. Visão geral

PostgreSQL 16, gerenciado via Prisma 6. **14 tabelas** organizadas em 2 grupos:

- **Globais (5):** `condominio`, `user`, `whatsapp_number`, `audit_log`, `despesa` — sem RLS, acesso controlado por role aplicacional.
- **Tenant-scoped (9):** `setor`, `bloco`, `unidade`, `morador`, `pacote`, `pacote_foto`, `pacote_evento`, `whatsapp_message`, `codigo_ml_pendente` — com RLS isolando por `condominio_id`.

Convenções:
- **PKs:** UUID v4 (`gen_random_uuid()`) em todas exceto `audit_log` e `pacote_evento` (BigInt, alto volume sequencial).
- **Timestamps:** `created_at`, `updated_at` em toda tabela mutável.
- **Soft delete:** apenas em `condominio` e `morador` (LGPD/audit).
- **Naming:** snake_case nas colunas/tabelas, camelCase nos models Prisma.

---

## 2. Diagrama ER (resumido)

```
┌──────────────────┐
│   condominio     │ (root tenant)
└────────┬─────────┘
         │ 1:N
         ├─────────► setor
         ├─────────► bloco ─────────► unidade ───────► morador
         ├─────────► user
         ├─────────► whatsapp_number (FK opcional, premium futuro)
         └─────────► pacote ◄──────┐
                       │           │
                       ├──► pacote_foto
                       ├──► pacote_evento
                       ├──► whatsapp_message
                       └──► codigo_ml_pendente

despesa (global, sem FK — controle financeiro do operador SaaS)

pacote relations:
  - unidade_id (FK → unidade)
  - destinatario_id (FK → morador, prioridade ou fallback)
  - setor_id (FK → setor)
  - funcionario_recebedor_id, funcionario_entregador_id (FK → user)
  - retirado_por_morador_id (FK → morador, se "próprio destinatário")
```

---

## 3. Tabelas — propósito e access patterns

### 3.1 `condominio` — Tenant raiz
- **Acesso:** super_admin lê todos; admin/porteiro só leem o próprio (filtrado por `user.condominio_id`).
- **Volume esperado:** 50-500 registros (escala SaaS).
- **Índices:** `cep`, `ativo`.
- **Campos adicionados pós-MVP:**
  - `tem_administracao` (Boolean, default false) — story 10.1: define se fluxo passa pela administração.
  - `max_unidades`, `max_moradores`, `max_pacotes_30d` (Int?, defaults generosos) — quotas por tenant.
  - `deleted_at` (DateTime?) — soft delete para archivamento.
  - `cidade`, `estado` — campos obrigatórios de endereço.
- **Relations:** `unidades`, `blocos` (story 11.1), `setores`, `moradores`, `pacotes`, `users`.

### 3.2 `user` — Usuários do sistema
- **Acesso:** Clerk é a fonte da verdade de auth; tabela espelha `clerk_id`, `email`, `nome`, `role`, `condominio_id`.
- **Sincronização:** webhook Clerk em `/api/webhooks/clerk` mantém em dia.
- **Roles:** `super_admin` (sem condomínio), `admin_master` (ex-`admin`, story 10.1), `admin_funcionario` (story 10.1), `porteiro`.

### 3.3 `whatsapp_number` — Configuração WhatsApp
- **MVP:** 1 registro com `condominio_id = NULL` (compartilhado).
- **Premium futuro:** N registros, cada um vinculado a um condomínio.
- **Tracking:** `quality_rating` e `messaging_limit_tier` atualizados via webhook Meta (event `account_update`).

### 3.4 `setor` — Local de armazenamento
- **Constraint:** nome único por condomínio.
- **Índice de uso:** `(condominio_id, ativo)` para listar opções na UI.

### 3.5 `unidade` — Apartamento/Casa
- **Constraint:** `(condominio_id, identificador, bloco)` único — permite "Apto 101 Bloco A" e "Apto 101 Bloco B" coexistirem.
- **Cascade:** delete de condomínio apaga unidades (cuidado em produção — usar soft delete via `condominio.ativo = false`).
- **Campos adicionados:** `bloco_id` (UUID?, FK → `Bloco`, story 11.1). Campo legado `bloco` (String?) mantido por 1 release para rollback seguro.
- **Índice:** `bloco_id` para queries hierárquicas.

### 3.6 `morador` — Pessoas que recebem pacotes
- **Coluna chave:** `nome_normalizado` (lowercase + sem acentos) — usada pelo matching IA.
- **Roteamento WhatsApp inbound:** lookup por `telefone` em todas as unidades (cross-tenant — usa role `webhook_worker` com BYPASSRLS).
- **LGPD:** `deleted_at` permite anonimização preservando histórico de pacotes (NFR-031).
- **Constraint:** telefone único por condomínio (mesmo morador pode estar em 2 condomínios diferentes — pessoa com escritório + casa, por exemplo).

### 3.7 `pacote` — Entidade central
- **Estados (PacoteStatus):** `rascunho` → `pendente_identificacao | aguardando_organizacao | aguardando_retirada | em_administracao` → `retirado | cancelado`.
  - `aguardando_organizacao` (story 10.2): porteiro confirmou, aguarda admin organizar (condomínio com administração).
  - `em_administracao` (story 10.2): saiu da portaria, admin entrega.
- **Campos derivados pela IA:** `nome_destinatario_etiqueta`, `endereco_etiqueta`, `cep_etiqueta`, `complemento_etiqueta`, `bairro_etiqueta`, `remetente`.
- **Campos resolvidos:** `unidade_id`, `destinatario_id`, `destinatario_resolvido_via`.
- **Lembretes 24h:** `ultimo_lembrete_em`, `proximo_lembrete_em`, `lembretes_pausados`, `lembretes_pausados_em`, `lembretes_pausados_motivo` (decisão produto 2026-05-09).
- **QR Code:** `qr_token` é random 64-char, único, invalidado via `qr_consumido_em` (FR-047).
- **Auditoria:** `ia_extracao_raw`, `ia_confianca`, `ia_processada_em` para análise de qualidade do modelo.
- **Índice composto crítico:** `(condominio_id, status, recebido_em DESC)` — query principal do dashboard porteiro/admin.

### 3.8 `pacote_foto` — Fotos da etiqueta
- **MVP:** 1 foto principal por pacote. Múltiplas suportadas para futuro.
- **Storage path:** caminho relativo no volume Docker (`/storage/condominio_{uuid}/pacote_{uuid}/{filename}`).
- **Hash SHA256:** dedup em caso de re-upload acidental.

### 3.9 `pacote_evento` — Timeline imutável
- **Tabela append-only.** Nunca UPDATE ou DELETE.
- **PK BigInt:** alto volume esperado (1 pacote = 5-10 eventos).
- **Tipos:** ver enum `PacoteEventoTipo`.
- **Uso:** detalhe do pacote no painel admin (FR-063).

### 3.10 `whatsapp_message` — Mensagens enviadas e recebidas
- **direction:** `outbound` (notificação) ou `inbound` (morador respondeu).
- **Tracking Meta:** `sent_at` → `delivered_at` → `read_at` (atualizados via webhook Meta).
- **Idempotência:** `meta_message_id` único previne duplicação em retry de webhook.
- **Retry:** `retry_count` incrementado por BullMQ (max 3, ver arquitetura §5.2).

### 3.11 `codigo_ml_pendente` — Códigos Mercado Livre
- **Lifecycle:** `pendente` → `consumido` (com `pacote_id` preenchido) ou `expirado` (cron limpa após 30d).
- **Acesso na portaria:** quando porteiro registra pacote, query busca `WHERE morador_id = ? AND status = 'pendente'`.

### 3.12 `audit_log` — Auditoria centralizada
- **Tabela append-only** (sem updated_at).
- **Campos:** `user_id`, `condominio_id`, `acao`, `entidade_tipo`, `entidade_id`, `metadata` (JSON), `ip_address`, `user_agent`.
- **Story 12.4:** `metadata` armazena diffs de mutações: `{ before: {...}, after: {...}, changed: [...] }`.
- **Particionamento futuro:** por mês quando passar de 10M registros.
- **Retenção:** 12 meses (NFR-033).

### 3.13 `bloco` — Torre/Bloco (story 11.1)
- **Entidade hierárquica:** Condomínio → Bloco → Unidade.
- **Campos:** `nome`, `descricao`, `ordem`, `ativo`.
- **Constraint:** `(condominio_id, nome)` único.
- **Índice:** `condominio_id`.
- **Substitui** o campo string `unidade.bloco` por FK real.

### 3.14 `despesa` — Controle financeiro (global)
- **Uso:** super-admin controla custos de infra, IA, telecom.
- **Campos:** `servico`, `descricao`, `id_pagamento`, `id_assinatura`, `valor_brl` (Decimal), `pago_em`.
- **Sem `condominio_id`** — despesa global do operador SaaS.
- **Índice:** `pago_em DESC`.

---

## 4. Estratégia de índices

### 4.1 Índices criados (justificativa por query pattern)

| Tabela | Índice | Query atendida |
|--------|--------|---------------|
| `morador` | `(condominio_id, nome_normalizado)` | Match IA por nome |
| `morador` | `(telefone)` | Webhook Meta lookup global |
| `morador` | `(condominio_id, is_principal)` | Fallback de notificação |
| `pacote` | `(condominio_id, status, recebido_em DESC)` | Dashboard principal |
| `pacote` | `(condominio_id, unidade_id)` | "Pacotes do apto 101" |
| `pacote` | `(condominio_id, destinatario_id)` | "Pacotes da Maria" |
| `pacote` | `(qr_token)` | Scan retirada |
| `pacote` | `(codigo_rastreio)` | Busca por código |
| `pacote_evento` | `(pacote_id, created_at)` | Timeline detalhe |
| `whatsapp_message` | `(condominio_id, created_at DESC)` | Histórico admin |
| `whatsapp_message` | `(meta_message_id)` | Idempotência webhook |
| `codigo_ml_pendente` | `(condominio_id, status, expira_em)` | Cron cleanup |
| `bloco` | `(condominio_id)` | Listagem por tenant |
| `unidade` | `(bloco_id)` | Unidades por bloco |
| `despesa` | `(pago_em DESC)` | Listagem cronológica |
| `audit_log` | `(user_id, created_at)` | Ações por usuário |
| `audit_log` | `(condominio_id, created_at)` | Ações por tenant |
| `audit_log` | `(acao)` | Filtro por tipo de ação |

### 4.2 Índices NÃO criados (decisões)

- **Full-text search em pacote/morador:** não no MVP — busca textual usa `ILIKE` em `nome_normalizado`. Quando dor real aparecer, adicionar GIN com `pg_trgm`.
- **Índice em `created_at` global:** Postgres já cria implicitamente em PKs sequenciais (BigInt). UUID v4 não tem essa propriedade — só criar quando query exigir.

---

## 5. Multi-tenancy — implementação RLS

### 5.1 Como funciona em runtime

```typescript
// 1. Middleware aplicacional captura tenant
const { condominioId, role } = await getTenantContext();

// 2. Antes de qualquer query, seta contexto na conexão
await db.$executeRaw`SET LOCAL app.current_condominio = ${condominioId}::uuid`;
await db.$executeRaw`SET LOCAL app.is_super_admin = ${role === 'super_admin'}`;

// 3. Queries Prisma rodam normalmente
const pacotes = await db.pacote.findMany({ where: { status: 'aguardando_retirada' } });
// → SQL: SELECT ... FROM pacote WHERE status='aguardando_retirada' AND <RLS policy>
```

### 5.2 Por que `SET LOCAL` e não `SET`

- `SET LOCAL` vale apenas pela transação atual.
- Pool de conexões compartilha sockets — `SET` global vazaria contexto entre requests.
- Prisma extension wrappa cada query numa transação implícita quando preciso.

### 5.3 Exceção: webhook Meta inbound

Webhook Meta chega sem auth de usuário. Precisa fazer lookup `WHERE telefone = ?` em **todos** os condomínios para descobrir qual morador é.

**Solução:** role Postgres separada `webhook_worker` com `BYPASSRLS`, usada apenas pelo handler do webhook. Permissões mínimas (SELECT em `morador`, INSERT/UPDATE em `whatsapp_message` e `codigo_ml_pendente`).

Conexão dedicada com URL diferente:
```
DATABASE_WEBHOOK_URL=postgresql://webhook_worker:<secret>@localhost:5432/gestao_pacotes
```

### 5.4 Testes de RLS (obrigatórios antes de cada deploy)

```sql
-- Teste 1: usuário do condomínio A NÃO vê pacotes do B
SET LOCAL app.current_condominio = '<uuid-A>';
SELECT count(*) FROM pacote WHERE condominio_id = '<uuid-B>';
-- Esperado: 0

-- Teste 2: super_admin vê tudo
SET LOCAL app.is_super_admin = 'true';
SELECT count(*) FROM pacote;
-- Esperado: total real

-- Teste 3: tentativa de INSERT cross-tenant
SET LOCAL app.current_condominio = '<uuid-A>';
INSERT INTO setor (condominio_id, nome) VALUES ('<uuid-B>', 'X');
-- Esperado: ERROR — violates RLS policy
```

---

## 6. Decisões de modelagem

| # | Decisão | Alternativa rejeitada | Motivo |
|---|---------|----------------------|--------|
| 1 | UUID em PKs (exceto audit/evento) | BigInt sequencial | Evita enumeração + facilita merge multi-DB futuro |
| 2 | `morador.telefone` único por condomínio (não global) | Único global | Mesma pessoa pode ser moradora em 2 condomínios |
| 3 | Soft delete só em condomínio + morador | Soft delete em tudo | Audit trail só importa onde LGPD exige; resto = hard delete + cascade |
| 4 | `pacote_evento` como append-only com BigInt | Update no pacote | Auditoria histórica + queries por timeline |
| 5 | `whatsapp_number` com FK opcional pra condomínio | Tabela separada premium | Mesma estrutura serve free e premium futuro, evita migração |
| 6 | RLS híbrido (middleware + policy) | Apenas middleware OU apenas RLS | Defesa em profundidade; bug aplicacional não expõe dados |
| 7 | `nome_normalizado` em coluna separada | Função SQL no WHERE | Permite índice eficiente; recomputado no app |
| 8 | `qr_token` em vez de assinar pacote_id | JWT no QR | Token random é mais simples; revogação trivial via `qr_consumido_em` |
| 9 | `ia_extracao_raw` como JSONB | Tabela separada | Schema da IA muda; JSONB é flexível e queryable |
| 10 | Enums Postgres (não strings) | VARCHAR + check | Type safety + tamanho menor; migração de enum exige ALTER TYPE |

---

## 7. Migrations e operação

### 7.1 Bootstrap inicial

```bash
# 1. Configurar DATABASE_URL no .env
# 2. Criar primeira migration
npx prisma migrate dev --name initial_schema

# 3. Aplicar RLS policies (não vai pelo Prisma)
psql $DATABASE_URL -f prisma/migrations/20260506_initial_schema/rls_policies.sql

# 4. Seed inicial (super-admin + condomínio de teste)
npx prisma db seed
```

### 7.2 Snapshot antes de migration destrutiva

```bash
pg_dump $DATABASE_URL --schema-only > snapshots/schema-$(date +%Y%m%d-%H%M).sql
```

### 7.3 Estratégia de migração (Prisma)

- **Backwards-compatible obrigatório** — adicionar colunas nullable, nunca remover/renomear sem janela de manutenção.
- **Renames:** sempre 2 deploys (add new → backfill → remove old).
- **Drops:** período de quarentena de 1 release antes de remover de fato.

### 7.4 Backups

Conforme NFR-011: cron diário 03:00 BRT executa `pg_dump`, retenção 30 dias local + 90 dias remoto. Script em `infra/scripts/backup-db.sh`.

---

## 8. Performance — limites e escala

| Métrica | Capacidade estimada | Quando preocupar |
|---------|-------------------|------------------|
| Pacotes/condomínio/mês | ~500 | Sem stress até 100k pacotes/mês total |
| Tamanho banco | ~50KB/pacote (com fotos fora) | Ação aos 20GB → considerar tablespace separada |
| Latência query dashboard P95 | <50ms | Re-avaliar índices se passar 200ms |
| Conexões simultâneas | 50 (pool Prisma) | Pgbouncer aos 100+ condomínios ativos |

---

## 9. Próximos passos

1. **`@dev` (Dex):** implementar Prisma client, repositories e middleware de tenant.
2. **`@dev`:** rodar primeira migration em ambiente local (Docker Postgres).
3. **`@qa` (Quinn):** validar RLS com testes positivos e negativos antes do primeiro deploy.
4. **Eu (Dara):** voltar quando precisar criar índice composto novo, otimizar query lenta, ou modelar feature pós-MVP.

---

## 9.5. Migration aplicada (story 1.3)

**Data:** 2026-05-06
**Comando:** `npx prisma migrate dev --name initial_schema`
**Migration gerada:** `prisma/migrations/20260506200212_initial_schema/migration.sql`
**RLS file (não aplicado ainda):** `prisma/migrations/20260506200212_initial_schema/rls_policies.sql` — será aplicado em **story 1.4**

**Resultado validado:**
- 12 tabelas criadas + 1 (`_prisma_migrations`) = 13 total
- 8 enums Postgres criados (UserRole, TamanhoPacote, PacoteStatus, PacoteEventoTipo, WhatsAppMessageStatus, WhatsAppMessageDirection, CodigoMlStatus, Transportadora). Nota: UserRole agora tem 4 valores (`super_admin`, `admin_master`, `admin_funcionario`, `porteiro`) e PacoteStatus tem 7 valores (adicionados `aguardando_organizacao`, `em_administracao` na story 10.2)
- Índices, FKs e constraints todos presentes
- Seed (`prisma/seed.ts`) executado com sucesso: 1 super-admin + 1 WhatsApp number placeholder

**Pequena correção no schema durante a story 1.3:**
A relação `Morador → Condominio` (via `condominio_id`) precisava de inversa explícita em `model Condominio`. Adicionados `moradores: Morador[]`, `pacote_fotos: PacoteFoto[]` e `pacote_eventos: PacoteEvento[]` por exigência do Prisma 6 (toda `@relation` precisa de inversa). Não muda a estrutura — apenas explicita as relações reversas que o Prisma usa pra gerar tipos TypeScript completos.

## 11. RLS aplicado em 1.4 + estratégia de roles

**Data:** 2026-05-06
**Comando:** `npm run db:apply-rls`
**Validado por:** suite de testes integration em `tests/integration/rls.test.ts` (6 cenários)

### Roles Postgres em uso

| Role | Privilégios | Quem usa | Notas |
|------|-------------|----------|-------|
| `app` | SUPERUSER, BYPASSRLS | Prisma CLI (migrations, seed) | Default do POSTGRES_USER. SUPERUSER ignora RLS. |
| `app_runtime` | LOGIN, NOSUPERUSER, NOBYPASSRLS, DML em todas tabelas | App Next.js + workers + tests RLS | **SUJEITO A RLS** — defesa em profundidade real. |
| `webhook_worker` | LOGIN, BYPASSRLS, SELECT em morador + INSERT/UPDATE em msg/codigo | Handler webhook Meta | Cross-tenant lookup por telefone. Princípio do menor privilégio. |

### Por que `app_runtime` é necessário

O Postgres SUPERUSER **bypassa RLS sempre**, mesmo com `FORCE ROW LEVEL SECURITY`. O image `postgres:16-alpine` cria `POSTGRES_USER=app` como SUPERUSER por default. Por isso:
- `DATABASE_URL` (= `app`) = só pra Prisma migrations (precisa SUPERUSER)
- `DATABASE_RUNTIME_URL` (= `app_runtime`) = pra runtime do app (sujeito a RLS)
- `DATABASE_WEBHOOK_URL` (= `webhook_worker`) = pra handler de webhook Meta

### Validações aplicadas

- ✅ 8 tabelas com RLS habilitado (`relrowsecurity=true`) e FORCE (`relforcerowsecurity=true`)
- ✅ Helpers `app_current_condominio()` e `app_is_super_admin()` retornam valores corretos
- ✅ Sem context, query retorna 0 (RLS bloqueia)
- ✅ Com context = Cond A, vê só dados de A
- ✅ Tentativa de INSERT cross-tenant levanta erro `new row violates row-level security policy`
- ✅ Com `is_super_admin = 'true'`, vê tudo
- ✅ `webhook_worker` SELECT em `morador` OK; SELECT em `condominio` BLOQUEADO; DELETE em `morador` BLOQUEADO

### Issues encontrados e fixados durante 1.4

1. **`GRANT CONNECT ON DATABASE CURRENT_DATABASE()`** falha sintaxe — substituído por nome literal `gestao_pacotes` no SQL.
2. **Adicionado `FORCE ROW LEVEL SECURITY`** em todas as 8 tabelas (sem isso, owner bypassa RLS).
3. **Criada role `app_runtime`** porque o `app` user é SUPERUSER (bypassa RLS independentemente de FORCE).

## 12. Middleware tenant em runtime (story 1.6)

**Implementado:** 2026-05-06.

### Fluxo Clerk → RLS automático

```
Request HTTP
  ↓
Clerk middleware (src/middleware.ts) — autentica
  ↓
Route handler chama withTenant(callback) ou getTenantContext()
  ↓
getTenantContext() — cached por request via React.cache()
  - chama getCurrentUser() (Clerk auth + lookup user no DB)
  - Resolve para: { kind: 'tenant'|'super_admin', userId, condominioId, role }
  - Lança UnauthorizedError | PendingProvisioningError | NoCondominioAssignedError
  ↓
withTenantContext(ctx, callback) wrappa em db.$transaction:
  - Para super_admin: SET LOCAL app.is_super_admin = 'true'
  - Para tenant: SET LOCAL app.current_condominio = '<uuid>'
  ↓
callback(tx) — Prisma queries dentro da transação são automaticamente
  filtradas pelo RLS (camada 1.4)
```

### Pontos de atenção

- **`SET LOCAL` exige transação ativa** — fora dela é silenciosamente ignorado.
  `withTenantContext` força `$transaction` por isso.
- **Postgres não aceita placeholder em `SET LOCAL`** — precisa interpolar string.
  Validamos formato UUID via regex ANTES de interpolar (defesa contra injection).
- **Webhook handlers (Clerk, Meta) NÃO usam middleware tenant** — são cross-tenant
  por design e usam `db` direto (`@/lib/db`). Ver `src/app/api/webhooks/clerk/route.ts`.
- **Cache via `React.cache()`** — múltiplas chamadas a `getTenantContext()` no mesmo
  request server retornam o mesmo resultado (sem re-fetch do user no DB).

### Endpoints smoke permanentes

- `GET /api/me` — retorna o `TenantContext` resolvido (sem dados do banco)
- `GET /api/me/data` — exemplo de query usando `withTenant` (lista unidades visíveis)

### Erros HTTP mapeados

| Erro | Status | Cenário |
|------|--------|---------|
| `UnauthorizedError` | 401 | Não logado |
| `PendingProvisioningError` | 503 | Logado mas webhook Clerk ainda não criou linha no DB |
| `NoCondominioAssignedError` | 403 | Logado mas user.condominio_id é NULL e role != super_admin |

## 10. Backlog de melhorias pós-MVP

- Particionamento `audit_log` e `pacote_evento` por mês (volume).
- Materialized view de dashboard admin (se queries ficarem lentas).
- Full-text search com `pg_trgm` em morador/pacote.
- Tabela `notification_preferences` por morador (opt-out de notificações específicas).
- Tabela `condominio_config` para configurações por tenant (regras de auto-sugestão de setor por tamanho, templates customizados, etc.).
- Particionamento `pacote` por `condominio_id` quando passar de 10M registros.
