#!/usr/bin/env bash
# Deployment script — canonical per docs/architecture/NFC_PLATFORM_ARCHITECTURE_v3.md.
# Requires a Hostinger VPS/SSH host running Node.js 22 + pm2 (SSH deploy compatibility).
set -euo pipefail

SERVER="${SERVER:?}"
USER="${USER:?}"
APP_DIR="${APP_DIR:?}"
BRANCH="${BRANCH:-main}"

ssh "$USER@$SERVER" <<EOF
set -e
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git reset --hard origin/$BRANCH
npm install
npm run db:migrate
npm run build
pm2 restart nfc-platform || pm2 start npm --name nfc-platform -- start
pm2 save
EOF