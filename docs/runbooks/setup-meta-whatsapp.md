# Setup Meta WhatsApp Business — Pré-requisitos Epic 4

> **Owner:** Gustavo Silva (oponto24@gmail.com)
> **Última atualização:** 2026-05-08
> **Bloqueia:** Epic 4 (Notificação WhatsApp), Story 6.5 (Reenviar/Cancelar), Epic 7 (Códigos ML)
> **Tempo total estimado:** 1-2 dias úteis (com janelas de espera Meta)
>
> **Estado atual:** Etapas 1-6 ✅ concluídas (2026-05-08). Webhook ativo em produção, validado por Meta, inscrito em `messages` + `message_template_status_update`. Aguarda apenas aprovação Meta do template `pacote_chegou` (em análise) + chip dedicado pra produção real (sandbox = 90d).

---

## Visão geral

O Epic 4 do MVP depende de uma integração com a **Meta Cloud API for WhatsApp Business**. Esse documento é o passo-a-passo operacional do que você (operador humano) precisa configurar do lado Meta antes que o código entre em produção real.

**Em paralelo a este setup**, o desenvolvimento das stories 4.1, 4.2, 4.3, 4.6 pode acontecer com mocks (cliente Meta fake + testes verdes), deixando apenas as variáveis de ambiente como placeholder. A story 4.4 (webhook) só pode ser testada ponta-a-ponta após a URL estar ativa em produção.

---

## Pré-requisitos (do seu lado, antes de começar)

- [ ] **CNPJ ativo** (Ponto24 — pessoa jurídica)
- [ ] **Site no ar com política de privacidade** ✅ já temos: `https://condominios.oponto24.com.br`
- [ ] **Cartão de crédito internacional** (Meta cobra em USD por mensagem template após o tier grátis de 1.000/mês)
- [ ] **Celular dedicado** OU número virtual — esse vira o número WABA. **CRÍTICO:** o número não pode ter sido usado em WhatsApp pessoal antes. Se já foi, é necessário deletar a conta WhatsApp pessoal e aguardar 30 dias antes de cadastrar como Business.

---

## Etapa 1 — Criar Meta Business Manager

**Tempo:** 15 min de cadastro + verificação de e-mail

1. Acessar https://business.facebook.com
2. Clicar em **Criar conta comercial**
3. Preencher:
   - Nome do negócio: `Ponto24`
   - Seu nome: `Gustavo Silva`
   - E-mail comercial: `oponto24@gmail.com`
4. Verificar e-mail (link enviado por Meta)
5. Em **Configurações do Negócio → Informações da empresa**:
   - Razão social, endereço, telefone, CNPJ
   - Subir contrato social ou cartão CNPJ digitalizado para iniciar a **verificação de negócio**

> ⚠️ A verificação de negócio é o que tira o número WABA do modo sandbox (limitado a 5 números de teste). Pode demorar de 2 a 14 dias para ser aprovada pela Meta.

**O que anotar:**
- [ ] **Business Manager ID** (visível em Configurações → Informações da empresa)

---

## Etapa 2 — Criar App Meta + adicionar produto WhatsApp

**Tempo:** 10 min

1. Acessar https://developers.facebook.com/apps
2. Clicar em **Criar app**
3. Caso seu Business Manager (Etapa 1) já apareça vinculado, ele será associado automaticamente. Se não, escolher tipo **Empresa** e selecionar o BM manualmente.
4. Nome do app: `Ponto24 Portaria`
5. Após criar, no painel do app: **Adicionar produto → WhatsApp → Configurar**
6. Aceitar termos da Cloud API

**O que anotar:**
- [ ] **App ID** (público, aparece no topo do painel)
- [ ] **App Secret** → vai virar variável de ambiente `META_APP_SECRET` (segredo crítico — não compartilhar)

> 📍 O App Secret fica em **Configurações → Básico → App Secret** (clicar em "Mostrar" e digitar a senha do Facebook).

---

## Etapa 3 — Cadastrar número de telefone WhatsApp Business

**Tempo:** 20-60 min (a aprovação do nome de exibição pode levar até 48h)

1. No painel do app criado na Etapa 2, ir em **WhatsApp → Configuração da API**
2. Clicar em **Adicionar número de telefone**
3. Inserir o celular dedicado (com DDD)
4. Receber código de verificação por **SMS** ou **ligação**
5. Confirmar
6. Definir **nome de exibição** (ex: `Ponto24 Portaria`) — esse nome aparece pros moradores no WhatsApp e passa por revisão Meta:
   - Deve refletir o negócio real
   - Não pode conter palavras genéricas como "WhatsApp", "Oficial", "Atendimento"
   - Aprovação geralmente em 1-2h, máx 48h

**O que anotar:**
- [ ] **Phone Number ID** → variável `META_PHONE_NUMBER_ID`
- [ ] **WhatsApp Business Account ID** (WABA ID) → variável `META_WHATSAPP_BUSINESS_ACCOUNT_ID`

> ⚠️ Enquanto a verificação de negócio (Etapa 1) não estiver concluída, o número fica em **modo sandbox** — só envia mensagens pra até 5 números de teste cadastrados manualmente em **WhatsApp → Configuração da API → Destinatários permitidos**. Para o smoke test inicial isso basta; pra produção real precisa da verificação.

---

## Etapa 4 — Gerar Token de Acesso permanente

**Tempo:** 10 min

> Por padrão Meta gera tokens temporários (24h) inúteis pra produção. O caminho oficial pra um token permanente é via **System User**.

1. Acessar **Configurações do Negócio → Usuários → Usuários do sistema**
2. Clicar em **Adicionar** → criar System User:
   - Nome: `ponto24-api`
   - Perfil: **Admin**
3. Após criar, atribuir ativos ao System User:
   - **Apps** → seu app criado na Etapa 2
   - **Contas do WhatsApp** → seu WABA criado na Etapa 3
4. Clicar em **Gerar token** com:
   - App: o app criado na Etapa 2
   - **Expiração: Nunca**
   - Permissões:
     - [x] `whatsapp_business_messaging`
     - [x] `whatsapp_business_management`
5. Copiar o token gerado (é exibido **uma única vez**)

**O que anotar:**
- [ ] **Access Token** → variável `META_ACCESS_TOKEN` (segredo crítico — armazenar em gerenciador de senhas, nunca commitar)

---

## Etapa 5 — Criar template de mensagem aprovado

**Tempo:** 5 min de cadastro + 1-24h de aprovação Meta

> Mensagens iniciadas pelo negócio (notificação de chegada de pacote) **só podem usar templates aprovados**. Free-form text só funciona quando o usuário responde nas últimas 24h.

1. Acessar **WhatsApp Manager** (https://business.facebook.com/wa/manage/) → selecionar o WABA
2. **Templates de mensagem → Criar template**
3. Preencher:
   - **Categoria:** `Utility` (não Marketing — Utility é mais barato e aprova mais rápido por ser comunicação transacional)
   - **Nome:** `pacote_chegou` (snake_case, sem espaços — vira identificador no código)
   - **Idioma:** Português (Brasil)
4. **Corpo da mensagem:**
   ```
   Olá {{1}}! Sua encomenda chegou no {{2}} e já está disponível na portaria.
   Mostre a imagem em anexo ao porteiro para a retirada.
   ```
   - `{{1}}` = nome do morador
   - `{{2}}` = nome do condomínio
   - **Por que essa redação?** A primeira tentativa ("Apresente este QR Code...") foi auto-classificada pela Meta como Autenticação (gatilho: "QR Code" + "Apresente"). A redação acima evita os gatilhos e mantém Utility, que é mais barato e aprova mais rápido.
5. **Cabeçalho com mídia:** marcar **Imagem** — vamos enviar o QR Code como imagem anexa
6. **Submeter para aprovação**

> Aprovação geralmente em 1h, máximo 24h. Se rejeitar, o motivo vem por e-mail e geralmente é reformulação do texto. Categorias `Utility` raramente são rejeitadas.

**O que anotar:**
- [ ] **Template name:** `pacote_chegou` (referenciado no código como `META_TEMPLATE_NAME`)

---

## Etapa 6 — Configurar Webhook (depois que Story 4.4 estiver em produção)

**Tempo:** 5 min — mas depende do código estar deployado

> Esta etapa **não pode ser feita antes** que a story 4.4 (webhook handler) esteja no ar em `https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp`.

1. No painel do app → **WhatsApp → Configuração → Webhook → Editar**
2. **Callback URL:** `https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp`
3. **Token de Verificação:** gerar uma string aleatória forte (ex: rodar `openssl rand -hex 32`) — vai virar `META_WEBHOOK_VERIFY_TOKEN`
4. Salvar (Meta faz uma chamada GET de verificação imediata; o handler precisa estar respondendo)
5. **Inscrever nos campos:**
   - [x] `messages` (recebe respostas dos usuários — útil pra futuro)
   - [x] `message_template_status_update` (recebe sent/delivered/read)

**O que anotar:**
- [ ] **Webhook Verify Token** → variável `META_WEBHOOK_VERIFY_TOKEN` (segredo)

---

## Resumo: variáveis de ambiente

> **Estado em 2026-05-08:** Etapas 1-5 concluídas. Variáveis abaixo já preenchidas em `.env.local` (sandbox). Pra `.env.prod` real, falta chip dedicado + WABA não-sandbox + Etapa 6.

```bash
# === Meta WhatsApp Business ===
META_APP_ID=2194393834738443                              # Etapa 2 — público
META_APP_SECRET=<rotacionar>                              # Etapa 2 — segredo
META_PHONE_NUMBER_ID=1138774412646193                     # Etapa 3 — sandbox (trocar pra chip prod depois)
META_WABA_ID=1446111150585784                             # Etapa 3 — sandbox (trocar depois)
META_ACCESS_TOKEN=<rotacionar>                            # Etapa 4 — segredo crítico, permanente
META_TEMPLATE_NAME=pacote_chegou                          # Etapa 5 — em análise Meta
META_API_VERSION=v25.0                                    # versão atual da Cloud API
META_WEBHOOK_VERIFY_TOKEN=<da Etapa 6, depois de 4.4 deployado>
```

| Variável | Onde obtém | Tipo | Status |
|----------|-----------|------|--------|
| `META_APP_ID` | Etapa 2 | ID público | ✅ |
| `META_APP_SECRET` | Etapa 2 | Segredo | ✅ (rotacionar antes prod) |
| `META_PHONE_NUMBER_ID` | Etapa 3 | ID público | ✅ sandbox |
| `META_WABA_ID` | Etapa 3 | ID público | ✅ sandbox |
| `META_ACCESS_TOKEN` | Etapa 4 | Segredo crítico | ✅ (rotacionar antes prod) |
| `META_TEMPLATE_NAME` | Etapa 5 | Nome (público) | ⏳ em análise |
| `META_API_VERSION` | Constante | Versão fixa | ✅ `v25.0` |
| `META_WEBHOOK_VERIFY_TOKEN` | Etapa 6 | Segredo | ⏳ pós-4.4 |

---

## Custos estimados

| Item | Custo |
|------|-------|
| Cadastro Meta Business + App + Cloud API | **R$0** |
| Verificação de negócio | **R$0** |
| Tier grátis Meta | **1.000 conversas utility/mês grátis** |
| Mensagem utility após tier grátis | **~US$ 0,008/msg (≈ R$0,04)** |

**Cálculo de exemplo (1 condomínio grande):**
- 100 unidades × 2 pacotes/dia/unidade = 200 pacotes/dia
- 30 dias = **6.000 conversas/mês**
- (6.000 - 1.000) × R$0,04 = **~R$200/mês** por condomínio

> Esse custo é absorvido na cobrança do SaaS (Epic 9, ainda não definido).

---

## O que dá pra adiantar com mocks (sem depender deste setup)

| Story | Pode rodar com mock? | Observação |
|-------|---------------------|------------|
| 4.1 — Cliente Meta + sendTemplate | ✅ Sim | Cliente fake retorna `message_id` simulado |
| 4.2 — Geração de QR Code | ✅ Sim | Lib `qrcode` é local, sem dependência Meta |
| 4.3 — Worker sendWhatsApp | ✅ Sim | Usa cliente mockado, salva mensagem no banco normalmente |
| 4.4 — Webhook handler | ⚠️ Parcial | Lógica testada com payloads de exemplo Meta, mas verificação ponta-a-ponta só com URL real |
| 4.5 — Fallback destinatário | ✅ Sim | Só lógica de roteamento, não depende de envio |
| 4.6 — Retry + tela reenviar | ✅ Sim | BullMQ retry é local; UI testável com mock |

**Estimativa:** 5-7 dias de dev em paralelo ao seu setup Meta de 1-2 dias úteis.

---

## Provider alternativos (descartados, anotados pra histórico)

| Provider | Pró | Contra | Veredicto |
|----------|-----|--------|-----------|
| **Meta Cloud API direto** | Mais barato (~R$0,04/msg), oficial, sem intermediário | Setup chato, verificação demora | ✅ Escolhido |
| Z-API | Setup em 5 min, sem aprovação template | ~R$0,15-0,40/msg, depende de QR Code de WhatsApp Web (frágil), não-oficial | ❌ Não escala |
| Twilio | Estável, dashboard bom | ~3x mais caro que Meta direto | ❌ Caro |
| WPPConnect (self-hosted) | Grátis | Não-oficial, instável, banimento de número provável | ❌ Risco de banimento |

---

## Próximo passo

Quando concluir as Etapas 1-5 (a 6 fica pra depois do deploy de 4.4), me avisa com os valores das variáveis e eu plugo no deploy + rodamos smoke E2E enviando uma mensagem real pro seu próprio celular cadastrado como número de teste.

**Em paralelo, posso começar agora** as stories 4.1, 4.2, 4.3, 4.5, 4.6 com mocks — é só me dizer "pode começar com mocks".
