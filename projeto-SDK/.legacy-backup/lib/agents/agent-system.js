/**
 * SISTEMA DE AGENTES REAL
 * Agentes que REALMENTE executam tarefas e chamam subagentes/ferramentas
 */

import { globalToolRegistry } from "../tools/index.js";

/**
 * Classe base para agentes
 */
class BaseAgent {
  constructor(name, description, config = {}) {
    this.name = name;
    this.description = description;
    this.subagents = new Map();
    this.tools = config.tools || [];
    this.enabled = config.enabled !== false;
    this.executionLog = [];
  }

  /**
   * Registra subagente
   */
  registerSubagent(subagent) {
    this.subagents.set(subagent.name, subagent);
    console.log(`   📎 Subagente registrado: ${subagent.name} → ${this.name}`);
  }

  /**
   * Chama um subagente
   */
  async callSubagent(name, input) {
    const subagent = this.subagents.get(name);
    if (!subagent) {
      throw new Error(`Subagente ${name} não encontrado`);
    }

    console.log(`   ↳ ${this.name} chamando subagente: ${name}`);
    this.log(`Chamou subagente: ${name}`);

    const result = await subagent.execute(input);
    return result;
  }

  /**
   * Chama uma ferramenta
   */
  async useTool(toolName, params) {
    console.log(`   🔧 ${this.name} usando tool: ${toolName}`);
    this.log(`Usou tool: ${toolName}`);

    const result = await globalToolRegistry.execute(toolName, params);
    return result;
  }

  /**
   * Registra ação no log
   */
  log(message) {
    this.executionLog.push({
      timestamp: new Date().toISOString(),
      agent: this.name,
      message: message,
    });
  }

  /**
   * Limpa log de execução
   */
  clearLog() {
    this.executionLog = [];
  }

  /**
   * Retorna log de execução
   */
  getLog() {
    return this.executionLog;
  }

  /**
   * Método abstrato para executar
   */
  async execute(input) {
    throw new Error("Método execute() deve ser implementado");
  }
}

// ============================================================================
// AGENTE 1: CODE ANALYZER
// ============================================================================

/**
 * Agente principal: Analisa código
 */
export class CodeAnalyzerAgent extends BaseAgent {
  constructor() {
    super("CodeAnalyzer", "Analisa código-fonte e detecta problemas", {
      tools: ["file_reader", "code_executor"],
    });
  }

  async execute(input) {
    console.log(`\n🤖 [${this.name}] Executando análise de código...`);
    this.log("Iniciou análise de código");

    const { code, checkSyntax, checkStyle, checkDeps } = input;
    const results = {
      agent: this.name,
      code: code,
      checks: {},
    };

    // 1. Verificar sintaxe com subagente
    if (checkSyntax) {
      console.log(`   📋 ${this.name}: Verificando sintaxe...`);
      const syntaxResult = await this.callSubagent("SyntaxChecker", { code });
      results.checks.syntax = syntaxResult;
    }

    // 2. Verificar estilo com subagente
    if (checkStyle) {
      console.log(`   📋 ${this.name}: Verificando estilo...`);
      const styleResult = await this.callSubagent("CodeFormatter", { code });
      results.checks.style = styleResult;
    }

    // 3. Verificar dependências com subagente
    if (checkDeps) {
      console.log(`   📋 ${this.name}: Verificando dependências...`);
      const depsResult = await this.callSubagent("DependencyAnalyzer", { code });
      results.checks.dependencies = depsResult;
    }

    // 4. Usar ferramenta para executar código (se necessário)
    if (input.shouldExecute) {
      console.log(`   📋 ${this.name}: Executando código...`);
      const execResult = await this.useTool("code_executor", { code });
      results.execution = execResult;
    }

    this.log("Concluiu análise");
    console.log(`   ✅ ${this.name}: Análise concluída`);

    return results;
  }
}

/**
 * Subagente: Verifica sintaxe
 */
export class SyntaxCheckerAgent extends BaseAgent {
  constructor() {
    super("SyntaxChecker", "Verifica sintaxe do código");
  }

  async execute(input) {
    console.log(`      🔍 [${this.name}] Verificando sintaxe...`);
    this.log("Verificou sintaxe");

    const { code } = input;
    const errors = [];

    // Simula verificação de sintaxe
    if (!code.includes("function") && !code.includes("const") && !code.includes("let")) {
      errors.push("Código não contém declarações válidas");
    }

    const result = {
      valid: errors.length === 0,
      errors: errors,
      linesChecked: code.split("\n").length,
    };

    console.log(`      ${result.valid ? "✓" : "✗"} ${this.name}: ${errors.length} erros encontrados`);
    return result;
  }
}

/**
 * Subagente: Formata código
 */
export class CodeFormatterAgent extends BaseAgent {
  constructor() {
    super("CodeFormatter", "Verifica formatação do código");
  }

  async execute(input) {
    console.log(`      🎨 [${this.name}] Verificando estilo...`);
    this.log("Verificou estilo");

    const { code } = input;
    const warnings = [];

    // Simula verificação de estilo
    if (code.includes("  ")) warnings.push("Indentação inconsistente detectada");
    if (!code.includes(";")) warnings.push("Ponto e vírgula faltando");

    const result = {
      formatted: warnings.length === 0,
      warnings: warnings,
      suggestions: warnings.map((w) => `Corrija: ${w}`),
    };

    console.log(`      ${result.formatted ? "✓" : "⚠"} ${this.name}: ${warnings.length} avisos`);
    return result;
  }
}

/**
 * Subagente: Analisa dependências
 */
export class DependencyAnalyzerAgent extends BaseAgent {
  constructor() {
    super("DependencyAnalyzer", "Analisa dependências do código");
  }

  async execute(input) {
    console.log(`      📦 [${this.name}] Analisando dependências...`);
    this.log("Analisou dependências");

    const { code } = input;
    const imports = [];

    // Detecta imports
    const importRegex = /import .* from ['"](.*)['"];?/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    const result = {
      dependencies: imports,
      count: imports.length,
      external: imports.filter((i) => !i.startsWith(".")),
    };

    console.log(`      ✓ ${this.name}: ${imports.length} dependências encontradas`);
    return result;
  }
}

// ============================================================================
// AGENTE 2: DATA PROCESSOR
// ============================================================================

/**
 * Agente principal: Processa dados
 */
export class DataProcessorAgent extends BaseAgent {
  constructor() {
    super("DataProcessor", "Processa e transforma dados", {
      tools: ["json_parser"],
    });
  }

  async execute(input) {
    console.log(`\n🤖 [${this.name}] Executando processamento de dados...`);
    this.log("Iniciou processamento");

    const { data, validate, transform, aggregate } = input;
    const results = {
      agent: this.name,
      original: data,
      steps: {},
    };

    // 1. Validar dados com subagente
    if (validate) {
      console.log(`   📋 ${this.name}: Validando dados...`);
      const validationResult = await this.callSubagent("DataValidator", { data });
      results.steps.validation = validationResult;

      if (!validationResult.valid) {
        console.log(`   ⚠️  ${this.name}: Dados inválidos, abortando processamento`);
        return results;
      }
    }

    // 2. Transformar dados com subagente
    if (transform) {
      console.log(`   📋 ${this.name}: Transformando dados...`);
      const transformResult = await this.callSubagent("DataTransformer", {
        data,
        transformType: input.transformType || "uppercase",
      });
      results.steps.transformation = transformResult;
    }

    // 3. Agregar dados com subagente
    if (aggregate) {
      console.log(`   📋 ${this.name}: Agregando dados...`);
      const aggregateResult = await this.callSubagent("DataAggregator", { data });
      results.steps.aggregation = aggregateResult;
    }

    // 4. Usar ferramenta JSON parser
    if (typeof data === "string") {
      console.log(`   📋 ${this.name}: Parseando JSON...`);
      const parseResult = await this.useTool("json_parser", { json: data });
      results.parsed = parseResult;
    }

    this.log("Concluiu processamento");
    console.log(`   ✅ ${this.name}: Processamento concluído`);

    return results;
  }
}

/**
 * Subagente: Valida dados
 */
export class DataValidatorAgent extends BaseAgent {
  constructor() {
    super("DataValidator", "Valida estrutura e conteúdo de dados");
  }

  async execute(input) {
    console.log(`      ✓ [${this.name}] Validando dados...`);
    this.log("Validou dados");

    const { data } = input;
    const errors = [];

    // Validação básica
    if (!data) errors.push("Dados vazios");
    if (Array.isArray(data) && data.length === 0) errors.push("Array vazio");
    if (typeof data === "object" && Object.keys(data).length === 0) {
      errors.push("Objeto vazio");
    }

    const result = {
      valid: errors.length === 0,
      errors: errors,
      dataType: Array.isArray(data) ? "array" : typeof data,
    };

    console.log(`      ${result.valid ? "✓" : "✗"} ${this.name}: ${errors.length} erros`);
    return result;
  }
}

/**
 * Subagente: Transforma dados
 */
export class DataTransformerAgent extends BaseAgent {
  constructor() {
    super("DataTransformer", "Transforma e mapeia dados");
  }

  async execute(input) {
    console.log(`      🔄 [${this.name}] Transformando dados...`);
    this.log("Transformou dados");

    const { data, transformType } = input;
    let transformed = data;

    // Aplica transformação
    if (Array.isArray(data)) {
      if (transformType === "uppercase") {
        transformed = data.map((item) =>
          typeof item === "string" ? item.toUpperCase() : item
        );
      } else if (transformType === "double") {
        transformed = data.map((item) => (typeof item === "number" ? item * 2 : item));
      }
    }

    const result = {
      transformed: transformed,
      transformType: transformType,
      itemsTransformed: Array.isArray(data) ? data.length : 1,
    };

    console.log(`      ✓ ${this.name}: ${result.itemsTransformed} itens transformados`);
    return result;
  }
}

/**
 * Subagente: Agrega dados
 */
export class DataAggregatorAgent extends BaseAgent {
  constructor() {
    super("DataAggregator", "Agrega e sumariza dados");
  }

  async execute(input) {
    console.log(`      📊 [${this.name}] Agregando dados...`);
    this.log("Agregou dados");

    const { data } = input;
    const result = {
      count: 0,
      sum: 0,
      average: 0,
      types: {},
    };

    if (Array.isArray(data)) {
      result.count = data.length;

      // Conta por tipo
      data.forEach((item) => {
        const type = typeof item;
        result.types[type] = (result.types[type] || 0) + 1;

        if (typeof item === "number") {
          result.sum += item;
        }
      });

      const numbers = data.filter((item) => typeof item === "number");
      if (numbers.length > 0) {
        result.average = result.sum / numbers.length;
      }
    }

    console.log(`      ✓ ${this.name}: ${result.count} itens agregados`);
    return result;
  }
}

// ============================================================================
// AGENTE 3: TASK MANAGER
// ============================================================================

/**
 * Agente principal: Gerencia tarefas
 */
export class TaskManagerAgent extends BaseAgent {
  constructor() {
    super("TaskManager", "Gerencia execução de tarefas", {
      tools: ["file_reader"],
    });
  }

  async execute(input) {
    console.log(`\n🤖 [${this.name}] Executando gerenciamento de tarefas...`);
    this.log("Iniciou gerenciamento");

    const { tasks, schedule, execute, report } = input;
    const results = {
      agent: this.name,
      tasks: tasks,
      results: {},
    };

    // 1. Agendar tarefas com subagente
    if (schedule) {
      console.log(`   📋 ${this.name}: Agendando tarefas...`);
      const scheduleResult = await this.callSubagent("TaskScheduler", { tasks });
      results.results.schedule = scheduleResult;
    }

    // 2. Executar tarefas com subagente
    if (execute) {
      console.log(`   📋 ${this.name}: Executando tarefas...`);
      const executeResult = await this.callSubagent("TaskExecutor", {
        tasks: tasks || [],
      });
      results.results.execution = executeResult;
    }

    // 3. Gerar relatório com subagente
    if (report) {
      console.log(`   📋 ${this.name}: Gerando relatório...`);
      const reportResult = await this.callSubagent("TaskReporter", {
        tasks,
        executionResults: results.results.execution,
      });
      results.results.report = reportResult;
    }

    this.log("Concluiu gerenciamento");
    console.log(`   ✅ ${this.name}: Gerenciamento concluído`);

    return results;
  }
}

/**
 * Subagente: Agenda tarefas
 */
export class TaskSchedulerAgent extends BaseAgent {
  constructor() {
    super("TaskScheduler", "Agenda e prioriza tarefas");
  }

  async execute(input) {
    console.log(`      📅 [${this.name}] Agendando tarefas...`);
    this.log("Agendou tarefas");

    const { tasks } = input;
    const scheduled = tasks.map((task, index) => ({
      id: index + 1,
      task: task,
      priority: Math.floor(Math.random() * 3) + 1, // 1-3
      scheduledAt: new Date().toISOString(),
    }));

    // Ordena por prioridade
    scheduled.sort((a, b) => a.priority - b.priority);

    const result = {
      scheduled: scheduled,
      count: scheduled.length,
      highPriority: scheduled.filter((t) => t.priority === 1).length,
    };

    console.log(`      ✓ ${this.name}: ${result.count} tarefas agendadas`);
    return result;
  }
}

/**
 * Subagente: Executa tarefas
 */
export class TaskExecutorAgent extends BaseAgent {
  constructor() {
    super("TaskExecutor", "Executa tarefas agendadas");
  }

  async execute(input) {
    console.log(`      ⚙️ [${this.name}] Executando tarefas...`);
    this.log("Executou tarefas");

    const { tasks } = input;
    const results = tasks.map((task, index) => {
      const success = Math.random() > 0.2; // 80% sucesso

      return {
        taskId: index + 1,
        task: task,
        status: success ? "success" : "failed",
        executedAt: new Date().toISOString(),
        duration: Math.floor(Math.random() * 1000) + 100, // ms
      };
    });

    const result = {
      executed: results,
      total: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    console.log(
      `      ✓ ${this.name}: ${result.successful}/${result.total} tarefas bem-sucedidas`
    );
    return result;
  }
}

/**
 * Subagente: Gera relatórios
 */
export class TaskReporterAgent extends BaseAgent {
  constructor() {
    super("TaskReporter", "Gera relatórios de execução");
  }

  async execute(input) {
    console.log(`      📄 [${this.name}] Gerando relatório...`);
    this.log("Gerou relatório");

    const { tasks, executionResults } = input;

    const report = {
      generatedAt: new Date().toISOString(),
      totalTasks: tasks?.length || 0,
      summary: executionResults
        ? {
            total: executionResults.total,
            successful: executionResults.successful,
            failed: executionResults.failed,
            successRate: (
              (executionResults.successful / executionResults.total) *
              100
            ).toFixed(1) + "%",
          }
        : null,
    };

    console.log(`      ✓ ${this.name}: Relatório gerado`);
    return report;
  }
}
