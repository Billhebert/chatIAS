# 🔧 Troubleshooting - ChatIAS

## Problemas Comuns e Soluções

### 1. "Falha ao criar sessão" ou "ID não encontrado na resposta"

**Causa**: O OpenCode SDK não está instalado ou não está rodando corretamente.

**Soluções**:

**Opção A: Use a versão standalone (recomendado para testes)**
```bash
node chat-standalone.js
```

Esta versão funciona sem OpenCode e demonstra:
- Sistema modular de agentes
- Sistema de tools
- MCP servers
- Fallback Ollama (se disponível)

**Opção B: Instale o OpenCode CLI**
```bash
# Instalar globalmente
npm install -g @opencode-ai/cli

# Verificar instalação
opencode --version

# Iniciar servidor
opencode serve --port 4096
```

Depois execute:
```bash
node chat.js
```

### 2. "Ollama não está disponível"

**Causa**: Ollama não está instalado ou não está rodando.

**Solução**:

```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Baixe de https://ollama.ai/download

# Baixar modelos
ollama pull llama3.2
ollama pull qwen2.5-coder
ollama pull deepseek-coder-v2

# Verificar
ollama list
```

### 3. "spawn opencode-cli.exe ENOENT"

**Causa**: No Windows, o OpenCode CLI não está no PATH ou não foi encontrado.

**Solução**:

```bash
# Verificar onde está instalado
npm list -g @opencode-ai/cli

# Adicionar ao PATH ou usar caminho completo
# No .env:
OPENCODE_CLI_PATH="C:\\caminho\\para\\opencode-cli.exe"
```

### 4. "Porta 4096 em uso"

**Causa**: Já existe um processo usando a porta 4096.

**Solução**:

```bash
# Opção 1: Mude a porta no .env
echo "SDK_PORT=4097" >> .env

# Opção 2: Mate o processo usando a porta
# Linux/Mac
lsof -i :4096
kill -9 <PID>

# Windows
netstat -ano | findstr :4096
taskkill /PID <PID> /F
```

### 5. Todos os modelos remotos falham

**Causa**: Problemas de rede ou API keys inválidas.

**Solução**:

```bash
# 1. Verifique sua conexão
ping api.openrouter.ai

# 2. Configure API keys no .env
OPENROUTER_API_KEY=sk-or-v1-...
OPENCODE_API_KEY=...

# 3. Use Ollama como alternativa
node chat-standalone.js
```

### 6. "Cannot find module"

**Causa**: Dependências não instaladas.

**Solução**:

```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### 7. Erros de TypeScript

**Causa**: Versões incompatíveis de TypeScript.

**Solução**:

```bash
# Atualizar TypeScript
npm install typescript@latest --save-dev

# Ou use apenas JavaScript (remova imports de tipos)
```

## Modos de Execução

### Modo 1: Completo (com OpenCode SDK)

**Requisitos**:
- OpenCode CLI instalado
- Servidor OpenCode rodando

**Comando**:
```bash
node chat.js
```

**Funcionalidades**:
- ✅ 12 modelos remotos
- ✅ Ollama como fallback
- ✅ Sistema de sessões
- ✅ Todas as APIs do SDK

### Modo 2: Standalone (sem OpenCode SDK)

**Requisitos**:
- Apenas Ollama (opcional)

**Comando**:
```bash
node chat-standalone.js
```

**Funcionalidades**:
- ✅ Sistema modular completo
- ✅ Agentes
- ✅ Tools
- ✅ MCP servers
- ✅ Ollama (se disponível)
- ❌ Modelos remotos (simulados)

### Modo 3: Demo do Sistema Modular

**Requisitos**:
- Nenhum

**Comando**:
```bash
node examples/demo-modular-system.js
```

**Funcionalidades**:
- ✅ Demonstra agentes
- ✅ Demonstra tools
- ✅ Demonstra MCP
- ✅ Demonstra Ollama
- ✅ Funciona sempre

## Verificação de Ambiente

Execute este script para verificar seu ambiente:

```bash
# Verificar Node.js
node --version  # Requer v18+

# Verificar npm
npm --version

# Verificar OpenCode (opcional)
opencode --version

# Verificar Ollama (opcional)
curl http://localhost:11434/api/tags

# Verificar dependências
npm list
```

## Logs de Debug

### Habilitar logs detalhados

Edite `chat.js` e descomente as linhas de debug:

```javascript
// No método createSession, já há logs de debug
console.log("Debug - Resposta completa:", JSON.stringify(sessionRes, null, 2));
```

### Ver estrutura da resposta

```javascript
// Adicione antes de processar a resposta
console.log("Tipo:", typeof sessionRes);
console.log("Keys:", Object.keys(sessionRes));
console.log("JSON:", JSON.stringify(sessionRes, null, 2));
```

## Perguntas Frequentes

### Q: Preciso do OpenCode instalado?

**R**: Não, você pode usar `chat-standalone.js` que funciona sem OpenCode.

### Q: Preciso do Ollama?

**R**: Não, mas é recomendado como fallback. O sistema funciona sem ele, apenas não terá o fallback final.

### Q: Qual é a diferença entre chat.js e chat-standalone.js?

**R**:
- `chat.js`: Versão completa com OpenCode SDK (12 modelos remotos + Ollama)
- `chat-standalone.js`: Versão sem OpenCode (apenas Ollama + sistema modular)

### Q: Como sei se está funcionando?

**R**: Execute `node examples/demo-modular-system.js`. Se mostrar os sistemas modulares, está funcionando.

### Q: Os modelos remotos não estão funcionando

**R**: Isso é esperado se o OpenCode não estiver instalado. Use `chat-standalone.js` ou instale o OpenCode CLI.

## Suporte

### Documentação

- [README.md](README.md) - Documentação principal
- [QUICKSTART.md](QUICKSTART.md) - Início rápido
- [OpenCode Docs](https://opencode.ai/docs/)
- [Ollama Docs](https://ollama.ai/)

### Reportar Problemas

1. Execute com debug habilitado
2. Copie os logs completos
3. Abra uma issue em: https://github.com/Billhebert/chatIAS/issues

### Informações úteis para reportar

```bash
# Sistema
uname -a  # Linux/Mac
ver       # Windows

# Node.js
node --version
npm --version

# OpenCode (se instalado)
opencode --version

# Ollama (se instalado)
ollama list

# Dependências
npm list --depth=0

# Logs
node chat.js 2>&1 | tee error.log
```
