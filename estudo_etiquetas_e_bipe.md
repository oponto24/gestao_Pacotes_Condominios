# Estudo de Etiquetas — Estratégia de "Bipe"

Análise das 4 etiquetas reais coletadas em `modelos_de_etiquetas/`
(`magalu.jpeg`, `melhorEnvio1.jpeg`, `melhorEnvio2.jpeg`,
`superFrete.jpeg`) para definir como o sistema vai capturar as
informações do pacote no momento da chegada ao condomínio.

## 1. Análise individual

### 1.1 Magalu / Agência Magalu — Malha Direta (`magalu.jpeg`)

**Códigos visuais presentes:**
- **QR Code** (no topo, ao lado do logo)
- **Código de barras 1D** lateral, vertical: `19341204-01`

**Texto estruturado legível:**
- `Pedido: 1534170108978940`
- `Nota Fiscal: 2136`
- `Data estimada: 07/05/2026`
- Códigos de roteamento: `HCPQ / 01 / LIM / 134$`
- **DESTINATÁRIO:** `MARCELO FERREIRA GOMES`
- Endereço: `VITAL BRASIL RODRIGUES AGUIAR, 438 — PARQUE DAS NACOES — 13481806 — LIMEIRA, SP`
- **REMETENTE:** `25BEST OSASCO`

**Observações:**
- O código de barras 1D contém apenas o ID interno Magalu — **não traz
  nome nem endereço**.
- O QR Code provavelmente aponta para um link/identificador proprietário
  da Magalu (não há API pública).
- Bloco "DESTINATÁRIO" tem layout fixo e bem legível → ótimo para OCR.

---

### 1.2 Melhor Envio + Correios SEDEX (`melhorEnvio1.jpeg`)

**Códigos visuais presentes:**
- **DataMatrix** (2D quadrado) ao lado do logo Melhor Envio
- **Código de barras 1D** principal: `AD417365859BR` (formato Correios)
- Código de barras 1D secundário no bloco "DESTINATÁRIO"
- Etiqueta extra (NFE simplificada) lateral com outro código de barras

**Texto estruturado legível:**
- `Contrato: 9912368972`
- `SEDEX`
- `Volume: 1/1`
- `Peso (g): 500`
- `AD417365859BR` (código de rastreio Correios)
- **DESTINATÁRIO:** `Raphael Feitosa`
- Endereço: `Rua Aderaldo Vasconcelos Diniz, 66 — Cruzeiro — 58415-605 — Campina Grande/PB`
- **REMETENTE:** `Mauro Sergio Da Silva Prado, Tel: (11) 98145-2072`

**Observações:**
- Código de rastreio dos Correios segue padrão `XX + 9 dígitos + BR` —
  fácil de reconhecer por regex.
- Os Correios têm endpoint público de rastreio, mas ele só retorna
  status, **não retorna nome/endereço do destinatário**.
- Tem 2 códigos de barras + 1 DataMatrix na mesma etiqueta — risco de
  bipar o errado. O sistema precisa priorizar o de rastreio principal.

---

### 1.3 Melhor Envio + Correios PAC (`melhorEnvio2.jpeg`)

**Códigos visuais presentes:**
- **DataMatrix** 2D (mesma posição da etiqueta anterior)
- **Código de barras 1D** principal: `AN908042669BR`
- Código de barras 1D secundário no bloco "DESTINATÁRIO"

**Texto estruturado legível:**
- `Contrato: 9912368972`
- `PAC`
- `Volume: 1/1`
- `Peso (g): 250`
- `AN908042669BR`
- **DESTINATÁRIO:** `Jacilane De Holanda Rabelo Rabelo`
- Endereço: `Rua Professora Maria De Lourdes Cordeiro, 1746 — Ypiranga — 62901-490 — Russas/CE`
- **REMETENTE:** `Mauro Sergio Da Silva Prado`

**Observações:**
- Layout praticamente idêntico ao da etiqueta SEDEX → tudo que vale para
  uma vale para a outra.
- Confirma que o padrão **Melhor Envio + Correios** é estável e
  reconhecível.

---

### 1.4 SuperFrete + Loggi/Pegaki (`superFrete.jpeg`)

**Códigos visuais presentes:**
- **QR Code** grande no topo (Loggi)
- **Código de barras 1D** principal: `LG3INTKA2FNCI7LGP4YJ`
- Código de rastreio textual: `I7LGP4YJ` (curto, alfanumérico)

**Texto estruturado legível:**
- `NF: 2046868315`
- `Volume: 1/1`
- `Peso(g): 1`
- `Dimensões: 20x20x20cm³`
- `Código de rastreio: I7LGP4YJ`
- **DESTINATÁRIO:** `Marlene Teresinha Junges`
- Endereço: `Rua Dona Stela 151 Goiânia - GO`
- **Complemento:** `AP 1304 bloco3` ← **primeira etiqueta com apto/bloco real**
- CEP: `74650100`
- **REMETENTE:** `INTERNACIONAL PRODUTOS OTICOS LTDA`
- Endereço remetente: `Rua Camacam 189 São Paulo - SP, Complemento: B`

**Observações — este é o caso mais relevante do estudo:**
- **Tem campo "Complemento" explícito e separado** no layout, com a
  string `AP 1304 bloco3`. Excelente para parsing.
- O formato `AP 1304 bloco3` mostra na prática a falta de padronização
  esperada: "AP" sem ponto, número junto, "bloco" minúsculo grudado
  ao número. Confirma que **regex puro vai falhar** — precisa LLM ou
  parser tolerante.
- O código de barras carrega só uma string proprietária Loggi
  (`LG3INTKA2FNCI7LGP4YJ`), sem dados do destinatário.
- Layout SuperFrete é **muito mais fácil para OCR** do que Magalu —
  campos rotulados (`Destinatário`, `Complemento`, `Remetente`,
  `Observações`) com separação clara.
- Combina **Loggi + SuperFrete + transportadora**: 3 marcas na mesma
  etiqueta. O sistema precisa identificar "SuperFrete" como o emissor
  da etiqueta, não a transportadora final.

---

## 2. O que cabe no código de barras 1D?

**Resposta curta: muito pouco.**

O código de barras 1D dessas etiquetas carrega apenas um **identificador
único do pacote** (ID Magalu, código de rastreio Correios, etc.). Ele
**não contém** nome do destinatário, endereço, apartamento ou condomínio.

| Etiqueta | O que sai do bipe | Suficiente para identificar o morador? |
|---|---|---|
| Magalu | `19341204-01` (ID interno) | ❌ Não |
| Correios SEDEX | `AD417365859BR` (rastreio) | ❌ Não |
| Correios PAC | `AN908042669BR` (rastreio) | ❌ Não |
| SuperFrete/Loggi | `LG3INTKA2FNCI7LGP4YJ` (ID Loggi) | ❌ Não |

QR Codes / DataMatrix são proprietários da transportadora e tipicamente
embutem links internos que não dão para nós sem API.

**Conclusão:** **bipar só o código de barras NÃO resolve.** Precisamos
extrair os dados do destinatário do bloco textual da etiqueta.

---

## 3. Onde está o número do apartamento?

A etiqueta da SuperFrete confirma o que esperávamos: existe um campo
**"Complemento"** explícito, separado do endereço principal, contendo
algo como `AP 1304 bloco3`.

O formato é **livre** — o cliente digita do jeito que quiser na hora de
comprar. Variações esperadas no mercado:

```
"AP 1304 bloco3"      ← caso real (SuperFrete)
"Apto 401"
"Ap. 401 - Bl. B"
"401B"
"Bloco 2 / 401"
"401 - 4º andar"
"AP 1304 BL 3"
```

**Observações que mudam o plano:**
- Etiquetas como a da **SuperFrete/Loggi** ajudam muito porque rotulam o
  campo `Complemento:`. Basta o sistema localizar esse rótulo.
- Etiquetas como **Magalu** e **Correios/Melhor Envio** **não têm campo
  separado** para complemento — tudo cai dentro do bloco "DESTINATÁRIO"
  como texto livre. Aí o parsing fica mais difícil.
- **Mesmo com OCR perfeito, normalizar o complemento exige parsing
  tolerante a variações** — caso clássico para LLM, não regex.

---

## 4. Estratégia de bipe proposta

### Fluxo "bipe + foto"

1. **Bipe do código de barras 1D** (ou leitura do QR/DataMatrix)
   - Captura o **ID único do pacote** (rastreio Correios, ID Magalu).
   - Serve para:
     - Garantir unicidade (evitar registrar o mesmo pacote 2 vezes).
     - Permitir consulta futura de status (Correios) ou auditoria.

2. **Foto da etiqueta** (mesma tela, sequência única)
   - O funcionário tira uma foto do bloco da etiqueta.
   - Imagem vai para um **pipeline de IA** que extrai:
     - Nome do destinatário
     - Endereço completo
     - **Complemento (apto / bloco)** — o ponto mais difícil
     - CEP (útil para validar condomínio)
     - Transportadora (Correios/Magalu/Melhor Envio)

3. **Casamento automático com o cadastro do condomínio**
   - O sistema cruza CEP + nome do destinatário com a base de moradores
     do condomínio.
   - **Match exato** (nome cadastrado e apto bate): notifica direto o
     destinatário.
   - **Match parcial** (CEP bate, nome não): cai no fluxo de fallback
     (notifica condômino principal do apto, se identificável; senão,
     fica como "pendente de identificação" para a ADM resolver
     manualmente).

### Por que não OCR puro com regex

OCR tradicional + regex fragiliza com:
- Etiquetas amassadas, dobradas ou com sombra.
- Variação grande no formato do complemento (apto/bloco).
- Layouts diferentes por transportadora.

LLM com visão (ex.: GPT-4o, Claude 3.5 Sonnet, Gemini) lida bem com tudo
isso e devolve JSON estruturado com poucos prompts. Custo por imagem é
baixo (~ centavos) e já cabe no modelo comercial.

### Para o MVP

Sugestão pragmática:

- **Sempre tirar foto** (mesmo padrão para todas as transportadoras).
- **Bipar o código** quando possível (opcional no MVP — ganho é unicidade
  e consulta de rastreio).
- IA processa a foto e devolve os campos estruturados.
- ADM pode revisar/corrigir antes de confirmar a entrada do pacote no
  sistema (UX: tela de "confirmar dados extraídos").

---

## 5. Padrões reconhecíveis que ajudam o sistema

Mesmo sem API, dá pra usar **regex** para classificar a transportadora a
partir do texto OCR/bipe:

| Padrão | Transportadora | Tipo |
|---|---|---|
| `^[A-Z]{2}\d{9}BR$` | Correios | rastreio |
| `Magalu` / `AGÊNCIA MAGALU` (texto) | Magalu Malha Direta | logo/marca |
| `melhorenvio.com` (texto) | Melhor Envio (revenda Correios) | logo |
| `SuperFrete` / `Loggi` / `pegaki` (texto) | SuperFrete / Loggi | logo/marca |
| `Pedido: \d{16}` | Magalu | nº pedido interno |
| `Contrato: \d{10}` | Correios | contrato corporativo |
| `Código de rastreio: [A-Z0-9]{8}` | SuperFrete/Loggi | rastreio curto |

Detectar a transportadora ajuda o sistema a:
- Aplicar layout de extração específico, se quisermos otimizar.
- Mostrar o ícone correto na UI.
- Decidir se cabe consultar API externa (Correios tem rastreio aberto).

---

## 6. Gap atual e prioridade

A SuperFrete (etiqueta nº 4) trouxe o que faltava: caso real com
**`Complemento: AP 1304 bloco3`**, validando que esse campo existe e que
o formato é mesmo livre na prática.

**Insight derivado da comparação das 4 etiquetas:**

- **SuperFrete / Loggi:** campo `Complemento:` rotulado e separado →
  extração fácil, basta localizar o rótulo.
- **Magalu / Correios / Melhor Envio:** **não têm campo separado** —
  tudo cai dentro do bloco "DESTINATÁRIO" como texto livre, e o
  apto/bloco vai colado no logradouro. Extração depende inteiramente
  do LLM inferir o que é o quê.

**Próximo gap prioritário:** conseguir **uma etiqueta Magalu enviada para
um condomínio** (com apto/bloco escondido dentro do bloco de
destinatário). É o pior caso do nosso conjunto e o que vai pôr o
pipeline de extração à prova. Sem essa amostra, qualquer teste de
LLM hoje fica enviesado pelo caso fácil (SuperFrete).

## 7. Próximos passos do estudo

1. Coletar **mais 5-10 etiquetas** incluindo:
   - Mais exemplos de endereços **de condomínio** com diferentes formatos
     de Apto/Bloco (já temos 1 — SuperFrete `AP 1304 bloco3`).
   - Mercado Livre Flex.
   - Shopee.
   - Amazon.
   - Magalu de condomínio (para ver como ele lida com o complemento, já
     que não tem campo separado).
2. Testar 1-2 LLMs com visão (Claude / GPT-4o / Gemini) nas mesmas
   etiquetas e comparar precisão na extração de:
   - Nome
   - CEP
   - Apto/Bloco (campo crítico)
3. Decidir se vale a pena **integrar com API de rastreio dos Correios**
   (status do pacote no histórico do morador como "extra").
4. Definir o fluxo de **fallback manual** quando o casamento automático
   falhar (UX da tela de "pendente de identificação").
