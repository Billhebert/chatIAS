/**
 * BaseAgent - Classe base abstrata para todos os agentes
 *
 * Garante que todos os agentes tenham:
 * - Métodos obrigatórios implementados
 * - Lifecycle hooks (onInit, onDestroy, beforeExecute, afterExecute)
 * - Sistema de logging consistente
 * - Gestão de subagentes
 * - Acesso controlado a tools
 * - Acesso a knowledge base
 * - Métricas e telemetria
 */

import EventEmitter from 'events';

export class BaseAgent extends EventEmitter {
  constructor(config) {
    super();

    // Validação obrigatória de configuração
    if (!config) {
      throw new Error('Agent config is required');
    }
    if (!config.id) {
      throw new Error('Agent id is required');
    }
    if (!config.class) {
      throw new Error('Agent class name is required');
    }

    this.id = config.id;
    this.class = config.class;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.version = config.version || '1.0.0';

    // Metadata
    this.description = config.description || '';
    this.tags = config.tags || [];

    // Capabilities
    this.capabilities = config.capabilities || {};

    // Routing
    this.routing = config.routing || {};

    // Permissions
    this.permissions = config.permissions || {
      readFile: false,
      writeFile: false,
      executeCode: false,
      accessKB: true,
      callSubagents: true,
      useTools: true
    };

    // Input schema
    this.inputSchema = config.input || {};

    // Gestão de subagentes
    this.subagents = new Map();
    this.subagentConfigs = config.subagents || [];

    // Tools disponíveis
    this.toolRegistry = null;
    this.availableTools = [];
    this.toolConfigs = config.tools || [];

    // Tool sequences
    this.toolSequences = new Map();
    if (config.toolSequences) {
      config.toolSequences.forEach(seq => {
        this.toolSequences.set(seq.trigger, seq);
      });
    }

    // Knowledge base
    this.knowledgeBase = new Map();
    this.kbConfigs = config.knowledgeBase || [];

    // MCP providers
    this.mcpProviders = new Map();
    this.mcpConfig = config.mcp || {};

    // SDK configuration
    this.sdkConfig = config.sdk || {};
    this.sdkController = null;

    // Logs e auditoria
    this.executionLog = [];
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      lastExecution: null,
      errors: []
    };

    // Rate limiting
    this.rateLimit = config.rateLimit || { enabled: false };
    this.rateLimitCounter = 0;
    this.rateLimitResetTime = null;

    // State
    this.state = 'initialized';
    this.initialized = false;
  }

  /**
   * Lifecycle Hook: Inicialização
   * Deve ser implementado por subclasses se necessário
   */
  async onInit() {
    // Override em subclasses
  }

  /**
   * Lifecycle Hook: Destruição
   * Deve ser implementado por subclasses se necessário
   */
  async onDestroy() {
    // Override em subclasses
  }

  /**
   * Lifecycle Hook: Antes da execução
   * @param {object} input - Input a ser processado
   */
  async beforeExecute(input) {
    // Override em subclasses
    return input;
  }

  /**
   * Lifecycle Hook: Após execução
   * @param {object} result - Resultado da execução
   */
  async afterExecute(result) {
    // Override em subclasses
    return result;
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * @param {object} input - Input do usuário
   * @returns {Promise<object>} - Resultado da execução
   */
  async execute(input) {
    throw new Error(`execute() must be implemented by ${this.class}`);
  }

  /**
   * Inicializa o agente (carrega subagentes, tools, KB)
   */
  async initialize(context) {
    if (this.initialized) {
      return;
    }

    this.log('Initializing agent', 'info');

    // Armazena contexto
    if (context) {
      this.toolRegistry = context.toolRegistry;
      this.sdkController = context.sdkController;

      // Carrega tools
      if (this.toolRegistry) {
        this.loadTools();
      }

      // Carrega subagentes
      if (context.agentFactory) {
        await this.loadSubagents(context.agentFactory, context);
      }

      // Carrega knowledge base
      if (context.knowledgeBaseRegistry) {
        this.loadKnowledgeBase(context.knowledgeBaseRegistry);
      }

      // Carrega MCP providers
      if (context.mcpRegistry) {
        this.loadMCPProviders(context.mcpRegistry);
      }
    }

    // Chama hook de inicialização
    await this.onInit();

    this.initialized = true;
    this.state = 'ready';
    this.log('Agent initialized successfully', 'info');

    this.emit('initialized');
  }

  /**
   * Carrega tools disponíveis para este agente
   */
  loadTools() {
    this.availableTools = [];

    for (const toolConfig of this.toolConfigs) {
      const toolId = typeof toolConfig === 'string' ? toolConfig : toolConfig.id;
      const tool = this.toolRegistry.get(toolId);

      if (tool && tool.enabled) {
        this.availableTools.push({
          id: toolId,
          tool: tool,
          config: toolConfig
        });
        this.log(`Loaded tool: ${toolId}`, 'debug');
      } else {
        this.log(`Tool not found or disabled: ${toolId}`, 'warn');
      }
    }
  }

  /**
   * Carrega subagentes
   */
  async loadSubagents(agentFactory, context) {
    for (const subagentConfig of this.subagentConfigs) {
      const subagentId = typeof subagentConfig === 'string' ? subagentConfig : subagentConfig.id;
      const subagentClass = typeof subagentConfig === 'string' ? subagentConfig : subagentConfig.class;

      try {
        const subagent = await agentFactory.create(subagentClass, {
          ...subagentConfig,
          id: subagentId,
          class: subagentClass,
          parent: this.id
        });

        await subagent.initialize(context);
        this.registerSubagent(subagentId, subagent);
        this.log(`Loaded subagent: ${subagentId}`, 'debug');
      } catch (error) {
        this.log(`Failed to load subagent ${subagentId}: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Carrega knowledge base
   */
  loadKnowledgeBase(kbRegistry) {
    for (const kbConfig of this.kbConfigs) {
      const kbId = typeof kbConfig === 'string' ? kbConfig : kbConfig.id;
      const kb = kbRegistry.get(kbId);

      if (kb && kb.enabled) {
        this.knowledgeBase.set(kbId, kb);
        this.log(`Loaded knowledge base: ${kbId}`, 'debug');
      } else {
        this.log(`Knowledge base not found or disabled: ${kbId}`, 'warn');
      }
    }
  }

  /**
   * Carrega MCP providers
   */
  loadMCPProviders(mcpRegistry) {
    const optionalMCPs = this.mcpConfig.optional || [];

    for (const mcpId of optionalMCPs) {
      const mcp = mcpRegistry.get(mcpId);

      if (mcp && mcp.enabled) {
        this.mcpProviders.set(mcpId, mcp);
        this.log(`Loaded MCP provider: ${mcpId}`, 'debug');
      }
    }
  }

  /**
   * Registra um subagente
   */
  registerSubagent(name, subagent) {
    if (!this.permissions.callSubagents) {
      throw new Error(`Agent ${this.id} does not have permission to use subagents`);
    }

    this.subagents.set(name, subagent);
    this.log(`Registered subagent: ${name}`, 'debug');
  }

  /**
   * Chama um subagente
   */
  async callSubagent(name, input) {
    if (!this.permissions.callSubagents) {
      throw new Error(`Agent ${this.id} does not have permission to call subagents`);
    }

    const subagent = this.subagents.get(name);
    if (!subagent) {
      throw new Error(`Subagent not found: ${name}`);
    }

    if (!subagent.enabled) {
      throw new Error(`Subagent is disabled: ${name}`);
    }

    this.log(`Calling subagent: ${name}`, 'debug');

    const startTime = Date.now();
    try {
      const result = await subagent.run(input);
      const duration = Date.now() - startTime;

      this.log(`Subagent ${name} completed in ${duration}ms`, 'debug');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Subagent ${name} failed after ${duration}ms: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Usa uma tool
   */
  async useTool(toolName, params) {
    if (!this.permissions.useTools) {
      throw new Error(`Agent ${this.id} does not have permission to use tools`);
    }

    const toolEntry = this.availableTools.find(t => t.id === toolName);
    if (!toolEntry) {
      throw new Error(`Tool not available: ${toolName}`);
    }

    this.log(`Using tool: ${toolName}`, 'debug');

    const startTime = Date.now();
    try {
      const result = await this.toolRegistry.execute(toolName, params);
      const duration = Date.now() - startTime;

      this.log(`Tool ${toolName} completed in ${duration}ms`, 'debug');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Tool ${toolName} failed after ${duration}ms: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Executa uma sequência de tools
   */
  async executeToolSequence(trigger, input) {
    const sequence = this.toolSequences.get(trigger);
    if (!sequence) {
      throw new Error(`Tool sequence not found: ${trigger}`);
    }

    this.log(`Executing tool sequence: ${sequence.sequence}`, 'info');

    const results = {};
    const steps = sequence.steps || [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepKey = `step${step.order}`;

      try {
        this.log(`Step ${step.order}: ${step.description}`, 'debug');

        // Resolve parâmetros dinâmicos
        const params = this.resolveParams(step.params, { input, ...results });

        // Executa tool ou MCP
        let result;
        if (step.tool) {
          result = await this.useTool(step.tool, params);
        } else if (step.mcp) {
          result = await this.useMCP(step.mcp, step.action, params);
        }

        results[stepKey] = { result, step };

        // Handle success
        if (step.onSuccess === 'continue') {
          continue;
        } else if (step.onSuccess === 'stop') {
          break;
        }
      } catch (error) {
        this.log(`Step ${step.order} failed: ${error.message}`, 'error');

        // Handle error
        if (step.onError === 'stop') {
          throw error;
        } else if (step.onError === 'skip') {
          continue;
        } else if (step.onError === 'log_warning') {
          this.log(`Step ${step.order} warning: ${error.message}`, 'warn');
          continue;
        } else if (step.onError === 'fallback' && step.fallbackMCP) {
          // Try fallback MCP
          try {
            const params = this.resolveParams(step.params, { input, ...results });
            const result = await this.useMCP(step.fallbackMCP, step.action, params);
            results[stepKey] = { result, step };
          } catch (fallbackError) {
            this.log(`Fallback also failed: ${fallbackError.message}`, 'error');
            throw fallbackError;
          }
        }
      }
    }

    return results;
  }

  /**
   * Resolve parâmetros dinâmicos (substitui ${...} por valores)
   */
  resolveParams(params, context) {
    const resolved = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const path = value.slice(2, -1);
        resolved[key] = this.getNestedValue(context, path);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Obtém valor aninhado de um objeto (ex: "step1.result")
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Usa um MCP provider
   */
  async useMCP(mcpId, action, params) {
    const mcp = this.mcpProviders.get(mcpId);
    if (!mcp) {
      throw new Error(`MCP provider not available: ${mcpId}`);
    }

    this.log(`Using MCP: ${mcpId}.${action}`, 'debug');

    const startTime = Date.now();
    try {
      const result = await mcp.execute(action, params);
      const duration = Date.now() - startTime;

      this.log(`MCP ${mcpId} completed in ${duration}ms`, 'debug');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`MCP ${mcpId} failed after ${duration}ms: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Consulta knowledge base
   */
  async queryKnowledgeBase(kbId, query) {
    if (!this.permissions.accessKB) {
      throw new Error(`Agent ${this.id} does not have permission to access knowledge base`);
    }

    const kb = this.knowledgeBase.get(kbId);
    if (!kb) {
      throw new Error(`Knowledge base not available: ${kbId}`);
    }

    this.log(`Querying knowledge base: ${kbId}`, 'debug');
    return await kb.query(query);
  }

  /**
   * Valida input do agente
   */
  validateInput(input) {
    const errors = [];

    for (const [key, schema] of Object.entries(this.inputSchema)) {
      const value = input[key];

      // Required check
      if (schema.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${key}`);
        continue;
      }

      // Type check
      if (value !== undefined && schema.type) {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];
        const valueType = Array.isArray(value) ? 'array' : typeof value;

        if (!types.includes(valueType)) {
          errors.push(`Invalid type for ${key}: expected ${types.join('|')}, got ${valueType}`);
        }
      }

      // Enum check
      if (value !== undefined && schema.enum && !schema.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${schema.enum.join(', ')}`);
      }

      // Min/max length
      if (typeof value === 'string') {
        if (schema.minLength && value.length < schema.minLength) {
          errors.push(`${key} must be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          errors.push(`${key} must be at most ${schema.maxLength} characters`);
        }
      }

      // Min/max value
      if (typeof value === 'number') {
        if (schema.min !== undefined && value < schema.min) {
          errors.push(`${key} must be at least ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
          errors.push(`${key} must be at most ${schema.max}`);
        }
      }
    }

    // Set defaults
    for (const [key, schema] of Object.entries(this.inputSchema)) {
      if (input[key] === undefined && schema.default !== undefined) {
        input[key] = schema.default;
      }
    }

    if (errors.length > 0) {
      throw new Error(`Input validation failed:\n${errors.join('\n')}`);
    }

    return input;
  }

  /**
   * Verifica rate limit
   */
  checkRateLimit() {
    if (!this.rateLimit.enabled) {
      return true;
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minuto

    if (!this.rateLimitResetTime || now > this.rateLimitResetTime) {
      this.rateLimitCounter = 0;
      this.rateLimitResetTime = now + windowMs;
    }

    if (this.rateLimitCounter >= this.rateLimit.requestsPerMinute) {
      throw new Error(`Rate limit exceeded for agent ${this.id}: ${this.rateLimit.requestsPerMinute} requests per minute`);
    }

    this.rateLimitCounter++;
    return true;
  }

  /**
   * Método principal de execução (wrapper)
   */
  async run(input) {
    // Check if enabled
    if (!this.enabled) {
      throw new Error(`Agent ${this.id} is disabled`);
    }

    // Check if initialized
    if (!this.initialized) {
      throw new Error(`Agent ${this.id} is not initialized`);
    }

    // Check rate limit
    this.checkRateLimit();

    const startTime = Date.now();
    this.state = 'executing';

    try {
      // Validate input
      const validatedInput = this.validateInput(input);

      // Before execute hook
      const processedInput = await this.beforeExecute(validatedInput);

      // Execute
      this.log(`Executing with input: ${JSON.stringify(processedInput)}`, 'debug');
      const result = await this.execute(processedInput);

      // After execute hook
      const processedResult = await this.afterExecute(result);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration);

      this.state = 'ready';
      this.log(`Execution completed in ${duration}ms`, 'info');

      this.emit('executed', { input: processedInput, result: processedResult, duration });

      return processedResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration, error);

      this.state = 'error';
      this.log(`Execution failed after ${duration}ms: ${error.message}`, 'error');

      this.emit('error', { input, error, duration });

      throw error;
    } finally {
      this.state = 'ready';
    }
  }

  /**
   * Atualiza métricas
   */
  updateMetrics(success, duration, error = null) {
    this.metrics.totalExecutions++;

    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
      if (error) {
        this.metrics.errors.push({
          timestamp: new Date().toISOString(),
          message: error.message,
          stack: error.stack
        });

        // Keep only last 100 errors
        if (this.metrics.errors.length > 100) {
          this.metrics.errors = this.metrics.errors.slice(-100);
        }
      }
    }

    this.metrics.totalExecutionTime += duration;
    this.metrics.averageExecutionTime =
      this.metrics.totalExecutionTime / this.metrics.totalExecutions;
    this.metrics.lastExecution = new Date().toISOString();
  }

  /**
   * Sistema de logging
   */
  log(message, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      agent: this.id,
      level,
      message
    };

    this.executionLog.push(entry);

    // Keep only last 1000 entries
    if (this.executionLog.length > 1000) {
      this.executionLog = this.executionLog.slice(-1000);
    }

    this.emit('log', entry);
  }

  /**
   * Obtém logs
   */
  getLog() {
    return this.executionLog;
  }

  /**
   * Limpa logs
   */
  clearLog() {
    this.executionLog = [];
  }

  /**
   * Obtém métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecutions > 0
        ? (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100
        : 0
    };
  }

  /**
   * Obtém informações do agente
   */
  getInfo() {
    return {
      id: this.id,
      class: this.class,
      version: this.version,
      description: this.description,
      tags: this.tags,
      enabled: this.enabled,
      initialized: this.initialized,
      state: this.state,
      capabilities: this.capabilities,
      routing: this.routing,
      permissions: this.permissions,
      subagents: Array.from(this.subagents.keys()),
      tools: this.availableTools.map(t => t.id),
      knowledgeBase: Array.from(this.knowledgeBase.keys()),
      mcpProviders: Array.from(this.mcpProviders.keys()),
      metrics: this.getMetrics()
    };
  }

  /**
   * Habilita o agente
   */
  enable() {
    this.enabled = true;
    this.log('Agent enabled', 'info');
    this.emit('enabled');
  }

  /**
   * Desabilita o agente
   */
  disable() {
    this.enabled = false;
    this.log('Agent disabled', 'info');
    this.emit('disabled');
  }

  /**
   * Destrói o agente
   */
  async destroy() {
    this.log('Destroying agent', 'info');

    // Destroy subagents
    for (const [name, subagent] of this.subagents.entries()) {
      try {
        await subagent.destroy();
      } catch (error) {
        this.log(`Error destroying subagent ${name}: ${error.message}`, 'error');
      }
    }

    // Call hook
    await this.onDestroy();

    // Clear references
    this.subagents.clear();
    this.availableTools = [];
    this.knowledgeBase.clear();
    this.mcpProviders.clear();

    this.state = 'destroyed';
    this.initialized = false;

    this.emit('destroyed');
    this.removeAllListeners();
  }
}
