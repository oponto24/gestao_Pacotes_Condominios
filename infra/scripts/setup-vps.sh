#!/usr/bin/env bash
# =====================================================================
# Setup inicial da VPS — story 3.12
# =====================================================================
# Roda UMA VEZ na VPS recém-provisionada (Ubuntu 22.04+).
# Instala Docker, ufw, cria usuário deploy, clona repo.
#
# Uso:
#   ssh root@<vps-ip>
#   curl -fsSL https://raw.githubusercontent.com/oponto24/gestao_Pacotes_Condominios/main/infra/scripts/setup-vps.sh | bash
# OU
#   wget ... && chmod +x setup-vps.sh && sudo ./setup-vps.sh
# =====================================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/oponto24/gestao_Pacotes_Condominios.git}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/gestao-pacotes}"

if [[ $EUID -ne 0 ]]; then
  echo "❌ Rode como root (sudo)"
  exit 1
fi

echo "🔧 1/6 — Atualizando sistema..."
apt-get update -y
apt-get upgrade -y

echo "🔧 2/6 — Instalando dependências base..."
apt-get install -y curl wget git ufw ca-certificates gnupg lsb-release

echo "🔧 3/6 — Instalando Docker + Compose..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

echo "🔧 4/6 — Configurando firewall (ufw)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Lets Encrypt)'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "🔧 5/6 — Criando usuário deploy..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
fi
mkdir -p "/home/$DEPLOY_USER/.ssh"
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/"
fi
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || true
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

echo "🔧 6/6 — Clonando repo em $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$DEPLOY_DIR" 2>/dev/null || \
  (cd "$DEPLOY_DIR" && sudo -u "$DEPLOY_USER" git pull origin main)

echo ""
echo "✅ VPS pronta!"
echo ""
echo "Próximos passos (como user deploy):"
echo "  1. su - $DEPLOY_USER"
echo "  2. cd $DEPLOY_DIR"
echo "  3. cp .env.prod.example .env.prod"
echo "  4. nano .env.prod  # preencher secrets"
echo "  5. ./infra/scripts/deploy-vps.sh first-deploy"
