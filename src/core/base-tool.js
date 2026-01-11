/**
 * BaseTool - Classe base abstrata para todas as ferramentas
 *
 * Garante que todas as tools tenham:
 * - Métodos obrigatórios implementados
 * - Validação de parâmetros
 * - Sistema de logging
 * - Métricas e telemetria
 * - Timeout e circuit breaker
 * - Actions múltiplas
 */

import EventEmitter from 'events';

export class BaseTool extends EventEmitter {
  constructor(config) {
    super();

    // Validação obrigatória
    if (!config) {
      throw new Error('Tool config is required');
    }
    if (!config.id) {
      throw new Error('Tool id is required');
    }
    if (!config.class) {
      throw new Error('Tool class name is required');
    }

    this.id = config.id;
    this.class = config.class;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.version = config.version || '1.0.0';

    // Metadata
    this.description = config.description || '';
    this.category = config.category || 'general';
    this.tags = config.tags || [];

    // Input schema
    this.inputSchema = config.input || {};

    // Constraints
    this.constraints = config.constraints || {};

    // Actions
    this.actions = new Map();
    if (config.actions) {
      config.actions.forEach(action => {
        this.actions.set(action.id, action);
      });
    }

    // Dependencies
    this.requiredBy = config.requiredBy || [];
    this.conflictsWith = config.conflictsWith || [];

    // Circuit breaker
    this.circuitBreaker = {
      enabled: config.circuitBreaker?.enabled || false,
      failureThreshold: config.circuitBreaker?.failureThreshold || 5,
      successThreshold: config.circuitBreaker?.successThreshold || 2,
      timeout: config.circuitBreaker?.timeout || 60000,
      state: 'closed', // closed, open, half-open
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      nextRetryTime: null
    };

    // Retry configuration
    this.retry = {
      enabled: config.retry?.enabled || false,
      maxRetries: config.retry?.maxRetries || 3,
      backoffMs: config.retry?.backoffMs || 1000,
      backoffMultiplier: config.retry?.backoffMultiplier || 2
    };

    // Timeout
    this.timeout = config.timeout || 30000;

    // Logs
    this.executionLog = [];

    // Metrics
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      lastExecution: null,
      errors: []
    };

    // State
    this.initialized = false;
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    // Override em subclasses
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    // Override em subclasses
  }

  /**
   * Lifecycle: Antes da execução
   */
  async beforeExecute(params) {
    // Override em subclasses
    return params;
  }

  /**
   * Lifecycle: Após execução
   */
  async afterExecute(result) {
    // Override em subclasses
    return result;
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * @param {object} params - Parâmetros da execução
   * @returns {Promise<any>} - Resultado
   */
  async execute(params) {
    throw new Error(`execute() must be implemented by ${this.class}`);
  }

  /**
   * Inicializa a tool
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.log('Initializing tool', 'info');
    await this.onInit();
    this.initialized = true;
    this.log('Tool initialized successfully', 'info');
    this.emit('initialized');
  }

  /**
   * Valida parâmetros
   */
  validateParams(params) {
    const errors = [];

    for (const [key, schema] of Object.entries(this.inputSchema)) {
      const value = params[key];

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

      // Min/max
      if (typeof value === 'number') {
        if (schema.min !== undefined && value < schema.min) {
          errors.push(`${key} must be at least ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
          errors.push(`${key} must be at most ${schema.max}`);
        }
      }

      // String length
      if (typeof value === 'string') {
        if (schema.minLength && value.length < schema.minLength) {
          errors.push(`${key} must be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          errors.push(`${key} must be at most ${schema.maxLength} characters`);
        }
      }
    }

    // Set defaults
    for (const [key, schema] of Object.entries(this.inputSchema)) {
      if (params[key] === undefined && schema.default !== undefined) {
        params[key] = schema.default;
      }
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed:\n${errors.join('\n')}`);
    }

    return params;
  }

  /**
   * Verifica circuit breaker
   */
  checkCircuitBreaker() {
    if (!this.circuitBreaker.enabled) {
      return true;
    }

    const now = Date.now();

    // Se circuit está aberto
    if (this.circuitBreaker.state === 'open') {
      // Verifica se passou o timeout
      if (now < this.circuitBreaker.nextRetryTime) {
        throw new Error(`Circuit breaker is open for tool ${this.id}. Retry after ${new Date(this.circuitBreaker.nextRetryTime).toISOString()}`);
      }

      // Tenta reabrir (half-open)
      this.circuitBreaker.state = 'half-open';
      this.circuitBreaker.successes = 0;
      this.log('Circuit breaker entering half-open state', 'info');
    }

    return true;
  }

  /**
   * Registra sucesso no circuit breaker
   */
  recordCircuitBreakerSuccess() {
    if (!this.circuitBreaker.enabled) {
      return;
    }

    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.successes++;

      if (this.circuitBreaker.successes >= this.circuitBreaker.successThreshold) {
        this.circuitBreaker.state = 'closed';
        this.circuitBreaker.failures = 0;
        this.log('Circuit breaker closed', 'info');
      }
    } else if (this.circuitBreaker.state === 'closed') {
      this.circuitBreaker.failures = 0;
    }
  }

  /**
   * Registra falha no circuit breaker
   */
  recordCircuitBreakerFailure() {
    if (!this.circuitBreaker.enabled) {
      return;
    }

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'open';
      this.circuitBreaker.nextRetryTime = Date.now() + this.circuitBreaker.timeout;
      this.log(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`, 'error');
      this.emit('circuit-breaker-open');
    }
  }

  /**
   * Executa com retry
   */
  async executeWithRetry(params) {
    let lastError;
    let attempt = 0;
    const maxAttempts = this.retry.enabled ? this.retry.maxRetries + 1 : 1;

    while (attempt < maxAttempts) {
      try {
        const result = await this.execute(params);
        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < maxAttempts) {
          const backoff = this.retry.backoffMs * Math.pow(this.retry.backoffMultiplier, attempt - 1);
          this.log(`Attempt ${attempt} failed, retrying in ${backoff}ms: ${error.message}`, 'warn');
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }

  /**
   * Executa com timeout
   */
  async executeWithTimeout(params) {
    return Promise.race([
      this.executeWithRetry(params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool ${this.id} timed out after ${this.timeout}ms`)), this.timeout)
      )
    ]);
  }

  /**
   * Método principal de execução (wrapper)
   */
  async run(params = {}, actionId = null) {
    // Check if enabled
    if (!this.enabled) {
      throw new Error(`Tool ${this.id} is disabled`);
    }

    // Check if initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Check circuit breaker
    this.checkCircuitBreaker();

    const startTime = Date.now();

    try {
      // Se actionId foi especificado, executa action específica
      if (actionId) {
        return await this.runAction(actionId, params);
      }

      // Validate params
      const validatedParams = this.validateParams(params);

      // Before execute hook
      const processedParams = await this.beforeExecute(validatedParams);

      // Execute with timeout
      this.log(`Executing with params: ${JSON.stringify(processedParams)}`, 'debug');
      const result = await this.executeWithTimeout(processedParams);

      // After execute hook
      const processedResult = await this.afterExecute(result);

      // Update metrics and circuit breaker
      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration);
      this.recordCircuitBreakerSuccess();

      this.log(`Execution completed in ${duration}ms`, 'info');
      this.emit('executed', { params: processedParams, result: processedResult, duration });

      return processedResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration, error);
      this.recordCircuitBreakerFailure();

      this.log(`Execution failed after ${duration}ms: ${error.message}`, 'error');
      this.emit('error', { params, error, duration });

      throw error;
    }
  }

  /**
   * Executa uma action específica
   */
  async runAction(actionId, params) {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    this.log(`Executing action: ${actionId}`, 'debug');

    // Validate action params
    const actionParams = {};
    for (const paramName of action.params || []) {
      if (params[paramName] === undefined) {
        throw new Error(`Missing required parameter for action ${actionId}: ${paramName}`);
      }
      actionParams[paramName] = params[paramName];
    }

    // Execute action method
    const methodName = `action_${actionId}`;
    if (typeof this[methodName] !== 'function') {
      throw new Error(`Action method not implemented: ${methodName}`);
    }

    return await this[methodName](actionParams);
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
      tool: this.id,
      level,
      message
    };

    this.executionLog.push(entry);

    // Keep only last 500 entries
    if (this.executionLog.length > 500) {
      this.executionLog = this.executionLog.slice(-500);
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
        : 0,
      circuitBreaker: this.circuitBreaker.enabled ? {
        state: this.circuitBreaker.state,
        failures: this.circuitBreaker.failures,
        lastFailureTime: this.circuitBreaker.lastFailureTime
      } : null
    };
  }

  /**
   * Obtém informações da tool
   */
  getInfo() {
    return {
      id: this.id,
      class: this.class,
      version: this.version,
      description: this.description,
      category: this.category,
      tags: this.tags,
      enabled: this.enabled,
      initialized: this.initialized,
      actions: Array.from(this.actions.keys()),
      constraints: this.constraints,
      requiredBy: this.requiredBy,
      conflictsWith: this.conflictsWith,
      metrics: this.getMetrics()
    };
  }

  /**
   * Habilita a tool
   */
  enable() {
    this.enabled = true;
    this.log('Tool enabled', 'info');
    this.emit('enabled');
  }

  /**
   * Desabilita a tool
   */
  disable() {
    this.enabled = false;
    this.log('Tool disabled', 'info');
    this.emit('disabled');
  }

  /**
   * Reseta circuit breaker
   */
  resetCircuitBreaker() {
    if (this.circuitBreaker.enabled) {
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.successes = 0;
      this.circuitBreaker.lastFailureTime = null;
      this.circuitBreaker.nextRetryTime = null;
      this.log('Circuit breaker reset', 'info');
      this.emit('circuit-breaker-reset');
    }
  }

  /**
   * Destrói a tool
   */
  async destroy() {
    this.log('Destroying tool', 'info');
    await this.onDestroy();

    this.actions.clear();
    this.initialized = false;

    this.emit('destroyed');
    this.removeAllListeners();
  }
}
