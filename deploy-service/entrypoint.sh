#!/usr/bin/env bash
set -euo pipefail

: "${GIT_REMOTE_URL:?GIT_REMOTE_URL must be set}"
: "${GITHUB_WEBHOOK_SECRET:?GITHUB_WEBHOOK_SECRET must be set}"

TARGET_BRANCH="${TARGET_BRANCH:-main}"
REPO_DIR="${REPO_DIR:-/opt/worktree}"
GIT_CLONE_DEPTH="${GIT_CLONE_DEPTH:-0}"

configure_git_http_credentials() {
  local remote_url="$1"
  local username="${GIT_HTTP_USERNAME:-}"
  local password="${GIT_HTTP_PASSWORD:-}"
  local token="${GIT_HTTP_TOKEN:-}"

  if [ -n "$token" ]; then
    username="${GIT_HTTP_USERNAME:-git}"
    password="$token"
  fi

  if [ -z "$username" ] || [ -z "$password" ]; then
    return 0
  fi

  case "$remote_url" in
    http://*|https://*)
      local host
      host="$(printf '%s\n' "$remote_url" | sed -E 's#^[a-z]+://([^/]+).*#\1#')"
      local scheme
      scheme="$(printf '%s\n' "$remote_url" | sed -E 's#^([a-z]+)://.*#\1#')"
      if [ -z "$host" ]; then
        echo "[entrypoint] Unable to extract host from $remote_url for HTTP credentials" >&2
        return 1
      fi

      local cred_file="${GIT_CREDENTIAL_STORE_PATH:-/tmp/git-credentials}"
      printf '%s://%s:%s@%s\n' "$scheme" "$username" "$password" "$host" >"$cred_file"
      chmod 600 "$cred_file"
      git config --global credential.helper "store --file=$cred_file"
      echo "[entrypoint] Configured HTTP credentials for $host"
      ;;
    *)
      echo "[entrypoint] HTTP credentials provided but remote URL is not HTTP(S); skipping" >&2
      ;;
  esac
}

configure_git_ssh() {
  local key="${GIT_SSH_PRIVATE_KEY:-}"
  if [ -z "$key" ]; then
    return 0
  fi

  local ssh_dir="${HOME}/.ssh"
  mkdir -p "$ssh_dir"
  chmod 700 "$ssh_dir"

  local key_path="${GIT_SSH_PRIVATE_KEY_PATH:-$ssh_dir/id_ed25519}"
  printf '%s\n' "$key" >"$key_path"
  chmod 600 "$key_path"
  echo "[entrypoint] Installed SSH private key at $key_path"

  if [ -n "${GIT_SSH_KNOWN_HOSTS:-}" ]; then
    printf '%s\n' "$GIT_SSH_KNOWN_HOSTS" >"$ssh_dir/known_hosts"
    chmod 600 "$ssh_dir/known_hosts"
    echo "[entrypoint] Added provided SSH known_hosts entries"
  else
    local host=""
    case "$GIT_REMOTE_URL" in
      git@*:* )
        host="$(printf '%s\n' "$GIT_REMOTE_URL" | sed -E 's#^[^@]+@([^:]+):.*#\1#')"
        ;;
      ssh://*)
        host="$(printf '%s\n' "$GIT_REMOTE_URL" | sed -E 's#^ssh://([^/]+)/.*#\1#')"
        ;;
    esac

    if [ -n "$host" ]; then
      if ssh-keyscan -H "$host" >>"$ssh_dir/known_hosts" 2>/dev/null; then
        chmod 600 "$ssh_dir/known_hosts"
        echo "[entrypoint] Added $host to SSH known_hosts"
      else
        echo "[entrypoint] Warning: failed to automatically add $host to known_hosts" >&2
      fi
    fi
  fi
}

configure_git_http_credentials "$GIT_REMOTE_URL"
configure_git_ssh

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

git config --global --add safe.directory "$REPO_DIR"

RUN_DEPLOY_ON_START="${RUN_DEPLOY_ON_START:-${AUTO_DEPLOY_RUN_ON_START:-true}}"

if [ "$RUN_DEPLOY_ON_START" = "true" ]; then
  echo "[entrypoint] Running initial deployment before starting the webhook listener"
  if /app/deploy.sh; then
    echo "[entrypoint] Initial deployment finished"
  else
    echo "[entrypoint] Initial deployment failed" >&2
    exit 1
  fi
else
  echo "[entrypoint] Skipping initial deployment (RUN_DEPLOY_ON_START=$RUN_DEPLOY_ON_START)"
fi

echo "[entrypoint] Starting webhook listener on port ${LISTEN_PORT:-3000}"
exec node /app/server.mjs
