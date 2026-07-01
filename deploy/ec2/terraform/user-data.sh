#!/bin/bash
# EC2 first-boot: install runtime deps. App code is synced separately via sync-to-server.sh
set -euo pipefail
exec > /var/log/physics-admin-bootstrap.log 2>&1

ADMIN_EMAIL="${admin_email}"
CORS_ORIGIN="${cors_origin}"
API_DOMAIN="${api_domain}"
JWT_SECRET="${jwt_secret}"

dnf -y update
dnf -y install git python3.11 python3.11-pip rsync

# Node 20 (for npm run export:data on publish)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf -y install nodejs

# 1 GB instances: add swap so npm install does not OOM
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

mkdir -p /opt/physics-database
chown ec2-user:ec2-user /opt/physics-database

# Stash bootstrap env for finish-setup.sh (run after code sync)
cat >/opt/physics-database/.ec2-bootstrap.env <<EOF
ADMIN_EMAIL=$${ADMIN_EMAIL}
CORS_ORIGIN=$${CORS_ORIGIN}
API_DOMAIN=$${API_DOMAIN}
JWT_SECRET=$${JWT_SECRET}
EOF
chmod 600 /opt/physics-database/.ec2-bootstrap.env
chown ec2-user:ec2-user /opt/physics-database/.ec2-bootstrap.env

if [[ -n "$API_DOMAIN" ]]; then
  dnf -y install yum-utils
  dnf copr enable -y @caddy/caddy epel-9-x86_64 || true
  dnf -y install caddy || {
    curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/bin/caddy
    chmod +x /usr/bin/caddy
  }
  systemctl enable caddy
fi

echo "bootstrap done" >> /var/log/physics-admin-bootstrap.log
