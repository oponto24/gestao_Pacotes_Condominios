# RLS-001 — Ligar Row Level Security em prod

**Status:** Draft
**Severidade:** Alta — bloqueador pra multi-tenant real
**Encontrado em:** Auditoria 2026-05-10 (Orion)

## Problema

Em produção, RLS está **desabilitado** em todas as tabelas tenant-scoped:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename IN ('pacote','condominio','unidade','morador');
-- todas: rowsecurity = false
```

As policies existem (criadas pelo `prisma/migrations/20260506200212_initial_schema/rls_policies.sql`), mas o `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nunca foi efetivamente aplicado em prod — provavelmente o arquivo `rls_policies.sql` não está sendo executado pelo `prisma migrate deploy` (que só roda `migration.sql`).

**Hoje só existe 1 tenant (TESTE-IA)**, então não há vazamento real. Mas no momento que entrar o 2º cliente, qualquer query do `app_runtime` lê dados dos dois.

## Critérios de Aceitação

1. RLS habilitado em **todas** as tabelas tenant-scoped (pacote, unidade, morador, setor, whatsapp_message, pacote_evento, pacote_foto, codigo_ml_pendente, audit_log, …)
2. Policies de isolamento ativas
3. Smoke test multi-tenant: 2 condomínios, query do tenant A não vê dados do tenant B
4. Smoke test super_admin: bypass funciona
5. Smoke test workers: jobs continuam funcionando (já preparados em PRs #78, #80)

## Plano de Migração

1. **Pré-requisito:** PRs #78 e #80 mergeados (✅ feito 2026-05-10) — sem isso, ao ligar RLS os workers quebram.
2. Criar migration nova `2026MMDDHHMM_enable_rls.sql`:
   - Inclui `\i rls_policies.sql` ou inline o SQL.
   - Idempotente (`DROP POLICY IF EXISTS` + `CREATE`).
3. Validar em staging (subir 2º condomínio fake, rodar smoke).
4. Deploy em prod fora de horário comercial.
5. Monitorar logs — se algum endpoint começar a falhar com "vazio inesperado", é falta de wrap em `withTenant` ou `withSuperAdmin`.

## Riscos

- **Médio:** algum endpoint não-coberto pelos PRs anteriores (auditoria pode ter perdido). Mitigação: revisão completa de `grep db.X.find` antes do deploy.
- **Baixo:** policy malformada bloquear queries legítimas. Mitigação: testar em staging primeiro.

## Não escopo

- Refazer testes de integração com RLS habilitado (próxima story).
- Adicionar audit log de bypass (próxima story).
