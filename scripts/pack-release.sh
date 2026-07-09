#!/usr/bin/env bash
# scripts/pack-release.sh
# 把 dist/ + dist-extras/ 打包成可分发的 zip。
# 用法: bash scripts/pack-release.sh
# 输出: release/video-label-demo-v<version>.zip

set -e
cd "$(dirname "$0")/.."

VERSION=$(node -e "console.log(require('./package.json').version)")
NAME="video-label-demo-v${VERSION}"
OUT_DIR="release"

echo "[pack-release] cleaning..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/$NAME"

echo "[pack-release] building..."
npm run build

echo "[pack-release] copying dist + dist-extras..."
cp -R dist "$OUT_DIR/$NAME/dist"
cp dist-extras/start.sh "$OUT_DIR/$NAME/"
cp dist-extras/start.bat "$OUT_DIR/$NAME/"
cp dist-extras/README.md "$OUT_DIR/$NAME/"
chmod +x "$OUT_DIR/$NAME/start.sh"

echo "[pack-release] zipping..."
cd "$OUT_DIR"
zip -r -q "${NAME}.zip" "$NAME"
cd ..

SIZE=$(du -sh "$OUT_DIR/${NAME}.zip" | cut -f1)
echo ""
echo "─────────────────────────────────────────────"
echo "  ✓ 打包完成: $OUT_DIR/${NAME}.zip ($SIZE)"
echo "─────────────────────────────────────────────"
