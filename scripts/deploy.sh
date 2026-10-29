#!/usr/bin/env bash
# Deploy the game server to the VPS (ludoreal.in). Touches only /www/ludoreal-app,
# the site folder /www/wwwroot/ludoreal.in and the "ludoreal" systemd service.
# Usage: scripts/deploy.sh   (needs the SSH key ~/.ssh/ludoreal_deploy)
set -euo pipefail
HOST=root@187.127.171.168
SSH="ssh -i $HOME/.ssh/ludoreal_deploy -o BatchMode=yes $HOST"
cd "$(dirname "$0")/.."
git archive --format=tar HEAD server www package.json package-lock.json | $SSH 'tar -x -C /www/ludoreal-app'
$SSH 'set -e; cd /www/ludoreal-app
  PATH=/www/ludoreal-app/.node/bin:$PATH npm ci --omit=dev --ignore-scripts --silent
  cp -r www/. /www/wwwroot/ludoreal.in/
  chown -R www:www /www/ludoreal-app /www/wwwroot/ludoreal.in 2>/dev/null || true
  systemctl restart ludoreal; sleep 2; systemctl is-active ludoreal
  curl -fsS http://127.0.0.1:3090/healthz; echo'
