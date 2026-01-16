#!/bin/bash

# ChatIAS Database Initialization Script
# Execute after containers are up

set -e

echo "🚀 Initializing ChatIAS Database..."

# Esperar PostgreSQL estar pronto
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h localhost -p 5432 -U chatias -d chatias; do
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# Gerar Prisma Client
echo "🔧 Generating Prisma Client..."
cd /app/packages/database
npx prisma generate

# Rodar migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Seed inicial (opcional)
echo "🌱 Seeding database..."
# npx prisma db seed

echo "✅ Database initialization complete!"
