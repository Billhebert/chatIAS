#!/bin/bash

# ChatIAS API Entry Point

set -e

echo "🚀 Starting ChatIAS API Server..."

# Verificar conexão com banco
echo "⏳ Checking database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

until pg_isready -h postgres -p 5432 -U chatias -d chatias; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Database not available after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "   Waiting for database... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "✅ Database connection verified!"

# Gerar Prisma Client se necessário
if [ ! -f /app/packages/database/node_modules/.prisma/client/index.js ]; then
  echo "🔧 Generating Prisma Client..."
  cd /app/packages/database
  npx prisma generate
fi

# Voltar para o diretório da API
cd /app

# Iniciar API
echo "🌐 Starting API server on port ${PORT:-3001}..."
exec npm start
