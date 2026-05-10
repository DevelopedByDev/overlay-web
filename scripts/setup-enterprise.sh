#!/usr/bin/env sh
# @enterprise-future — not wired to production
# curl -fsSL https://getoverlay.dev/install.sh | bash
#
# POSIX-compatible bootstrapper for create-overlay-app.
# Works on macOS, Linux, and WSL. Installs Node 20+ if missing,
# then delegates to the shared Node.js setup module.

set -e

REPO="https://github.com/getoverlay/overlay"
CLI_PACKAGE="create-overlay-app"
NODE_MIN_MAJOR=20

warn() { printf "\033[33m[warn] %s\033[0m\n" "$1"; }
info() { printf "\033[36m[info] %s\033[0m\n" "$1"; }
error() { printf "\033[31m[error] %s\033[0m\n" "$1"; }

get_node_version() {
  if command -v node >/dev/null 2>&1; then
    node -v | sed 's/^v//'
  else
    echo ""
  fi
}

get_node_major() {
  ver="$(get_node_version)"
  if [ -n "$ver" ]; then
    echo "$ver" | cut -d. -f1
  else
    echo "0"
  fi
}

install_node() {
  warn "Node.js $NODE_MIN_MAJOR+ is required but not found."
  info "Installing Node.js via fnm..."

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://fnm.vercel.app/install | bash -s -- --skip-shell
  else
    error "Neither curl nor wget is available. Please install Node.js $NODE_MIN_MAJOR+ manually."
    exit 1
  fi

  # Add fnm to PATH for this session
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
  fnm install "$NODE_MIN_MAJOR"
  fnm default "$NODE_MIN_MAJOR"
}

check_prereqs() {
  if ! command -v git >/dev/null 2>&1; then
    error "Git is required. Install it: https://git-scm.com/downloads"
    exit 1
  fi

  node_major=$(get_node_major)
  if [ "$node_major" -lt "$NODE_MIN_MAJOR" ]; then
    install_node
  fi

  info "Node $(node -v) detected."
}

main() {
  info "Overlay Enterprise Installer"
  info "----------------------------"

  check_prereqs

  # Parse optional arguments passed through from the curl command
  # e.g. curl ... | bash -s -- my-instance --profile on-prem
  target_dir=""
  extra_args=""
  if [ $# -gt 0 ]; then
    target_dir="$1"
    shift
    extra_args="$*"
  fi

  if [ -z "$target_dir" ]; then
    target_dir="overlay-instance"
  fi

  info "Installing $CLI_PACKAGE..."
  npm install -g "$CLI_PACKAGE@latest" >/dev/null 2>&1 || true

  if command -v create-overlay-app >/dev/null 2>&1; then
    info "Running create-overlay-app..."
    create-overlay-app "$target_dir" $extra_args
  else
    info "Running via npx..."
    npx "$CLI_PACKAGE@latest" "$target_dir" $extra_args
  fi

  info "Setup complete."
}

main "$@"
