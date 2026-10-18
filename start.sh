#!/bin/bash
# 虾多多 - 启动脚本（Mac / Linux）

cd "$(dirname "$0")"

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 18 或更高版本"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 首次启动，正在安装依赖..."
    npm install --registry=https://registry.npmmirror.com
fi

echo "🚀 启动虾多多服务..."
echo ""
echo "  本机访问: http://localhost:3000"
echo ""

# 获取本机 IP
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
if [ -n "$IP" ]; then
    echo "  手机访问: http://$IP:3000  （手机需连接同一WiFi）"
    echo ""
fi

echo "  按 Ctrl+C 停止服务"
echo ""

node server.js
