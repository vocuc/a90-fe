#!/usr/bin/env bash
# Deploy frontend a90-fe: pull code mới, cài package, build rồi thay thư mục dist.
# Cách dùng: bash deployfe.sh [branch]   (mặc định: main)
set -euo pipefail

APP_DIR="/var/www/html/a51/a90-fe"
BRANCH="${1:-main}"
BUILD_DIR="dist_new"
OLD_DIR="dist_old"

cd "$APP_DIR"

echo "==> Thư mục: $APP_DIR | nhánh: $BRANCH"

if [ ! -f .env.production ]; then
  echo "!! Thiếu file .env.production (file này không nằm trong git), tạo từ .env.example rồi chạy lại." >&2
  exit 1
fi

echo "==> Lấy code mới"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "    Commit: $(git log -1 --pretty='%h %s')"

echo "==> Cài package"
npm ci --no-audit --no-fund

echo "==> Build"
rm -rf "$BUILD_DIR"
npx vite build --outDir "$BUILD_DIR" --emptyOutDir

# Build ra thư mục tạm rồi mới đổi tên, để web không bị trống trong lúc build
echo "==> Thay dist"
rm -rf "$OLD_DIR"
[ -d dist ] && mv dist "$OLD_DIR"
mv "$BUILD_DIR" dist
rm -rf "$OLD_DIR"

echo "==> Xong: $(date '+%Y-%m-%d %H:%M:%S')"
