# Cleanup Plan — Sprint Lean 2026-05-10

**Status:** Aprovado para execução (Fase 3)
**Base:** `AUDIT-2026-05-10.md` + `architect-review.md` + `po-review.md`

## Convenção de decisão final
A decisão final combina Architect (técnica) + PO (produto). VETO do PO sempre prevalece.

---

## PR #1 — Dependências (zero blast radius)
**Branch:** `chore/cleanup-deps`
**Risco:** baixíssimo

- Remover `jsqr` de devDependencies (zero imports — story 4.2 não usa)
- Remover `pino-http` de dependencies (zero imports — só `pino` direto é usado)
- Mover `@types/papaparse` de `dependencies` → `devDependencies` (higiene)
- Rodar `pnpm install` (ou npm) e commitar lockfile

**Validação:** build, typecheck, testes passam.

---

## PR #2 — CANCELADO (no-op)
Verificado durante execução: `teste.jpeg` já está gitignored (`.gitignore:55 /*.jpeg`) e `storage/` nunca foi tracked (recriado em runtime pelo `LocalStorageDriver`). `.tsbuildinfo` e `/.clerk/` também já no gitignore. Nada a commitar. Itens removidos do escopo da sprint.

---

## PR #3 — Fixtures + scripts de dev (acoplados)
**Branch:** `chore/cleanup-dev-fixtures`
**Risco:** médio (5 paths editados em scripts)

- Criar `scripts/dev/fixtures/etiquetas/`
- Mover para lá: `pacote_teste.jpeg`, `modelos_de_etiquetas/melhor-envio.jpeg`, `modelos_de_etiquetas/magalu.jpeg`, `modelos_de_etiquetas/superfrete.jpeg`, etc.
- Atualizar paths nos scripts `scripts/test-extract-*.ts` (5 referências)
- Remover diretório `modelos_de_etiquetas/` da raiz após mover

**Validação:** rodar pelo menos 1 script `test-extract-*` para confirmar paths funcionam.

---

## PR #4 — Documentação (consolidação + arquivamento)
**Branch:** `chore/cleanup-docs`
**Risco:** baixo (só move arquivos, não remove conteúdo)

### Criar `docs/legacy/discovery-2026-05/`
Com `README.md` explicando "discovery pré-PRD, congelado, conteúdo absorvido pelo PRD formal":
- Mover `ideia_de_projeto.md` → `docs/legacy/discovery-2026-05/ideia-de-projeto.md`
- Mover `estudo_etiquetas_e_bipe.md` → `docs/legacy/discovery-2026-05/estudo-etiquetas-e-bipe.md`

### Promover A5 a ADR formal
- Criar `docs/decisions/2026-05-08-pos-epic4.md` com decisão de produto pós-Epic 4

### Arquivar handoffs de auditoria
- Mover `auditoria-*-handoff.md` de `docs/stories/` para `docs/cleanup/handoffs/` (PRs #77-#91 já endereçaram)

### Consolidar planning antigos
- Identificar planning docs duplicados/superados pelo PRD e mover para `docs/legacy/`

**NÃO TOCAR (vetos PO):**
- `pre-producao-checklist.md` seção "Já endereçado" — compliance/auditoria
- `.env.example` raiz — onboarding
- `.github/agents/` — contrato externo
- Prisma migrations — histórico imutável
- `AGENTS.md`, `.claude/CLAUDE.md` — entrypoints onboarding
- Dotfolders IDE (multi-IDE consciente)
- `MEMORY.md` files — contexto operacional IA

---

## Fora do escopo desta sprint
- A9 (shared rules AIOX) — discussão de framework
- A10 (checklist contínuo) — não é cleanup
- E7 (gap smoke-s4) — task separada, não enxugamento

---

## Ordem de execução (Fase 3 — @dev)
1. PR #1 (deps) — merge antes do resto
2. PR #2 (raiz) — independente
3. PR #3 (fixtures+scripts) — independente
4. PR #4 (docs) — pode esperar revisão visual

Cada PR isolado, atômico, com rollback fácil.

## Métricas alvo
- ~3 deps a menos no `package.json`
- ~600-800 KB de fixtures fora da raiz
- ~10-15 docs reorganizados (não removidos)
- 0 código de produção tocado
