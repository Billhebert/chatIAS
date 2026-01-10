# 🚀 Quick Start Guide - ChatIAS

## Resumo Executivo

ChatIAS é um sistema de chat com IA que usa:
- **15 modelos de IA** em cascata (12 remotos + 3 Ollama locais)
- **Arquitetura 100% modular** para agentes, tools e MCP servers
- **Ollama como fallback final** quando tudo mais falhar

## ⚡ Instalação Rápida

```bash
# 1. Clone e instale
git clone https://github.com/Billhebert/chatIAS.git
cd chatIAS
npm install

# 2. Configure ambiente (opcional)
cp .env.example .env
# Edite .env se necessário (SDK_PORT padrão: 4096)

# 3. Execute
node chat.js
```

## 🦙 Ollama (Opcional mas Recomendado)

```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Baixar modelos
ollama pull llama3.2
ollama pull qwen2.5-coder
ollama pull deepseek-coder-v2

# Verificar
ollama list
```

## 📁 Estrutura do Projeto

```
chatIAS/
├── .opencode/          # Config OpenCode
│   ├── config.json    # Config principal
│   ├── agent/         # 5 agentes modulares
│   └── skill/         # 3 skills documentadas
├── lib/               # Bibliotecas
│   ├── agents/       # Gerenciador de agentes
│   ├── ollama/       # Cliente Ollama
│   ├── tools/        # Tools customizadas
│   └── mcp/          # MCP servers
├── examples/         # Exemplos
└── chat.js          # App principal
```

## 🎯 Uso Básico

### Executar Chat

```bash
node chat.js
```

### Demonstração do Sistema Modular

```bash
node examples/demo-modular-system.js
```

## 🤖 Gerenciar Agentes

```javascript
import { globalAgentManager } from "./lib/agents/index.js";

// Listar
globalAgentManager.list({ enabled: true });

// Habilitar/Desabilitar
globalAgentManager.enable("code-analyst");
globalAgentManager.disable("code-analyst");
```

### Agentes Disponíveis

- **chat** - Conversas gerais (primary)
- **code-analyst** - Análise de código (primary)
- **code-writer** - Escrever código (primary)
- **researcher** - Pesquisa (subagent)
- **tester** - Testes (subagent)

## 🔧 Gerenciar Tools

```javascript
import { globalToolRegistry } from "./lib/tools/index.js";

// Executar
await globalToolRegistry.execute("ollama_status");

// Habilitar/Desabilitar
globalToolRegistry.enable("ollama_generate");
globalToolRegistry.disable("ollama_generate");
```

### Tools Disponíveis

- **ollama_generate** - Gera texto com Ollama
- **ollama_chat** - Chat com Ollama
- **ollama_status** - Status do Ollama

## 🔌 Gerenciar MCP Servers

```javascript
import { globalMCPManager } from "./lib/mcp/index.js";

// Registrar servidor local
globalMCPManager.registerLocal("my-server", {
  command: ["npx", "-y", "my-mcp-package"],
  enabled: true
});

// Iniciar/Parar
await globalMCPManager.startLocal("my-server");
globalMCPManager.stopLocal("my-server");
```

## 🔄 Sistema de Fallback

```
Modelo Primário
    ↓ (falhou?)
OpenCode (2 modelos)
    ↓ (falharam?)
OpenRouter (7 modelos)
    ↓ (falharam?)
Zenmux (3 modelos)
    ↓ (falharam?)
🦙 Ollama (3 modelos locais)
    ↓ (falharam?)
❌ Erro
```

## 📝 Criar Custom Agent

Crie `.opencode/agent/my-agent.md`:

```markdown
---
name: my-agent
description: Meu agente customizado
mode: primary
temperature: 0.7
tools:
  "*": true
---

# My Agent

Instruções do agente aqui...
```

## 🔧 Criar Custom Tool

```javascript
import { globalToolRegistry } from "./lib/tools/index.js";

globalToolRegistry.register("my_tool", {
  description: "Minha tool",
  enabled: true,
  parameters: {
    input: { type: "string", required: true }
  },
  async execute({ input }) {
    return { result: `Processado: ${input}` };
  }
});
```

## 📚 Criar Skill

Crie `.opencode/skill/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Minha skill customizada
---

# My Skill

Conteúdo da skill...
```

## ⚙️ Configuração

### `.env`

```env
SDK_PORT=4096
OLLAMA_URL=http://localhost:11434
```

### `.opencode/config.json`

```json
{
  "model": {
    "provider": "opencode",
    "model": "minimax-m2.1-free"
  },
  "agent": {
    "my-agent": {
      "mode": "primary",
      "enabled": true
    }
  }
}
```

## 🆘 Troubleshooting

### OpenCode SDK não encontrado

```bash
# Certifique-se de ter o OpenCode instalado
npm install @opencode-ai/sdk
```

### Ollama não disponível

```bash
# Verifique se Ollama está rodando
curl http://localhost:11434/api/tags
```

### Porta em uso

```bash
# Mude a porta no .env
echo "SDK_PORT=4097" >> .env
```

## 📖 Documentação Completa

- [README.md](README.md) - Documentação completa
- [OpenCode SDK Docs](https://opencode.ai/docs/sdk/)
- [Ollama Docs](https://ollama.ai/)

## 💡 Exemplos

### Exemplo 1: Chat Simples

```javascript
const client = new ChatClient();
await client.initialize();
await client.createSession("Minha Sessão");
const response = await client.sendMessage([
  { type: "text", text: "Olá!" }
]);
```

### Exemplo 2: Usar Agente Específico

```javascript
globalAgentManager.enable("code-analyst");
// Agente code-analyst agora está ativo
```

### Exemplo 3: Testar Ollama

```bash
node examples/demo-modular-system.js
```

## 🎉 Pronto!

Você agora tem:
- ✅ Sistema de chat com 15 modelos
- ✅ Agentes modulares ativáveis/desativáveis
- ✅ Tools customizadas
- ✅ MCP servers integrados
- ✅ Ollama como fallback
- ✅ 100% OpenCode SDK

Para mais detalhes, veja [README.md](README.md)
