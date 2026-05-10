# Backup do Postgres em produção

## Estado atual

`pg_dump` automático diário via cron na VPS. Storage **local** (sem cópia offsite ainda — TODO).

## Setup (uma vez na VPS)

```bash
ssh -i ~/.ssh/ponto24_pacotes_deploy root@<vps>

# Cria diretório de logs
touch /var/log/gestao-pacotes-backup.log
chmod 644 /var/log/gestao-pacotes-backup.log

# Adiciona ao crontab do root (03h UTC = 00h BRT)
crontab -e
# Adicionar a linha:
0 3 * * * /opt/gestao-pacotes/infra/scripts/backup-db.sh >> /var/log/gestao-pacotes-backup.log 2>&1

# Validar
crontab -l | grep backup-db
```

## Política de retenção

| Tipo | Frequência | Mantém |
|---|---|---|
| Diário | Todo dia 03h UTC | 7 últimos |
| Semanal | Domingos | 4 últimos |
| Mensal | Dia 01 | 3 últimos |

Retenção total ≈ 14 backups na VPS. Tamanho típico inicial: poucos MB, escala com volume de pacotes.

## Estrutura no disco

```
/var/backups/gestao-pacotes/
├── daily/      backup_YYYYMMDD_HHMMSS.sql.gz × 7
├── weekly/     backup_YYYYMMDD_HHMMSS.sql.gz × 4
└── monthly/    backup_YYYYMMDD_HHMMSS.sql.gz × 3
```

## Smoke test (rodar manualmente uma vez)

```bash
ssh -i ~/.ssh/ponto24_pacotes_deploy root@<vps> \
  /opt/gestao-pacotes/infra/scripts/backup-db.sh

# Verificar arquivo gerado
ls -la /var/backups/gestao-pacotes/daily/

# Verificar conteúdo (cabeçalho do dump)
gunzip -c /var/backups/gestao-pacotes/daily/backup_*.sql.gz | head -20
```

## Restaurar backup

```bash
# Lista backups disponíveis
ls -la /var/backups/gestao-pacotes/daily/

# Restaurar (script pede confirmação interativa)
/opt/gestao-pacotes/infra/scripts/restore-db.sh \
  /var/backups/gestao-pacotes/daily/backup_20260510_030000.sql.gz
```

⚠️ **Restaurar apaga todos os dados atuais antes de recriar** (dump foi criado com `--clean --if-exists`).

## Verificações periódicas

### Diariamente (idealmente automatizado)
```bash
# Último backup foi nas últimas 25h?
find /var/backups/gestao-pacotes/daily/ -name "*.sql.gz" -mtime -1 | head -1
```

### Mensalmente (manual)
- Restaurar último backup mensal num ambiente staging e validar fluxo
- Confirmar que tamanho do backup faz sentido (não está vazio nem corrompido)

## Pendências (TODO)

1. **Storage offsite** (S3/R2/Backblaze B2) — proteção contra perda da VPS inteira.
   Sugestão: rclone configurado apontando pra bucket; rodar após `backup-db.sh` no mesmo cron.

2. **Alerting** — UptimeRobot / cron-monitoring que avisa se o cron de backup falhar 2 dias consecutivos.

3. **Backup do volume de fotos** (`/app/storage` no container app) — hoje só DB. Fotos vivem em volume Docker, perda da VPS = perda das fotos. Adicionar `tar` + sync pra mesmo bucket offsite quando configurar.

## Por que não está em compose

Cron rodando dentro de container exige PID 1 cron daemon, complica observabilidade. Cron do host é mais simples e auditável via `/var/log/cron`.
