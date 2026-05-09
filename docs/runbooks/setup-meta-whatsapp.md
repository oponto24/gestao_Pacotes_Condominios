# Setup Meta WhatsApp Business — Estado e operação

> **Status (2026-05-08):** Etapas 1-6 ✅ concluídas. Sistema integrado e webhook ativo em produção.
> **Pendente externo:** aprovação do template `pacote_chegou` pela Meta + chip dedicado pra produção real (sandbox = 90d / 5 destinatários).

---

## Credenciais (referenciar no `.env.prod`)

| Variável | Valor sandbox atual | Quando trocar |
|----------|---------------------|---------------|
| `META_APP_ID` | `2194393834738443` | Nunca (público, app id) |
| `META_APP_SECRET` | em `.env.prod` (rotacionar antes de prod real) | Antes do piloto pago |
| `META_PHONE_NUMBER_ID` | `1138774412646193` (sandbox) | Quando comprar chip dedicado |
| `META_WABA_ID` | `1446111150585784` (sandbox `Test WhatsApp Business Account`) | Quando comprar chip dedicado |
| `META_ACCESS_TOKEN` | em `.env.prod` (token permanente do System User `ponto24-api`) | Antes do piloto pago (rotacionar) |
| `META_API_VERSION` | `v25.0` | Quando Meta deprecar |
| `META_WEBHOOK_VERIFY_TOKEN` | em `.env.prod` (gerado com `openssl rand -hex 32`) | Antes do piloto pago |
| `META_DISABLED` | `false` em prod, `true` em CI/dev sem credencial | — |

---

## Etapas concluídas (resumo histórico)

1. ✅ **Business Manager Ponto24** verificado — 2026-05-08
2. ✅ **App `Gestao de Pacotes Condominios`** criado (App ID `2194393834738443`) com produto WhatsApp adicionado
3. ✅ **Phone Number ID sandbox** ativo (válido por 90 dias, max 5 destinatários cadastrados manualmente)
4. ✅ **System User `ponto24-api`** com Admin role, ativos atribuídos (App + WABA), token permanente gerado
5. ⏳ **Template `pacote_chegou`** submetido à Meta em 2026-05-08 16h25 (Utility / pt_BR / header imagem). Aguarda aprovação (geralmente 1h, max 24h)
6. ✅ **Webhook configurado** em `https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp` em 2026-05-08 22h15 — validado por Meta (challenge ping retornou OK), inscrito em `messages` + `message_template_status_update`

---

## Smoke pós-deploy

```bash
# Verifica webhook validation (deve retornar o challenge passado)
curl -s "https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp?hub.mode=subscribe&hub.verify_token=$META_WEBHOOK_VERIFY_TOKEN&hub.challenge=ping"
# → ping

# Verifica rejection com token errado (deve retornar 403)
curl -s -w "%{http_code}\n" "https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp?hub.mode=subscribe&hub.verify_token=ERRADO&hub.challenge=x"
# → Forbidden403

# Smoke envio template (requer template aprovado + destinatário cadastrado no sandbox)
npm run smoke:meta -- --to=5511XXXXXXXXX --template=hello_world --lang=en_US
# → wamid.HBgM... (id da mensagem entregue)
```

---

## Checklist pré-piloto pago

- [ ] Template `pacote_chegou` aprovado pela Meta
- [ ] Chip dedicado WhatsApp Business comprado
- [ ] Nova WABA produção criada (não-sandbox), `META_PHONE_NUMBER_ID` + `META_WABA_ID` atualizados
- [ ] `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN` rotacionados
- [ ] Verificação de negócio Meta (CNPJ + cartão CNPJ) submetida
- [ ] Templates `palavra_chave_recebida` + `morador_nao_cadastrado` submetidos (E7)

---

## Custos estimados (referência)

- Cadastro Meta Business + App + Cloud API: **R$ 0**
- Tier grátis Meta: **1.000 conversas utility/mês grátis**
- Mensagem utility após tier grátis: **~US$ 0,008/msg (≈ R$ 0,04)**

**Exemplo:** condomínio grande (100 unidades × 2 pacotes/dia × 30 dias = 6.000 conversas/mês) → (6000 - 1000) × R$0,04 = **~R$ 200/mês**

---

## Decisões registradas

- **Modelo:** número WhatsApp único compartilhado entre todos os condomínios (CON-005). Multi-tenancy via lookup de telefone do morador.
- **Provider:** Meta Cloud API direto (sem BSP) — mais barato, oficial, free tier real (CON-003).
- **Categoria de templates:** Utility (transacional, mais barato e aprova mais rápido que Marketing).
- **Aspect ratio do header:** 1.91:1 (1200×628) — evita corte do QR no preview WhatsApp.
