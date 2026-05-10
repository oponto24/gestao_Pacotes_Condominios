# PO Review — Sprint Lean Cleanup
**Reviewer:** @po (Pax)
**Base:** AUDIT-2026-05-10.md + architect-review.md
**Data:** 2026-05-10

> Revisão de produto. Onde o Architect olha risco técnico/blast radius, o PO olha histórico de produto, rastreabilidade de decisão, onboarding e compliance. Nada é executado nesta fase.

---

## Resumo
- **OK_REMOVER:** 6
- **ARQUIVAR:** 11
- **VETO:** 4
- **Sem objeção (alinhado com architect):** 5 (consolidações puramente estruturais)

(26 itens; A6/A7, B2/D2, C4/E1 tratados como pares)

---

## Decisões por categoria

| Item | Veredicto PO | Justificativa de produto |
|---|---|---|
| A1 `ideia_de_projeto.md` | **ARQUIVAR** | Brief original do produto. É a "ata de nascimento" do sistema — útil pra onboarding de novo dev entender o "porquê" antes do PRD formal. Mover para `docs/legacy/discovery-2026-05/`, NUNCA remover. |
| A2 `estudo_etiquetas_e_bipe.md` | **ARQUIVAR** | Estudo discovery que originou decisão de IA. Rastreabilidade obrigatória — `docs/decisions/ai-model-comparison.md` referencia esse raciocínio. Vai pra `docs/legacy/discovery-2026-05/`. |
| A3 `modelos_de_etiquetas/*.jpeg` | **ARQUIVAR** | Evidência visual do discovery (4 transportadoras reais). Compõe o contexto de produto junto com A2. Mover junto com scripts B1 (architect já apontou o acoplamento). |
| A4 `pacote_teste.jpeg` | **ARQUIVAR (junto com B1)** | Fixture de script dev — sem valor de produto isolado, mas movimentação deve preservar histórico de testes manuais. |
| A4 `teste.jpeg` | **OK_REMOVER** | Órfão real, sem referência. Sem valor de produto. |
| A5 `docs/planning/2026-05-08-decisoes.md` | **ARQUIVAR (renomear ADR)** | **Decisão de produto crítica** (hierarquia operacional, palavra-chave, audit log). Mover pra `docs/decisions/2026-05-08-pos-epic4.md` é IDEAL — vira ADR formal. Nunca remover. |
| A6 `auditoria-2026-05-10-handoff.md` | **ARQUIVAR** | Handoff de auditoria — rastro de governança. Mover pra `docs/cleanup/handoffs/` mantém o trail. Sair de `docs/stories/` é OK (não é story canônica), mas preservar. |
| A7 `auditoria-ux-2026-05-10-handoff.md` | **ARQUIVAR** | Idem A6. |
| A8 `docs/qa/{e2e-specs,test-designs}/` | **Sem objeção** | Consolidação estrutural. Nenhum impacto de produto desde que os 2 arquivos sigam para `docs/qa/specs/` (não deletar conteúdo). |
| A9 `AGENTS.md` vs `.claude/CLAUDE.md` | **VETO em remoção** | Ambos são entrypoints de onboarding para CLIs diferentes. Concordo com architect: MANTER. Refactor de shared rules fica fora desta sprint. |
| A10 `pre-producao-checklist.md` "Já endereçado" | **VETO em remoção** | **CRÍTICO de compliance pré-produção.** Itens "✅ Já endereçado" são evidência de due diligence (LGPD, RLS, backup, quotas). Não limpar — é histórico de gates de release. Operação contínua só ADICIONA. |
| B1 `scripts/test-extract-*.ts` | **ARQUIVAR (manter como dev)** | Reproduzem decisão Gemini default. Mover para `scripts/dev/` preserva reprodutibilidade da decisão de produto. Não remover. |
| B2 `storage/` raiz | **OK_REMOVER** | Sem valor de produto. Architect confirmou volume nomeado no compose. |
| C1 `jsqr` | **OK_REMOVER** | Higiene técnica, zero impacto de produto. |
| C2 `pino-http` | **OK_REMOVER** | Idem. |
| C3 `@types/papaparse` (mover) | **OK_REMOVER (mover)** | Higiene. |
| C4/E1 `.env.example` AIOX | **VETO em remoção** | **Crítico de onboarding.** Novo contribuidor que clone o repo precisa do template para `aiox init`. Concordo com architect: MANTER. |
| D1 `docs/qa/{e2e-specs,test-designs}/` | **Sem objeção** | Vide A8. |
| D2 `storage/` | **OK_REMOVER** | Vide B2. |
| E2 `.github/agents/` | **VETO em remoção** | Onboarding multi-IDE — 12 `.agent.md` versionados são contrato com tooling externo (Copilot Chat). Architect concorda em manter. |
| E3 `.clerk/.tmp/` | **Sem objeção** | Já no .gitignore. No-op operacional. |
| E4 `.gemini/`, `.codex/`, `.cursor/`, `.antigravity/`, `.claude/` | **VETO em remoção** | Decisão consciente de produto (multi-IDE). Tirar qualquer um afeta workflow do time. |
| E5 `infra/scripts/*.sh` | **Sem objeção** | Operacionais, em uso. |
| E6 Migration `add_quotas_condominio` | **VETO ABSOLUTO em remoção** | Migrations Prisma são **histórico imutável** do schema de produto. Lei do projeto: nunca remover. |
| E7 `smoke-s4-*.csv` ausente | **Sem objeção** | Gap de runbook, fora desta sprint. Abrir issue @qa. |
| E8 `tsconfig.tsbuildinfo` | **OK_REMOVER (do tracking)** | Cache, sem valor de produto. |

---

## Vetos críticos (não pode sair)

1. **A10 `pre-producao-checklist.md` itens "Já endereçado"** — evidência de gates pré-prod (LGPD, RLS-001, backup, quotas, Meta WhatsApp). Compliance/auditoria. Crescer é OK; encurtar perde rastro de release.
2. **C4/E1 `.env.example` AIOX raiz** — onboarding novo contribuidor.
3. **E2 `.github/agents/`** — contrato externo multi-IDE.
4. **E6 Prisma migrations** — histórico imutável (regra absoluta do projeto).
5. **A9 `AGENTS.md` + `.claude/CLAUDE.md`** — entrypoints onboarding por CLI.
6. **E4 dotfolders de IDE** — decisão consciente multi-IDE.

> **Reforço:** Stories Done em `docs/stories/` NÃO entraram no AUDIT, mas reitero a regra: nunca remover. Eventual `docs/stories/done/` é opcional, não urgente.

---

## Sugestões de arquivamento (preservar mas mover)

Proposta de estrutura `docs/legacy/`:

```
docs/
├── legacy/
│   └── discovery-2026-05/           # Era pré-MVP, valor histórico de produto
│       ├── README.md                # "Por que este conteúdo está aqui"
│       ├── ideia-de-projeto.md      # ex A1 (raiz)
│       ├── estudo-etiquetas-e-bipe.md   # ex A2 (raiz)
│       └── samples/                 # ex A3 (modelos_de_etiquetas/)
│           ├── magalu.jpeg
│           ├── melhor-envio-1.jpeg
│           ├── melhor-envio-2.jpeg
│           └── super-frete.jpeg
├── decisions/
│   └── 2026-05-08-pos-epic4.md      # ex A5 (era docs/planning/)
├── cleanup/
│   └── handoffs/
│       ├── auditoria-2026-05-10.md       # ex A6
│       └── auditoria-ux-2026-05-10.md    # ex A7
└── qa/
    └── specs/                       # consolidação A8/D1
        ├── 2.4-smoke-e2e.md
        └── reenviar-whatsapp.md
```

**Regra de bolso pra `docs/legacy/`:**
- Cada subpasta tem um `README.md` curto explicando "o que isso era, por que foi superado, onde está o substituto canônico".
- Subpastas datadas (`discovery-2026-05/`, `pre-rls-2026-05/`, etc) — facilita arqueologia futura.
- Conteúdo em `docs/legacy/` NÃO é editado mais — é congelado.

**Fixtures de scripts (separado de legacy):**
```
scripts/
└── dev/
    ├── test-extract-labels.ts
    ├── test-extract-gemini.ts
    ├── test-extract-via-entry.ts
    └── fixtures/
        └── etiquetas/
            ├── magalu.jpeg
            ├── melhor-envio-1.jpeg
            ├── melhor-envio-2.jpeg
            ├── super-frete.jpeg
            └── pacote-teste.jpeg
```

> Architect já cobriu esse layout no PR #3 da ordem proposta — endosso integral.

---

## Endosso ao plano de PRs do Architect

A ordem proposta (PR#1 deps → PR#2 raiz → PR#3 fixtures+scripts → PR#4 docs) **respeita** as preocupações de produto:
- Histórico preservado em `docs/legacy/`
- ADR formalizada (A5)
- Handoffs de auditoria com trail intacto
- Stories Done sequer tocadas

**Única adição PO ao PR #4:** incluir um `docs/legacy/discovery-2026-05/README.md` curto explicando o conteúdo movido — onboarding-friendly.
