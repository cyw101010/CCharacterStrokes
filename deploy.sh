#!/bin/bash
# 将 index.html 部署到 Cloudflare Pages
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$HOME/.cache/cchar-deploy"
PROJECT_NAME="cchar-strokes"
# 只有 main 分支会更新生产地址 https://cchar-strokes.pages.dev
BRANCH="${DEPLOY_BRANCH:-main}"
ENV_FILE="$HOME/.config/cchar-deploy.env"

# git 钩子运行时是非交互 shell，读不到 ~/.zshrc，这里从独立配置文件加载凭据
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "缺少环境变量，请先在 $ENV_FILE 中写入："
  echo "  CLOUDFLARE_API_TOKEN=你的token"
  echo "  CLOUDFLARE_ACCOUNT_ID=你的account_id"
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
cp "$PROJECT_DIR/index.html" "$DEPLOY_DIR/index.html"
echo "已同步 index.html → $DEPLOY_DIR/index.html"

# 必须在可写目录下执行，否则 wrangler 会尝试创建 /.wrangler/tmp
cd "$DEPLOY_DIR"
npx --yes wrangler@latest pages deploy . \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" \
  --commit-dirty=true

echo
echo "完成，访问 https://$PROJECT_NAME.pages.dev"
