#!/usr/bin/env bash
set -euo pipefail

: "${GIT_REMOTE_URL:?GIT_REMOTE_URL must be set}"
: "${GITHUB_WEBHOOK_SECRET:?GITHUB_WEBHOOK_SECRET must be set}"

TARGET_BRANCH="${TARGET_BRANCH:-main}"
REPO_DIR="${REPO_DIR:-/opt/worktree}"
GIT_CLONE_DEPTH="${GIT_CLONE_DEPTH:-0}"

mkdir -p "$REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[entrypoint] Cloning $GIT_REMOTE_URL into $REPO_DIR (branch: $TARGET_BRANCH)"
  clone_args=("$GIT_REMOTE_URL" "$REPO_DIR")
  if [ "$GIT_CLONE_DEPTH" != "0" ]; then
    clone_args=("--depth" "$GIT_CLONE_DEPTH" "--branch" "$TARGET_BRANCH" "--single-branch" "$GIT_REMOTE_URL" "$REPO_DIR")
  else
    clone_args=("--branch" "$TARGET_BRANCH" "--single-branch" "$GIT_REMOTE_URL" "$REPO_DIR")
  fi
  git clone "${clone_args[@]}"
else
  echo "[entrypoint] Existing repository detected at $REPO_DIR"
  git -C "$REPO_DIR" remote set-url origin "$GIT_REMOTE_URL"
  git -C "$REPO_DIR" fetch --all --prune
  git -C "$REPO_DIR" checkout "$TARGET_BRANCH"
  git -C "$REPO_DIR" reset --hard "origin/$TARGET_BRANCH"
fi

echo "[entrypoint] Starting webhook listener on port ${LISTEN_PORT:-3000}"
exec node /app/server.mjs
