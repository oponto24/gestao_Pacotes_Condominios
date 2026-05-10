# Architect Review — Sprint Lean Cleanup
**Reviewer:** @architect (Aria)
**Base:** docs/cleanup/AUDIT-2026-05-10.md
**Data:** 2026-05-10

> Review técnico do AUDIT pré-cleanup. Decide **REMOVER / CONSOLIDAR / MANTER** sob ótica de risco e blast radius. Nada é executado nesta fase.

---

## Resumo

- **REMOVER:** 9
- **CONSOLIDAR:** 9
- **MANTER:** 8

(26 itens; A6/A7, B2/D2, C4/E1 são tratados como pares — contados uma vez do ponto de vista de decisão)

---

## Decisões por categoria

### A) Documentação

| Item | Decisão | Justificativa técnica |
|---|---|---|
| A1 `ideia_de_projeto.md` | **CONSOLIDAR** | Brief pré-PRD. Zero referências em código/config (grep limpo). Mover para `docs/legacy/discovery-2026-05/` preserva contexto histórico sem poluir raiz. Não remover puro — pode ser útil em retrospectiva. |
| A2 `estudo_etiquetas_e_bipe.md` | **CONSOLIDAR** | Idem A1. Decisão Gemini já cristalizada em `docs/decisions/ai-model-comparison.md` (PRD-aligned). Mover para `docs/legacy/discovery-2026-05/`. |
| A3 `modelos_de_etiquetas/*.jpeg` | **CONSOLIDAR (cuidado)** | **RISCO descoberto:** `scripts/test-extract-labels.ts` e `test-extract-gemini.ts` (B1) referenciam esses paths literais. Mover JPEGs **junto com** os scripts B1 para `scripts/dev/fixtures/etiquetas/` e atualizar paths nos scripts. NÃO mover isolado. |
| A4 `pacote_teste.jpeg` + `teste.jpeg` | **CONSOLIDAR (cuidado)** | Mesmo acoplamento de A3: `scripts/test-extract-via-entry.ts:13` lê `pacote_teste.jpeg` por default. Mover junto para `scripts/dev/fixtures/` ou similar e atualizar default no script. `teste.jpeg` aparenta ser órfão real — verificar antes de remover. |
| A5 `docs/planning/2026-05-08-decisoes.md` | **CONSOLIDAR** | Mover para `docs/decisions/2026-05-08-pos-epic4.md` e remover pasta `docs/planning/` (atualmente só conteúdo histórico). Acompanha convenção do projeto (ADRs ficam em `docs/decisions/`). |
| A6 `docs/stories/auditoria-2026-05-10-handoff.md` | **CONSOLIDAR** | Não segue convenção `{epic}.{story}.story.md`. Mover para `docs/cleanup/handoffs/` (esta sprint) ou `docs/audits/`. Confirmar status atual com user antes (pode estar obsoleto pós PRs #77-#91). |
| A7 `docs/stories/auditoria-ux-2026-05-10-handoff.md` | **CONSOLIDAR** | Idem A6. |
| A8 `docs/qa/{e2e-specs,test-designs}/` | **CONSOLIDAR** | Cada pasta tem 1 arquivo. Mesclar em `docs/qa/specs/` reduz fragmentação. Convenção QA do projeto centraliza em `docs/qa/gates/` (27 gates). |
| A9 `AGENTS.md` vs `.claude/CLAUDE.md` | **MANTER** | Cada um é entrypoint canônico do seu CLI (Codex/Claude). Extrair shared rules é refactor de framework AIOX (L2), fora do escopo desta sprint de cleanup. Risco>benefício. |
| A10 `pre-producao-checklist.md` seção "Já endereçado" | **MANTER** | Operação contínua (não cleanup pontual). Limpeza periódica feita pelo @pm. |

### B) Código morto

| Item | Decisão | Justificativa técnica |
|---|---|---|
| B1 `scripts/test-extract-*.ts` | **CONSOLIDAR** | Mover trio para `scripts/dev/` (não `scripts/smoke/` — não são smokes de release). Atualizar paths para fixtures movidas em A3/A4. Documentar em `docs/decisions/ai-model-comparison.md` o novo path. **Sem entrada em `package.json`** — manter como script manual. |
| B2 `storage/` (raiz) | **REMOVER** | **Confirmado:** `infra/docker/docker-compose.{yml,prod.yml}` usa **volume nomeado** (`storage:` / `app_storage:`) — não bind-mount do host. Dockerfile cria `/app/storage` no container (`Dockerfile:64`). Pasta vazia no host é vestigial. `git ls-files storage/` retorna vazio. Seguro remover. |

### C) Dependências

| Item | Decisão | Justificativa técnica |
|---|---|---|
| C1 `jsqr` (devDeps) | **REMOVER** | Zero imports em `src/`, `tests/`, `scripts/`, `workers/` (re-verificado). Story 4.2 sugeriu mas implementação real usa `html5-qrcode`. Seguro. |
| C2 `pino-http` (deps) | **REMOVER** | Zero imports. App usa `pino` direto via wrapper próprio. Seguro. |
| C3 `@types/papaparse` em `dependencies` | **REMOVER (mover)** | Higiene de packaging. `papaparse` runtime fica em `dependencies`; tipos para `devDependencies`. Sem impacto runtime. |
| C4/E1 `.env.example` (AIOX raiz) | **MANTER** | Template do framework AIOX. Pode ser regenerado por `aiox init`. Mover quebra onboarding de novos contribuidores que clonam o repo. Marcar com comentário no header já é suficiente (`.env.app.example` já avisa). |

### D) Estrutura de pastas

| Item | Decisão | Justificativa técnica |
|---|---|---|
| D1 `docs/qa/{e2e-specs,test-designs}/` | **CONSOLIDAR** | Vide A8 (mesmo item). |
| D2 `storage/` | **REMOVER** | Vide B2 (mesmo item). |

### E) Configs e infra

| Item | Decisão | Justificativa técnica |
|---|---|---|
| E1 `.env.example` AIOX | **MANTER** | Vide C4. |
| E2 `.github/agents/` | **MANTER** | 12 `.agent.md` versionados (`git ls-files .github/agents/`). Provavelmente lido por GitHub Copilot Chat ou tooling AIOX externo. **Sem evidência de ser tooling-dead.** Remover sem confirmar quebra contrato externo. |
| E3 `.clerk/.tmp/` no .gitignore | **REMOVER (do tracking)** | **Achado:** `.gitignore:47` já tem `/.clerk/`. Se arquivos `.clerk/.tmp/keyless.json` estão no FS mas não tracked, nada a fazer. Se tracked, `git rm --cached -r .clerk/`. Verificar com `git ls-files .clerk/` antes. |
| E4 `.gemini/`, `.codex/`, `.cursor/`, `.antigravity/`, `.claude/` | **MANTER** | Multi-IDE é decisão de produto consciente. Tamanho total <700K — não vale risco de quebrar workflow de quem usa cada IDE. |
| E5 `infra/scripts/*.sh` | **MANTER** | Todos em uso ativo (runbooks + npm scripts). |
| E6 Migration `add_quotas_condominio` | **MANTER** | Migrations Prisma **NUNCA removem-se** (regra absoluta). |
| E7 `smoke-s4-*.csv` ausente | **MANTER (investigar separado)** | Confirmado ausente em `docs/runbooks/exemplos/`. Não é cleanup — é gap de runbook. Issue separada para @qa, não bloqueia esta sprint. |
| E8 `tsconfig.tsbuildinfo` | **REMOVER (do tracking)** | **Achado:** `.gitignore:35` já tem `*.tsbuildinfo`. Se está no FS mas não tracked (`git ls-files | grep tsbuildinfo` veio vazio), arquivo é local e nada a fazer. Confirmar e fechar item. |

---

## Riscos descobertos na review

1. **A3/A4 ↔ B1 acoplados (crítico):** Os JPEGs da raiz são fixtures dos scripts `test-extract-*.ts`. Removê-los isoladamente quebra os scripts. **PR único** deve mover ambos junto e atualizar paths nos `.ts`.

2. **B2/D2 false-alarm potencial parcial:** `storage/` na raiz é vazia E não tracked (`git ls-files storage/` vazio). Não há nada a fazer no Git — só `rmdir` local opcional. **Cuidado:** alguns devs podem ter criado a pasta manualmente esperando bind-mount; documentar no PR que compose usa volume nomeado.

3. **E3/E8 já cobertos pelo .gitignore:** A auditoria reportou como ação. Verificação confirma que ambos padrões **já estão** no `.gitignore`. Item virou no-op — só validar que nada foi commitado por engano antes do gitignore (provavelmente nada, `git ls-files` limpo).

4. **`.github/agents/` é tracked com 12 arquivos:** Não é candidato a remoção. AUDIT sugeriu "investigar" — minha decisão: manter, sem evidência de quebra.

5. **`teste.jpeg` (separado de `pacote_teste.jpeg`):** Não aparece nos scripts. Provável artefato real órfão. Confirmar com `grep -r "teste\.jpeg"` antes de remover (já feito — só AUDIT cita). **Pode remover puro.**

---

## Recomendação de ordem dos PRs (Fase 3)

Ordem por **risco crescente** e independência (cada PR fecha-se):

1. **PR #1 — Dependências (risco BAIXÍSSIMO, blast radius zero)**
   - Remover `jsqr` (C1) e `pino-http` (C2) de `package.json`
   - Mover `@types/papaparse` para `devDependencies` (C3)
   - Validar: `npm install && npm run typecheck && npm test`

2. **PR #2 — Limpeza de raiz (risco BAIXO)**
   - Remover `teste.jpeg` (órfão isolado de A4)
   - Remover diretório vazio `storage/` (B2/D2) — não tracked
   - `git rm --cached` em `tsconfig.tsbuildinfo` e `.clerk/.tmp/*` **se** tracked (provavelmente no-op)

3. **PR #3 — Mover fixtures + scripts dev (risco MÉDIO, acoplado)**
   - Criar `scripts/dev/fixtures/etiquetas/`
   - Mover `modelos_de_etiquetas/*.jpeg` (A3) + `pacote_teste.jpeg` (A4) para fixtures
   - Mover `scripts/test-extract-*.ts` (B1) para `scripts/dev/`
   - Atualizar paths nos 3 scripts (5 referências)
   - Atualizar `docs/decisions/ai-model-comparison.md`
   - Validar: rodar 1 script manualmente com `tsx scripts/dev/test-extract-gemini.ts`

4. **PR #4 — Reorganização de docs (risco BAIXO)**
   - Criar `docs/legacy/discovery-2026-05/` e mover `ideia_de_projeto.md` (A1) + `estudo_etiquetas_e_bipe.md` (A2)
   - Mover `docs/planning/2026-05-08-decisoes.md` → `docs/decisions/2026-05-08-pos-epic4.md` (A5); remover pasta `docs/planning/` se vazia
   - Mover `docs/stories/auditoria-*-handoff.md` (A6/A7) → `docs/cleanup/handoffs/` **após confirmação user**
   - Consolidar `docs/qa/{e2e-specs,test-designs}/` → `docs/qa/specs/` (A8/D1)

5. **(Fora desta sprint)** A9 shared rules AIOX, A10 limpeza checklist contínua, E7 gap smoke-s4.

---

**Ordem racional:** começa por changes _puramente_ em `package.json` (PR #1, reversível em 1 commit), depois remoções não-tracked (PR #2, sem impacto Git), depois moves acoplados que exigem editar código (PR #3), e por fim a reorganização documental que toca mais arquivos mas zero código (PR #4).
