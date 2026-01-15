@echo off
echo Starting OpenCode server via Docker...

docker run -it --rm ^
  -v "%cd%":/app ^
  -p 4150:4150 ^
  -p 3000:3000 ^
  -w /app ^
  bun:latest ^
  sh -c "bun install && bun run --cwd packages/opencode src/index.ts serve --port 4150"

echo Server stopped.
