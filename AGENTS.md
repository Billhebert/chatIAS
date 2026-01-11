# 🤖 Sistema de Agentes e Ferramentas

Sistema completo de agentes hierárquicos com subagentes e ferramentas modulares.

---

## 📊 Visão Geral

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE AGENTES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐  │
│  │ CodeAnalyzer  │    │ DataProcessor │    │ TaskManager   │  │
│  │   (Agente)    │    │   (Agente)    │    │   (Agente)    │  │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘  │
│          │                    │                    │            │
│  ┌───────▼────────┐   ┌───────▼────────┐   ┌───────▼────────┐ │
│  │ SyntaxChecker  │   │ DataValidator  │   │ TaskScheduler  │ │
│  │  (Subagente)   │   │  (Subagente)   │   │  (Subagente)   │ │
│  ├────────────────┤   ├────────────────┤   ├────────────────┤ │
│  │ CodeFormatter  │   │ DataTransformer│   │ TaskExecutor   │ │
│  │  (Subagente)   │   │  (Subagente)   │   │  (Subagente)   │ │
│  ├────────────────┤   ├────────────────┤   ├────────────────┤ │
│  │DependencyAnalyz│   │ DataAggregator │   │ TaskReporter   │ │
│  │  (Subagente)   │   │  (Subagente)   │   │  (Subagente)   │ │
│  └────────────────┘   └────────────────┘   └────────────────┘ │
│          │                    │                    │            │
│          └────────────────────┴────────────────────┘            │
│                             │                                   │
│                  ┌──────────▼──────────┐                        │
│                  │   FERRAMENTAS       │                        │
│                  ├─────────────────────┤                        │
│                  │ • file_reader       │                        │
│                  │ • json_parser       │                        │
│                  │ • code_executor     │                        │
│                  └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Agentes Principais (3)

### 1. CodeAnalyzer

**Descrição**: Analisa código-fonte e detecta problemas

**Subagentes**:
- `SyntaxChecker` - Verifica sintaxe do código
- `CodeFormatter` - Verifica formatação e estilo
- `DependencyAnalyzer` - Analisa dependências e imports

**Ferramentas utilizadas**:
- `file_reader` - Lê arquivos de código
- `code_executor` - Executa código (simulado)

**Exemplo de uso**:
```javascript
import { CodeAnalyzerAgent, SyntaxCheckerAgent, CodeFormatterAgent, DependencyAnalyzerAgent } from "./lib/agents/agent-system.js";

// Criar agente
const codeAnalyzer = new CodeAnalyzerAgent();

// Registrar subagentes
codeAnalyzer.registerSubagent(new SyntaxCheckerAgent());
codeAnalyzer.registerSubagent(new CodeFormatterAgent());
codeAnalyzer.registerSubagent(new DependencyAnalyzerAgent());

// Executar
const result = await codeAnalyzer.execute({
  code: "const x = 1 + 1;",
  checkSyntax: true,
  checkStyle: true,
  checkDeps: true,
  shouldExecute: true
});

console.log(result.checks.syntax.valid);        // true/false
console.log(result.checks.style.formatted);     // true/false
console.log(result.checks.dependencies.count);  // número
```

---

### 2. DataProcessor

**Descrição**: Processa e transforma dados

**Subagentes**:
- `DataValidator` - Valida estrutura e conteúdo dos dados
- `DataTransformer` - Transforma e mapeia dados
- `DataAggregator` - Agrega e sumariza dados

**Ferramentas utilizadas**:
- `json_parser` - Parseia JSON

**Exemplo de uso**:
```javascript
import { DataProcessorAgent, DataValidatorAgent, DataTransformerAgent, DataAggregatorAgent } from "./lib/agents/agent-system.js";

// Criar agente
const dataProcessor = new DataProcessorAgent();

// Registrar subagentes
dataProcessor.registerSubagent(new DataValidatorAgent());
dataProcessor.registerSubagent(new DataTransformerAgent());
dataProcessor.registerSubagent(new DataAggregatorAgent());

// Executar
const result = await dataProcessor.execute({
  data: [1, 2, 3, "test", 5],
  validate: true,
  transform: true,
  transformType: "double",  // ou "uppercase"
  aggregate: true
});

console.log(result.steps.validation.valid);           // true/false
console.log(result.steps.transformation.transformed); // dados transformados
console.log(result.steps.aggregation.average);        // média
```

---

### 3. TaskManager

**Descrição**: Gerencia execução de tarefas

**Subagentes**:
- `TaskScheduler` - Agenda e prioriza tarefas
- `TaskExecutor` - Executa tarefas agendadas
- `TaskReporter` - Gera relatórios de execução

**Ferramentas utilizadas**:
- `file_reader` - Lê arquivos de configuração

**Exemplo de uso**:
```javascript
import { TaskManagerAgent, TaskSchedulerAgent, TaskExecutorAgent, TaskReporterAgent } from "./lib/agents/agent-system.js";

// Criar agente
const taskManager = new TaskManagerAgent();

// Registrar subagentes
taskManager.registerSubagent(new TaskSchedulerAgent());
taskManager.registerSubagent(new TaskExecutorAgent());
taskManager.registerSubagent(new TaskReporterAgent());

// Executar
const result = await taskManager.execute({
  tasks: ["Tarefa 1", "Tarefa 2", "Tarefa 3"],
  schedule: true,
  execute: true,
  report: true
});

console.log(result.results.schedule.count);        // número de tarefas
console.log(result.results.execution.successful);  // tarefas bem-sucedidas
console.log(result.results.report.summary);        // resumo
```

---

## 🔧 Ferramentas (3)

### 1. file_reader

**Descrição**: Lê conteúdo de arquivos do sistema

**Parâmetros**:
- `path` (string, obrigatório) - Caminho do arquivo
- `encoding` (string, opcional) - Encoding (padrão: utf-8)

**Retorna**:
```javascript
{
  success: true,
  path: "/path/to/file",
  content: "...",
  size: 1234,
  lines: 42
}
```

**Exemplo**:
```javascript
const result = await globalToolRegistry.execute("file_reader", {
  path: "./package.json"
});
```

---

### 2. json_parser

**Descrição**: Parseia e valida strings JSON

**Parâmetros**:
- `json` (string, obrigatório) - String JSON
- `strict` (boolean, opcional) - Modo estrito (padrão: false)

**Retorna**:
```javascript
{
  success: true,
  parsed: {...},
  type: "object",  // ou "array"
  keys: 5
}
```

**Exemplo**:
```javascript
const result = await globalToolRegistry.execute("json_parser", {
  json: '{"test": "value"}'
});
```

---

### 3. code_executor

**Descrição**: Executa código JavaScript (simulado para segurança)

**Parâmetros**:
- `code` (string, obrigatório) - Código JavaScript
- `timeout` (number, opcional) - Timeout em ms (padrão: 5000)

**Retorna**:
```javascript
{
  success: true,
  executed: true,
  result: "...",
  duration: 45,
  safe: true
}
```

**Exemplo**:
```javascript
const result = await globalToolRegistry.execute("code_executor", {
  code: "const x = 1 + 1;"
});
```

---

## 🧪 Como Testar

### Teste Completo (REAL)

```bash
node test-agents-real.js
```

**O que é testado**:
- ✅ 3 agentes principais executam
- ✅ 9 subagentes são chamados (3 por agente)
- ✅ 3 ferramentas funcionam
- ✅ Logs de execução são registrados
- ✅ Integrações entre agentes e ferramentas

**Saída esperada**:
```
🎉 TODOS OS TESTES PASSARAM!

✅ Confirmado:
   • 3 agentes principais executam corretamente
   • 9 subagentes são chamados pelos agentes principais
   • 3 ferramentas são usadas pelos agentes
   • Sistema de logs funciona corretamente
   • Todas as integrações estão funcionando
```

---

## 📋 Sistema de Logs

Cada agente mantém um log de execução:

```javascript
// Executar agente
await agent.execute(input);

// Ver log
const log = agent.getLog();
log.forEach(entry => {
  console.log(`[${entry.timestamp}] ${entry.agent}: ${entry.message}`);
});

// Limpar log
agent.clearLog();
```

**Exemplo de log**:
```
[2026-01-11T...] CodeAnalyzer: Iniciou análise de código
[2026-01-11T...] CodeAnalyzer: Chamou subagente: SyntaxChecker
[2026-01-11T...] CodeAnalyzer: Chamou subagente: CodeFormatter
[2026-01-11T...] CodeAnalyzer: Usou tool: code_executor
[2026-01-11T...] CodeAnalyzer: Concluiu análise
```

---

## 🔌 Integração com Outros Sistemas

### Com OpenCode SDK

```javascript
import { CodeAnalyzerAgent } from "./lib/agents/agent-system.js";

// No chat.js
class ChatClient {
  async analyzeCode(code) {
    const analyzer = new CodeAnalyzerAgent();
    // ... registrar subagentes

    const result = await analyzer.execute({
      code: code,
      checkSyntax: true,
      checkStyle: true,
      checkDeps: true
    });

    return result;
  }
}
```

### Com Sistema de Ollama

```javascript
// Agente pode usar Ollama para análise avançada
async execute(input) {
  // Análise básica com subagentes
  const syntaxResult = await this.callSubagent("SyntaxChecker", { code });

  // Se necessário, usar Ollama para análise semântica
  if (input.deepAnalysis) {
    const ollamaResult = await this.ollamaClient.generate(
      "llama3.2",
      `Analise este código: ${code}`
    );
  }
}
```

---

## 📚 Estrutura de Arquivos

```
lib/
├── agents/
│   ├── index.js           # AgentManager existente
│   └── agent-system.js    # Novo sistema de agentes (3 + 9)
└── tools/
    ├── index.js           # ToolRegistry existente
    ├── ollama-tool.js     # Tools Ollama existentes
    └── agent-tools.js     # Novas 3 ferramentas
```

---

## 🎯 Casos de Uso

### 1. Análise de Código em CI/CD

```javascript
const analyzer = new CodeAnalyzerAgent();
// Configurar subagentes...

const result = await analyzer.execute({
  code: fileContent,
  checkSyntax: true,
  checkStyle: true,
  checkDeps: true
});

if (!result.checks.syntax.valid) {
  throw new Error("Erros de sintaxe encontrados");
}
```

### 2. Pipeline de Processamento de Dados

```javascript
const processor = new DataProcessorAgent();
// Configurar subagentes...

const result = await processor.execute({
  data: rawData,
  validate: true,
  transform: true,
  transformType: "normalize",
  aggregate: true
});

const cleanData = result.steps.transformation.transformed;
```

### 3. Sistema de Tarefas Automatizado

```javascript
const manager = new TaskManagerAgent();
// Configurar subagentes...

const result = await manager.execute({
  tasks: ["Deploy", "Test", "Notify"],
  schedule: true,
  execute: true,
  report: true
});

if (result.results.report.summary.successRate < "90%") {
  alert("Taxa de sucesso baixa!");
}
```

---

## ⚙️ Configuração Avançada

### Criar Agente Customizado

```javascript
import { BaseAgent } from "./lib/agents/agent-system.js";

class MyCustomAgent extends BaseAgent {
  constructor() {
    super("MyAgent", "Descrição do agente", {
      tools: ["tool1", "tool2"]
    });
  }

  async execute(input) {
    console.log(`[${this.name}] Executando...`);
    this.log("Iniciou execução");

    // Chamar subagente
    const result1 = await this.callSubagent("SubAgent1", input);

    // Usar ferramenta
    const result2 = await this.useTool("tool1", { param: "value" });

    this.log("Concluiu execução");
    return { result1, result2 };
  }
}
```

### Criar Ferramenta Customizada

```javascript
export const myTool = {
  name: "my_tool",
  description: "Descrição da ferramenta",
  enabled: true,
  parameters: {
    input: { type: "string", required: true }
  },
  execute: async ({ input }) => {
    // Lógica da ferramenta
    return {
      success: true,
      result: `Processado: ${input}`
    };
  }
};

// Registrar
globalToolRegistry.register("my_tool", myTool);
```

---

## 📊 Comparação com Sistema Anterior

| Aspecto | Sistema Anterior | Novo Sistema |
|---------|------------------|--------------|
| **Agentes** | Apenas registro | ✅ Execução real |
| **Subagentes** | Não suportado | ✅ 9 subagentes |
| **Ferramentas** | 3 Ollama apenas | ✅ 6 ferramentas |
| **Logs** | Não tinha | ✅ Log completo |
| **Testes reais** | Smoke tests | ✅ Integração real |
| **Hierarquia** | Plana | ✅ Hierárquica |

---

## 🎉 Resumo

**Implementado**:
- ✅ 3 agentes principais com execução real
- ✅ 9 subagentes (3 para cada agente)
- ✅ 3 ferramentas novas (6 total com Ollama)
- ✅ Sistema de logs de execução
- ✅ Testes que REALMENTE executam e verificam chamadas
- ✅ Integração completa entre agentes e ferramentas

**Execute**: `node test-agents-real.js` para ver tudo funcionando! 🚀
