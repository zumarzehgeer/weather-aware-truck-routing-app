#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec gunicorn --chdir backend config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" --workers 1 --worker-class gthread --threads 4 \
  --timeout 120 --access-logfile - --error-logfile -
