# Setup Meta WhatsApp Business — Estado e operação

> **Status (2026-05-15):** Todas as etapas concluídas. WhatsApp em produção com chip dedicado. Envio real testado e confirmado.

---

## Credenciais ativas em produção (`.env.prod`)

| Variável | Valor produção | Notas |
|----------|---------------|-------|
| `META_APP_ID` | `2194393834738443` | Público, App ID |
| `META_APP_SECRET` | em `.env.prod` | ⚠️ Rotacionar antes do piloto pago |
| `META_PHONE_NUMBER_ID` | `1084364871431519` | Chip dedicado +55 11 99440-8930 |
| `META_WABA_ID` | `1017715357824074` | WABA produção "Ponto 24 Pacotes (Condominios)" |
| `META_ACCESS_TOKEN` | em `.env.prod` | Atualizado 2026-05-15 |
| `META_API_VERSION` | `v25.0` | Quando Meta deprecar |
| `META_WEBHOOK_VERIFY_TOKEN` | em `.env.prod` | Gerado com `openssl rand -hex 32` |
| `META_DISABLED` | `false` | `true` em CI/dev sem credencial |

### Credenciais sandbox (legado, manter como referência)

| Variável | Valor sandbox |
|----------|--------------|
| `META_PHONE_NUMBER_ID_SANDBOX` | `1138774412646193` |
| `META_WABA_ID_SANDBOX` | `1446111150585784` |

---

## Etapas concluídas

1. ✅ **Business Manager Ponto24** verificado — 2026-05-08
2. ✅ **App `Gestao de Pacotes Condominios`** criado (App ID `2194393834738443`) com produto WhatsApp adicionado
3. ✅ **Chip dedicado comprado** — +55 11 99440-8930 registrado como WhatsApp Business, Phone Number ID `1084364871431519` — 2026-05-15
4. ✅ **WABA produção criada** — `1017715357824074`, nome verificado "Ponto 24 Pacotes (Condominios)", status CONNECTED, modo LIVE
5. ✅ **Template `pacote_chegou`** aprovado pela Meta (Utility / pt_BR / header imagem) — ID `26618717394464267`
6. ✅ **Webhook configurado** em `https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp` — validado por Meta (challenge ping OK), inscrito em `messages` + `message_template_status_update`
7. ✅ **Método de pagamento** configurado no WABA — cartão adicionado 2026-05-15
8. ✅ **Envio real testado** — template `pacote_chegou` enviado com sucesso para +55 11 98810-8784 e +55 11 94039-8377 — 2026-05-15
9. ✅ **Token e WABA atualizados na VPS** — `.env.prod` atualizado, containers `app` + `worker` reiniciados — 2026-05-15

---

## Smoke pós-deploy

```bash
# Verifica webhook validation (deve retornar o challenge passado)
curl -s "https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp?hub.mode=subscribe&hub.verify_token=$META_WEBHOOK_VERIFY_TOKEN&hub.challenge=ping"
# → ping

# Verifica rejection com token errado (deve retornar 403)
curl -s -w "%{http_code}\n" "https://condominios.oponto24.com.br/api/webhooks/meta-whatsapp?hub.mode=subscribe&hub.verify_token=ERRADO&hub.challenge=x"
# → Forbidden403

# Smoke envio template (requer destinatário com WhatsApp)
curl -s -X POST "https://graph.facebook.com/v25.0/1084364871431519/messages" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5511XXXXXXXXX",
    "type": "template",
    "template": {
      "name": "pacote_chegou",
      "language": { "code": "pt_BR" },
      "components": [
        { "type": "header", "parameters": [{ "type": "image", "image": { "link": "https://condominios.oponto24.com.br/icons/icon-512.png" } }] },
        { "type": "body", "parameters": [{ "type": "text", "text": "Nome" }, { "type": "text", "text": "Condominio" }] }
      ]
    }
  }'
# → {"messaging_product":"whatsapp","contacts":[...],"messages":[{"id":"wamid.HBg...","message_status":"accepted"}]}
```

---

## Checklist pré-piloto pago

- [x] Template `pacote_chegou` aprovado pela Meta
- [x] Chip dedicado WhatsApp Business comprado
- [x] WABA produção criada, `META_PHONE_NUMBER_ID` + `META_WABA_ID` atualizados
- [x] Método de pagamento configurado no WABA
- [x] Envio real testado e confirmado
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
- **Nota sobre imagem no template:** A URL da imagem DEVE retornar HTTP 200. URLs com 404 fazem a Meta aceitar a mensagem (`accepted`) mas NÃO entregar ao destinatário silenciosamente. Descoberto em 2026-05-15.

---

## Troubleshooting

### Mensagem aceita mas não entrega
1. Verificar `health_status` do número: `GET /v25.0/{PHONE_NUMBER_ID}?fields=health_status`
2. Se `WABA.can_send_message = BLOCKED` com erro 141006 → problema no método de pagamento
3. Se imagem do header retorna 404 → Meta descarta silenciosamente. Confirmar URL antes de enviar
4. Envio de texto simples funciona sem janela de 24h se for template — se texto simples chega mas template não, problema é no template

### Verificar status da conta
```bash
# Health check completo
curl -s "https://graph.facebook.com/v25.0/1084364871431519?fields=health_status&access_token=$META_ACCESS_TOKEN"

# Templates aprovados
curl -s "https://graph.facebook.com/v25.0/1017715357824074/message_templates?access_token=$META_ACCESS_TOKEN"
```
