# 🤖 ChatEngine - Guia Completo

## 📖 Visão Geral

O **ChatEngine** é o coração do ChatIAS Pro 2.0. Ele é um motor de conversação inteligente que:
- ✅ Entende a intenção do usuário (intent detection)
- ✅ Roteia para o recurso correto (agente, ferramenta, ou resposta conversacional)
- ✅ Gerencia histórico de conversação
- ✅ Trabalha com múltiplos providers (Ollama primário, SDK como fallback)
- ✅ Registra logs detalhados de toda a interação

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     CHATENGINE                              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  1. RECEBE MENSAGEM                                    │ │
│  │     "Quanto é 2 + 2?"                                  │ │
│  └─────────────────┬─────────────────────────────────────┘ │
│                    │                                        │
│  ┌─────────────────▼─────────────────────────────────────┐ │
│  │  2. DETECTA INTENT (com LLM se necessário)            │ │
│  │     Intent: "tool"                                     │ │
│  │     Confidence: 0.95                                   │ │
│  │     Tool: "soma"                                       │ │
│  └─────────────────┬─────────────────────────────────────┘ │
│                    │                                        │
│  ┌─────────────────▼─────────────────────────────────────┐ │
│  │  3. ROTEIA PARA RECURSO CORRETO                       │ │
│  │                                                        │ │
│  │    ┌──────────┐  ┌──────────┐  ┌──────────┐          │ │
│  │    │Conversa  │  │  Agent   │  │   Tool   │          │ │
│  │    │  (LLM)   │  │ Registry │  │ Registry │          │ │
│  │    └──────────┘  └──────────┘  └──────────┘          │ │
│  └─────────────────┬─────────────────────────────────────┘ │
│                    │                                        │
│  ┌─────────────────▼─────────────────────────────────────┐ │
│  │  4. EXECUTA E RETORNA RESPOSTA                        │ │
│  │     "2 + 2 = 4"                                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Detecção de Intent

### Tipos de Intent

| Intent | Descrição | Exemplo |
|--------|-----------|---------|
| `conversational` | Conversa normal | "Olá, como vai?" |
| `tool` | Usar ferramenta específica | "Quanto é 5 + 3?" |
| `agent` | Usar agente | "Analise este código..." |
| `command` | Comando do sistema | "/clear" ou "/help" |

### Método de Detecção

O ChatEngine usa **dois métodos**:

1. **Regex (rápido, 90% dos casos)**
   ```javascript
   // Padrões definidos
   /quanto (é|e).*\+|soma|adicionar/i  → tool: soma
   /analise|análise|analyze/i          → agent: CodeAnalyzer
   /^\/.*/                              → command
   ```

2. **LLM (casos ambíguos, 10% dos casos)**
   ```javascript
   // Quando confiança < threshold (0.7)
   // Usa Ollama para determinar intent
   ```

### Exemplo de Resultado

```javascript
{
  intent: "tool",
  intentConfidence: 0.95,
  intentMethod: "regex",  // ou "llm"
  toolName: "soma",
  params: { a: 2, b: 2 }
}
```

---

## 🔄 Roteamento

### 1. Rota Conversacional

**Quando**: Intent = `conversational` ou confiança baixa

**Providers**:
- 🥇 **Ollama** (primário) - llama3.2 local
- 🥈 **SDK** (fallback) - Modelos remotos

**Exemplo**:
```javascript
Usuário: "Como você está?"
ChatEngine: [Ollama] "Estou bem, obrigado por perguntar!"
```

### 2. Rota de Ferramenta (Tool)

**Quando**: Intent = `tool` e ferramenta identificada

**Fluxo**:
1. Identifica nome da ferramenta
2. Extrai parâmetros da mensagem
3. Valida parâmetros
4. Executa ferramenta via ToolRegistry
5. Retorna resultado

**Exemplo**:
```javascript
Usuário: "Quanto é 10 + 5?"
ChatEngine:
  1. Intent: "tool" (soma)
  2. Params: { a: 10, b: 5 }
  3. Executa: soma.execute({ a: 10, b: 5 })
  4. Resultado: "10 + 5 = 15"
```

### 3. Rota de Agente (Agent)

**Quando**: Intent = `agent` e agente identificado

**Fluxo**:
1. Identifica nome do agente
2. Prepara contexto
3. Executa agente via AgentRegistry
4. Retorna resultado

**Exemplo**:
```javascript
Usuário: "Analise o código em main.js"
ChatEngine:
  1. Intent: "agent" (CodeAnalyzer)
  2. Contexto: { file: "main.js" }
  3. Executa: CodeAnalyzer.execute(context)
  4. Resultado: "Código analisado: 0 erros, 2 warnings"
```

### 4. Rota de Comando

**Quando**: Intent = `command` (mensagem inicia com `/`)

**Comandos disponíveis**:
- `/clear` - Limpa histórico
- `/help` - Mostra ajuda
- `/status` - Status do sistema

---

## 📝 Sistema de Histórico

### Configuração

```javascript
new ChatEngine({
  maxHistory: 20,  // Mantém últimas 20 mensagens
  // ...
})
```

### Estrutura do Histórico

```javascript
history = [
  {
    role: "user",
    content: "Olá!",
    timestamp: 1705000000000
  },
  {
    role: "assistant",
    content: "Olá! Como posso ajudar?",
    timestamp: 1705000001000,
    intent: "conversational",
    provider: "ollama"
  }
]
```

### Métodos

```javascript
// Obter histórico
const history = chatEngine.getHistory();

// Limpar histórico
chatEngine.clearHistory();

// Adicionar ao histórico manualmente
chatEngine.addToHistory("user", "Mensagem");
chatEngine.addToHistory("assistant", "Resposta");
```

---

## 📊 Sistema de Logs

### Categorias de Logs

| Categoria | Descrição | Exemplos |
|-----------|-----------|----------|
| `system` | Sistema geral | Inicialização, shutdown |
| `mcp` | Providers (Ollama, SDK) | Conexão, erros |
| `intent` | Detecção de intent | Regex match, LLM detection |
| `agent` | Execução de agentes | Agent chamado, resultado |
| `tool` | Execução de ferramentas | Tool chamada, resultado |
| `request` | HTTP requests | POST /api/chat |
| `response` | HTTP responses | 200 OK (150ms) |

### Níveis de Logs

| Nível | Uso | Cor |
|-------|-----|-----|
| `info` | Informação geral | 🔵 Azul |
| `success` | Operação bem-sucedida | 🟢 Verde |
| `warn` | Aviso | 🟡 Amarelo |
| `error` | Erro | 🔴 Vermelho |
| `debug` | Debug detalhado | ⚪ Branco |

### Uso no Código

```javascript
import { logger } from "./src/core/logger.js";

// Logs simples
logger.info('system', 'Server starting...');
logger.success('system', 'Server ready!');
logger.warn('mcp', 'SDK not reachable');
logger.error('system', 'Failed to connect', { error: err.message });

// Logs especializados
logger.request('POST', '/api/chat', { message: "Hi" }, 'req_123');
logger.response(200, 150, 'req_123');  // status, duration, requestId

// Obter logs
const logs = logger.getLogs({ 
  level: 'error',      // Filtrar por nível
  category: 'system',  // Filtrar por categoria
  limit: 50            // Limitar quantidade
});

// Estatísticas
const stats = logger.getStats();
// { total: 1234, byLevel: {...}, byCategory: {...} }
```

---

## 🚀 Como Usar

### 1. Inicialização Completa

```javascript
import { ChatEngine } from "./src/core/chat-engine.js";
import { logger } from "./src/core/logger.js";
import { createSystem } from "./src/core/system-loader.js";

// 1. Carregar sistema
const system = await createSystem({
  configPath: "./config/system-config.json"
});

// 2. Criar ChatEngine
const chatEngine = new ChatEngine({
  defaultModel: "llama3.2:latest",
  temperature: 0.7,
  maxTokens: 4000,
  maxHistory: 20,
  smartIntentDetection: true
});

// 3. Inicializar com recursos
await chatEngine.initialize({
  ollama: system.mcpRegistry.get("mcp_ollama"),
  sdk: sdkClient,
  toolRegistry: system.toolRegistry,
  agentRegistry: system.agentRegistry
});

// 4. Usar
const result = await chatEngine.chat("Olá!");
console.log(result.text);
```

### 2. Processar Mensagem

```javascript
const result = await chatEngine.chat("Quanto é 2 + 2?");

console.log(result);
// {
//   success: true,
//   text: "2 + 2 = 4",
//   intent: "tool",
//   intentConfidence: 0.95,
//   intentMethod: "regex",
//   provider: null,      // null pois foi tool, não LLM
//   usedAgent: null,
//   usedTool: "soma",
//   duration: 45,        // ms
//   requestId: "req_1705000000000",
//   logs: [...]
// }
```

### 3. Histórico

```javascript
// Ver histórico
const history = chatEngine.getHistory();
console.log(history.length);  // 20 (maxHistory)

// Limpar
chatEngine.clearHistory();
```

### 4. Informações do Sistema

```javascript
const info = chatEngine.getInfo();
console.log(info);
// {
//   activeProvider: "ollama",
//   availableProviders: ["ollama", "sdk"],
//   historySize: 5,
//   maxHistory: 20,
//   registeredTools: 3,
//   registeredAgents: 2
// }
```

---

## 🛠️ Adicionar Nova Ferramenta

### 1. Criar a Ferramenta

**Arquivo**: `src/tools/minha-tool.js`

```javascript
import { BaseTool } from "./base-tool.js";

export class MinhaToolTool extends BaseTool {
  constructor() {
    super({
      name: "minha_tool",
      description: "Descrição da ferramenta",
      enabled: true,
      parameters: {
        param1: { type: "string", required: true },
        param2: { type: "number", required: false }
      }
    });
  }

  async execute(params) {
    // Validar parâmetros
    this.validateParameters(params);

    // Lógica da ferramenta
    const result = this.processar(params.param1, params.param2);

    return {
      success: true,
      result: result
    };
  }

  processar(p1, p2) {
    // Implementação
    return `Processado: ${p1} ${p2}`;
  }
}
```

### 2. Registrar no Sistema

**Arquivo**: `config/system-config.json`

```json
{
  "tools": {
    "minha_tool": {
      "enabled": true,
      "path": "./src/tools/minha-tool.js",
      "className": "MinhaToolTool"
    }
  }
}
```

### 3. Adicionar Padrão de Intent

**Arquivo**: `src/core/chat-engine.js`

```javascript
// Adicionar em detectIntent()
const patterns = {
  tool: [
    // ... padrões existentes
    {
      regex: /minha tool|executar minha/i,
      toolName: "minha_tool",
      extractParams: (msg) => ({
        param1: msg.match(/\w+/)[0]
      })
    }
  ]
};
```

### 4. Testar

```javascript
const result = await chatEngine.chat("Executar minha tool teste");
// Deve detectar intent="tool", toolName="minha_tool"
// E executar MinhaToolTool.execute({ param1: "teste" })
```

---

## 🤖 Adicionar Novo Agente

### 1. Criar o Agente

**Arquivo**: `src/agents/meu-agente.js`

```javascript
import { BaseAgent } from "./base-agent.js";

export class MeuAgente extends BaseAgent {
  constructor() {
    super({
      name: "MeuAgente",
      description: "Descrição do agente",
      enabled: true,
      capabilities: ["capability1", "capability2"]
    });
  }

  async execute(context) {
    // Lógica do agente
    const result = await this.processar(context);

    return {
      success: true,
      result: result
    };
  }

  async processar(context) {
    // Implementação
    return `Processado: ${JSON.stringify(context)}`;
  }
}
```

### 2. Registrar no Sistema

**Arquivo**: `config/system-config.json`

```json
{
  "agents": {
    "meu_agente": {
      "enabled": true,
      "path": "./src/agents/meu-agente.js",
      "className": "MeuAgente"
    }
  }
}
```

### 3. Adicionar Padrão de Intent

**Arquivo**: `src/core/chat-engine.js`

```javascript
const patterns = {
  agent: [
    // ... padrões existentes
    {
      regex: /processar|execute meu agente/i,
      agentName: "meu_agente"
    }
  ]
};
```

### 4. Testar

```javascript
const result = await chatEngine.chat("Processar dados");
// Deve detectar intent="agent", agentName="meu_agente"
// E executar MeuAgente.execute({})
```

---

## 🔧 Configuração Avançada

### Ajustar Threshold de Confiança

```javascript
const chatEngine = new ChatEngine({
  intentConfidenceThreshold: 0.8  // Aumentar para usar menos LLM
});
```

- **Valor baixo (0.5)**: Usa mais LLM, mais preciso, mais lento
- **Valor alto (0.9)**: Usa mais regex, mais rápido, pode errar

### Ajustar Histórico

```javascript
const chatEngine = new ChatEngine({
  maxHistory: 10  // Reduzir para economizar memória
});
```

### Desabilitar Smart Intent

```javascript
const chatEngine = new ChatEngine({
  smartIntentDetection: false  // Nunca usa LLM para intent
});
```

---

## 📡 Endpoints da API

### POST /api/chat

**Envia mensagem ao chat**

```bash
curl -X POST http://localhost:4174/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá!"}'
```

**Resposta**:
```json
{
  "success": true,
  "response": "Olá! Como posso ajudar?",
  "intent": "conversational",
  "intentConfidence": 0.6,
  "intentMethod": "regex",
  "provider": "ollama",
  "duration": 250,
  "requestId": "req_1705000000000",
  "logs": [...]
}
```

### POST /api/chat/clear

**Limpa histórico**

```bash
curl -X POST http://localhost:4174/api/chat/clear
```

### GET /api/logs

**Obtém logs do sistema**

```bash
curl "http://localhost:4174/api/logs?category=intent&limit=10"
```

### GET /api/logs/stream

**Server-Sent Events para logs em tempo real**

```javascript
const eventSource = new EventSource('http://localhost:4174/api/logs/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.log);
};
```

### GET /api/tools

**Lista ferramentas disponíveis**

```bash
curl http://localhost:4174/api/tools
```

### GET /api/agents

**Lista agentes disponíveis**

```bash
curl http://localhost:4174/api/agents
```

### GET /api/health

**Health check**

```bash
curl http://localhost:4174/api/health
```

---

## 🎨 Interface Web

### Acessar

```
http://localhost:4174/chat-v2
```

### Funcionalidades

- ✅ Chat em tempo real
- ✅ Histórico de conversa
- ✅ Indicador de intent detectado
- ✅ Indicador de provider usado
- ✅ Logs em tempo real (lateral direita)
- ✅ Estatísticas do sistema (header)
- ✅ Limpar histórico
- ✅ Dark mode

---

## 🐛 Troubleshooting

### Erro: "ChatEngine não inicializado"

**Causa**: `chatEngine.initialize()` não foi chamado

**Solução**:
```javascript
await chatEngine.initialize({
  ollama: ollamaProvider,
  sdk: sdkClient,
  toolRegistry: system.toolRegistry,
  agentRegistry: system.agentRegistry
});
```

### Erro: "Ollama not connected"

**Causa**: Ollama não está rodando

**Solução**:
```bash
# Iniciar Ollama
ollama serve

# Verificar
curl http://localhost:11434/api/tags
```

### Intent sempre "conversational"

**Causa**: Padrões de regex não cobrem o caso

**Solução**: Adicionar padrão específico em `detectIntent()`

### LLM sempre usado para intent

**Causa**: Threshold muito alto ou regex não configurado

**Solução**: Ajustar `intentConfidenceThreshold` ou adicionar regex

---

## 📚 Referências

### Arquivos Importantes

- `src/core/chat-engine.js` - Motor principal
- `src/core/logger.js` - Sistema de logs
- `src/core/system-loader.js` - Carregador do sistema
- `server-v2.js` - Servidor Express
- `public/chat-v2.html` - Interface web
- `config/system-config.json` - Configuração

### Estrutura de Projeto

```
chatIAS/
├── src/
│   ├── core/
│   │   ├── chat-engine.js       # Motor do chat
│   │   ├── logger.js            # Sistema de logs
│   │   └── system-loader.js     # Carregador
│   ├── tools/                   # Ferramentas
│   │   ├── base-tool.js
│   │   ├── soma.js
│   │   └── ...
│   └── agents/                  # Agentes
│       ├── base-agent.js
│       └── ...
├── config/
│   └── system-config.json       # Configuração
├── public/
│   └── chat-v2.html             # Interface
├── server-v2.js                 # Servidor
└── package.json
```

---

## 🎉 Conclusão

O **ChatEngine** é o cérebro do ChatIAS Pro 2.0, oferecendo:
- 🧠 Detecção inteligente de intenção
- 🔄 Roteamento automático para recursos
- 📝 Sistema de logs detalhado
- 🌐 API REST completa
- 🎨 Interface web moderna
- 🔧 Fácil extensibilidade

Para adicionar novos recursos, basta:
1. Criar ferramenta/agente
2. Registrar no `system-config.json`
3. Adicionar padrão de intent (opcional)
4. Testar!

**Dúvidas?** Veja o código-fonte ou execute `node server-v2.js` para testar! 🚀
