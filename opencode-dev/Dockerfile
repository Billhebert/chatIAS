# Dockerfile completo do SUATEC - Agente IA Multi-Tenant
# Este container inclui: OpenCode Dev + Projeto-SDK + Frontend + Backend

FROM oven/bun:1.3.5 AS base

# ============================================
# Stage 1: Dependências do OpenCode Dev
# ============================================
FROM base AS deps

WORKDIR /app

# Copia apenas arquivos necessários para install
COPY package.json bun.lock .gitignore ./
COPY patches/ ./patches/
COPY turbo.json ./
COPY tsconfig.json ./

# Instala dependências
RUN bun install

# ============================================
# Stage 2: Build do OpenCode Dev
# ============================================
FROM base AS build

WORKDIR /app

# Copia lockfile e install
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/bun.lock ./
COPY --from=deps /app/package.json ./

# Copia source
COPY . .

# Build do workspace
RUN bun run build

# ============================================
# Stage 3: Container Final
# ============================================
FROM base AS runner

WORKDIR /app

# Usuário não-root
RUN addgroup -g 1000 -S appgroup && \
    adduser -S appuser -u 1000 -G appgroup

# Copia arquivos do build
COPY --from=build /app ./

# Permissões
RUN chown -R appuser:appgroup /app

# Configuração de ambiente
ENV NODE_ENV=production
ENV PORT=3000
ENV SERVER_PORT=4150

# Portas expostas
EXPOSE 3000 4150

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4150/global/health || exit 1

# Executa como usuário não-root
USER appuser

# Scripts de entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
