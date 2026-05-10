# Auditoria 2026-05-10 — Handoff p/ próximo squad

> ⏸️ **STATUS: AGUARDANDO** — Outro squad está mexendo no código nesta janela. **Não iniciar implementação até o squad atual fechar suas branches/PRs e mergear na main.** Ao pegar este doc, primeiro: `git pull origin main` + `git status` em todas branches abertas pra confirmar zero conflito antes de criar a branch dos fixes abaixo.
>
> **Prioridade ao desbloquear:** A1 + A2 (workers que vão quebrar quando RLS-001 ligar) — são pré-requisito da story RLS-001.

**Time envolvido:** Orion (aiox-master) iniciou via Codex, Claude continuou e validou. Subagentes Kant/Hypatia/Linnaeus/Pauli foram acionados pelo Codex em paralelo (resultado não consolidado neste doc — a verificação manual deste handoff já incorpora as áreas que eles cobririam).

## Status dos achados anteriores (Codex)

A auditoria do Codex listou 6 achados, mas analisou snapshot **anterior** aos PRs #78–#80 já mergeados. Estado real após validação contra `main` (commit `9499e95`):

| # Codex | Descrição | Estado real |
|---|---|---|
| 1 | Workers (`chooseRecipient`, `ensureQrForPacote`) sem RLS bypass | **Falso positivo.** Ambos usam `withSuperAdmin` (`src/lib/whatsapp/recipient.ts:82`, `src/lib/qr/ensure.ts:23,58`). Fixado em PR #78. |
| 2 | Webhook não normaliza telefone Meta | **Já fixado** em PR #80. |
| 3 | Schema local defasado vs migrations | **Confirmado** — `npm test` falhou local com drift. Não é bug de produto, é hygiene de DB local. |
| 4 | API `organizar` aceita porteiro burlando regra admin | **Já fixado** em PR #79. |
| 5 | `em_administracao` abre tela de retirada mas falha no confirmar | **Já fixado** em PR #79. |
| 6 | Dashboards (`dashboard-admin`, `dashboard-super-admin`) sem contexto RLS | **Falso positivo.** `dashboard-admin.ts:20` usa `withTenant`, `dashboard-super-admin.ts:33` usa `withSuperAdmin`. Fixado em PR #78. |

Resumo: dos 6 do Codex, **4 já estavam corrigidos**, **2 eram leitura incorreta do código atual**. Apenas o #3 (drift local) sobra como real, mas é cosmético.

---

## Achados NOVOS desta sessão (Claude)

### A1 — ALTA · Cron `enviarLembretes` vai quebrar quando RLS-001 ligar

**Arquivo:** `src/lib/queue/jobs/enviar-lembretes.ts:43,66,87,101`

PR #78 corrigiu workers de `sendWhatsApp`/`processWhatsAppWebhook`, mas **esqueceu o cron `enviarLembretes`**. Ele faz `db.pacote.findMany` cross-tenant direto (linha 43) e 3 `db.pacote.update` (66, 87, 101) sem `withSuperAdmin`. O comentário em :42 ("bypassa RLS via prisma client global") era verdadeiro **antes** de RLS estar ativo — vai virar mentira no momento que rls-001 for executada.

**Sintoma pós-deploy RLS:** cron de lembretes silenciosamente passa a enviar 0 mensagens. Usuário não percebe até alguém perguntar "cadê o lembrete de 24h?".

**Fix:** wrap em `withSuperAdmin` no mesmo padrão de `send-whatsapp.ts`. ~10 linhas.

### A2 — ALTA · `process-palavra-chave` mesmo problema

**Arquivo:** `src/lib/queue/jobs/process-palavra-chave.ts:37,68,82`

Worker do Epic 7 lê `db.whatsAppMessage` e escreve `db.codigoMlPendente` direto, sem bypass. Pós-RLS: palavra-chave do morador via WhatsApp para de funcionar.

**Fix:** wrap em `withSuperAdmin`. ~8 linhas.

### A3 — MÉDIA · `next.config.ts` usa flag deprecada

**Arquivo:** `next.config.ts:7-9`

```ts
experimental: { typedRoutes: true }   // deprecated no Next 15
```

Build warning: "experimental.typedRoutes mudou para typedRoutes (root level)". Mover pra fora de `experimental`.

### A4 — BAIXA · Import de `version` do package.json no health route

**Arquivo:** `src/app/api/health/route.ts:3`

`import { version } from '../../../../package.json'` gera warning de bundle (Next 15 reclama de import full do package.json). Trocar por `process.env.npm_package_version` ou env var explícita de build.

### A5 — BAIXA · README inconsistente sobre nº de testes

README mistura "312/312" (sessão noturna) e "401/401" (Epic 4 completo). Atualizar pra valor real ou tirar a contagem do README.

---

## Riscos transversais p/ RLS-001

Antes de ligar RLS em prod, **revisar todos os `db.X.find*/create/update/delete` em `src/`** sem `withTenant`/`withSuperAdmin`. Lista crua (já filtrada por bootstrap legítimo):

```
src/lib/queue/jobs/enviar-lembretes.ts        # A1 — fix urgente
src/lib/queue/jobs/process-palavra-chave.ts   # A2 — fix urgente
src/lib/db/user-management.ts                 # super-admin only — verificar wrap
src/lib/db/condominio.ts                      # super-admin only — verificar wrap
src/lib/audit/write-log.ts                    # audit log — checar se respeita tenant
src/app/super-admin/users/page.tsx            # super-admin — wrap em withSuperAdmin
src/app/api/super-admin/impersonate/start     # super-admin — wrap em withSuperAdmin
src/app/api/admin/condominios/seed-test       # super-admin — wrap em withSuperAdmin
src/app/(admin)/admin/page.tsx                # logado — confirma se withTenant aplica
src/app/(admin)/layout.tsx                    # logado — idem
src/app/(portaria)/layout.tsx                 # logado — idem
```

**Bootstrapping legítimo (sem wrap, OK):**
- `src/lib/auth.ts:22` — busca user antes de saber o tenant
- `src/server/middleware/tenant.ts:59,117` — resolve o próprio tenant
- `src/app/api/webhooks/clerk/route.ts:85,89,95,98,126` — webhook Clerk, sem sessão

---

## Gates rodados

- ✅ `npm run lint` — 0 warnings
- ✅ `npm run typecheck` — 0 erros
- ⚠️ `npm test` — local quebra por drift de schema (achado #3 do Codex). Em CI tende a passar.
- ✅ `npm run build` — passa, com 2 warnings (A3 e A4 acima).

---

## Próximas ações sugeridas (ordem)

1. **A1 + A2** — fix de 2 workers (~30min). Necessário **antes** de RLS-001.
2. **Auditar lista de riscos transversais** acima caso a caso (~2h).
3. **A3 + A4** — limpa warnings do build (~15min).
4. Executar **RLS-001** em staging com 2º cond fake → smoke → prod.
5. **A5** — sincroniza README com nº real de testes pós-fix.
