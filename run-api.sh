#!/bin/sh

# ChatIAS Startup Script - Runs API in background + Nginx frontend

set -e

echo "🚀 Starting ChatIAS..."

# Iniciar API em background
echo "🌐 Starting API server..."
cd /app/packages/api
node dist/index.js &
API_PID=$!

# Aguardar API estar pronta
echo "⏳ Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ API is ready!"
        break
    fi
    sleep 1
done

# Iniciar Nginx
echo "🎯 Starting Nginx..."
nginx -g 'daemon off;'

# Se Nginx parar, matar API
trap "kill $API_PID 2>/dev/null" EXIT
