# Comparação de modelos Claude — Extração de etiqueta

> **Status:** Decisão atual. Manter Haiku 4.5 como default no MVP.
> **Última atualização:** 2026-05-08
> **Owner:** Gustavo Silva

## TL;DR

| Modelo | Custo/foto | Custo/condo/ano* | Acurácia | Tempo | Decisão |
|---|---:|---:|---|---:|---|
| **Haiku 4.5** | $0.0049 | $54 | 2/5 perfeito (1 grave: nome inventado) | ~2.2s | ✅ **Default no MVP** |
| **Sonnet 4.6** | $0.0146 | $160 | 3/5 perfeito | ~3-5s | 🟡 Reserva (fallback futuro) |
| **Opus 4.7** | $0.0908 | $1.000 | 4/5 perfeito | ~5.3s | ❌ Custo desproporcional |

\* Estimativa: 30 pacotes/dia × 365 dias = 11k fotos/ano por condomínio.

**Decisão:** Haiku 4.5 segue como default. Quando o produto crescer e tivermos margem, considerar **Haiku como primeiro pass + Sonnet como fallback** para confiança < 0.7. Opus não compensa — Sonnet entrega quase a mesma qualidade por 1/6 do custo.

---

## Metodologia

5 etiquetas reais foram processadas pelos 3 modelos com **mesmo prompt** (`src/lib/anthropic/prompts/label-extraction.ts`, versão refinada 2026-05-08) e mesma temperatura (0 — determinístico, exceto Opus que não suporta).

Etiquetas testadas:
1. **Magalu** — caixa com etiqueta padronizada Magalu Entregas
2. **Melhor Envio 1 (SEDEX)** — caixa com etiqueta Melhor Envio + logo Correios. Remetente em fonte mais grossa que destinatário (pegadinha)
3. **Melhor Envio 2 (PAC)** — caixa com etiqueta padrão Melhor Envio
4. **SuperFrete (Loggi)** — caixa com etiqueta Loggi/SuperFrete (única com apto/bloco)
5. **Mercado Livre Flex** — saco plástico, etiqueta sem logo grande, com apto manuscrito

Script reproduzível: `scripts/test-extract-labels.ts`. Rodar com `COMPARE=1 npx tsx scripts/test-extract-labels.ts` para Haiku+Sonnet, ou `ANTHROPIC_MODEL=claude-opus-4-7` para Opus.

---

## Resultados detalhados

### Etiqueta 1 — Magalu (CEP real: `13481-806`)

| Modelo | Nome | Endereço | CEP | Remetente | Conf |
|---|---|---|---|---|---|
| Haiku | ✅ Marcelo Ferreira Gomes | ✅ Vital Brasil Rodrigues Aguiar, 438 | ❌ `13418-906` (2 dígitos errados) | ❌ "29BEST OSASCO" | 0.92 |
| Sonnet | ✅ | ✅ | ❌ `13481-006` (1 dígito) | ✅ "25BEST OSASCO" | 0.82 |
| Opus | ✅ | ✅ | ❌ `13481-006` (1 dígito) | ✅ | 0.85 |

### Etiqueta 2 — Melhor Envio 1 / SEDEX (real: `Raphael Feitosa`, `Rua Aderaldo Vasconcelos Diniz, 66`, `58415-605`)

> **Pegadinha:** o remetente "Mauro Sergio Da Silva Prado" aparece em fonte grossa em CAIXA ALTA. O destinatário "Raphael Feitosa" está em fonte normal.

| Modelo | Nome | Endereço | CEP | Conf |
|---|---|---|---|---|
| Haiku | ❌🚨 **"Fabio Alves"** (nome inventado!) | ❌ "Adalberto Vasconcelos Dirtz, 65" | ❌ `56410-000` | 0.88 |
| Sonnet | ✅ Raphael Feitosa | ✅ Aderaldo Vasconcelos Diniz, 66 | ✅ `58415-605` | 0.82 |
| Opus | ✅ | ✅ | ✅ | 0.88 |

🚨 **Caso crítico:** Haiku alucinou um nome ("Fabio Alves" não está na etiqueta). Em produção isso geraria: pacote registrado em nome de pessoa inexistente → fallback pro principal → notificação errada → perda de confiança do síndico.

### Etiqueta 3 — Melhor Envio 2 / PAC (real: `Jacilane De Holanda Rabelo Rabelo`, número `1746`, CEP `62901-490`)

| Modelo | Número rua | CEP | Complemento (deve ser null) |
|---|---|---|---|
| Haiku | ❌ 1748 | ❌ 62901-480 | ✅ null |
| Sonnet | ✅ 1746 | ✅ 62901-490 | ❌ "Yoiranga" (era o bairro Ypiranga) |
| Opus | ✅ | ✅ | ✅ null |

### Etiqueta 4 — SuperFrete/Loggi (única com apto)

| Modelo | Apto/Bloco extraído | Transportadora | Conf |
|---|---|---|---|
| Haiku | ✅ "AP 1304 BL 3" | ✅ loggi | 0.95 |
| Sonnet | ✅ | 🟡 super_frete (também válido) | 0.93 |
| Opus | ✅ | 🟡 super_frete | 0.95 |

### Etiqueta 5 — Mercado Livre Flex (sem logo grande, apto manuscrito)

| Modelo | Tudo | Conf |
|---|---|---|
| Haiku | ✅ Gustavo Silva, Rua Francisca Júlia 229, 02403-010, AP 31, mercado_livre | 0.92 |
| Sonnet | ✅ | 0.88 |
| Opus | ✅ | 0.90 |

---

## Score consolidado

| Modelo | Etiquetas perfeitas | Erros graves | Erros leves | Velocidade |
|---|---|---|---|---|
| **Haiku 4.5** | 2/5 (Loggi, ML) | 1 (nome inventado) | 3 (CEP/número) | 2.2s |
| **Sonnet 4.6** | 3/5 (Loggi, ML, MEnv1) | 0 | 2 (CEP, complemento confuso) | 3-5s |
| **Opus 4.7** | 4/5 | 0 | 1 (complemento) | 5.3s |

> **Nota sobre confiança auto-reportada:** os 3 modelos retornam confiança próxima (0.85-0.95) mesmo quando erram. Não confiar cegamente — usar como sinal apenas, validar com regras adicionais (ViaCEP, match com unidade no banco).

---

## Custo escalado

Cenário: 30 pacotes/dia, 365 dias/ano.

| Modelo | Por foto | Por dia | Por mês | Por ano | × 100 condos |
|---|---:|---:|---:|---:|---:|
| Haiku 4.5 | $0.0049 | $0.15 | $4.50 | **$54** | $5.400 |
| Sonnet 4.6 | $0.0146 | $0.44 | $13.30 | **$160** | $16.000 |
| Opus 4.7 | $0.0908 | $2.72 | $82.00 | **$995** | $99.500 |

(USD. R$5/USD ≈ R$270/R$800/R$5.000 por condo/ano)

### Diferença de margem

Premissa: cobrança SaaS de **R$300/mês/condo** = R$3.600/ano.

| Modelo | Custo IA | % da receita |
|---|---:|---:|
| Haiku | R$270/ano | 7,5% |
| Sonnet | R$800/ano | 22% |
| Opus | R$5.000/ano | **138%** ❌ |

Opus inviabiliza unit economics. Sonnet aperta margem. Haiku é o único compatível com preço SaaS plausível para condomínios de pequeno-médio porte.

---

## Decisão atual e gatilhos para reavaliar

### Default: **Haiku 4.5**

Motivos:
1. Custo viável dentro da estrutura SaaS prevista
2. Acurácia "boa o suficiente" quando combinada com **fluxo de match robusto** (apto+bloco antes de nome — ver `docs/architecture/morador-matching-flow.md`)
3. Velocidade adequada (2s — porteiro mal nota a espera)
4. Bug do "nome inventado" é mitigado pelo fluxo: se IA dá nome que não bate com nenhum morador da unidade, sistema cai no principal (não cria pacote pra pessoa inexistente)

### Reavaliar Sonnet quando

- [ ] Houver feedback recorrente de erro de extração em prod
- [ ] Margem permitir (>R$500/mês/condo)
- [ ] Tivermos > 50 condomínios ativos (cabe implementar fallback Haiku→Sonnet só nos casos `confianca < 0.7`)

### Reavaliar Opus

- Provavelmente nunca. Sonnet entrega 90% da qualidade por 16% do custo.

---

## Próximos passos técnicos

1. ✅ Prompt refinado (2026-05-08) — reforço de DESTINATÁRIO vs REMETENTE, ML Flex, conferência de dígitos
2. ⏳ Implementar **validação ViaCEP** após extração — se CEP não bate cidade do condomínio, baixar confiança
3. ⏳ UX: mostrar `flags.cep_diverge` ao porteiro quando CEP da etiqueta ≠ CEP do condomínio
4. ⏳ (Quando escalar) Implementar fallback Haiku→Sonnet para `confianca < 0.7`
5. ⏳ Job de QA: amostrar 1% das extrações e re-rodar com Sonnet em paralelo, registrar diffs (telemetria de drift)
