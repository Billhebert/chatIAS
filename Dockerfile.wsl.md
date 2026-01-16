# ChatIAS 3.0 - Docker Setup for WSL

## Pré-requisitos

1. **WSL2** instalado e configurado
2. **Docker Desktop** com integração WSL2 habilitada
3. **Ubuntu** (ou outra distribuição) no WSL

## Instalação do Docker no WSL (se necessário)

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Adicionar repositório Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Iniciar Docker
sudo service docker start
```

## Configuração do Docker Desktop

1. Abrir Docker Desktop
2. Ir em **Settings** → **Resources** → **WSL Integration**
3. Habilitar sua distribuição WSL (ex: Ubuntu)
4. Aplicar e reiniciar

## Rodando o ChatIAS

### 1. Navegar para o diretório do projeto

```bash
cd /mnt/e/Vinicius/chat/chatIAS
# ou
cd ~/chat/chatIAS  # se o projeto estiver na home
```

### 2. Criar arquivo .env (opcional)

```bash
cp .env.example .env
# Editar se necessário
```

### 3. Subir os containers

```bash
# Construir e iniciar
docker compose up --build

# Ou em modo detach (background)
docker compose up --build -d
```

### 4. Verificar logs

```bash
docker compose logs -f
```

### 5. Parar os containers

```bash
docker compose down
```

## Serviços Disponíveis

| Serviço | URL | Porta |
|---------|-----|-------|
| Web Dashboard | http://localhost | 80 |
| API Server | http://localhost:3001 | 3001 |
| PostgreSQL | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

## Comandos Úteis

```bash
# Ver status dos containers
docker compose ps

# Reiniciar um serviço específico
docker compose restart api

# Ver logs de um serviço específico
docker compose logs -f api

# Parar e remover volumes (perde dados)
docker compose down -v

# Rebuild após mudanças
docker compose build --no-cache
```

## Estrutura dos Containers

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Web (80)  │───>│  API (3001) │───>│PostgreSQL   │     │
│  │  (Nginx)    │    │  (Node)     │    │  (5432)     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                           │                                 │
│                           │                                 │
│                      ┌─────────────┐                       │
│                      │   Redis     │                       │
│                      │   (6379)    │                       │
│                      └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Problemas Comuns

### Porta já em uso

```bash
# Verificar o que está usando a porta
sudo lsof -i :80

# Matar o processo
sudo kill -9 <PID>
```

### Permissão negada

```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Reiniciar sessão
exit
# Entrar novamente no WSL
```

### WSL não aparece no Docker Desktop

1. Verificar se WSL2 está instalado: `wsl --version`
2. Habilitar no Docker Desktop: Settings → Resources → WSL Integration
3. Reiniciar Docker Desktop

## Variáveis de Ambiente

Consulte o arquivo `.env.example` para todas as variáveis disponíveis.

## Desenvolvimento com Hot Reload

Para desenvolvimento com hot reload, use os scripts de desenvolvimento local:

```bash
# API
cd packages/api && npm run dev

# Web
cd packages/web && npm run dev
```

O Docker é recomendado apenas para produção ou testes de integração.
