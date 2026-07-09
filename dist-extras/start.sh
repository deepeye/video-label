#!/usr/bin/env bash
# 视频语料标注 Demo · 现场启动脚本 (macOS / Linux)
# 用法: 双击此文件，或终端运行 bash start.sh

set -e
cd "$(dirname "$0")"

PORT=8080
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

echo "─────────────────────────────────────────────"
echo "  视频语料标注 Demo"
echo "─────────────────────────────────────────────"
echo "  地址: http://localhost:$PORT"
echo "  按 Ctrl+C 退出"
echo "─────────────────────────────────────────────"
echo ""

# 1s 后自动打开浏览器, 同时启动 server
(
  sleep 1
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
  fi
) &

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --directory ./dist
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT" --directory ./dist
else
  echo "未找到 python3 或 python。请安装 Python 3 后重试。"
  echo "macOS: brew install python"
  echo "Linux: sudo apt install python3"
  exit 1
fi
