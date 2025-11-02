#!/bin/bash

set -euo pipefail

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

warn() {
  printf '\n[%s] ⚠️  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >&2
}

fail() {
  printf '\n[%s] ❌ %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

cd "$PROJECT_DIR"

[ -f "docker-compose.yml" ] || fail "未找到 docker-compose.yml，请在项目根目录运行此脚本"

# 可通过环境变量自定义
COMPOSE_PROJECT="${COMPOSE_PROJECT:-crs}"
COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
USE_SUDO="${USE_SUDO:-1}"

# 将 COMPOSE_BIN 拆分为数组，支持自定义命令
IFS=' ' read -r -a COMPOSE_PARTS <<< "$COMPOSE_BIN"
[ "${#COMPOSE_PARTS[@]}" -gt 0 ] || fail "COMPOSE_BIN 配置无效"

COMPOSE_CMD=("${COMPOSE_PARTS[@]}" -p "$COMPOSE_PROJECT")

if [ "$USE_SUDO" = "1" ] && [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    COMPOSE_CMD=(sudo "${COMPOSE_CMD[@]}")
  else
    fail "需要 sudo 权限或设置 USE_SUDO=0"
  fi
fi

command -v "${COMPOSE_PARTS[0]}" >/dev/null 2>&1 || fail "未找到 '${COMPOSE_PARTS[0]}' 命令，请安装 Docker CLI"

log "更新 Git 仓库"
git fetch --all --tags

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
  warn "当前处于 detached HEAD 状态，跳过 git pull；请手动更新"
else
  git pull --ff-only origin "$CURRENT_BRANCH"
fi

if [ -n "$(git status --porcelain)" ]; then
  warn "存在未提交改动或合并冲突，请确认无误后继续"
fi

if [ ! -f ".env" ]; then
  warn "未检测到 .env 文件，请确保已配置必需环境变量"
fi

log "构建最新镜像 (docker compose build --pull)"
"${COMPOSE_CMD[@]}" build --pull

log "以新版本启动服务 (docker compose up -d)"
"${COMPOSE_CMD[@]}" up -d

log "当前容器状态"
"${COMPOSE_CMD[@]}" ps

log "升级流程完成，可使用 curl http://127.0.0.1:3000/health 进行验证"
