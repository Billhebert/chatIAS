#!/bin/bash

# ChatIAS Docker Manager - Simplified for WSL

cd "$(dirname "$0")"

case "$1" in
  up)
    echo "🚀 Starting ChatIAS..."
    docker compose up -d
    echo ""
    echo "✅ ChatIAS is running!"
    echo "   Web + API Proxy: http://localhost"
    echo "   API Direct: http://localhost:3001"
    echo "   PostgreSQL: localhost:5432"
    echo "   Redis: localhost:6379"
    ;;
  down)
    echo "🛑 Stopping ChatIAS..."
    docker compose down
    ;;
  restart)
    echo "🔄 Restarting ChatIAS..."
    docker compose restart
    ;;
  logs)
    docker compose logs -f "${2:-}"
    ;;
  status)
    docker compose ps
    ;;
  clean)
    echo "🧹 Cleaning up..."
    docker compose down -v
    echo "✅ Cleanup complete!"
    ;;
  db:shell)
    docker compose exec postgres psql -U chatias -d chatias
    ;;
  help|*)
    echo "ChatIAS Docker Manager"
    echo ""
    echo "Usage: ./docker.sh <command>"
    echo ""
    echo "Commands:"
    echo "  up          Start all services"
    echo "  down        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs        Show logs"
    echo "  status      Show container status"
    echo "  clean       Stop and remove all data"
    echo "  db:shell    Get PostgreSQL shell"
    echo "  help        Show this help"
    ;;
esac
