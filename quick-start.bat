@echo off
REM Quick Start Script - ChatIAS Pro 2.0 (Windows)

echo.
echo ========================================
echo   ChatIAS Pro 2.0 - Quick Start
echo ========================================
echo.

REM 1. Check OpenCode server
echo [1/5] Checking OpenCode server...
curl -s http://localhost:4096/global/health >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] OpenCode server is running (port 4096)
) else (
    echo [!!] OpenCode server is NOT running
    echo      Start it with:
    echo      E:\app\OpenCode\opencode-cli.exe serve --hostname=127.0.0.1 --port=4096
    echo.
    pause
)
echo.

REM 2. Check Ollama (optional)
echo [2/5] Checking Ollama server...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] Ollama is running (port 11434)
) else (
    echo [..] Ollama is NOT running (optional fallback)
)
echo.

REM 3. Test SDK directly
echo [3/5] Testing SDK directly...
echo ----------------------------------------
node test-sdk-prompt.js
echo ----------------------------------------
echo.

REM 4. Ask to continue
set /p continue="Did SDK test pass? (y/n): "
if /i not "%continue%"=="y" (
    echo.
    echo [!!] SDK test failed. Please configure OpenCode server with a free model.
    echo      See TESTING_INSTRUCTIONS.md for details.
    echo.
    pause
    exit /b 1
)
echo.

REM 5. Test ChatEngine
echo [4/5] Testing ChatEngine...
echo ----------------------------------------
node test-chat-quick.js
echo ----------------------------------------
echo.

REM 6. Ask to start server
set /p startserver="Start web server? (y/n): "
if /i "%startserver%"=="y" (
    echo.
    echo [5/5] Starting web server...
    echo ========================================
    echo    Open in browser:
    echo    http://localhost:4174/chat-v2
    echo ========================================
    echo.
    set OPENCODE_AUTOSTART=false
    node server-v2.js
) else (
    echo.
    echo [DONE] You can start the server manually with:
    echo        node server-v2.js
    echo.
    pause
)
