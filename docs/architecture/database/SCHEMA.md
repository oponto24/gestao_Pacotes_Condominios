# Schema do Banco de Dados — Gestão de Pacotes em Condomínios

> **Versão:** 1.0 (MVP)
> **Owner:** Dara (AIOX Data Engineer)
> **Última atualização:** 2026-05-06
> **Arquivo Prisma:** `prisma/schema.prisma`
> **RLS:** `prisma/migrations/20260506_initial_schema/rls_policies.sql`

---

## 1. Visão geral

PostgreSQL 16, gerenciado via Prisma 6. **15 tabelas** organizadas em 2 grupos:

- **Globais (4):** `condominio`, `user`, `whatsapp_number`, `audit_log` — sem RLS, acesso controlado por role aplicacional.
- **Tenant-scoped (8):** `setor`, `unidade`, `morador`, `pacote`, `pacote_foto`, `pacote_evento`, `whatsapp_message`, `codigo_ml_pendente` — com RLS isolando por `condominio_id`.

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
         ├─────────► unidade ───────► morador
         ├─────────► user
         ├─────────► whatsapp_number (FK opcional, premium futuro)
         └─────────► pacote ◄──────┐
                       │           │
                       ├──► pacote_foto
                       ├──► pacote_evento
                       ├──► whatsapp_message
                       └──► codigo_ml_pendente

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

### 3.2 `user` — Usuários do sistema
- **Acesso:** Clerk é a fonte da verdade de auth; tabela espelha `clerk_id`, `email`, `nome`, `role`, `condominio_id`.
- **Sincronização:** webhook Clerk em `/api/webhooks/clerk` mantém em dia.
- **Roles:** `super_admin` (sem condomínio), `admin`, `porteiro`.

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

### 3.6 `morador` — Pessoas que recebem pacotes
- **Coluna chave:** `nome_normalizado` (lowercase + sem acentos) — usada pelo matching IA.
- **Roteamento WhatsApp inbound:** lookup por `telefone` em todas as unidades (cross-tenant — usa role `webhook_worker` com BYPASSRLS).
- **LGPD:** `deleted_at` permite anonimização preservando histórico de pacotes (NFR-031).
- **Constraint:** telefone único por condomínio (mesmo morador pode estar em 2 condomínios diferentes — pessoa com escritório + casa, por exemplo).

### 3.7 `pacote` — Entidade central
- **Estados (PacoteStatus):** `rascunho` → `pendente_identificacao | aguardando_retirada` → `retirado | cancelado`.
- **Campos derivados pela IA:** `nome_destinatario_etiqueta`, `endereco_etiqueta`, `cep_etiqueta`, `complemento_etiqueta`.
- **Campos resolvidos:** `unidade_id`, `destinatario_id`, `destinatario_resolvido_via`.
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
- **Particionamento futuro:** por mês quando passar de 10M registros.
- **Retenção:** 12 meses (NFR-033).

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

## 10. Backlog de melhorias pós-MVP

- Particionamento `audit_log` e `pacote_evento` por mês (volume).
- Materialized view de dashboard admin (se queries ficarem lentas).
- Full-text search com `pg_trgm` em morador/pacote.
- Tabela `notification_preferences` por morador (opt-out de notificações específicas).
- Tabela `condominio_config` para configurações por tenant (regras de auto-sugestão de setor por tamanho, templates customizados, etc.).
- Particionamento `pacote` por `condominio_id` quando passar de 10M registros.
