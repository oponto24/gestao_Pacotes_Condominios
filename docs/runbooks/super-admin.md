# Runbook — Super-Admin

> **Story:** 2.1 (CRUD Condominio) | **Owner:** Dev (Dex) | **Última atualização:** 2026-05-06

## Quem é super_admin

Usuário com `role='super_admin'` e `condominio_id=NULL`. Criado pelo seed
(story 1.10) com `clerk_id='pending_clerk_link_<hash>'`. Ao logar via Clerk
pela primeira vez, o webhook reconcilia por email — preserva `role` e
`condominio_id`.

**Override manual em dev:**
```bash
docker compose -f infra/docker/docker-compose.yml exec postgres psql -U app gestao_pacotes \
  -c "UPDATE \"user\" SET role='super_admin', condominio_id=NULL WHERE email='seu@email.com';"
```

## CRUD de Condomínios

UI: `http://localhost:3000/super-admin/condominios` (acesso negado para
admin/porteiro — redireciona para `/`).

### API REST

| Método | Path | Propósito |
|---|---|---|
| `GET` | `/api/admin/condominios` | Lista paginada com `_count.unidades` e `_count.moradores` |
| `GET` | `/api/admin/condominios/[id]` | Detalhe com `_count` completo |
| `POST` | `/api/admin/condominios` | Cria — valida CNPJ único global |
| `PATCH` | `/api/admin/condominios/[id]` | Update parcial |
| `DELETE` | `/api/admin/condominios/[id]` | **Soft delete** (seta `deleted_at`, NÃO DELETE físico) |
| `POST` | `/api/admin/condominios/[id]/restore` | Reverte soft delete |

**Query params do list:** `?page=1&pageSize=20&q=<busca>&include_arquivados=false`

### Arquivar vs deletar

- **Arquivar** (`DELETE`): seta `deleted_at`, `ativo=false`. Preserva FKs em
  unidades/moradores/pacotes históricos. Reversível via restore.
- **Deletar fisicamente:** **não suportado.** Se realmente necessário (LGPD),
  fazer manualmente via SQL após análise de impacto.

### Restaurar arquivado

```bash
curl -X POST http://localhost:3000/api/admin/condominios/<id>/restore \
  -H "Cookie: <clerk_session>"
```

Ou pela UI: clicar "Mostrar arquivados" → botão "Restaurar" na linha.

## Validação de inputs

`src/lib/validators/condominio.ts` (Zod):

| Campo | Regra | Normalização |
|---|---|---|
| `nome` | 3-200 chars | trim |
| `cnpj` | regex (formatado ou 14 dígitos), opcional, **unique global** | remove pontuação |
| `endereco` | 5-300 chars | trim |
| `cep` | regex (formatado ou 8 dígitos) | remove pontuação |
| `cidade` | 2-100 chars | trim |
| `estado` | 2 chars **uppercase** (UF) | — |
| `contato_nome` | 3-200 chars | trim |
| `contato_telefone` | E.164 ou BR formatado | normaliza para E.164 (`+55XXXXXXXXXXX`) |
| `contato_email` | email válido, opcional | trim |

**Nota:** validação de **dígito verificador CNPJ** está fora de escopo
(MVP). Considerar `validation-br` em story futura se necessário.

## Smoke endpoint (DEV ONLY)

`POST /api/admin/condominios/seed-test` cria/garante "Edifício Demo" para
teste rápido sem preencher form. Idempotente. Bloqueado em prod.

```bash
curl -X POST http://localhost:3000/api/admin/condominios/seed-test \
  -H "Cookie: <clerk_session>"
```

## Permissões

| Endpoint | super_admin | admin | porteiro | Anônimo |
|---|---|---|---|---|
| `/super-admin/condominios` (UI) | ✅ | redirect | redirect | redirect |
| `GET/POST/PATCH/DELETE /api/admin/condominios/*` | ✅ | 403 | 403 | 401 |

Guard centralizado: `src/lib/api/super-admin-guard.ts`. Cada endpoint chama
`await requireSuperAdmin()` no início do `try`.

## Próximas evoluções

- Story 2.2: CRUD Setor (admin do condomínio, scoped por tenant)
- Story 2.3: CRUD Unidade
- Story 2.4: CRUD Morador
- Story 8.1: SuperAdminLayout dedicado + lista de tenants no menu
- Story 8.3: audit_log de ações sensíveis (criar/arquivar condomínio)
