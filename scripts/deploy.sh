#!/usr/bin/env bash
# Deploy to the VPS. Touches only /www/ludoreal-app, the site folders /www/wwwroot/ludoreal.in and
# /www/wwwroot/api.ludoreal.in, and the "ludoreal" systemd service.
#   ludoreal.in           landing page, terms, privacy; admin panel at /sradmin/
#   api.ludoreal.in       developer portal (+ /v1 API and /api/dev proxied to the Node server)
# The game itself runs only in the Android app.
# Usage: scripts/deploy.sh   (needs the SSH key ~/.ssh/ludoreal_deploy)
set -euo pipefail
HOST=root@187.127.171.168
SSH="ssh -i $HOME/.ssh/ludoreal_deploy -o BatchMode=yes $HOST"
cd "$(dirname "$0")/.."
git archive --format=tar HEAD server www site admin portal package.json package-lock.json | $SSH 'tar -x -C /www/ludoreal-app'
$SSH 'set -e; cd /www/ludoreal-app
  PATH=/www/ludoreal-app/.node/bin:$PATH npm ci --omit=dev --ignore-scripts --silent
  MAIN=/www/wwwroot/ludoreal.in; API=/www/wwwroot/api.ludoreal.in
  rm -rf "$MAIN/js" "$MAIN/css" "$MAIN/admin.js" "$MAIN/admin.css" "$MAIN/sradmin"   # old game/admin files
  cp -r site/. "$MAIN/"
  mkdir -p "$MAIN/sradmin" && cp -r admin/. "$MAIN/sradmin/"
  cp -r portal/. "$API/"
  chown -R www:www /www/ludoreal-app 2>/dev/null || true
  for d in "$MAIN" "$API"; do find "$d" -mindepth 1 -maxdepth 1 ! -name .user.ini -exec chown -R www:www {} + 2>/dev/null || true; done
  systemctl restart ludoreal; sleep 2; systemctl is-active ludoreal
  curl -fsS http://127.0.0.1:3090/healthz; echo'
