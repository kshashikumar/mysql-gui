#!/usr/bin/env bash
#
# mysql-gui 本地启动脚本
#
# 配置优先级: 命令行环境变量  >  .env 文件  >  脚本默认值
# 把你的真实连接信息写到 .env（该文件已 gitignore，不会被提交）。
#
set -euo pipefail
cd "$(dirname "$0")"

# 1) 读取 .env（若存在）
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

# 2) 配置（带默认值；macOS 的 5000 端口被 AirPlay 占用，默认用 5050）
: "${MYSQL_URL:=mysql://root:password@127.0.0.1:3306}"
: "${PORT:=5050}"

# 3) 前置检查
command -v node >/dev/null 2>&1 || { echo "✗ 未找到 node，请先安装 Node.js (>=16)"; exit 1; }

# 4) 后端依赖
if [ ! -d node_modules ]; then
    echo "→ 安装后端依赖..."
    npm install
fi

# 5) 前端产物（缺失则自动构建，首次较慢）
if [ ! -f src/public/mysql-gui-client/index.html.gz ]; then
    echo "→ 未找到前端构建产物，开始构建..."
    (
        cd client/mysql-gui-client
        [ -d node_modules ] || npm install
        npm run clean-build-compress
    )
fi

# 6) 在终端回显连接信息时把密码遮掉
MASKED_URL=$(printf '%s' "$MYSQL_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1****@#')

echo ""
echo "🚀 mysql-gui 已就绪"
echo "   数据库: ${MASKED_URL}"
echo "   打开:   http://127.0.0.1:${PORT}"
echo "           (浏览器请用 127.0.0.1，不要用 localhost —— 本机 IPv6 解析有问题)"
echo "   停止:   Ctrl+C"
echo ""

# 后端实际读取的环境变量名是 URL / PORT（见 src/config/dbConnector.js、src/index.js）
URL="$MYSQL_URL" PORT="$PORT" exec node src/index.js
