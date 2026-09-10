#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/vhosts/andersonyard.co.uk/yardle.andersonyard.co.uk/yardle}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-yardle}"

cd "$APP_DIR"

echo "Deploying Yardle from $(pwd)"
echo "Branch: $BRANCH"
echo "PM2 app: $PM2_APP"

git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm install
npm run typecheck
npm run build

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
  pm2 save || true
else
  echo "pm2 was not found. Build completed, but the app was not restarted."
  exit 1
fi

echo "Yardle deploy complete."
