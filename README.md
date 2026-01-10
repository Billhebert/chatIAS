# ChatIAS

Sistema de chat inteligente com múltiplos modelos de IA e fallback Ollama, usando 100% do OpenCode SDK com arquitetura modular.

## 🚀 Características

- ✅ **15 modelos de IA** (12 remotos + 3 Ollama)
- ✅ **Fallback em cascata** automático
- ✅ **Arquitetura modular** para agentes, tools e MCP servers
- ✅ **100% OpenCode SDK** - todas as funcionalidades
- ✅ **Ollama como última opção** - privacidade e disponibilidade offline
- ✅ **Sistema de agentes** ativável/desativável
- ✅ **Tools customizadas** modulares
- ✅ **Suporte a MCP servers** (Model Context Protocol)
- ✅ **Skills** reutilizáveis

## 📦 Instalação

```bash
# Clonar repositório
git clone https://github.com/Billhebert/chatIAS.git
cd chatIAS

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env e configure SDK_PORT (padrão: 4096)
```

## 🦙 Configurar Ollama (Opcional mas Recomendado)

O Ollama funciona como fallback quando todos os modelos remotos falharem:

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Baixar modelos
ollama pull llama3.2
ollama pull qwen2.5-coder
ollama pull deepseek-coder-v2

# 3. Verificar instalação
ollama list
```

## 🎯 Uso

### 3 Modos de Execução

#### 1. Modo Completo (com OpenCode SDK)
```bash
node chat.js
```
**Requisitos**: OpenCode CLI instalado e rodando
**Funcionalidades**: Todos os 15 modelos + sistema modular completo

#### 2. Modo Standalone (sem OpenCode SDK) - **Recomendado para testes**
```bash
node chat-standalone.js
```
**Requisitos**: Nenhum (Ollama opcional)
**Funcionalidades**: Sistema modular completo + Ollama

#### 3. Modo Demo (apenas demonstração)
```bash
node examples/demo-modular-system.js
```
**Requisitos**: Nenhum
**Funcionalidades**: Demonstra todos os sistemas modulares

## 🏗️ Arquitetura

### Estrutura de Diretórios

```
chatIAS/
├── .opencode/               # Configurações OpenCode
│   ├── config.json         # Config principal
│   ├── agent/              # Agentes modulares
│   │   ├── chat.md
│   │   ├── code-analyst.md
│   │   ├── code-writer.md
│   │   ├── researcher.md
│   │   └── tester.md
│   └── skill/              # Skills reutilizáveis
│       ├── ollama-integration/
│       ├── multi-model-fallback/
│       └── sdk-usage/
├── lib/                    # Bibliotecas modulares
│   ├── agents/            # Sistema de agentes
│   ├── ollama/            # Cliente Ollama
│   ├── tools/             # Tools customizadas
│   └── mcp/               # Gerenciador MCP
├── sdk/                   # OpenCode SDK
├── chat.js               # Aplicação principal
└── package.json
```

### Sistema de Fallback

```
┌─────────────────────────────────────────┐
│ 1. Modelo Especificado                  │
│    ↓ (falhou?)                          │
├─────────────────────────────────────────┤
│ 2. Modelos OpenCode (2)                 │
│    - minimax-m2.1-free                  │
│    - glm-4.7-free                       │
│    ↓ (todos falharam?)                  │
├─────────────────────────────────────────┤
│ 3. Modelos OpenRouter Free (7)          │
│    - kat-coder-pro                      │
│    - gemini-2.0-flash-exp               │
│    - qwen3-coder                        │
│    - devstral-2512                      │
│    - llama-3.3-70b-instruct             │
│    - devstral-small-2507                │
│    - glm-4.5-air                        │
│    ↓ (todos falharam?)                  │
├─────────────────────────────────────────┤
│ 4. Modelos Zenmux (3)                   │
│    - mimo-v2-flash-free                 │
│    - glm-4.6v-flash-free                │
│    - kat-coder-pro-v1-free              │
│    ↓ (todos falharam?)                  │
├─────────────────────────────────────────┤
│ 5. 🦙 Ollama Local (3)                  │
│    - llama3.2                           │
│    - qwen2.5-coder                      │
│    - deepseek-coder-v2                  │
│    ↓ (todos falharam?)                  │
├─────────────────────────────────────────┤
│ ❌ Erro Final                           │
└─────────────────────────────────────────┘
```

## 🤖 Agentes

### Agentes Primários

- **chat** - Agente principal para conversas gerais
- **code-analyst** - Analisa código sem modificar (somente leitura)
- **code-writer** - Escreve e edita código

### Subagentes

- **researcher** - Pesquisa informações na web e código
- **tester** - Executa e analisa testes

### Gerenciar Agentes

```javascript
import { globalAgentManager } from "./lib/agents/index.js";

// Listar agentes
globalAgentManager.list({ enabled: true });

// Habilitar/Desabilitar
globalAgentManager.enable("code-analyst");
globalAgentManager.disable("code-analyst");

// Configurar ferramentas
globalAgentManager.setTools("chat", {
  bash: "ask",
  edit: true
});
```

## 🔧 Tools Customizadas

### Tools Ollama

- `ollama_generate` - Gera texto com Ollama
- `ollama_chat` - Chat usando Ollama
- `ollama_status` - Verifica status do Ollama

### Gerenciar Tools

```javascript
import { globalToolRegistry } from "./lib/tools/index.js";

// Executar tool
await globalToolRegistry.execute("ollama_status");

// Habilitar/Desabilitar
globalToolRegistry.enable("ollama_generate");
globalToolRegistry.disable("ollama_generate");

// Listar tools
globalToolRegistry.list(true); // apenas habilitadas
```

## 🔌 MCP Servers

Servidores MCP estendem funcionalidades através do Model Context Protocol.

### Gerenciar MCP

```javascript
import { globalMCPManager } from "./lib/mcp/index.js";

// Registrar servidor local
globalMCPManager.registerLocal("filesystem", {
  command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
  args: ["/path/to/dir"],
  enabled: true
});

// Iniciar servidor
await globalMCPManager.startLocal("filesystem");

// Parar servidor
globalMCPManager.stopLocal("filesystem");

// Habilitar/Desabilitar
globalMCPManager.enable("filesystem");
globalMCPManager.disable("filesystem");
```

## 📚 Skills

Skills são instruções reutilizáveis em formato Markdown.

### Skills Disponíveis

- **ollama-integration** - Integração com Ollama
- **multi-model-fallback** - Sistema de fallback
- **sdk-usage** - Guia completo do SDK

### Criar Nova Skill

```bash
mkdir -p .opencode/skill/my-skill
```

Crie `.opencode/skill/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Descrição da skill
license: MIT
---

# Minha Skill

Conteúdo da skill aqui...
```

## ⚙️ Configuração Avançada

### `.opencode/config.json`

```json
{
  "model": {
    "provider": "opencode",
    "model": "minimax-m2.1-free"
  },
  "agent": {
    "custom-agent": {
      "description": "Meu agente customizado",
      "mode": "primary",
      "temperature": 0.5,
      "tools": { "*": true }
    }
  },
  "tool": {
    "ollama": {
      "enabled": true,
      "priority": "fallback"
    }
  },
  "mcp": {
    "servers": {
      "my-server": {
        "type": "local",
        "command": ["npx", "my-mcp-server"],
        "enabled": true
      }
    }
  }
}
```

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env`:

```env
# OpenCode SDK
SDK_PORT=4096

# Ollama (opcional)
OLLAMA_URL=http://localhost:11434

# API Keys (se necessário)
OPENROUTER_API_KEY=sk-or-v1-...
```

## 🧪 Testes

```bash
# Testar sistema completo
node chat.js

# Verificar Ollama
curl http://localhost:11434/api/tags
```

## 📖 Documentação

- [OpenCode SDK](https://opencode.ai/docs/sdk/)
- [Agents](https://opencode.ai/docs/agents/)
- [Tools](https://opencode.ai/docs/tools/)
- [MCP Servers](https://opencode.ai/docs/mcp-servers/)
- [Skills](https://opencode.ai/docs/skills/)
- [Ollama](https://ollama.ai/)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

ISC

## 👤 Autor

ChatIAS Project

## 🙏 Agradecimentos

- OpenCode.ai pela excelente SDK
- Ollama pelo framework de modelos locais
- Comunidade open source
