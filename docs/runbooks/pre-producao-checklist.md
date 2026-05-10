# Pré-produção — Checklist pra primeiro cliente pagante

Status snapshot 2026-05-10. Atualizar conforme itens forem fechados.

## ✅ Já endereçado

- [x] **RLS multi-tenant** — Story RLS-001 (migration `20260510160000_enable_rls_prod`). Roles `app_runtime` (sem bypass) e `webhook_worker` (com bypass) ativos. App roda com `app_runtime` em prod.
- [x] **Quotas por condomínio** — `max_unidades=200`, `max_moradores=600`, `max_pacotes_30d=2000` (defaults MVP, NULL = ilimitado).
- [x] **Backup automático do DB** — `pg_dump` diário às 03h UTC, retenção 7d/4w/3m em `/var/backups/gestao-pacotes/`. Cron ativo. **Pendente storage offsite (S3/R2).**
- [x] **Erro Clerk no startup** — diagnóstico: prerender de rota static, não afeta runtime. Sem fix necessário.

## 🚧 Bloqueante pra primeiro cliente real

### Chip dedicado WhatsApp
- **Por quê**: Sem isso, Epic 4 inteiro morto. `META_PHONE_NUMBER_ID` em prod aponta pro Test Number da Meta (+1 555-638-8239 NOT_VERIFIED) — qualquer template retorna 133010.
- **O que fazer**: Comprar chip pré-pago R$30 (ou número virtual TotalVoice/Twilio). Seguir Etapa 3 do `docs/runbooks/setup-meta-whatsapp.md`. Atualizar `META_PHONE_NUMBER_ID` em `.env.prod`. `docker compose restart app worker`.
- **Quem**: usuário (ação operacional, não código)

### Migrar Clerk dev → prod
- **Por quê**: Hoje usa keys de desenvolvimento da Clerk. Limite de MAU + branding "Powered by Clerk" + restrições de envio de email.
- **O que fazer**: Criar Production Instance em dashboard Clerk. Configurar domínio `condominios.oponto24.com.br`. Trocar `CLERK_SECRET_KEY` e `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` em `.env.prod`. Reconfigurar webhook Clerk apontando pra prod URL. Migrar usuários existentes (Clerk tem ferramenta de export/import).
- **Estimativa**: ~2-4h. Tem step de validação de domínio que pode demorar.

### Rotacionar 6 secrets vazadas em chat
Histórico de chat anterior expôs 6 keys. Em ordem de criticidade:

| Secret | Onde rotacionar | Como |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Criar nova, atualizar `.env.prod`, deletar antiga |
| `GOOGLE_API_KEY` (Gemini) | console.cloud.google.com → APIs | Idem |
| Senha root VPS | VPS shell | `passwd root` + atualizar `~/.ssh/...` se documentada |
| `CLERK_SECRET_KEY` | Endereçado junto com Clerk dev→prod acima |
| `META_APP_SECRET` | developers.facebook.com → App → Basic | Reset em "Show", atualizar `.env.prod` |
| `META_ACCESS_TOKEN` | Idem (System User → Generate New Token) |

Validar com `curl /api/health` após cada rotação.

## ⚠️ Importante mas não bloqueante (pré-2º cliente)

### Storage offsite do backup
- **Hoje**: backup só na própria VPS. Perda da VPS = perda total.
- **Solução**: rclone configurado pra S3/R2/Backblaze B2. Adicionar ao final do `backup-db.sh`:
  ```bash
  rclone copy "$DAILY_FILE" "remote:gestao-pacotes-backups/daily/"
  ```
- **Custo estimado**: B2 ~$5/mês pra primeiros 10GB. Boa opção.

### Backup do volume de fotos
- **Hoje**: `/app/storage` no container app vive em volume Docker. Não está no `pg_dump`.
- **Solução**: `tar` + sync pro mesmo bucket offsite. Pode rodar semanalmente (fotos crescem mais devagar).

### Alerting
- **Hoje**: só `/api/health` + UptimeRobot (HTTP up/down).
- **Falta**:
  - Cron-monitoring que avisa se `backup-db.sh` falhar (Healthchecks.io é gratuito).
  - Sentry / GlitchTip pra erros runtime.
  - Alert quando filas BullMQ ficam paradas (worker travou).

### Confirmar volume Postgres backupado
- Volume Docker `postgres_data` precisa estar em disco persistente da VPS. Confirmar que não é tmpfs/ramdisk.

## 📋 Pra escalar (5+ clientes ou venda real)

### Billing automatizado
- Provider: Asaas (BR), Stripe (intl)
- Modelos a definir:
  - Free trial 30 dias
  - Pro: R$X/mês, até Y unidades
  - Enterprise: contato comercial
- Integração: webhook do gateway → `condominio.ativo = false` quando inadimplente

### Self-signup com aprovação
- Hoje desabilitado (memory: `Self-signup desabilitado em main`). Webhook bloqueia orphan accounts.
- Possível UX: landing → form de interesse → super-admin aprova → email com setup link.

### Quotas por plano
- Hoje: defaults únicos (200/600/2000). Não tem conceito de "plano".
- Acoplar com billing: `condominio.plano_id` → `plano.max_unidades` etc.

### Subdomínio por cliente (opcional)
- `<cliente>.oponto24.com.br` em vez de tudo na mesma URL.
- Boost de profissionalismo. Tem custo de infra (wildcard SSL + Nginx config).

### Observability
- Sentry / GlitchTip — erros runtime
- Grafana / Prometheus — métricas latência, throughput, jobs Bull
- LogDNA / Better Stack — logs centralizados

## 📋 Cleanup técnico (UX restante da auditoria)

Achados U4, U10, U12, U13 da auditoria UX 2026-05-10:
- **U4**: `docs/ux/UX_SPEC.md` desatualizado (azul+Inter na doc vs amarelo+Montserrat real)
- **U10**: `hover:bg-primary-light/40` espalhado vs `hover:bg-muted` — padronizar token
- **U12**: `space-y-{4|6|8}` aleatório entre páginas — definir ritmo único
- **U13**: `force-dynamic` + `runtime nodejs` boilerplate em todo layout — abstrair? (decisão: não compensa, manter literal pra clareza)

## Sequência sugerida de execução

1. **Agora**: chip WhatsApp (operacional, paralelo)
2. **Esta semana**: rotação dos 6 secrets + Clerk dev→prod
3. **Antes de cobrar**: storage offsite do backup + alerting básico (Healthchecks.io)
4. **Mês 1 de cobrança**: billing automatizado + self-signup com aprovação
5. **Mês 2+**: quotas por plano, observability completa, subdomínio por cliente
