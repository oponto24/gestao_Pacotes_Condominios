# Plano de Revisao do Projeto — 2026-05-15

**Objetivo:** Limpar documentacao inutil, separar configs de ferramentas AI do projeto, e garantir que tudo que resta e real e util.

---

## Fase 1 — Separar AI Tool Configs do Projeto

**Problema:** 5 pastas de config de ferramentas AI na raiz (`.antigravity/`, `.codex/`, `.cursor/`, `.gemini/`, `.clerk/`) poluem o projeto. Sao 63+ arquivos de agent definitions duplicados entre ferramentas.

**Acao:**
- [x] Mover `.antigravity/`, `.codex/`, `.cursor/`, `.gemini/` para `.ai-tools/` (pasta consolidada)
- [x] Manter `.claude/` na raiz (necessario pro Claude Code funcionar)
- [x] Manter `.clerk/` na raiz (necessario pro Clerk SDK)
- [x] Atualizar `.gitignore` para refletir nova estrutura
- [x] `AGENTS.md` na raiz: avaliar se e util ou duplicacao do `.claude/CLAUDE.md`

## Fase 2 — Limpeza de Documentacao

**Problema:** Pastas com docs obsoletos, handoffs temporarios, e artefatos de sessoes passadas que nao servem mais.

### 2.1 — `docs/cleanup/` (artefatos de auditoria passada)
- [x] Avaliar: `architect-review.md`, `AUDIT-2026-05-10.md`, `CLEANUP-PLAN.md`, `po-review.md`, `QA-GATE.md`
- [x] Mover uteis para local adequado ou deletar se temporarios

### 2.2 — `docs/legacy/discovery-2026-05/`
- [x] `ideia-de-projeto.md` — historico, manter ou mover para pitch
- [x] `estudo-etiquetas-e-bipe.md` — pesquisa tecnica, avaliar relevancia
- [x] `README.md` — index, deletar se vazio

### 2.3 — `docs/planning/`
- [x] `2026-05-08-decisoes.md` — decisoes ativas? Se ja implementadas, arquivar
- [x] `2026-05-08-novos-requirements.md` — requirements ja incorporados no PRD?
- [x] `naming-brainstorm-2026-05-15.md` — brainstorm concluido? Deletar se sim

### 2.4 — `docs/design/`
- [x] `fab-chegada-mockup.html` — mockup HTML, util como referencia?
- [x] `fab-chegada-spec.md` — spec implementada? Se sim, pode arquivar

### 2.5 — `docs/qa/`
- [x] `e2e-specs/reenviar-whatsapp.md` — spec de teste ativa?
- [x] `test-designs/2.4-smoke-e2e.md` — design de teste, manter se util
- [x] `gates/*.gate.yaml` (30 arquivos) — QA gates das stories, manter

### 2.6 — Root files
- [x] `AGENTS.md` — duplicacao do CLAUDE.md, avaliar remoção
- [x] `CHANGELOG.md` — historico macro, manter

## Fase 3 — Scripts Cleanup

- [x] `scripts/test-extract-gemini.ts` — script de teste one-off, deletar
- [x] `scripts/test-extract-labels.ts` — script de teste one-off, deletar
- [x] `scripts/test-extract-via-entry.ts` — script de teste one-off, deletar
- [x] `scripts/dev/` e `scripts/smoke/` — manter (scripts operacionais)

## Fase 4 — Verificacao Final

- [x] `npm run lint` passa
- [x] `npm run typecheck` passa
- [x] `npm run build` passa
- [x] 450/450 testes passando
- [x] Git commit: `1db4571`

---

**Status:** CONCLUIDO em 2026-05-16

## Decisoes tomadas

| Item | Decisao | Motivo |
|------|---------|--------|
| `.antigravity/`, `.codex/`, `.cursor/`, `.gemini/` | Movidos para `.ai-tools/` (gitignored) | Separar configs AI do projeto |
| `.claude/` | Mantido na raiz | Necessario pro Claude Code funcionar |
| `.clerk/` | Mantido na raiz | Necessario pro Clerk SDK |
| `AGENTS.md` | Mantido (paths atualizados) | Entrypoint do Codex CLI (PO vetou remocao) |
| `docs/cleanup/` | Mantido integralmente | Trail de governanca da sprint de cleanup anterior |
| `docs/legacy/discovery-2026-05/` | Ja estava consolidado | Auditoria anterior ja moveu |
| `docs/planning/2026-05-08-decisoes.md` | Removido | Duplicata do ADR em `docs/decisions/` |
| `docs/planning/novos-requirements.md` | Mantido | Documento ativo com requirements futuros |
| `docs/planning/naming-brainstorm.md` | Mantido | Brainstorm ativo, pendente discussao com socios |
| `docs/design/` | Mantido | Spec FAB aprovada e ativa |
| `docs/qa/` | Mantido integralmente | Gates, specs e test designs ativos |
| `scripts/test-extract-*.ts` | Movidos para `scripts/dev/` | Consolidar com fixtures, corrigir import paths |
| `storage/` (raiz, vazia) | Removida | Docker usa volume nomeado, nao bind-mount |
| `CHANGELOG.md` | Mantido | Historico macro do projeto |
