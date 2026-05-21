# Novos Fluxos — Requisitos (2026-05-21)

## 1. Captura em Massa (Batch Mode)

**Problema atual:** Porteiro tira uma foto, espera a IA processar (~5-20s), confirma dados, organiza, e só depois pode tirar a próxima foto. Em horários de pico (ex: chegada de transportadora com 10+ pacotes), isso é muito lento.

**Fluxo desejado:**
1. Porteiro entra em "modo massa" / "modo rápido"
2. Tira foto → pacote criado como rascunho → IA começa a processar em background
3. Imediatamente pode tirar a próxima foto (sem esperar IA)
4. Após tirar todas as fotos, porteiro vai para uma fila de "pacotes pendentes de revisão"
5. Cada pacote aparece com a foto e os dados que a IA extraiu
6. Porteiro revisa/corrige cada um e confirma
7. Pacotes confirmados seguem o fluxo normal (organização → retirada)

**Benefícios:**
- Porteiro não fica travado esperando IA
- Upload + processamento acontecem em paralelo
- Revisão pode ser feita depois, com calma

**Considerações técnicas:**
- Já temos BullMQ com job `extractLabel` que processa em background
- Falta: UI de captura contínua (sem redirect para /confirmar após cada foto)
- Falta: tela de fila de revisão (listar pacotes em `pendente_identificacao` do porteiro)
- A tela `/portaria/pendentes` já existe parcialmente — pode ser base

---

## 2. Rastreamento Completo de Status (Lifecycle do Pacote)

**Problema atual:** Os status existem mas não refletem toda a jornada física do pacote. O porteiro não tem visibilidade clara de onde cada pacote está.

**Status propostos (em ordem cronológica):**

| Status | Descrição | Quem muda | Onde aparece |
|--------|-----------|-----------|-------------|
| `na_portaria` | Pacote chegou, foto tirada, IA processou, porteiro confirmou | Porteiro (ao confirmar) | Tela portaria |
| `em_transito` | Pacote saiu da portaria rumo à administração/destino | Porteiro (ao despachar) | Tela portaria + admin |
| `na_administracao` | Pacote chegou na administração, aguardando organização | Admin (ao receber) | Tela admin |
| `organizado` | Admin definiu unidade/morador/setor/posição | Admin (ao organizar) | Tela admin |
| `aguardando_retirada` | Morador notificado, aguardando retirada | Sistema (após WhatsApp) | Todas as telas |
| `retirado` | Morador retirou o pacote | Porteiro/Sistema (ao confirmar retirada) | Histórico |

**Controles necessários:**
- Porteiro precisa saber: quantos pacotes saíram da portaria, quais, para onde
- Admin precisa saber: quantos pacotes estão na administração, quais foram organizados
- Dashboard com contadores por status
- Registro de quem moveu cada pacote e quando (audit trail)

**Mapeamento para status atuais:**

| Status atual | Status novo equivalente |
|-------------|----------------------|
| `rascunho` | (pré-confirmação, interno) |
| `pendente_identificacao` | (pré-confirmação, interno) |
| `aguardando_organizacao` | `na_administracao` |
| `aguardando_retirada` | `aguardando_retirada` |
| `retirado` | `retirado` |

**Novos status necessários:**
- `na_portaria` — após confirmação, antes de despachar
- `em_transito` — porteiro registra saída da portaria

**Considerações:**
- Precisa de uma ação explícita do porteiro para marcar "saiu da portaria"
- Pode ser um botão na lista de pacotes confirmados
- O admin precisa confirmar recebimento (ou pode ser automático?)
- Audit log já existe — precisa registrar cada transição de status

---

## Prioridade sugerida

1. **Rastreamento de status** — impacta operação diária, controle gerencial
2. **Captura em massa** — impacta produtividade do porteiro em horário de pico

## Discussão pendente

- Os nomes dos status são adequados? O parceiro/cliente prefere outros termos?
- O fluxo `em_transito` faz sentido para todos os condomínios ou só para os que têm administração separada?
- A confirmação de recebimento na administração é manual ou automática?
- Precisa de relatórios/exportação dos movimentos?
