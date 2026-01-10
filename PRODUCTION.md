# 🚀 ChatIAS - Guia de Produção

Este documento descreve como usar o ChatIAS em **ambiente de produção**.

## ⚠️ Importante

- **PRODUÇÃO**: `chat.js` e `production-example.js`
- **DESENVOLVIMENTO/TESTES**: `chat-standalone.js` e `examples/demo-modular-system.js`

## 📋 Pré-requisitos

### Obrigatórios

1. **Node.js 18+**
```bash
node --version  # v18.0.0 ou superior
```

2. **OpenCode CLI**
```bash
npm install -g @opencode-ai/cli
opencode --version
```

3. **Dependências do projeto**
```bash
npm install
```

### Opcionais (mas recomendados)

4. **Ollama** (para fallback)
```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Baixar modelos
ollama pull llama3.2
ollama pull qwen2.5-coder
ollama pull deepseek-coder-v2
```

## 🔧 Configuração

### 1. Variáveis de Ambiente

Crie arquivo `.env`:

```env
# OpenCode SDK (obrigatório)
SDK_PORT=4096

# Ollama (opcional - apenas para fallback)
OLLAMA_URL=http://localhost:11434

# API Keys (se necessário para providers)
OPENROUTER_API_KEY=sk-or-v1-...
```

### 2. Configuração OpenCode

Edite `.opencode/config.json` conforme necessário:

```json
{
  "model": {
    "provider": "opencode",
    "model": "minimax-m2.1-free"
  },
  "agent": {
    "chat": {
      "enabled": true
    }
  }
}
```

## 🚀 Execução em Produção

### Modo 1: Script Standalone

```bash
node chat.js
```

**Este é o modo principal de produção**. Inclui:
- ✅ 12 modelos remotos
- ✅ 3 modelos Ollama (fallback)
- ✅ Sistema modular completo
- ✅ Todas as funcionalidades

### Modo 2: Como Módulo

```javascript
import { ProductionChatClient } from "./production-example.js";

async function main() {
  const client = new ProductionChatClient({
    sdkPort: 4096
  });

  try {
    // Inicializar
    await client.initialize();

    // Criar sessão
    const sessionId = await client.createSession("Minha App");

    // Enviar mensagem
    const response = await client.sendMessage("Olá!");

    if (response.success) {
      console.log("Resposta:", response.data);
      console.log("Fonte:", response.source); // "remote" ou "ollama"
    }

    // Encerrar
    await client.shutdown();
  } catch (error) {
    console.error("Erro:", error);
    await client.shutdown();
  }
}

main();
```

## 📊 Monitoramento

### Logs

Os logs incluem:
- ✅ Status de inicialização
- ✅ Tentativas de modelos
- ✅ Sucessos e falhas
- ✅ Tempo de resposta (em metadata Ollama)

### Métricas

Acesse informações do sistema:

```javascript
// Status dos agentes
const agentes = globalAgentManager.list({ enabled: true });
console.log(`Agentes ativos: ${agentes.length}`);

// Status das tools
const tools = globalToolRegistry.list(true);
console.log(`Tools ativas: ${tools.length}`);

// Status dos MCP servers
const mcps = globalMCPManager.list(true);
console.log(`MCP servers: ${mcps.length}`);
```

## 🔄 Fluxo de Fallback

```
1. Modelo primário especificado (se houver)
   ↓ falhou?
2. Modelo OpenCode 1 (minimax-m2.1-free)
   ↓ falhou?
3. Modelo OpenCode 2 (glm-4.7-free)
   ↓ falhou?
4. Modelos OpenRouter (7 modelos)
   ↓ falharam?
5. Modelos Zenmux (3 modelos)
   ↓ falharam?
6. 🦙 Ollama modelo 1 (llama3.2)
   ↓ falhou?
7. 🦙 Ollama modelo 2 (qwen2.5-coder)
   ↓ falhou?
8. 🦙 Ollama modelo 3 (deepseek-coder-v2)
   ↓ falhou?
9. ❌ Retorna erro
```

## 🛡️ Tratamento de Erros

### Erros Fatais

O sistema lança erros em casos fatais:

```javascript
try {
  await client.initialize();
} catch (error) {
  if (error.message.includes("OpenCode SDK não inicializado")) {
    // SDK não está disponível
    console.error("Instale OpenCode CLI:");
    console.error("npm install -g @opencode-ai/cli");
    process.exit(1);
  }
}
```

### Fallback Gracioso

Quando um modelo falha, o sistema:
1. Loga o erro
2. Tenta próximo modelo automaticamente
3. Continua até Ollama
4. Só retorna erro se TUDO falhar

## 🔐 Segurança

### API Keys

**NUNCA** commite API keys:

```bash
# .gitignore já inclui
.env
*.key
```

Configure via variáveis de ambiente:

```javascript
// No código
const apiKey = process.env.OPENROUTER_API_KEY;
```

### Rate Limiting

Os providers têm rate limits. O fallback automático ajuda a distribuir carga.

## 📈 Performance

### Otimizações

1. **Timeout configurável**: Ajuste `timeout` no createOpencode()
2. **Cache de sessões**: Reutilize sessionId
3. **Modelos mais rápidos primeiro**: Lista ordenada por velocidade

### Benchmarks Típicos

- Modelos remotos: 1-5s por resposta
- Ollama local: 2-30s (depende de GPU)
- Criação de sessão: <500ms

## 🧪 Testes em Produção

### Health Check

```javascript
async function healthCheck() {
  const client = new ProductionChatClient();

  try {
    await client.initialize();
    await client.createSession("Health Check");

    const response = await client.sendMessage("ping");

    if (response.success) {
      console.log("✅ Sistema OK");
      return true;
    }

    console.error("❌ Sistema com problemas");
    return false;
  } catch (error) {
    console.error("❌ Sistema down:", error);
    return false;
  } finally {
    await client.shutdown();
  }
}
```

## 📞 Suporte

### Logs de Debug

Para debug detalhado, adicione:

```javascript
console.log("DEBUG:", JSON.stringify(response, null, 2));
```

### Reportar Problemas

1. Colete logs completos
2. Inclua versões (Node, OpenCode, Ollama)
3. Descreva comportamento esperado vs atual
4. Abra issue: https://github.com/Billhebert/chatIAS/issues

## 🚨 Troubleshooting

Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para problemas comuns.

## 📚 Documentação Adicional

- [README.md](README.md) - Visão geral
- [QUICKSTART.md](QUICKSTART.md) - Início rápido
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Solução de problemas
- [OpenCode Docs](https://opencode.ai/docs/)
- [Ollama Docs](https://ollama.ai/)

## 📝 Checklist de Deploy

- [ ] Node.js 18+ instalado
- [ ] OpenCode CLI instalado e rodando
- [ ] Ollama instalado (opcional)
- [ ] Dependências instaladas (`npm install`)
- [ ] `.env` configurado
- [ ] `.opencode/config.json` revisado
- [ ] Health check passou
- [ ] Logs configurados
- [ ] Monitoramento ativo

## 🎯 Próximos Passos

1. Configure seu ambiente seguindo este guia
2. Execute health check
3. Integre em sua aplicação
4. Configure monitoramento
5. Deploy! 🚀
