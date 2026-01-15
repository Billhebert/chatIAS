#!/bin/sh
# docker-entrypoint.sh - Script de entrada para o container SUATEC

set -e

echo "🚀 Iniciando SUATEC..."

# Verifica se é primeira execução
if [ ! -f "/app/.configured" ]; then
    echo "📦 Primeira execução - configurando..."

    # Copia arquivos de exemplo se não existirem
    if [ ! -f "/app/.env" ]; then
        cp "/app/.env.example" "/app/.env" 2>/dev/null || true
    fi

    # Cria marker
    touch "/app/.configured"
fi

# Função para iniciar servidor backend
start_backend() {
    echo "🔧 Iniciando servidor backend na porta ${SERVER_PORT:-4150}..."
    cd /app/packages/opencode
    exec bun run dev --port ${SERVER_PORT:-4150}
}

# Função para iniciar frontend
start_frontend() {
    echo "🌐 Iniciando frontend na porta ${PORT:-3000}..."
    cd /app/packages/app
    exec bun run dev --host 0.0.0.0 --port ${PORT:-3000}
}

# Parseia argumentos
case "$1" in
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    all)
        # Inicia ambos em background
        start_backend &
        BACKEND_PID=$!
        sleep 5
        start_frontend &
        FRONTEND_PID=$!

        # Espera ambos
        wait $BACKEND_PID $FRONTEND_PID
        ;;
    *)
        # Default: inicia ambos
        echo "📦 Modo: all (backend + frontend)"
        start_backend &
        BACKEND_PID=$!
        sleep 5
        start_frontend &
        FRONTEND_PID=$!

        # Cleanup
        trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
        wait
        ;;
esac
