#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_REPO="${1:-git@github.com:ioswater/ioswater.github.io.git}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"

echo "[1/5] Installing dependencies"
cd "$REPO_ROOT"
npm ci

echo "[2/5] Building static site"
npm run build

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "[3/5] Cloning deploy branch: ${DEPLOY_BRANCH}"
git clone --depth 1 --branch "$DEPLOY_BRANCH" "$REMOTE_REPO" "$TMP_DIR/repo"

echo "[4/5] Replacing deploy content with dist output"
find "$TMP_DIR/repo" -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
cp -R "$REPO_ROOT/dist/." "$TMP_DIR/repo/"
touch "$TMP_DIR/repo/.nojekyll"

echo "[5/5] Committing and pushing deploy branch"
cd "$TMP_DIR/repo"
git add -A
if git diff --cached --quiet; then
  echo "No deploy changes detected; exiting."
  exit 0
fi

git config user.name "${GIT_COMMITTER_NAME:-codex-deploy-bot}"
git config user.email "${GIT_COMMITTER_EMAIL:-codex-deploy-bot@users.noreply.github.com}"
git commit -m "deploy: publish Dockit Astro site ($(date -u +"%Y-%m-%dT%H:%M:%SZ"))"
git push origin "$DEPLOY_BRANCH"

echo "Deploy completed successfully."
