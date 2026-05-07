# Runbook — Setup UptimeRobot (Story 1.7)

**Objetivo:** monitorar uptime do app via serviço externo, recebendo alerta por e-mail (e opcionalmente Telegram) em <5 min se algum endpoint cair.

**Por que externo:** healthcheck Docker detecta crashes do container, mas não detecta network issues, DNS quebrado, certificate expirado, problemas no provedor (Hostinger). Monitor externo cobre tudo.

**Free tier UptimeRobot:** 50 monitors, intervalo mínimo 5 min, alertas e-mail/SMS/Telegram/Slack/Discord. Suficiente pro MVP.

---

## Pré-requisitos

1. **App rodando e acessível por URL pública.** Em desenvolvimento, isso significa cloudflared (mesmo tunnel da story 1.5 — Clerk webhook). Em produção, será o domínio da VPS Hostinger (story 8.4).

2. **Confirmar que `/api/health` está respondendo:**
   ```bash
   curl https://SEU_DOMINIO/api/health
   # Esperado: {"status":"ok",...}  HTTP 200
   ```

---

## Passo 1 — Criar conta UptimeRobot

1. Acesse https://uptimerobot.com
2. Botão **Sign Up Free** (canto superior direito)
3. Cadastra com e-mail (recomendado: o mesmo que recebe alertas críticos)
4. Confirma e-mail

---

## Passo 2 — Adicionar Monitor 1: App Health (agregado)

1. No dashboard, botão **+ New Monitor** (canto superior esquerdo)
2. Configure:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Pacotes Condomínios — Health`
   - **URL (or IP):** `https://SEU_DOMINIO/api/health`
   - **Monitoring Interval:** `5 minutes` (free tier mínimo)
   - **Monitor Timeout:** `30 seconds`
   - **HTTP Method:** `HEAD` (ou `GET` se preferir testar payload completo)
   - **Alert when:** `Status code is not 200`
3. Em **Select Alert Contacts**, marca o e-mail padrão (criado no Sign Up)
4. **Create Monitor**

---

## Passo 3 — Adicionar Monitor 2: App Reachability (raiz)

1. **+ New Monitor**
2. Configure:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Pacotes Condomínios — App Root`
   - **URL:** `https://SEU_DOMINIO/`
   - **Monitoring Interval:** `5 minutes`
   - **Alert when:** `Status code is not 200`
3. **Create Monitor**

---

## Passo 4 — Configurar canais de alerta adicionais (opcional)

### Telegram

1. Sidebar esquerda → **My Settings** → **Add Alert Contact**
2. **Type:** `Telegram`
3. Segue o passo-a-passo: precisa criar um bot via `@BotFather` no Telegram, copiar o token, e enviar `/start` pro bot
4. UptimeRobot mostra o `Chat ID` que você cola na config
5. Aplica o novo contato aos monitors criados (Edit Monitor → Alert Contacts)

### Slack

1. **Add Alert Contact** → **Slack**
2. UptimeRobot mostra URL pra autorizar via OAuth
3. Escolhe canal (#alerts, #ops, etc.)
4. Aplica aos monitors

---

## Passo 5 — Validar que alertas funcionam

**Teste forçado de DOWN:**

```bash
# 1. Pare o app local
docker compose -f infra/docker/docker-compose.yml stop app

# 2. Aguarde 5-10 min (intervalo de check + tempo pra UptimeRobot considerar DOWN)
# 3. Você deve receber e-mail "Pacotes Condomínios — Health is DOWN"

# 4. Suba o app de volta
docker compose -f infra/docker/docker-compose.yml --env-file .env.local up -d app

# 5. Em ~5 min, recebe e-mail "is UP" confirmando recuperação
```

---

## Operação dia-a-dia

### Janela de manutenção planejada

Quando precisar fazer deploy / restart / migração e não quer disparar alertas:

1. Dashboard UptimeRobot → seu monitor
2. Botão **Pause** (ou **Maintenance Window** pra agendar futuro)
3. Após terminar manutenção, **Resume**

### Rotação de URL do tunnel (DEV)

Se o cloudflared parar/reiniciar e gerar URL nova, atualize no UptimeRobot:
1. Dashboard → seu monitor → **Edit**
2. Substitua `URL` pela nova
3. **Save Changes**

Em produção (story 8.4) isso não acontece — domínio é fixo.

### Histórico

Dashboard mostra:
- **Status atual** (Up / Down / Paused)
- **Uptime ratio** últimos 1/7/30/90 dias
- **Response time graph**
- **Incident log** com início/fim de cada DOWN

---

## Troubleshooting

### "Monitor sempre DOWN mesmo com app rodando"

- Verifique `curl URL` direto do seu terminal — se retorna 200, problema é de rede UptimeRobot ↔ seu host
- DNS/certificado: verifique no `https://www.ssllabs.com/ssltest/`
- Em DEV: cloudflared parou? URL mudou?

### "Não recebo alerta de e-mail"

- Verifica spam folder (UptimeRobot às vezes vai pra spam de e-mails Gmail)
- Adiciona `noreply@uptimerobot.com` aos contatos
- Em **My Settings → Alert Contacts** confirma que e-mail está verified

### "Alertas demais (DOWN/UP frequente)"

- Pode ser flapping do healthcheck — `/api/health` retorna 503 intermitente
- Aumentar `Monitoring Timeout` pra 60s
- Investigar latência DB/Redis no log do app

---

## Referências

- Doc oficial: https://uptimerobot.com/help/
- Endpoints monitorados: `/api/health` (story 1.7), `/` (Next.js home)
- Story relacionada: 1.7 — Endpoint /api/health expandido + UptimeRobot
