# Sistema de Permissões de Agentes

## Visão Geral

O ChatIAS agora possui um sistema de permissões granular que permite controlar quais **tools** e **subagentes** cada agente pode usar.

## Como Funciona

### 1. Configuração em `config/agent-system.json`

#### Permissões de Agentes Principais

```json
{
  "agents": [
    {
      "key": "code",
      "label": "CodeAnalyzer",
      "class": "CodeAnalyzerAgent",
      "subagents": ["SyntaxCheckerAgent", "CodeFormatterAgent", "DependencyAnalyzerAgent"],
      "allowedTools": ["file_reader", "code_executor"],
      "allowedSubagents": ["SyntaxChecker", "CodeFormatter", "DependencyAnalyzer"]
    }
  ]
}
```

- **`allowedTools`**: Lista de tools que o agente pode usar
- **`allowedSubagents`**: Lista de subagentes que o agente pode chamar

#### Permissões de Subagentes

```json
{
  "subagents": {
    "SyntaxChecker": {
      "allowedTools": [],
      "allowedSubagents": []
    },
    "DataValidator": {
      "allowedTools": ["json_parser"],
      "allowedSubagents": []
    },
    "TaskExecutor": {
      "allowedTools": ["file_reader"],
      "allowedSubagents": []
    }
  }
}
```

### 2. Validação Automática

Quando um agente tenta:
- **Usar uma tool**: O sistema verifica se está em `allowedTools`
- **Chamar um subagente**: O sistema verifica se está em `allowedSubagents`

Se a permissão não existir, um erro é lançado:
```
⛔ CodeAnalyzer NÃO tem permissão para usar tool: json_parser
Erro: Permissão negada: CodeAnalyzer não pode usar tool json_parser
```

### 3. Backward Compatibility

- Se `allowedTools` estiver vazio (`[]`), **permite todas as tools**
- Se `allowedSubagents` estiver vazio (`[]`), **permite todos os subagentes**

Isso mantém compatibilidade com configurações antigas.

## Exemplos de Configuração

### Exemplo 1: CodeAnalyzer com Acesso Restrito

```json
{
  "key": "code",
  "label": "CodeAnalyzer",
  "allowedTools": ["file_reader", "code_executor"],
  "allowedSubagents": ["SyntaxChecker"]
}
```

**Pode:**
- ✅ Usar `file_reader`
- ✅ Usar `code_executor`
- ✅ Chamar `SyntaxChecker`

**Não pode:**
- ❌ Usar `json_parser`
- ❌ Usar `soma`
- ❌ Chamar `CodeFormatter`
- ❌ Chamar `DependencyAnalyzer`

### Exemplo 2: DataValidator com Acesso a JSON Parser

```json
{
  "subagents": {
    "DataValidator": {
      "allowedTools": ["json_parser"],
      "allowedSubagents": []
    }
  }
}
```

**Pode:**
- ✅ Usar `json_parser` para validar JSON

**Não pode:**
- ❌ Usar qualquer outra tool
- ❌ Chamar subagentes

### Exemplo 3: Agente com Acesso Total (Legado)

```json
{
  "key": "admin",
  "label": "AdminAgent",
  "allowedTools": [],
  "allowedSubagents": []
}
```

**Pode:**
- ✅ Usar **qualquer tool** registrada
- ✅ Chamar **qualquer subagente** registrado

## Configuração Atual

### Agentes Principais

| Agente          | Tools Permitidas                | Subagentes Permitidos                          |
|-----------------|--------------------------------|-----------------------------------------------|
| CodeAnalyzer    | file_reader, code_executor     | SyntaxChecker, CodeFormatter, DependencyAnalyzer |
| DataProcessor   | json_parser                    | DataValidator, DataTransformer, DataAggregator |
| TaskManager     | file_reader                    | TaskScheduler, TaskExecutor, TaskReporter     |

### Subagentes

| Subagente          | Tools Permitidas | Subagentes Permitidos |
|--------------------|------------------|-----------------------|
| SyntaxChecker      | (nenhuma)        | (nenhum)              |
| CodeFormatter      | (nenhuma)        | (nenhum)              |
| DependencyAnalyzer | (nenhuma)        | (nenhum)              |
| DataValidator      | json_parser      | (nenhum)              |
| DataTransformer    | (nenhuma)        | (nenhum)              |
| DataAggregator     | (nenhuma)        | (nenhum)              |
| TaskScheduler      | (nenhuma)        | (nenhum)              |
| TaskExecutor       | file_reader      | (nenhum)              |
| TaskReporter       | (nenhuma)        | (nenhum)              |

## Como Adicionar Novas Permissões

### 1. Adicionar Tool a um Agente

```json
{
  "key": "code",
  "allowedTools": ["file_reader", "code_executor", "soma"]  // ← Adicione aqui
}
```

### 2. Adicionar Subagente a um Agente

```json
{
  "key": "code",
  "allowedSubagents": ["SyntaxChecker", "MyNewSubagent"]  // ← Adicione aqui
}
```

### 3. Configurar Permissões de um Novo Subagente

```json
{
  "subagents": {
    "MyNewSubagent": {
      "allowedTools": ["file_reader"],
      "allowedSubagents": []
    }
  }
}
```

## Logs e Debug

Quando um agente tenta usar uma tool ou subagente sem permissão, você verá:

```
⛔ CodeAnalyzer NÃO tem permissão para usar tool: json_parser
```

Esses logs aparecem:
1. No console do servidor
2. No log de execução do agente (`agent.getLog()`)
3. Como erro na resposta da API

## Benefícios

✅ **Segurança**: Previne uso não autorizado de tools sensíveis
✅ **Modularidade**: Controle granular sobre o que cada componente pode fazer
✅ **Debug**: Fácil identificar tentativas de acesso não autorizadas
✅ **Flexibilidade**: Configure permissões sem modificar código

## API para Verificação de Permissões

### No Código do Agente

```javascript
// Verificar se pode usar uma tool
if (this.canUseTool('file_reader')) {
  const result = await this.useTool('file_reader', { path: 'file.txt' });
}

// Verificar se pode chamar um subagente
if (this.canCallSubagent('SyntaxChecker')) {
  const result = await this.callSubagent('SyntaxChecker', { code: 'test' });
}
```

Essas verificações são feitas automaticamente por `useTool()` e `callSubagent()`, mas você pode fazer verificações manuais antes.
