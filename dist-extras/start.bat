@echo off
REM 视频语料标注 Demo · 现场启动脚本 (Windows)
REM 用法: 双击此文件
chcp 65001 >NUL
cd /d "%~dp0"

set PORT=8080

REM 找空闲端口 (PowerShell)
for /f "delims=" %%P in ('powershell -NoProfile -Command ^
  "$p=8080; while ((Test-NetConnection -ComputerName localhost -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded) { $p++ }; Write-Output $p"') do set PORT=%%P

echo -----------------------------------------
echo   视频语料标注 Demo
echo -----------------------------------------
echo   地址: http://localhost:%PORT%
echo   按 Ctrl+C 退出
echo -----------------------------------------
echo.

REM 1s 后自动开浏览器
start /B powershell -Command "Start-Sleep 1; Start-Process 'http://localhost:%PORT%'"

REM 启动 Python http.server
python -m http.server %PORT% --directory ./dist
if errorlevel 1 (
  echo.
  echo 未找到 python。请安装 Python 3 后重试:
  echo   Microsoft Store 搜索 "Python 3" 或访问 https://www.python.org/downloads/
  pause
)
