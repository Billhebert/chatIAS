#!/bin/bash

# ChatIAS Simple Setup for WSL
# Builds only the frontend and starts containers

set -e

echo "🚀 ChatIAS Setup"

# Verificar se WSL
if ! command -v wslpath &> /dev/null; then
    echo "⚠️  This script is designed for WSL. Running on Linux may work but is untested."
fi

# Navegar para o diretório do projeto
cd "$(dirname "$0")"

# Verificar se os pacotes web existem
if [ ! -d "packages/web/dist" ]; then
    echo "📦 Building frontend..."
    if command -v bun &> /dev/null; then
        cd packages/web && bun install && bun run build
    elif command -v npm &> /dev/null; then
        cd packages/web && npm install && npm run build
    else
        echo "❌ Error: Neither bun nor npm is installed"
        exit 1
    fi
    cd ../..
fi

echo "🐳 Starting Docker containers..."

# Iniciar containers
docker compose up -d

echo ""
echo "✅ ChatIAS is running!"
echo ""
echo "📋 URLs:"
echo "   Web:     http://localhost"
echo "   API:     http://localhost:3001"
echo "   Health:  http://localhost:3001/health"
echo ""
echo "📦 Database:"
echo "   Host:    localhost:5432"
echo "   User:    chatias"
echo "   Password: chatias_secret"
echo "   Database: chatias"
