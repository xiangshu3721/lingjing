#!/usr/bin/env bash
# 构建并发布到 GitHub Pages（gh-pages 分支，保留历史，不强推）
# 站点根路径是 /lingjing/ ，对应 https://xiangshu3721.github.io/lingjing/
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_BASE=/lingjing/ npm run build

NAME="$(git config user.name || true)"
EMAIL="$(git config user.email || true)"
if [[ -z "$NAME" ]]; then NAME="lingjing-pages"; fi
if [[ -z "$EMAIL" ]]; then EMAIL="41898282+github-actions[bot]@users.noreply.github.com"; fi

TMP="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

publish() {
  find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -R dist/. "$TMP/"
  touch "$TMP/.nojekyll"
  git -C "$TMP" add -A
  if git -C "$TMP" diff --cached --quiet; then
    echo "没有变化，无需发布"
    exit 0
  fi
  git -C "$TMP" -c user.name="$NAME" -c user.email="$EMAIL" commit --quiet -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
  git -C "$TMP" push --quiet origin HEAD:gh-pages
  echo "已发布到 gh-pages"
}

# 优先在当前仓库里开 worktree，这样 GitHub Actions 的凭证也能跟着走
if git fetch --quiet origin gh-pages && git rev-parse --verify --quiet FETCH_HEAD >/dev/null; then
  git worktree add --quiet --detach "$TMP" FETCH_HEAD
  publish
else
  cleanup
  trap - EXIT
  TMP="$(mktemp -d)"
  REPO_URL="$(git remote get-url origin)"
  if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
    git clone --quiet --depth 1 --branch gh-pages "$REPO_URL" "$TMP"
  else
    git init --quiet -b gh-pages "$TMP"
    git -C "$TMP" remote add origin "$REPO_URL"
  fi
  find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -R dist/. "$TMP/"
  touch "$TMP/.nojekyll"
  git -C "$TMP" add -A
  if git -C "$TMP" diff --cached --quiet; then echo "没有变化，无需发布"; exit 0; fi
  git -C "$TMP" -c user.name="$NAME" -c user.email="$EMAIL" commit --quiet -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
  git -C "$TMP" push --quiet origin HEAD:gh-pages
  echo "已发布到 gh-pages"
  rm -rf "$TMP"
fi
