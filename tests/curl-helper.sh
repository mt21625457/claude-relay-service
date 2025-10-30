#!/usr/bin/env bash

# Simple curl helper for Claude Relay Service
# Usage:
#   ANTHROPIC_BASE_URL="http://localhost:3000/api" \
#   ANTHROPIC_API_KEY="cr_..." \
#   ./tests/curl-helper.sh messages --model claude-sonnet-4-20250514 --text "ping" [--stream] [--ccr]
#
#   # 验证密钥映射是否存在（避免 401）
#   ./tests/curl-helper.sh whoami [--base http://localhost:3000/api] [--key cr_...]
#
#   # 健康检查
#   ./tests/curl-helper.sh health [--base http://localhost:3000/api]
#
# Env vars:
#   ANTHROPIC_BASE_URL   Base URL to this service's API (default: http://localhost:3000/api)
#   ANTHROPIC_API_KEY    Your cr_ key created in the admin UI
#   ANTHROPIC_AUTH_TOKEN Same as ANTHROPIC_API_KEY (兼容变量名)

set -euo pipefail

BASE_URL=${ANTHROPIC_BASE_URL:-"http://localhost:3000/api"}
# 兼容两种环境变量名称：ANTHROPIC_API_KEY 与 ANTHROPIC_AUTH_TOKEN
API_KEY=${ANTHROPIC_API_KEY:-${ANTHROPIC_AUTH_TOKEN:-""}}

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
err()  { printf "\033[31m%s\033[0m\n" "$*" 1>&2; }

if [[ $# -lt 1 ]]; then
  err "Missing command. Try: health | whoami | messages | count-tokens"
  exit 1
fi

CMD=$1; shift || true

require_key() {
  if [[ -z "$API_KEY" ]]; then
    err "ANTHROPIC_API_KEY not set. Export your cr_ key first."
    err "Example: export ANTHROPIC_API_KEY=cr_xxx"
    exit 1
  fi
}

# 解析通用标志：--base、--key
parse_global_flags() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --base) BASE_URL="$2"; shift 2 ;;
      --key) API_KEY="$2"; shift 2 ;;
      *) break ;;
    esac
  done
  REMAINING_ARGS=("$@")
}

case "$CMD" in
  health)
    parse_global_flags "$@"; set -- "${REMAINING_ARGS[@]}"
    bold "GET $BASE_URL/health"
    curl -i "$BASE_URL/health"
    ;;

  whoami)
    # 验证 cr_ 密钥在服务端是否可识别（避免 401）
    parse_global_flags "$@"; set -- "${REMAINING_ARGS[@]}"
    require_key
    bold "POST ${BASE_URL%/api}/apiStats/api/get-key-id"
    curl -i \
      -H "Content-Type: application/json" \
      --data-raw "{\"apiKey\":\"$API_KEY\"}" \
      "${BASE_URL%/api}/apiStats/api/get-key-id"
    ;;

  messages)
    parse_global_flags "$@"; set -- "${REMAINING_ARGS[@]}"
    require_key
    MODEL="claude-sonnet-4-20250514"
    TEXT="ping"
    STREAM="false"
    CCR_PREFIX="false"

    while [[ $# -gt 0 ]]; do
      case $1 in
        --model) MODEL="$2"; shift 2 ;;
        --text) TEXT="$2"; shift 2 ;;
        --ccr) CCR_PREFIX="true"; shift ;;
        --stream) STREAM="true"; shift ;;
        *) err "Unknown flag: $1"; exit 1 ;;
      esac
    done

    # 根据 --ccr 标记自动加前缀
    if [[ "$CCR_PREFIX" == "true" ]]; then
      if [[ "$MODEL" != ccr,* ]]; then
        MODEL="ccr,$MODEL"
      fi
    fi

    bold "POST $BASE_URL/v1/messages (model=$MODEL stream=$STREAM)"

    if [[ "$STREAM" == "true" ]]; then
      # SSE stream
      curl -i -N \
        -H "x-api-key: $API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "Content-Type: application/json" \
        --data-raw "{\"model\":\"$MODEL\",\"max_tokens\":256,\"stream\":true,\"messages\":[{\"role\":\"user\",\"content\":\"$TEXT\"}]}" \
        "$BASE_URL/v1/messages"
    else
      curl -i \
        -H "x-api-key: $API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "Content-Type: application/json" \
        --data-raw "{\"model\":\"$MODEL\",\"max_tokens\":256,\"messages\":[{\"role\":\"user\",\"content\":\"$TEXT\"}]}" \
        "$BASE_URL/v1/messages"
    fi
    ;;

  count-tokens)
    parse_global_flags "$@"; set -- "${REMAINING_ARGS[@]}"
    require_key
    MODEL="claude-sonnet-4-20250514"
    TEXT="hello"
    while [[ $# -gt 0 ]]; do
      case $1 in
        --model) MODEL="$2"; shift 2 ;;
        --text) TEXT="$2"; shift 2 ;;
        *) err "Unknown flag: $1"; exit 1 ;;
      esac
    done
    bold "POST $BASE_URL/v1/messages/count_tokens (model=$MODEL)"
    curl -i \
      -H "x-api-key: $API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "Content-Type: application/json" \
      --data-raw "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"$TEXT\"}]}" \
      "$BASE_URL/v1/messages/count_tokens"
    ;;

  *)
    err "Unknown command: $CMD"
    err "Available: health | messages | count-tokens"
    exit 1
    ;;
esac
