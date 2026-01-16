# Stage 1: Build do frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json e instalar dependências do web
COPY packages/web/package*.json ./

# Instalar dependências do web
RUN npm install

# Copiar código fonte
COPY packages/web ./packages/web

# Build do frontend
WORKDIR /app/packages/web
RUN npm run build

# Stage 2: Nginx para servir frontend + API proxy
FROM nginx:alpine AS production

# Copiar built files
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Configurar proxy reverso para API
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy - conecta ao container da API via hostname
    location /api/ {
        proxy_pass http://chatias-api:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://chatias-api:3001/health;
    }

    # Assets cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
