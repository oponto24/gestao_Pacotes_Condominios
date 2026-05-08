# Fluxo de match Etiqueta ↔ Morador

> **Status:** Implementação atual (story 3.7) + propostas de refinamento UX (2026-05-08)
> **Código:** `src/lib/matching/match-unidade-morador.ts`, `src/lib/matching/parse-complemento.ts`, `src/lib/matching/normalize-name.ts`
> **Owner:** Gustavo Silva

## TL;DR

O fluxo "**bater apto/bloco PRIMEIRO, nome DEPOIS dentro do apto**" — sugerido pelo PO em 2026-05-08 — **já está implementado** desde a story 3.7. Este doc explica como ele funciona hoje e quais são os 3 refinamentos de UX/produto que vale aplicar agora pra deixá-lo "redondo".

---

## Como funciona hoje (já em produção)

```
Foto da etiqueta
      │
      ▼
[Worker BullMQ extractLabel]
      │  Claude Haiku 4.5 vê a imagem
      ▼
JSON estruturado: { nome_destinatario, complemento, cep, ... }
      │
      ▼
[matchUnidadeMorador (determinístico, sem IA)]
      │
      ▼
   ┌──────────────────────────────────┐
   │ 1. parseComplemento(complemento) │  → { apto: "31", bloco: null }
   └──────────────────────────────────┘
      │
      ▼
   ┌──────────────────────────────────┐
   │ 2. Filtra unidades onde          │
   │    identificador = "31"          │  → 1 unidade (ou múltiplas, ou nenhuma)
   │    AND bloco bate (se houver)    │
   └──────────────────────────────────┘
      │
      ├─ 0 candidatas    → pending/unidade_nao_encontrada (porteiro confirma)
      ├─ 2+ candidatas   → pending/ambiguous_unidade (porteiro escolhe)
      ▼
   1 candidata (apto+bloco únicos)
      │
      ▼
   ┌──────────────────────────────────┐
   │ 3. Filtra moradores DAQUELA      │
   │    unidade                       │  → [Gustavo Silva, ...]
   └──────────────────────────────────┘
      │
      ▼
   ┌──────────────────────────────────┐
   │ 4. Busca melhor match por nome   │
   │    nameSimilarity(IA, morador)   │  → score 0..1 (Levenshtein)
   │    threshold ≥ 0.7               │
   └──────────────────────────────────┘
      │
      ├─ score ≥ 0.7    → matched/destinatario_cadastrado ✅
      │                    notifica diretamente o morador
      │
      ▼
   nenhum nome bate
      │
      ▼
   ┌──────────────────────────────────┐
   │ 5. Fallback: pega o morador      │
   │    is_principal = true do apto   │
   └──────────────────────────────────┘
      │
      ├─ achou principal → matched/fallback_principal ✅
      │                     notifica o principal: "chegou pacote, mas
      │                     o nome não bate com nenhum morador cadastrado"
      │
      ▼
   sem principal      → pending/no_morador (porteiro confirma manual)
```

### Resumo das saídas

| Resultado | Significado | Ação do sistema |
|---|---|---|
| `matched/destinatario_cadastrado` | IA leu nome + apto OK, nome casa com morador cadastrado | Notifica o morador direto |
| `matched/fallback_principal` | Apto bate, nome não casa com ninguém — provável visitante/familiar | Notifica o principal do apto |
| `pending/no_complemento` | IA não conseguiu ler apto na etiqueta | Porteiro digita apto manual |
| `pending/unidade_nao_encontrada` | Apto extraído não existe no condomínio | Porteiro confirma se existe (pode ser typo OCR) |
| `pending/ambiguous_unidade` | Apto+bloco resulta em 2+ unidades (ex: "Apto 31" sem bloco em condo com 2 torres) | Porteiro escolhe |
| `pending/no_morador` | Apto existe mas não tem nenhum morador cadastrado | Porteiro confirma + sugere cadastrar |

---

## Algoritmo de similaridade de nomes

```ts
// src/lib/matching/normalize-name.ts
nameSimilarity("Gustavo Silva", "GUSTAVO DA SILVA")  → ~0.85 (match)
nameSimilarity("J. Pereira",   "Joao Pereira")       → ~0.75 (match — pega "ireira" comum)
nameSimilarity("Ana Costa",    "Joao Pereira")       → ~0.10 (sem match)
```

Algoritmo: Levenshtein normalizado (1 - dist/maxLen) sobre nomes lowercase + sem acento + sem pontuação. Threshold 0.7. Funciona bem em PT-BR pra:
- Variantes com/sem "da/de/dos" (Joao da Silva ↔ Joao Silva)
- Pequenos erros de OCR (Joao ↔ João)
- Nome abreviado (J. Pereira ↔ Joao Pereira)

⚠️ **Limitações conhecidas:** dois moradores no mesmo apto com sobrenome igual (irmãos, casal) podem ambos passar do threshold. O sistema pega o de **maior score**. Caso de empate é raro mas vale futura melhoria.

---

## Refinamentos propostos (2026-05-08)

### Refinamento 1 — Sinalizar visualmente o `fallback_principal`

**Problema:** quando cai em `fallback_principal`, hoje o sistema só vincula o pacote ao principal sem deixar claro pro porteiro/morador que o nome da etiqueta não bateu.

**UX proposta:** na tela `/chegada/confirmar/[pacote_id]` mostrar:

```
┌─────────────────────────────────────────────┐
│ 🟡 Apto 31 — destinatário não cadastrado    │
│                                             │
│ A etiqueta diz: "Maria Costa"               │
│ Moradores do apto 31: Gustavo Silva         │
│                                             │
│ ⓘ Notificação será enviada para o morador  │
│   principal (Gustavo Silva) avisar que     │
│   chegou pacote pra outra pessoa do apto.  │
│                                             │
│   [ Confirmar ]  [ Trocar destinatário ]   │
└─────────────────────────────────────────────┘
```

**Backend:** já temos `resolvido_via: 'fallback_principal'` + `flags.complemento_extraido`. Falta só passar pro front.

**Estimativa:** pequena (~2h dev + design). Fica como story 3.13.

### Refinamento 2 — Mensagem WhatsApp diferenciada no fallback

**Problema:** quando o pacote vai pro principal porque o nome não casou, o template de WhatsApp deve avisar a situação — não passar como se fosse pacote do próprio principal.

**Templates atuais (todos): "Olá {nome}, chegou um pacote pra você na portaria!"**

**Templates propostos:**
- `pacote_chegou_destinatario_cadastrado` (atual): "Olá {nome}, chegou um pacote pra você..."
- `pacote_chegou_morador_nao_cadastrado` (novo): "Olá {nome_principal}, chegou um pacote no apto {apto} endereçado a **{nome_etiqueta}**. Como ele(a) não está cadastrado(a), notificamos você como responsável pelo apto. Combine a retirada com a pessoa."

**Onde mexer:**
- Adicionar template no enum (Epic 4 / Meta WhatsApp)
- Lógica de seleção de template no worker `notifyChegada` (Epic 4)
- **Não bloqueia o MVP** — pode entrar quando Epic 4 for implementado

**Estimativa:** trivial (mudança de string + branch). Fica como ajuste dentro da story 4.3.

### Refinamento 3 — Prompt da IA priorizar apto/complemento

**Problema:** IA hoje extrai todos os campos com a mesma "atenção". Se a etiqueta corta o apto (foto cortada, dobra, etc), IA pode retornar `complemento: null` sem tentar muito.

**Proposta:** adicionar ao prompt instrução explícita de **caçar apto** mesmo em locais incomuns (manuscrito, riscado a caneta sobre etiqueta impressa, anotação à parte). Exemplos no prompt:
- Manuscrito sobre etiqueta: "31 - GUSTAVO" (caso real do nosso teste)
- Etiqueta SEM campo "Complemento" mas endereço fala "Rua X 123 apto 31"
- Anotação rabiscada na parte de cima/baixo da etiqueta

**Onde mexer:** `src/lib/anthropic/prompts/label-extraction.ts` (já refinado em 2026-05-08, mas pode ser ainda mais explícito sobre apto manuscrito).

**Estimativa:** 30min + re-rodar `scripts/test-extract-labels.ts` pra confirmar acurácia mantida.

---

## Métricas de produto (a instrumentar)

Pra saber se o flow está bom em produção, capturar % de cada caso:

| Métrica | Meta |
|---|---|
| `% matched/destinatario_cadastrado` | > 70% (caminho ideal) |
| `% matched/fallback_principal` | < 20% (visitantes/familiares são minoria) |
| `% pending/no_complemento` | < 10% (etiqueta sem apto) |
| `% pending/unidade_nao_encontrada` | < 5% (apto digitado/cadastrado errado) |
| Tempo médio bipe→notificação | < 30s |

Adicionar logger/telemetria no worker `extractLabel` + `match-unidade-morador` (já tem alguns logs).

---

## Próximos passos sugeridos

1. ✅ **Já feito:** flow base (story 3.7), prompt refinado (2026-05-08), bug volume permission (PR #51)
2. ⏳ **Próximo PR:** UX do fallback_principal (Refinamento 1)
3. ⏳ **Quando Epic 4 entrar:** template WhatsApp diferenciado (Refinamento 2)
4. ⏳ **Continuous:** instrumentar métricas + revisar amostra mensal
