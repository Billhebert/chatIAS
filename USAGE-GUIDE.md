# 📖 Guia de Uso Completo - ChatIAS

Este guia mostra como usar **TODAS** as funcionalidades implementadas.

## 🧪 Validar que Tudo Funciona

```bash
node test-all.js
```

**Resultado esperado**: `39/39 testes passaram (100%)`

---

## 1️⃣ Sistema de Ollama (Fallback)

### Como funciona

O Ollama é automaticamente acionado quando os 12 modelos remotos falharem.

### Exemplo de uso direto

```javascript
import { createOllamaClient } from "./lib/ollama/index.js";

const ollamaClient = createOllamaClient({
  baseUrl: "http://localhost:11434",
  models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
});

// Verificar disponibilidade
const available = await ollamaClient.isAvailable();
console.log("Ollama disponível:", available);

// Listar modelos instalados
const models = await ollamaClient.listModels();
console.log("Modelos:", models);

// Gerar texto com fallback automático
const result = await ollamaClient.generateWithFallback("Olá, como você está?", {
  temperature: 0.7,
});

if (result.success) {
  console.log("Resposta:", result.response);
  console.log("Modelo usado:", result.model);
}

// Gerar com modelo específico
const result2 = await ollamaClient.generate("llama3.2", "Conte uma piada");

// Chat
const result3 = await ollamaClient.chat([
  { role: "user", content: "Olá!" },
  { role: "assistant", content: "Oi! Como posso ajudar?" },
  { role: "user", content: "Me conte sobre IA" }
], "llama3.2");
```

### Integração no chat.js

O Ollama já está integrado! Veja `chat.js` linhas 100-124:

```javascript
// Quando todos os 12 modelos remotos falharem:
const ollamaResponse = await this.ollamaClient.generateWithFallback(prompt, {
  temperature: 0.7,
});
```

---

## 2️⃣ Sistema de Tools Customizadas

### Como funciona

Tools são funções que podem ser executadas dinamicamente. Você pode registrar, executar, habilitar/desabilitar tools.

### Exemplo de uso

```javascript
import { globalToolRegistry } from "./lib/tools/index.js";
import { ollamaTool, ollamaChatTool, ollamaStatusTool } from "./lib/tools/ollama-tool.js";

// Registrar tools Ollama
globalToolRegistry.register("ollama_generate", ollamaTool);
globalToolRegistry.register("ollama_chat", ollamaChatTool);
globalToolRegistry.register("ollama_status", ollamaStatusTool);

// Criar tool customizada
globalToolRegistry.register("my_custom_tool", {
  description: "Minha tool customizada",
  enabled: true,
  parameters: {
    input: { type: "string", required: true },
    multiplier: { type: "number", required: false, default: 2 }
  },
  async execute({ input, multiplier = 2 }) {
    return {
      result: input.repeat(multiplier),
      length: input.length * multiplier
    };
  }
});

// Executar tool
const result = await globalToolRegistry.execute("my_custom_tool", {
  input: "teste",
  multiplier: 3
});
console.log(result); // { result: "testetesteteste", length: 15 }

// Listar tools
console.log("Tools ativas:", globalToolRegistry.list(true));

// Habilitar/Desabilitar
globalToolRegistry.disable("my_custom_tool");
globalToolRegistry.enable("my_custom_tool");

// Remover tool
globalToolRegistry.unregister("my_custom_tool");
```

### Tools Ollama pré-configuradas

```javascript
// Executar status do Ollama
const status = await globalToolRegistry.execute("ollama_status");
console.log("Ollama disponível:", status.available);
console.log("Modelos:", status.models);

// Gerar texto com Ollama
const generate = await globalToolRegistry.execute("ollama_generate", {
  prompt: "Escreva um poema",
  model: "llama3.2", // opcional
  temperature: 0.7
});

// Chat com Ollama
const chat = await globalToolRegistry.execute("ollama_chat", {
  messages: [
    { role: "user", content: "Olá!" }
  ],
  model: "llama3.2"
});
```

---

## 3️⃣ Sistema de Agentes

### Como funciona

Agentes são perfis configuráveis com diferentes temperaturas, ferramentas e permissões.

### Exemplo de uso

```javascript
import { globalAgentManager } from "./lib/agents/index.js";

// Registrar agente
globalAgentManager.register("my-agent", {
  description: "Meu agente customizado",
  mode: "primary", // ou "subagent" ou "all"
  temperature: 0.5,
  maxSteps: 30,
  tools: {
    "*": true, // todas as tools
    "bash": "ask", // pedir confirmação
    "edit": false // desabilitar edição
  },
  enabled: true
});

// Obter agente
const agent = globalAgentManager.get("my-agent");
console.log(agent);

// Listar agentes
console.log("Todos:", globalAgentManager.list());
console.log("Ativos:", globalAgentManager.list({ enabled: true }));
console.log("Primários:", globalAgentManager.listPrimary());
console.log("Subagentes:", globalAgentManager.listSubagents());

// Configurar tools
globalAgentManager.setTools("my-agent", {
  webfetch: true,
  bash: "allow"
});

// Configurar permissões
globalAgentManager.setPermissions("my-agent", {
  bash: {
    "git *": "allow",
    "*": "ask"
  }
});

// Habilitar/Desabilitar
globalAgentManager.disable("my-agent");
globalAgentManager.enable("my-agent");

// Remover
globalAgentManager.unregister("my-agent");
```

### Exemplo prático: Agente de análise

```javascript
// Agente que apenas lê código, sem modificar
globalAgentManager.register("code-reviewer", {
  description: "Revisa código sem modificar",
  mode: "primary",
  temperature: 0.2, // mais determinístico
  tools: {
    read: true,
    grep: true,
    glob: true,
    edit: false, // não pode editar
    write: false, // não pode escrever
    bash: "ask" // pede confirmação
  }
});

// Agente que escreve código
globalAgentManager.register("code-writer", {
  description: "Escreve e modifica código",
  mode: "primary",
  temperature: 0.3,
  tools: {
    "*": true // todas as ferramentas
  }
});

// Usar filtros
const readOnlyAgents = globalAgentManager.list({ enabled: true })
  .filter(a => !a.tools.edit && !a.tools.write);

console.log("Agentes read-only:", readOnlyAgents);
```

---

## 4️⃣ Sistema de MCP Servers

### Como funciona

MCP (Model Context Protocol) servers estendem funcionalidades através de servidores externos.

### Exemplo de uso

```javascript
import { globalMCPManager } from "./lib/mcp/index.js";

// Registrar servidor MCP local
globalMCPManager.registerLocal("filesystem", {
  command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
  args: ["/path/to/directory"],
  env: { DEBUG: "true" },
  timeout: 5000,
  enabled: true
});

// Registrar servidor MCP remoto
globalMCPManager.registerRemote("api-server", {
  url: "https://api.example.com/mcp",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
  },
  auth: {
    type: "oauth",
    clientId: "your-client-id"
  },
  enabled: true
});

// Iniciar servidor local
await globalMCPManager.startLocal("filesystem");

// Parar servidor local
globalMCPManager.stopLocal("filesystem");

// Listar servidores
console.log("Todos:", globalMCPManager.list());
console.log("Ativos:", globalMCPManager.list(true));

// Habilitar/Desabilitar
globalMCPManager.disable("filesystem");
globalMCPManager.enable("filesystem");

// Parar todos os servidores
globalMCPManager.stopAll();
```

### Exemplo prático: MCP de banco de dados

```javascript
// Servidor MCP para PostgreSQL
globalMCPManager.registerLocal("postgres-mcp", {
  command: ["npx", "-y", "@modelcontextprotocol/server-postgres"],
  args: [],
  env: {
    POSTGRES_URL: "postgresql://user:pass@localhost:5432/db"
  },
  timeout: 10000,
  enabled: true
});

await globalMCPManager.startLocal("postgres-mcp");

// Agora o MCP server está rodando e pode ser usado
// para queries, schemas, etc.
```

---

## 5️⃣ Usar Tudo Junto

### Exemplo completo

```javascript
import { createOpencode } from "./sdk/index.js";
import { createOllamaClient } from "./lib/ollama/index.js";
import { globalToolRegistry } from "./lib/tools/index.js";
import { globalAgentManager } from "./lib/agents/index.js";
import { globalMCPManager } from "./lib/mcp/index.js";
import { ollamaTool, ollamaChatTool, ollamaStatusTool } from "./lib/tools/ollama-tool.js";

async function main() {
  // 1. Inicializar OpenCode SDK
  const { client, server } = await createOpencode({
    hostname: "127.0.0.1",
    port: 4096
  });

  // 2. Inicializar Ollama
  const ollamaClient = createOllamaClient();

  // 3. Registrar tools
  globalToolRegistry.register("ollama_generate", ollamaTool);
  globalToolRegistry.register("ollama_chat", ollamaChatTool);
  globalToolRegistry.register("ollama_status", ollamaStatusTool);

  // 4. Registrar agentes
  globalAgentManager.register("chat", {
    description: "Agente de chat",
    mode: "primary",
    temperature: 0.7,
    enabled: true
  });

  // 5. Registrar MCP servers
  globalMCPManager.registerLocal("filesystem", {
    command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
    args: [process.cwd()],
    enabled: false // desabilitado por padrão
  });

  // 6. Usar sistema
  const sessionRes = await client.session.create({
    body: { title: "Minha Sessão" }
  });
  const sessionId = sessionRes.data.id;

  // Tentar com modelos remotos
  try {
    const result = await client.session.prompt({
      path: { id: sessionId },
      body: {
        model: { providerID: "opencode", modelID: "minimax-m2.1-free" },
        parts: [{ type: "text", text: "Olá!" }]
      }
    });

    console.log("Resposta (remoto):", result.data);
  } catch (error) {
    // Fallback para Ollama
    const ollamaResult = await ollamaClient.generateWithFallback("Olá!");
    console.log("Resposta (Ollama):", ollamaResult.response);
  }

  // 7. Cleanup
  globalMCPManager.stopAll();
  await server.close();
}

main();
```

---

## 6️⃣ Testar Componentes Individualmente

### Testar apenas Ollama

```bash
node -e "
import('./lib/ollama/index.js').then(async ({ createOllamaClient }) => {
  const client = createOllamaClient();
  const available = await client.isAvailable();
  console.log('Ollama disponível:', available);
  if (available) {
    const models = await client.listModels();
    console.log('Modelos:', models.map(m => m.name));
  }
});
"
```

### Testar apenas Tools

```bash
node -e "
import('./lib/tools/index.js').then(async ({ globalToolRegistry }) => {
  globalToolRegistry.register('test', {
    description: 'Teste',
    execute: async () => ({ ok: true })
  });
  const result = await globalToolRegistry.execute('test');
  console.log('Resultado:', result);
});
"
```

### Testar apenas Agentes

```bash
node -e "
import('./lib/agents/index.js').then(({ globalAgentManager }) => {
  globalAgentManager.register('test', {
    description: 'Teste',
    mode: 'primary',
    enabled: true
  });
  console.log('Agentes:', globalAgentManager.list());
});
"
```

---

## 7️⃣ Documentação Adicional

### Skills Disponíveis

Consulte os arquivos em `.opencode/skill/`:

- **ollama-integration** - Como usar Ollama
- **multi-model-fallback** - Sistema de fallback
- **sdk-usage** - Uso completo do SDK

### Arquivos de Exemplo

- `production-example.js` - Exemplo de integração em produção
- `chat-standalone.js` - Versão sem OpenCode SDK (apenas testes)
- `examples/demo-modular-system.js` - Demo de todos os sistemas

---

## 📊 Verificar Status

```javascript
import { globalToolRegistry } from "./lib/tools/index.js";
import { globalAgentManager } from "./lib/agents/index.js";
import { globalMCPManager } from "./lib/mcp/index.js";

console.log("📊 STATUS DO SISTEMA\n");
console.log("Tools registradas:", globalToolRegistry.list().length);
console.log("Tools ativas:", globalToolRegistry.list(true).length);
console.log("\nAgentes registrados:", globalAgentManager.list().length);
console.log("Agentes ativos:", globalAgentManager.list({ enabled: true }).length);
console.log("Agentes primários:", globalAgentManager.listPrimary().length);
console.log("Subagentes:", globalAgentManager.listSubagents().length);
console.log("\nMCP Servers:", globalMCPManager.list().length);
console.log("MCP ativos:", globalMCPManager.list(true).length);
```

---

## 🎯 Casos de Uso Práticos

### Caso 1: Chat com fallback para Ollama

```javascript
// Use chat.js diretamente - já implementado!
node chat.js
```

### Caso 2: Criar tool de processamento de dados

```javascript
globalToolRegistry.register("process_data", {
  description: "Processa dados JSON",
  parameters: {
    data: { type: "object", required: true },
    operation: { type: "string", required: true }
  },
  async execute({ data, operation }) {
    switch(operation) {
      case "sum":
        return Object.values(data).reduce((a, b) => a + b, 0);
      case "count":
        return Object.keys(data).length;
      default:
        throw new Error("Operação inválida");
    }
  }
});
```

### Caso 3: Agente especializado em documentação

```javascript
globalAgentManager.register("doc-writer", {
  description: "Escreve documentação técnica",
  mode: "primary",
  temperature: 0.3,
  tools: {
    read: true,
    write: true,
    grep: true,
    edit: true,
    bash: false // sem comandos bash
  }
});
```

---

## ✅ Checklist de Validação

Execute para garantir que tudo funciona:

```bash
# 1. Testes automatizados
node test-all.js

# 2. Chat com fallback
node chat.js

# 3. Demo do sistema modular
node examples/demo-modular-system.js

# 4. Exemplo de produção (se OpenCode estiver rodando)
node production-example.js
```

Se todos passarem: **🎉 Sistema 100% funcional!**
