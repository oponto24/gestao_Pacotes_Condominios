# QA Gate — Sprint Lean Cleanup
**Reviewer:** @qa (Quinn)
**Data:** 2026-05-10
**Branches avaliadas:** chore/cleanup-deps, chore/cleanup-dev-fixtures, chore/cleanup-docs (PRs #92, #93, #94)

## Verdict global
**PASS**

Os três PRs são cleanup de baixo risco, com escopo cirúrgico, sem regressão observável vs. baseline de `main`. Aprovados para merge.

## Por PR

### PR #92 (deps) — `chore/cleanup-deps`
- **Verdict:** PASS
- **Commits:** 1 (`f5551f6 chore(deps): remove jsqr e pino-http, move @types/papaparse pra devDeps`) — convencional, escopo correto
- **Diff stat:** `package.json` (+1/-3 deps) + `package-lock.json`. Nenhum código tocado.
- **typecheck:** ✅ passou (`tsc --noEmit` limpo)
- **lint:** ✅ `No ESLint warnings or errors`
- **testes:** ✅ **431/434 passa, 3 falhas pré-existentes em `tests/integration/clerk-webhook.test.ts`** — bate exatamente com baseline informado pelo dev. Nenhuma regressão.
- **grep órfãos:** ✅ `grep -rn "jsqr\|pino-http" src/ tests/ scripts/` vazio. Remoção é segura — nada importa esses pacotes.
- **Notas:** `@types/papaparse` movido pra `devDependencies` consistente com uso (apenas type-only). `npm install` idempotente, lockfile já refletido no commit.

### PR #93 (fixtures) — `chore/cleanup-dev-fixtures`
- **Verdict:** PASS
- **Commits:** 1 (`51b2fab chore(scripts): move fixtures de etiquetas para scripts/dev/fixtures/`) — convencional
- **Diff stat:** 5 JPEGs movidos + 3 scripts atualizados (10 linhas cada em test-extract-{labels,gemini}.ts e 1 linha em test-extract-via-entry.ts)
- **typecheck:** ✅ passou
- **grep paths antigos (`modelos_de_etiquetas`):** ✅ zero matches. Todos os refs a `pacote_teste.jpeg` apontam pra `scripts/dev/fixtures/etiquetas/` (caminho novo)
- **Fixtures presentes:** ✅ `magalu.jpeg`, `melhorEnvio1.jpeg`, `melhorEnvio2.jpeg`, `pacote_teste.jpeg`, `superFrete.jpeg` em `scripts/dev/fixtures/etiquetas/`
- **Scripts parse-check:** ✅ `node --check` nos 3 scripts (sintaxe TS válida)
- **Notas:** Reorganização cosmética dentro de `scripts/`. Sem impacto em build/runtime de produção.

### PR #94 (docs) — `chore/cleanup-docs`
- **Verdict:** PASS
- **Commits:** 1 (`3312e02 docs: consolida discovery legado e formaliza ADR pos-Epic 4`) — convencional
- **Diff stat:** +497/-0, somente arquivos `.md`. Cria `docs/legacy/discovery-2026-05/`, `docs/decisions/2026-05-08-pos-epic4.md` e move handoffs de auditoria pra subpasta `handoffs/`.
- **typecheck:** ✅ passou (esperado — só docs)
- **Arquivos essenciais intocados:** ✅ grep contra `README.md`, `docs/prd/`, `docs/architecture/`, `docs/stories/ROADMAP.md`, `AGENTS.md`, `.claude/`, `.github/agents/`, `prisma/migrations/`, `MEMORY.md`, `pre-producao-checklist.md`, `.env.example` → **zero matches** no diff. Nada crítico foi mexido.
- **Arquivos esperados criados:** ✅ `docs/legacy/discovery-2026-05/README.md` e `docs/decisions/2026-05-08-pos-epic4.md` existem
- **Notas:** Move de arquivos preservado pelo git como rename (subpastas `handoffs/` e `discovery-2026-05/`). Histórico mantido.

## Riscos residuais
1. **Baixo:** `pino-http` foi removido apesar de `pino` continuar no projeto. Se houver instalação futura de logger HTTP, precisará reinstalar. Não é regressão — só uma dependência que estava órfã.
2. **Baixo:** Fixtures em `scripts/dev/fixtures/etiquetas/` (~200KB) seguem no repo. Cleanup move mas não enxuga peso. Aceitável — são úteis pra debug de extração de etiquetas.
3. **Nenhum risco operacional** observado. As 3 branches são independentes (não conflitam entre si — modificam arquivos distintos).
4. **Aviso conhecido (não bloqueia):** `next lint` deprecated em Next 16. Já estava em main; não introduzido pelo cleanup.

## Recomendação ao user
- **Ordem de merge sugerida (irrelevante por independência, mas pra rastreabilidade):**
  1. **#94 (docs)** primeiro — zero risco, só `.md`
  2. **#93 (fixtures)** — toca apenas `scripts/`, sem impacto em produção
  3. **#92 (deps)** por último — única que mexe em `package.json`/`lock`; merge final dispara CI de instalação

- **Itens a confirmar antes de mergear:**
  - CI verde em cada PR (gh checks)
  - Nenhum revisor humano com pendência aberta
  - Após merge final, rodar `npm ci` local na `main` atualizada pra confirmar lockfile coerente

- **Pós-merge:** smoke rápido em prod só faz sentido se outro PR de runtime entrar junto. Estes 3 são no-op de runtime.
