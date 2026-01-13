# ChatIAS Pro 2.0 - Sistema Modular de Agentes IA

## 🎯 Visão Geral

ChatIAS Pro 2.0 é um sistema completo e modular para gerenciamento de agentes IA, ferramentas, bases de conhecimento e provedores MCP (Model Context Protocol). O sistema foi completamente reorganizado com foco em:

- **Governança**: Classes base garantem que todos os componentes sigam padrões
- **Configuração Declarativa**: Todo o sistema é configurado via JSON
- **Modularidade**: Fácil adicionar/remover componentes sem tocar no código
- **Padronização**: Todos os agentes, tools, KB e MCP seguem as mesmas interfaces
- **Observabilidade**: Métricas, logs e telemetria integrados
- **Fallback Automático**: SDK OpenCode com fallback para Ollama

## 🏗️ Arquitetura

```
chatIAS/
├── config/
│   └── system-config.json          # Configuração principal (JSON)
├── src/
│   ├── core/                        # Classes base e sistema
│   │   ├── base-agent.js           # Classe base para agentes
│   │   ├── base-tool.js            # Classe base para ferramentas
│   │   ├── base-mcp.js             # Classe base para MCP providers
│   │   ├── base-knowledge-base.js  # Classe base para KB
│   │   ├── config-schema.json      # Schema de validação
│   │   ├── config-validator.js     # Validador de configuração
│   │   └── system-loader.js        # Bootstrap do sistema
│   ├── agents/                      # Implementações de agentes
│   │   ├── code-analyzer.js        # Análise de código
│   │   └── data-processor.js       # Processamento de dados
│   ├── tools/                       # Implementações de ferramentas
│   │   ├── code-executor.js        # Execução de código
│   │   ├── json-parser.js          # Parse/validação JSON
│   │   └── file-reader.js          # Leitura de arquivos
│   ├── knowledge-base/              # Bases de conhecimento
│   │   ├── js-syntax.js            # Sintaxe JavaScript
│   │   ├── patterns.js             # Padrões de design
│   │   ├── json-schema.js          # JSON Schema
│   │   └── data-patterns.js        # Padrões de dados
│   └── mcp/                         # Provedores MCP
│       ├── ollama.js               # Ollama local (preferido)
│       └── openai.js               # OpenAI cloud (fallback)
├── logs/                            # Logs do sistema
└── example.js                       # Exemplos de uso
```

## 🚀 Início Rápido

### 1. Instalação

```bash
# Clone o repositório
git clone https://github.com/Billhebert/chatIAS.git
cd chatIAS

# Instale dependências
npm install

# Execute os exemplos
npm start
```

### 2. Uso Básico

```javascript
import { createSystem } from './src/core/system-loader.js';

// Inicializa o sistema (carrega tudo do JSON automaticamente)
const system = await createSystem({
  configPath: './config/system-config.json'
});

// Usa um agente
const result = await system.runAgent('code_analyzer', {
  code: 'const x = 10;',
  language: 'javascript',
  depth: 'standard'
});

// Usa uma ferramenta
const parsed = await system.runTool('json_parser', {
  json: '{"name": "Alice"}'
});

// Consulta knowledge base
const docs = await system.queryKnowledgeBase('js_syntax', 'async await');

// Cleanup
await system.destroy();
```

## 📋 Configuração (system-config.json)

### Estrutura Principal

```json
{
  "system": {
    "name": "ChatIAS Pro",
    "version": "2.0.0",
    "environment": "production",
    "strict": true,
    "hotReload": true
  },

  "routing": { ... },
  "middleware": { ... },
  "events": { ... },
  "toolSequences": { ... },
  "agents": { ... },
  "tools": { ... },
  "knowledgeBase": { ... },
  "mcp": { ... },
  "governance": { ... },
  "observability": { ... }
}
```

### Definindo um Agente

```json
{
  "agents": {
    "code_analyzer": {
      "id": "code_analyzer",
      "class": "CodeAnalyzerAgent",
      "file": "code-analyzer.js",
      "enabled": true,
      "version": "1.0.0",

      "description": "Analisa sintaxe, estilo e dependências de código-fonte",
      "tags": ["code", "analysis", "static"],

      "routing": {
        "keywords": ["code", "analyze", "syntax"],
        "priority": 1,
        "minConfidence": 0.7
      },

      "input": {
        "code": { "type": "string", "required": true },
        "language": { "type": "string", "default": "javascript" }
      },

      "subagents": [
        { "id": "syntax_checker", "class": "SyntaxCheckerAgent" }
      ],

      "tools": [
        { "id": "code_executor", "required": true }
      ],

      "knowledgeBase": [
        { "id": "js_syntax", "priority": "high" }
      ],

      "mcp": {
        "optional": ["mcp_ollama", "mcp_openai"]
      },

      "permissions": {
        "readFile": true,
        "executeCode": true
      }
    }
  }
}
```

### Definindo uma Tool

```json
{
  "tools": {
    "code_executor": {
      "id": "code_executor",
      "class": "CodeExecutor",
      "file": "code-executor.js",
      "enabled": true,

      "description": "Executa código JavaScript em sandbox seguro",
      "category": "execution",
      "tags": ["javascript", "execution"],

      "input": {
        "code": { "type": "string", "required": true },
        "timeout": { "type": "number", "default": 5000 }
      },

      "constraints": {
        "maxExecutionTime": 30000,
        "noFileSystem": true,
        "noNetwork": true
      },

      "actions": [
        {
          "id": "validate_syntax",
          "description": "Valida sintaxe JavaScript",
          "params": ["code"]
        },
        {
          "id": "execute",
          "description": "Executa código",
          "params": ["code", "timeout"]
        }
      ]
    }
  }
}
```

### Tool Sequences (Receitas)

Tool Sequences são sequências pré-definidas de ferramentas para resolver problemas específicos:

```json
{
  "toolSequences": {
    "analyze_code": {
      "id": "analyze_code",
      "name": "Análise Completa de Código",
      "description": "Analisa código em 3 fases",
      "triggeredBy": ["code_analyzer"],

      "steps": [
        {
          "order": 1,
          "tool": "code_executor",
          "action": "validate_syntax",
          "params": { "code": "${input.code}" },
          "onSuccess": "continue",
          "onError": "stop"
        },
        {
          "order": 2,
          "tool": "code_executor",
          "action": "check_style",
          "params": { "code": "${input.code}" },
          "onSuccess": "continue",
          "onError": "log_warning"
        }
      ]
    }
  }
}
```

## 🧩 Classes Base

### BaseAgent

Todos os agentes devem estender `BaseAgent`:

```javascript
import { BaseAgent } from '../core/base-agent.js';

export class MyAgent extends BaseAgent {
  async execute(input) {
    // Valida input automaticamente
    // this.validateInput() é chamado automaticamente

    // Usa subagente
    const result = await this.callSubagent('my_subagent', input);

    // Usa tool
    const toolResult = await this.useTool('my_tool', params);

    // Consulta KB
    const docs = await this.queryKnowledgeBase('my_kb', query);

    // Usa MCP
    const llmResult = await this.useMCP('mcp_ollama', 'generate', params);

    // Log
    this.log('Processing...', 'info');

    return { success: true, data: result };
  }

  // Hooks opcionais
  async onInit() { }
  async onDestroy() { }
  async beforeExecute(input) { return input; }
  async afterExecute(result) { return result; }
}
```

### BaseTool

Todas as tools devem estender `BaseTool`:

```javascript
import { BaseTool } from '../core/base-tool.js';

export class MyTool extends BaseTool {
  async execute(params) {
    // Implementação padrão
    return { success: true };
  }

  // Actions específicas
  async action_parse(params) {
    // Implementação da action 'parse'
  }

  async action_validate(params) {
    // Implementação da action 'validate'
  }
}
```

### BaseMCP

Todos os MCP providers devem estender `BaseMCP`:

```javascript
import { BaseMCP } from '../core/base-mcp.js';

export class MyMCPProvider extends BaseMCP {
  async connect() {
    // Conecta ao provider
  }

  async disconnect() {
    // Desconecta
  }

  async execute(action, params) {
    // Executa ação
  }

  async checkHealth() {
    // Health check
  }
}
```

### BaseKnowledgeBase

Todas as KBs devem estender `BaseKnowledgeBase`:

```javascript
import { BaseKnowledgeBase } from '../core/base-knowledge-base.js';

export class MyKnowledgeBase extends BaseKnowledgeBase {
  async loadDocuments() {
    // Carrega documentos
    this.addDocument({
      id: 'doc1',
      title: 'Document 1',
      content: 'Content here...',
      tags: ['tag1', 'tag2']
    });
  }

  async search(query) {
    // Implementa busca customizada
    return this.searchIndex(keywords);
  }
}
```

## 🎯 Features Principais

### 1. Governança e Padronização

- ✅ Todas as classes base garantem métodos obrigatórios
- ✅ Validação automática de input/params
- ✅ Lifecycle hooks (onInit, onDestroy, beforeExecute, afterExecute)
- ✅ Logging e métricas padronizados

### 2. Configuração Declarativa

- ✅ Todo o sistema configurado via JSON
- ✅ Validação de schema automática
- ✅ Validação de referências cruzadas
- ✅ Hot reload suportado

### 3. Fallback Automático

- ✅ Ollama local (preferido)
- ✅ OpenAI cloud (fallback)
- ✅ Circuit breaker integrado
- ✅ Retry automático

### 4. Tool Sequences

- ✅ Sequências pré-definidas de ferramentas
- ✅ Parâmetros dinâmicos (`${input.code}`)
- ✅ Error handling configurável
- ✅ Fallback entre MCPs

### 5. Observabilidade

- ✅ Logs estruturados
- ✅ Métricas por componente
- ✅ Telemetria integrada
- ✅ Audit trail

### 6. Segurança

- ✅ Validação de paths
- ✅ Sandbox para código
- ✅ Rate limiting
- ✅ Permissions por agente
- ✅ Constraints por tool

## 📊 Métricas e Observabilidade

Todos os componentes expõem métricas:

```javascript
// Métricas de um agente
const agent = system.agentRegistry.get('code_analyzer');
const metrics = agent.getMetrics();
console.log({
  totalExecutions: metrics.totalExecutions,
  successRate: metrics.successRate,
  averageTime: metrics.averageExecutionTime
});

// Métricas de uma tool
const tool = system.toolRegistry.get('code_executor');
const toolMetrics = tool.getMetrics();

// Métricas do sistema
const systemInfo = system.getSystemInfo();
```

## 🔧 Adicionando Novos Componentes

### 1. Adicionar um Novo Agente

```javascript
// 1. Criar src/agents/my-agent.js
import { BaseAgent } from '../core/base-agent.js';

export class MyAgent extends BaseAgent {
  async execute(input) {
    return { success: true, result: 'done' };
  }
}

// 2. Adicionar ao config/system-config.json
{
  "agents": {
    "my_agent": {
      "id": "my_agent",
      "class": "MyAgent",
      "file": "my-agent.js",
      "enabled": true,
      // ... configuração
    }
  }
}

// 3. Pronto! O sistema carrega automaticamente
```

### 2. Adicionar uma Nova Tool

Similar ao agente, criar o arquivo e adicionar ao JSON.

### 3. Desabilitar um Componente

Basta mudar `"enabled": false` no JSON.

## 🧪 Testando

```bash
# Executa todos os exemplos
npm start

# Exemplos incluídos:
# - Inicialização básica
# - Code analyzer
# - Data processor
# - Uso direto de tools
# - Consulta a knowledge base
# - Métricas e observabilidade
```

## 📝 Melhores Práticas

### 1. Sempre use as Classes Base

```javascript
// ✅ Correto
export class MyAgent extends BaseAgent { }

// ❌ Errado
export class MyAgent { }
```

### 2. Valide o JSON antes de Deployment

```javascript
import { validateConfigCompleteStrict } from './src/core/config-validator.js';

const config = JSON.parse(fs.readFileSync('config.json'));
validateConfigCompleteStrict(config); // Lança erro se inválido
```

### 3. Use Tool Sequences para Workflows Complexos

Em vez de chamar múltiplas tools manualmente, defina uma sequence no JSON.

### 4. Implemente Lifecycle Hooks

```javascript
export class MyAgent extends BaseAgent {
  async onInit() {
    // Inicialização pesada aqui
  }

  async onDestroy() {
    // Cleanup aqui
  }
}
```

### 5. Log Apropriadamente

```javascript
this.log('Starting process...', 'info');
this.log('Warning: something', 'warn');
this.log('Error occurred', 'error');
```

## 🐛 Troubleshooting

### Sistema não inicializa

- Verifique se o JSON está válido
- Execute validação manual: `node -e "import('./src/core/config-validator.js').then(v => v.loadAndValidateConfig('./config/system-config.json'))"`

### Agente não é carregado

- Verifique se o arquivo existe no caminho especificado
- Verifique se a classe está sendo exportada corretamente
- Verifique se `enabled: true`

### Tool não funciona

- Verifique constraints (permissions, allowed paths, etc)
- Verifique logs: `tool.getLog()`
- Verifique métricas: `tool.getMetrics()`

## 🔄 Migration do Sistema Antigo

Se você tem código do sistema antigo (v1.0), veja o guia de migração detalhado em `docs/MIGRATION_GUIDE.md`.

## 📚 Documentação Adicional

- `docs/ARCHITECTURE.md` - Arquitetura detalhada
- `docs/API.md` - Referência completa da API
- `docs/EXAMPLES.md` - Mais exemplos de uso
- `docs/MIGRATION_GUIDE.md` - Guia de migração

## 🤝 Contribuindo

1. Crie um novo branch
2. Faça suas alterações
3. Adicione testes
4. Atualize o JSON se necessário
5. Envie um Pull Request

## 📄 Licença

ISC

## 🎉 Conclusão

ChatIAS Pro 2.0 oferece uma base sólida e extensível para sistemas de agentes IA. Com governança integrada, configuração declarativa e observabilidade completa, você pode focar em implementar lógica de negócio sem se preocupar com infraestrutura.

**Happy Coding! 🚀**
