@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 检查 node 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 18 或更高版本
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo 📦 首次启动，正在安装依赖...
    call npm install --registry=https://registry.npmmirror.com
)

echo.
echo 🚀 启动虾多多服务...
echo.
echo   本机访问: http://localhost:3000
echo.

REM 获取本机 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found_ip
)
:found_ip
if defined IP (
    echo   手机访问: http://%IP: =%:3000  （手机需连接同一WiFi）
    echo.
)

echo   按 Ctrl+C 停止服务
echo.

node server.js
pause
