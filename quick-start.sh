#!/bin/bash
# Quick Start Script - ChatIAS Pro 2.0

echo "🚀 ChatIAS Pro 2.0 - Quick Start"
echo "================================"
echo ""

# 1. Check OpenCode server
echo "📡 Checking OpenCode server..."
curl -s http://localhost:4096/global/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ OpenCode server is running (port 4096)"
else
    echo "❌ OpenCode server is NOT running"
    echo "   Start it with:"
    echo "   E:/app/OpenCode/opencode-cli.exe serve --hostname=127.0.0.1 --port=4096"
    echo ""
    read -p "Press Enter to continue anyway or Ctrl+C to exit..."
fi
echo ""

# 2. Check Ollama (optional)
echo "🦙 Checking Ollama server..."
curl -s http://localhost:11434/api/tags > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Ollama is running (port 11434)"
else
    echo "⚠️  Ollama is NOT running (optional fallback)"
fi
echo ""

# 3. Test SDK directly
echo "🧪 Testing SDK directly..."
node test-sdk-prompt.js
echo ""

# 4. Ask to continue
read -p "Did SDK test pass? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ SDK test failed. Please configure OpenCode server with a free model."
    echo "   See TESTING_INSTRUCTIONS.md for details."
    exit 1
fi

# 5. Test ChatEngine
echo "🤖 Testing ChatEngine..."
node test-chat-quick.js
echo ""

# 6. Ask to start server
read -p "Start web server? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌐 Starting web server..."
    echo "   Open http://localhost:4174/chat-v2 in your browser"
    echo ""
    export OPENCODE_AUTOSTART=false
    node server-v2.js
fi
