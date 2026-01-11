# 🔧 Como Adicionar Novas Ferramentas - Sistema ChatIAS Pro v2.0

## Estado Atual do Sistema

✅ **Sistema:** ChatIAS Pro v2.0  
✅ **Ferramentas atuais:** 3 (code_executor, json_parser, file_reader)  
✅ **Arquitetura:** Sistema modular baseado em configuração  
✅ **Branch:** `estado-original`

---

## 📁 Estrutura de Arquivos

```
chatIAS/
├── src/
│   ├── tools/
│   │   ├── code-executor.js    ← Exemplo de ferramenta
│   │   ├── json-parser.js      ← Exemplo de ferramenta
│   │   ├── file-reader.js      ← Exemplo de ferramenta
│   │   └── sua-nova-tool.js    ← ADICIONE AQUI
│   └── core/
│       └── base-tool.js        ← Classe base
├── config/
│   └── system-config.json      ← CONFIGURE AQUI
└── example.js
```

---

## 🚀 Passo a Passo: Adicionar Uma Nova Ferramenta

### **Passo 1: Criar arquivo da ferramenta em `src/tools/`**

Crie um novo arquivo, por exemplo `src/tools/calculator.js`:

```javascript
import { BaseTool } from '../core/base-tool.js';

/**
 * Calculator Tool - Realiza operações matemáticas
 */
export class Calculator extends BaseTool {
  /**
   * Execução padrão da ferramenta
   */
  async execute(params) {
    const { operation, a, b } = params;
    
    // Validar parâmetros
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Parâmetros a e b devem ser números');
    }
    
    let result;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) throw new Error('Divisão por zero');
        result = a / b;
        break;
      default:
        throw new Error(`Operação desconhecida: ${operation}`);
    }
    
    return {
      success: true,
      operation,
      a,
      b,
      result,
      message: `${a} ${operation} ${b} = ${result}`
    };
  }
  
  /**
   * Hook de inicialização (opcional)
   */
  async onInit() {
    console.log(`[${this.id}] Calculadora inicializada`);
  }
  
  /**
   * Hook de destruição (opcional)
   */
  async onDestroy() {
    console.log(`[${this.id}] Calculadora destruída`);
  }
}
```

### **Passo 2: Adicionar configuração em `config/system-config.json`**

Abra `config/system-config.json` e adicione na seção `"tools"` (por volta da linha 407):

```json
{
  "tools": {
    "code_executor": {
      // ... configuração existente
    },
    "json_parser": {
      // ... configuração existente
    },
    "file_reader": {
      // ... configuração existente
    },
    
    // NOVA FERRAMENTA AQUI
    "calculator": {
      "id": "calculator",
      "class": "Calculator",
      "file": "calculator.js",
      "enabled": true,
      "version": "1.0.0",
      
      "description": "Realiza operações matemáticas básicas",
      "category": "utility",
      "tags": ["math", "calculation", "numbers"],
      
      "input": {
        "operation": {
          "type": "string",
          "required": true,
          "enum": ["add", "subtract", "multiply", "divide"]
        },
        "a": {
          "type": "number",
          "required": true
        },
        "b": {
          "type": "number",
          "required": true
        }
      },
      
      "constraints": {
        "maxExecutionTime": 1000
      },
      
      "requiredBy": [],
      "conflictsWith": [],
      
      "actions": [
        {
          "id": "calculate",
          "description": "Executa operação matemática",
          "params": ["operation", "a", "b"],
          "returnType": "object"
        }
      ]
    }
  }
}
```

### **Passo 3: Testar a ferramenta**

```bash
# Rodar o exemplo para verificar se carrega
node example.js

# Deve mostrar:
# [SystemLoader] [INFO] Loaded tool: calculator (Calculator)
# [SystemLoader] [INFO] Tools loaded: 4
```

### **Passo 4: Usar a ferramenta programaticamente**

```javascript
import { createSystem } from './src/core/system-loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCalculator() {
  // Inicializar sistema
  const system = await createSystem({
    configPath: path.join(__dirname, 'config', 'system-config.json'),
    verbose: true
  });
  
  // Obter a ferramenta
  const calculator = system.toolRegistry.get('calculator');
  
  // Executar operação
  const result = await calculator.run({
    operation: 'add',
    a: 10,
    b: 5
  });
  
  console.log(result);
  // { success: true, operation: 'add', a: 10, b: 5, result: 15, message: '10 add 5 = 15' }
  
  // Destruir sistema
  await system.destroy();
}

testCalculator();
```

---

## 📖 Referência: Classe BaseTool

Todas as ferramentas herdam de `BaseTool` que fornece:

### Propriedades Principais

```javascript
{
  id: string,              // ID único da ferramenta
  class: string,           // Nome da classe
  enabled: boolean,        // Se está habilitada
  version: string,         // Versão (ex: "1.0.0")
  description: string,     // Descrição
  category: string,        // Categoria (ex: "utility", "data", "io")
  tags: string[],          // Tags
  inputSchema: object,     // Schema de validação de entrada
  constraints: object,     // Limites (timeout, memória, etc)
  actions: object[],       // Ações disponíveis
}
```

### Métodos Principais

```javascript
// OBRIGATÓRIO: Implementar execução
async execute(params) { }

// OPCIONAL: Hooks do ciclo de vida
async onInit() { }       // Ao inicializar
async onDestroy() { }    // Ao destruir

// OPCIONAL: Ações customizadas
async action_minhaAcao(params) { }

// Métodos herdados (não precisa implementar)
async run(params, actionId)     // Executa com validação
validateParams(params)          // Valida parâmetros
getInfo()                       // Retorna informações
getMetrics()                    // Retorna métricas
enable()                        // Habilita ferramenta
disable()                       // Desabilita ferramenta
```

---

## 🎨 Templates Prontos

### Template 1: Ferramenta Simples

```javascript
import { BaseTool } from '../core/base-tool.js';

export class MinhaFerramenta extends BaseTool {
  async execute(params) {
    const { input } = params;
    
    // Sua lógica aqui
    const resultado = processar(input);
    
    return {
      success: true,
      result: resultado
    };
  }
}
```

### Template 2: Ferramenta com Validações

```javascript
import { BaseTool } from '../core/base-tool.js';

export class MinhaFerramenta extends BaseTool {
  async execute(params) {
    // Validar
    if (!params.input) {
      throw new Error('Input é obrigatório');
    }
    
    try {
      // Processar
      const resultado = await processar(params.input);
      
      return {
        success: true,
        data: resultado
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### Template 3: Ferramenta com Múltiplas Ações

```javascript
import { BaseTool } from '../core/base-tool.js';

export class MinhaFerramenta extends BaseTool {
  // Ação padrão
  async execute(params) {
    return await this.action_processar(params);
  }
  
  // Ação 1: Processar
  async action_processar(params) {
    return {
      success: true,
      action: 'processar',
      result: 'processado'
    };
  }
  
  // Ação 2: Validar
  async action_validar(params) {
    return {
      success: true,
      action: 'validar',
      valid: true
    };
  }
}
```

---

## ✅ Checklist

- [ ] **Passo 1**: Criar arquivo em `src/tools/nome-da-ferramenta.js`
- [ ] **Passo 2**: Estender `BaseTool` e implementar `execute()`
- [ ] **Passo 3**: Adicionar configuração em `config/system-config.json`
- [ ] **Passo 4**: Definir `id`, `class`, `file`, `description`, `input`
- [ ] **Passo 5**: Testar com `node example.js`
- [ ] **Passo 6**: Verificar se aparece "Loaded tool: sua_ferramenta"
- [ ] **Passo 7**: Usar via `toolRegistry.get('sua_ferramenta')`

---

## 🔍 Exemplos de Ferramentas para Criar

### 1. String Tools
```javascript
// src/tools/string-utils.js
export class StringUtils extends BaseTool {
  async execute(params) {
    const { text, operation } = params;
    
    const operations = {
      uppercase: () => text.toUpperCase(),
      lowercase: () => text.toLowerCase(),
      reverse: () => text.split('').reverse().join(''),
      length: () => text.length,
      wordCount: () => text.split(/\s+/).length
    };
    
    return {
      success: true,
      original: text,
      operation,
      result: operations[operation]()
    };
  }
}
```

### 2. Data Validator
```javascript
// src/tools/validator.js
export class Validator extends BaseTool {
  async execute(params) {
    const { type, value } = params;
    
    const validators = {
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      url: (v) => /^https?:\/\/.+/.test(v),
      number: (v) => !isNaN(parseFloat(v)),
      json: (v) => { try { JSON.parse(v); return true; } catch { return false; } }
    };
    
    return {
      success: true,
      type,
      value,
      valid: validators[type]?.(value) ?? false
    };
  }
}
```

### 3. Array Processor
```javascript
// src/tools/array-processor.js
export class ArrayProcessor extends BaseTool {
  async execute(params) {
    const { array, operation } = params;
    
    const operations = {
      sum: (arr) => arr.reduce((a, b) => a + b, 0),
      avg: (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
      max: (arr) => Math.max(...arr),
      min: (arr) => Math.min(...arr),
      sort: (arr) => [...arr].sort((a, b) => a - b),
      unique: (arr) => [...new Set(arr)]
    };
    
    return {
      success: true,
      original: array,
      operation,
      result: operations[operation](array)
    };
  }
}
```

---

## 📊 Ver Ferramentas Carregadas

```javascript
import { createSystem } from './src/core/system-loader.js';

const system = await createSystem({ configPath: './config/system-config.json' });

// Listar todas
const tools = system.toolRegistry.list();
console.log('Ferramentas:', tools.map(t => t.id));

// Ver detalhes de uma
const tool = system.toolRegistry.get('calculator');
console.log(tool.getInfo());

// Ver métricas
console.log(tool.getMetrics());
```

---

## 🚨 Troubleshooting

### Erro: "Class not found"
- Verifique se o nome da classe no arquivo `.js` corresponde ao campo `"class"` no JSON
- Certifique-se de exportar a classe: `export class NomeDaClasse`

### Erro: "File not found"
- Verifique o caminho do arquivo no campo `"file"` do JSON
- O arquivo deve estar em `src/tools/`

### Ferramenta não aparece
- Verifique se `"enabled": true` no JSON
- Rode `node example.js` e veja os logs

### Erro ao executar
- Implemente corretamente `async execute(params)`
- Valide os parâmetros de entrada
- Use try/catch para capturar erros

---

## 🎯 Próximos Passos

1. **Criar sua primeira ferramenta** seguindo este guia
2. **Testar** com `node example.js`
3. **Integrar com agentes** adicionando na config do agente
4. **Consultar exemplos** em `src/tools/code-executor.js`

Boa sorte! 🚀
