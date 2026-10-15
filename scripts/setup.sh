#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check --cache-dir "${TMPDIR:-/tmp}/waycast-pip-cache" -r requirements.txt
(cd frontend && npm ci --cache "${WAYCAST_NPM_CACHE:-${TMPDIR:-/tmp}/waycast-npm-cache}" && npm run build)
.venv/bin/python backend/manage.py collectstatic --noinput
.venv/bin/python backend/manage.py check
