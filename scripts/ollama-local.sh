#!/usr/bin/env bash
# Start/stop a user-local Ollama server (no sudo) for Halliday tagging.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OLLAMA_BIN="$ROOT/.tools/ollama/bin/ollama"
OLLAMA_LIB="$ROOT/.tools/ollama/lib/ollama"
export OLLAMA_MODELS="${OLLAMA_MODELS:-$ROOT/.tools/ollama-models}"
export OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
export LD_LIBRARY_PATH="${OLLAMA_LIB}:${LD_LIBRARY_PATH:-}"

if [[ ! -x "$OLLAMA_BIN" ]]; then
  echo "Missing $OLLAMA_BIN — run: curl -fL .../ollama-linux-amd64.tar.zst && zstd -d && tar -xf" >&2
  exit 1
fi

mkdir -p "$OLLAMA_MODELS"

cmd="${1:-status}"
case "$cmd" in
  start)
    if curl -fsS "http://${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
      echo "Ollama already running at http://${OLLAMA_HOST}"
      exit 0
    fi
    nohup "$OLLAMA_BIN" serve >"$ROOT/.tools/ollama/serve.log" 2>&1 &
    echo $! >"$ROOT/.tools/ollama/serve.pid"
    for _ in $(seq 1 30); do
      if curl -fsS "http://${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
        echo "Ollama ready at http://${OLLAMA_HOST}"
        exit 0
      fi
      sleep 1
    done
    echo "Ollama failed to start — see .tools/ollama/serve.log" >&2
    exit 1
    ;;
  stop)
    if [[ -f "$ROOT/.tools/ollama/serve.pid" ]]; then
      kill "$(cat "$ROOT/.tools/ollama/serve.pid")" 2>/dev/null || true
      rm -f "$ROOT/.tools/ollama/serve.pid"
    fi
    pkill -u "$USER" -f "$OLLAMA_BIN serve" 2>/dev/null || true
    echo "Stopped"
    ;;
  pull)
  model="${2:-qwen2.5:3b}"
    "$OLLAMA_BIN" pull "$model"
    ;;
  status)
    if curl -fsS "http://${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
      echo "running @ http://${OLLAMA_HOST}"
      "$OLLAMA_BIN" list 2>/dev/null || true
    else
      echo "not running"
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status|pull [model]}" >&2
    exit 1
    ;;
esac
