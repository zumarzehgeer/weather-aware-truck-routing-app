#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; source .env; set +a; fi
export DJANGO_DEBUG="${DJANGO_DEBUG:-true}"
.venv/bin/python backend/manage.py runserver 127.0.0.1:8000 --noreload &
backend_pid=$!
cleanup() { kill "$backend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
cd frontend
npm run dev
