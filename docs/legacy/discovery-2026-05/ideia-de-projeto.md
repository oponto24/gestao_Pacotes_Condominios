# Gestão de Pacotes em Condomínios

## Visão geral

Sistema voltado a condomínios para gerenciar a chegada e a retirada de
encomendas (Correios, Mercado Livre, Shopee, etc.), com rastreio do fluxo
desde o recebimento na portaria até a retirada pelo morador.

**Diferencial:** o morador **não precisa instalar aplicativo**. Ele recebe
um QR Code **via WhatsApp** (canal universal, todo mundo tem) e apresenta
na administração no momento da retirada. Foco em **máxima facilidade para
o morador** — zero fricção.

## Problema

Hoje a gestão de pacotes em condomínios é manual: o porteiro recebe, anota
em caderno ou planilha, e não há registro confiável de quem retirou,
quando, nem onde o pacote foi guardado. Isso gera extravios, retrabalho e
falta de auditoria.

## Proposta de solução

### 1. Chegada do pacote

- O funcionário da administração/portaria escaneia o pacote pelo celular.
- O sistema identifica automaticamente o destinatário e o apartamento.
- Na própria tela, o funcionário classifica o **tamanho** do pacote:
  - Pequeno
  - Médio
  - Grande
  - Extra grande
- Essa classificação dispara uma **notificação interna para a administração**
  informando o tamanho e sugerindo o **setor de armazenamento**.
- O **horário de chegada** é registrado **automaticamente pelo sistema**
  no momento do bipe — nunca digitado manualmente — e fica visível no
  histórico do pacote.

### 2. Organização interna pela administração

- A administração define **setor** e **número/posição** do local onde o
  pacote será guardado.
- Esse registro fica vinculado ao pacote para localização rápida na entrega.

### 3. Notificação ao morador (via WhatsApp)

- Após a organização, o sistema dispara automaticamente uma mensagem de
  **WhatsApp** contendo:
  - Aviso de que o pacote chegou
  - Local de retirada (setor)
  - **QR Code único** que identifica aquele pacote/morador
- **Prioridade do destinatário:** a mensagem vai prioritariamente para o
  **nome do destinatário** que aparece na etiqueta, se ele estiver
  cadastrado naquele apartamento.
- **Fallback:** se o nome do destinatário **não estiver cadastrado**, a
  mensagem é enviada para o **condômino principal** do apartamento.
- WhatsApp é o canal único do MVP — escolhido por ser universal e
  dispensar instalação de qualquer app.
- O **QR Code não expira**: vale por tempo indeterminado até ser usado.

### 4. Retirada do pacote

- A pessoa vai até a administração e apresenta o QR Code recebido no
  WhatsApp.
- O funcionário escaneia o QR Code.
- O sistema mostra imediatamente qual é o pacote correspondente e onde
  está armazenado.
- **Não há validação de identidade**: o morador pode pedir que outra
  pessoa retire por ele — basta repassar o QR Code.
- Após escanear o QR, o sistema pergunta ao funcionário:
  **"O próprio destinatário está retirando?"** (Sim / Não)
  - **Sim:** registro automático em nome do destinatário.
  - **Não:** o funcionário digita o **nome da pessoa** que está retirando.
- No momento da entrega, a administração **registra obrigatoriamente**:
  - **Nome de quem está retirando** (destinatário ou terceiro informado)
  - **Horário da retirada** — capturado **automaticamente pelo sistema**
    no momento em que o QR é escaneado (nunca digitado manualmente)
  - Funcionário que realizou a entrega

### 5. Visão administrativa

- Painel com histórico completo de cada pacote, contendo:
  - Horário de chegada
  - Tamanho e setor/posição de armazenamento
  - Horário da retirada
  - Nome de quem retirou (morador ou terceiro)
  - Funcionário que recebeu e funcionário que entregou
- Filtros por unidade, morador, período e tamanho.

## Funcionalidade adicional — código de retirada do Mercado Livre

Alguns pedidos (sobretudo do Mercado Livre) exigem um **código/palavra-chave
de retirada** que o entregador pede para liberar o pacote. Hoje isso vira
problema porque o porteiro não tem o código quando o entregador chega.

**Solução proposta:** o morador, logo depois de finalizar a compra, envia
o código pelo **WhatsApp do sistema** (mesmo número que envia as
notificações). O sistema vincula o código ao apartamento e o exibe na
tela do funcionário no momento do recebimento.

### Como o morador envia o código

O morador manda mensagem para o **WhatsApp do sistema** com o código
+ identificação do pedido. O bot reconhece, vincula ao apartamento e
deixa pronto para uso na chegada.

### Comportamento na chegada

- Quando o pacote bipa na portaria, se o sistema já tiver código
  registrado para aquele morador/pedido, ele aparece destacado na tela.
- Se o entregador exigir o código, o funcionário lê direto no sistema —
  sem precisar acionar o morador na hora.

## Cadastros

- **Condomínio**
- **Setores de armazenamento** (com posições/números)
- **Apartamento/unidade** — cada unidade tem um **condômino principal**
  (recebe notificações por padrão / fallback) e pode ter **destinatários
  adicionais** cadastrados (cônjuge, filhos, dependentes, etc.).
- **Destinatários:** moradores cadastrados na unidade, identificados por
  nome. Quando a etiqueta traz o nome de um destinatário cadastrado, a
  notificação vai direto para ele; caso contrário, vai para o
  condômino principal.


## Stack (DECIDIDA — MVP)

- **Hospedagem:** VPS **Hostinger KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe).
  Escolhida por ter suporte 24/7 em PT-BR e NF brasileira.
- **Containerização:** Docker Compose com toda a stack isolada.
- **Backend + Frontend:** **Next.js 16 (App Router)** — PWA mobile-first
  para portaria/administração, sem necessidade de app instalado.
- **Banco de dados:** **PostgreSQL 16** rodando no mesmo Docker da VPS.
- **ORM:** **Prisma**.
- **Fila de jobs:** **BullMQ + Redis** (processamento de foto da etiqueta,
  envio de WhatsApp, webhooks).
- **Storage de fotos:** volume local (MinIO opcional quando crescer).
- **Canal de notificação ao morador:** **WhatsApp Cloud API oficial da
  Meta** (sem BSP no MVP — direto pela Meta). Veja seção dedicada abaixo.
- **Extração de dados da etiqueta:** **Anthropic Claude Haiku 4.5** com
  vision, usando prompt caching para reduzir custo. Custo estimado:
  ~R$ 0,02 por etiqueta processada (~R$ 2/mês por condomínio com cache).
- **Geração/leitura de QR Code:** biblioteca a definir na fase de
  arquitetura (`qrcode` para geração, `html5-qrcode` ou similar para
  leitura via webcam).

## Modelo de WhatsApp — Número Único Multi-Tenant (DECIDIDO)

**Decisão:** o sistema usa **um único número WhatsApp** que atende todos
os condomínios clientes (modelo multi-tenant compartilhado).

**Como funciona:**
- 1 chip dedicado, 1 Meta Business Account, 1 conjunto de templates
  aprovados que valem para todos os condomínios.
- Cada mensagem injeta o nome do condomínio como prefixo:
  `[Edifício Aurora] Olá Maria! Seu pacote chegou...`
- Quando o morador responde (código de retirada do ML), o sistema
  identifica o condomínio pelo **telefone do morador** já cadastrado
  em alguma unidade.
- Templates Meta usam variáveis (`{{1}}` = nome do condomínio,
  `{{2}}` = nome do morador, etc.).

**Por que esse modelo:**
- Onboarding instantâneo de novo condomínio (zero espera de aprovação
  Meta para cada cliente).
- Custo recorrente baixo (1 chip eterno vs N chips).
- Operação simples (1 webhook, 1 token, 1 quality rating para monitorar).
- Capacidade folgada: Tier 1 da Meta = 1.000 destinatários únicos/dia,
  já cobre ~10 condomínios pequenos sem apertar; tier sobe automático
  conforme quality rating fica alto.

**Roadmap futuro — feature premium "Marca Própria":**
Quando aparecer condomínio enterprise pedindo número exclusivo, vira
upsell (~R$ 100-200/mês adicional). Arquitetura já deve nascer
preparada: tabela `whatsapp_numbers` com FK opcional para
`condominio_id` (null = número compartilhado do sistema, preenchido =
dedicado).

## Provedor WhatsApp — Meta Cloud API Direto (DECIDIDO)

**Decisão:** começar com **Meta Cloud API direto, sem BSP intermediário**
(Z-API, Take Blip, Gupshup, etc.).

**Justificativa:**
- **Free tier real:** 1.000 conversas service/mês grátis. Conversas
  utility (notificação de pacote) custam US$ 0,008 cada no Brasil.
  Para 5 condomínios pequenos: ~US$ 8-12/mês total.
- **API oficial e estável** (nada de WhatsApp Web não-oficial estilo
  Evolution/Z-API tradicional, que tem risco de banimento).
- **Migração futura para BSP é trivial:** quando o ticket recorrente
  justificar pagar por suporte PT e painel pronto (Z-API Cloud API ou
  Take Blip), troca-se a URL base e credenciais — mesmo número, mesmos
  templates, mesmo histórico.

**Limitação aceita no MVP:** suporte da Meta é via documentação +
tickets em inglês. Volume de problema é baixo nesse caso de uso.

**Plano de migração futuro:**

| Fase | Provedor | Volume |
|------|----------|--------|
| MVP / piloto (0-3 condomínios) | Meta Cloud API direto | ~R$ 0-60/mês |
| Crescimento (4-15 condomínios) | Meta direto OU Z-API Cloud API | R$ 200-500/mês |
| Escala (15+ condomínios) | Z-API ou Take Blip (painel + atendimento PT) | conforme uso |

## Custos operacionais estimados por condomínio

| Item | Custo mensal |
|------|--------------|
| WhatsApp (Meta direto) | ~R$ 4 (500 notificações × US$ 0,008) |
| Anthropic Haiku (com prompt caching) | ~R$ 2 |
| VPS Hostinger (rateado entre clientes) | R$ 5-10 |
| **Total variável por condomínio** | **~R$ 15-20/mês** |

Com ticket-alvo de R$ 199-299/mês por condomínio pequeno → **margem 90%+**.

## Definições e pontos abertos

### Formato do "bipe" na chegada
Investigar primeiro se o **código de barras da etiqueta** dos pacotes
(Correios, Mercado Livre, Shopee) já contém as infos necessárias
(destinatário/endereço/identificador).

- **Se sim:** usar leitura direta do código de barras — caminho ideal.
- **Se não:** fallback com **foto da etiqueta + análise por IA** (OCR/LLM
  para extrair nome, apartamento, transportadora).


### Fluxo do pacote (modelo conceitual)

```
Recebedor (portaria) → ADM (classifica/organiza) → Setor de armazenamento → Morador (notificado via WhatsApp)
```

Cada etapa gera um **evento** com timestamp automático e responsável,
formando a trilha de auditoria. Modelagem detalhada do banco será feita
na próxima fase.

### LGPD
Cobrir via **termos de uso e política de privacidade**, com aceite no
cadastro do morador e do condomínio. Pontos a explicitar nos termos:
finalidade do tratamento, retenção do nome de quem retirou, e (no
cenário alternativo futuro) coleta de foto/documento.

### Modelo comercial
**Assinatura mensal, com valor acessível** (não-premium), pensada para
ser viável em condomínios pequenos e médios. Definir se o ticket é por
condomínio ou por unidade — testar em piloto.

## Próximos passos

### Em andamento (paralelo)

**Ações do fundador (fora do código):**
1. Assinar Hostinger KVM 2 e disponibilizar acesso (IP, root/SSH).
2. Comprar chip novo dedicado para o número WhatsApp do sistema.
3. Criar Meta Business Manager (CNPJ + comprovações) e iniciar
   verificação — leva 3-7 dias, é o caminho crítico do MVP.
4. Criar conta na Anthropic Console e gerar API key.

**Ações do squad AIOX:**
1. **`@pm` (Morgan):** criar épico inicial e PRD com escopo travado do
   MVP (próximo passo imediato).
2. **`@architect` (Aria):** fechar arquitetura técnica detalhada
   (componentes, integrações, deploy, multi-tenancy).
3. **`@data-engineer` (Dara):** modelar banco de dados completo
   (condomínios, unidades, moradores, pacotes, eventos, whatsapp_numbers).
4. **`@ux-design-expert` (Uma):** prototipar telas mobile-first
   (chegada, organização, entrega, confirmação de extração da IA,
   painel admin).
5. **`@dev` (Dex):** implementação por stories.
6. **`@qa` (Quinn):** quality gates por story.
7. **`@devops` (Gage):** setup VPS, CI/CD, deploy.

### Backlog de produto (após MVP rodando em piloto)

- Mais coleta de etiquetas reais (Magalu condomínio, Mercado Livre Flex,
  Shopee, Amazon) para validar pipeline de extração.
- Decisão sobre integração com API de rastreio dos Correios (status como
  feature extra no histórico do morador).
- Refinamento da UX da tela "pendente de identificação" (quando match
  automático falha).
- Feature premium "Marca Própria" (número WhatsApp dedicado por
  condomínio enterprise).
