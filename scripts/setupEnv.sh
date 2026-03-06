#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
VITE_APP_NAME=Delta
VITE_API_BASE=/api
ENV
  echo "Created .env.local"
else
  echo ".env.local already exists"
fi
