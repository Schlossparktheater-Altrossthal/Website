#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${TARGET_BRANCH:-main}"
REPO_DIR="${REPO_DIR:-/opt/worktree}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$REPO_DIR/docker-compose.hosting.yml}"
DEPLOY_ENV="${DEPLOY_ENV:-prod}"
DOCKER_COMPOSE_CMD="${DOCKER_COMPOSE_CMD:-docker compose}"
DEPLOY_SERVICE_NAME="${DEPLOY_SERVICE_NAME:-}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[deploy] Repository not found in $REPO_DIR" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE_PATH" ]; then
  echo "[deploy] Compose file $COMPOSE_FILE_PATH does not exist" >&2
  exit 1
fi

if [ -z "$DEPLOY_SERVICE_NAME" ]; then
  if [ "$DEPLOY_ENV" = "dev" ]; then
    DEPLOY_SERVICE_NAME="app-dev"
  else
    DEPLOY_SERVICE_NAME="app-prod"
  fi
fi

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-theater}"

echo "[deploy] Updating repository at $REPO_DIR"
git -C "$REPO_DIR" fetch origin --prune
if git -C "$REPO_DIR" rev-parse "origin/$TARGET_BRANCH" >/dev/null 2>&1; then
  git -C "$REPO_DIR" checkout "$TARGET_BRANCH"
  git -C "$REPO_DIR" reset --hard "origin/$TARGET_BRANCH"
else
  echo "[deploy] Branch $TARGET_BRANCH not found on remote" >&2
  exit 1
fi

echo "[deploy] Syncing submodules (if any)"
git -C "$REPO_DIR" submodule update --init --recursive

echo "[deploy] Building service $DEPLOY_SERVICE_NAME using $COMPOSE_FILE_PATH"
$DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE_PATH" build "$DEPLOY_SERVICE_NAME"

echo "[deploy] Recreating service $DEPLOY_SERVICE_NAME"
$DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE_PATH" up -d "$DEPLOY_SERVICE_NAME"

echo "[deploy] Deployment finished"
