#!/usr/bin/env bash
set -euo pipefail
cd /home/leads/repos/hermes-dashboard

# Ensure standalone has latest static/public assets before boot.
mkdir -p .next/standalone/.next/static
if [ -d .next/static ]; then
  rsync -a .next/static/ .next/standalone/.next/static/
fi
if [ -d public ]; then
  rsync -a public/ .next/standalone/public/
fi

exec /usr/bin/node /home/leads/repos/hermes-dashboard/.next/standalone/server.js
