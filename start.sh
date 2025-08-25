#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[start] Project root: $ROOT_DIR"

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "[warn] .env not found in project root. Backend will start, but API_KEY is required for syncing."
fi

echo "[deps] Installing backend deps (if needed)..."
cd "$ROOT_DIR/backend"
if [ ! -d node_modules ]; then
  npm install
fi

echo "[deps] Installing frontend deps (if needed)..."
cd "$ROOT_DIR/frontend"
if [ ! -d node_modules ]; then
  npm install --legacy-peer-deps
fi

cleanup() {
  echo "\n[stop] Shutting down..."
  pkill -P $$ || true
}
trap cleanup EXIT INT TERM

echo "[run] Starting backend on http://localhost:4000"
cd "$ROOT_DIR/backend"
PORT=4000 nodemon src/server.js &

echo "[run] Starting frontend on http://localhost:3000"
cd "$ROOT_DIR/frontend"
npm run dev -- --port 3000 &

wait


