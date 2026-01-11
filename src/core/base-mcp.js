/**
 * BaseMCP - Classe base abstrata para MCP (Model Context Protocol) Providers
 *
 * Garante que todos os MCP providers tenham:
 * - Conexão e health check
 * - Circuit breaker com fallback automático
 * - Retry logic
 * - Rate limiting
 * - Métricas e telemetria
 */

import EventEmitter from 'events';

export class BaseMCP extends EventEmitter {
  constructor(config) {
    super();

    // Validação obrigatória
    if (!config) {
      throw new Error('MCP config is required');
    }
    if (!config.id) {
      throw new Error('MCP id is required');
    }
    if (!config.class) {
      throw new Error('MCP class name is required');
    }

    this.id = config.id;
    this.class = config.class;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.version = config.version || '1.0.0';
    this.type = config.type || 'local'; // local, cloud, hybrid

    // Metadata
    this.name = config.name || this.id;
    this.description = config.description || '';

    // Connection
    this.baseUrl = config.baseUrl || '';
    this.connected = false;
    this.lastConnectionAttempt = null;

    // Authentication
    this.authentication = config.authentication || null;
    this.authenticated = false;

    // Models
    this.models = new Map();
    if (config.models) {
      config.models.forEach(model => {
        this.models.set(model.id, model);
      });
    }
    this.defaultModel = config.defaultModel || (config.models?.[0]?.id);

    // Health check
    this.healthCheck = {
      enabled: config.healthCheck?.enabled || false,
      endpoint: config.healthCheck?.endpoint || '/health',
      interval: config.healthCheck?.interval || 30000,
      timeout: config.healthCheck?.timeout || 5000,
      intervalId: null,
      lastCheck: null,
      lastStatus: null
    };

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

    // Fallback
    this.fallbackId = config.fallback || null;
    this.fallbackProvider = null;

    // Retry
    this.retry = {
      enabled: config.retry?.enabled !== false,
      maxRetries: config.retry?.maxRetries || 3,
      backoffMs: config.retry?.backoffMs || 1000,
      backoffMultiplier: config.retry?.backoffMultiplier || 2
    };

    // Rate limiting
    this.rateLimit = {
      enabled: config.rateLimit?.enabled || false,
      requestsPerMinute: config.rateLimit?.requestsPerMinute || 60,
      burstSize: config.rateLimit?.burstSize || 10,
      counter: 0,
      resetTime: null,
      queue: []
    };

    // Timeout
    this.timeout = config.timeout || 30000;

    // Logs
    this.executionLog = [];

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbackRequests: 0,
      totalRequestTime: 0,
      averageRequestTime: 0,
      lastRequest: null,
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
   * Lifecycle: Antes da requisição
   */
  async beforeRequest(params) {
    // Override em subclasses
    return params;
  }

  /**
   * Lifecycle: Após requisição
   */
  async afterRequest(result) {
    // Override em subclasses
    return result;
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * Conecta ao provider
   */
  async connect() {
    throw new Error(`connect() must be implemented by ${this.class}`);
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * Desconecta do provider
   */
  async disconnect() {
    throw new Error(`disconnect() must be implemented by ${this.class}`);
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * Executa uma ação no provider
   */
  async execute(action, params) {
    throw new Error(`execute() must be implemented by ${this.class}`);
  }

  /**
   * Inicializa o MCP provider
   */
  async initialize(context) {
    if (this.initialized) {
      return;
    }

    this.log('Initializing MCP provider', 'info');

    // Armazena contexto (para acessar fallback)
    if (context?.mcpRegistry) {
      this.mcpRegistry = context.mcpRegistry;

      // Carrega fallback provider
      if (this.fallbackId) {
        this.fallbackProvider = this.mcpRegistry.get(this.fallbackId);
        if (this.fallbackProvider) {
          this.log(`Fallback provider configured: ${this.fallbackId}`, 'info');
        }
      }
    }

    // Autentica se necessário
    if (this.authentication) {
      await this.authenticate();
    }

    // Conecta
    try {
      await this.connect();
      this.connected = true;
      this.log('Connected successfully', 'info');
    } catch (error) {
      this.log(`Connection failed: ${error.message}`, 'error');
      // Não falha a inicialização, apenas marca como não conectado
    }

    // Inicia health check
    if (this.healthCheck.enabled) {
      this.startHealthCheck();
    }

    // Chama hook
    await this.onInit();

    this.initialized = true;
    this.log('MCP provider initialized successfully', 'info');
    this.emit('initialized');
  }

  /**
   * Autentica com o provider
   */
  async authenticate() {
    if (!this.authentication) {
      return true;
    }

    this.log('Authenticating', 'info');

    try {
      if (this.authentication.type === 'api-key') {
        const apiKey = process.env[this.authentication.envVar];
        if (!apiKey && this.authentication.required) {
          throw new Error(`API key not found in environment variable: ${this.authentication.envVar}`);
        }

        this.apiKey = apiKey;
        this.authenticated = true;
        this.log('Authentication successful', 'info');
        return true;
      }

      // Outros tipos de autenticação podem ser implementados aqui
      throw new Error(`Unsupported authentication type: ${this.authentication.type}`);
    } catch (error) {
      this.log(`Authentication failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Inicia health check periódico
   */
  startHealthCheck() {
    if (this.healthCheck.intervalId) {
      return; // Já está rodando
    }

    this.log(`Starting health check (interval: ${this.healthCheck.interval}ms)`, 'info');

    this.healthCheck.intervalId = setInterval(async () => {
      try {
        const isHealthy = await this.checkHealth();
        this.healthCheck.lastCheck = new Date().toISOString();
        this.healthCheck.lastStatus = isHealthy ? 'healthy' : 'unhealthy';

        if (!isHealthy && this.connected) {
          this.log('Health check failed, marking as disconnected', 'warn');
          this.connected = false;
          this.emit('disconnected');
        } else if (isHealthy && !this.connected) {
          this.log('Health check passed, marking as connected', 'info');
          this.connected = true;
          this.emit('connected');
        }
      } catch (error) {
        this.log(`Health check error: ${error.message}`, 'error');
      }
    }, this.healthCheck.interval);
  }

  /**
   * Para health check
   */
  stopHealthCheck() {
    if (this.healthCheck.intervalId) {
      clearInterval(this.healthCheck.intervalId);
      this.healthCheck.intervalId = null;
      this.log('Health check stopped', 'info');
    }
  }

  /**
   * Verifica saúde do provider
   */
  async checkHealth() {
    // Override em subclasses para implementação específica
    return this.connected;
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
        throw new Error(`Circuit breaker is open for MCP ${this.id}. Retry after ${new Date(this.circuitBreaker.nextRetryTime).toISOString()}`);
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
        this.emit('circuit-breaker-closed');
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
   * Verifica e aplica rate limit
   */
  async checkRateLimit() {
    if (!this.rateLimit.enabled) {
      return true;
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minuto

    // Reset counter se passou a janela
    if (!this.rateLimit.resetTime || now > this.rateLimit.resetTime) {
      this.rateLimit.counter = 0;
      this.rateLimit.resetTime = now + windowMs;
    }

    // Verifica limite
    if (this.rateLimit.counter >= this.rateLimit.requestsPerMinute) {
      const waitTime = this.rateLimit.resetTime - now;
      this.log(`Rate limit exceeded, waiting ${waitTime}ms`, 'warn');

      // Aguarda reset
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Reset counter
      this.rateLimit.counter = 0;
      this.rateLimit.resetTime = Date.now() + windowMs;
    }

    this.rateLimit.counter++;
    return true;
  }

  /**
   * Executa com retry
   */
  async executeWithRetry(action, params) {
    let lastError;
    let attempt = 0;
    const maxAttempts = this.retry.enabled ? this.retry.maxRetries + 1 : 1;

    while (attempt < maxAttempts) {
      try {
        const result = await this.execute(action, params);
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
  async executeWithTimeout(action, params) {
    return Promise.race([
      this.executeWithRetry(action, params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`MCP ${this.id} timed out after ${this.timeout}ms`)), this.timeout)
      )
    ]);
  }

  /**
   * Executa com fallback automático
   */
  async executeWithFallback(action, params) {
    try {
      return await this.executeWithTimeout(action, params);
    } catch (error) {
      this.log(`Primary execution failed: ${error.message}`, 'error');

      // Tenta fallback se disponível
      if (this.fallbackProvider && this.fallbackProvider.enabled && this.fallbackProvider.connected) {
        this.log(`Attempting fallback to: ${this.fallbackId}`, 'info');
        this.metrics.fallbackRequests++;

        try {
          const result = await this.fallbackProvider.run(action, params);
          this.log('Fallback succeeded', 'info');
          this.emit('fallback-success', { primary: this.id, fallback: this.fallbackId });
          return result;
        } catch (fallbackError) {
          this.log(`Fallback also failed: ${fallbackError.message}`, 'error');
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Método principal de execução (wrapper)
   */
  async run(action, params = {}) {
    // Check if enabled
    if (!this.enabled) {
      throw new Error(`MCP provider ${this.id} is disabled`);
    }

    // Check if initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Check circuit breaker
    this.checkCircuitBreaker();

    // Check rate limit
    await this.checkRateLimit();

    const startTime = Date.now();

    try {
      // Before request hook
      const processedParams = await this.beforeRequest(params);

      // Execute with fallback
      this.log(`Executing action: ${action}`, 'debug');
      const result = await this.executeWithFallback(action, processedParams);

      // After request hook
      const processedResult = await this.afterRequest(result);

      // Update metrics and circuit breaker
      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration);
      this.recordCircuitBreakerSuccess();

      this.log(`Execution completed in ${duration}ms`, 'info');
      this.emit('executed', { action, params: processedParams, result: processedResult, duration });

      return processedResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration, error);
      this.recordCircuitBreakerFailure();

      this.log(`Execution failed after ${duration}ms: ${error.message}`, 'error');
      this.emit('error', { action, params, error, duration });

      throw error;
    }
  }

  /**
   * Obtém informações de um modelo
   */
  getModel(modelId) {
    return this.models.get(modelId || this.defaultModel);
  }

  /**
   * Lista modelos disponíveis
   */
  listModels() {
    return Array.from(this.models.values());
  }

  /**
   * Atualiza métricas
   */
  updateMetrics(success, duration, error = null) {
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
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

    this.metrics.totalRequestTime += duration;
    this.metrics.averageRequestTime =
      this.metrics.totalRequestTime / this.metrics.totalRequests;
    this.metrics.lastRequest = new Date().toISOString();
  }

  /**
   * Sistema de logging
   */
  log(message, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      mcp: this.id,
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
      successRate: this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 0,
      fallbackRate: this.metrics.totalRequests > 0
        ? (this.metrics.fallbackRequests / this.metrics.totalRequests) * 100
        : 0,
      circuitBreaker: this.circuitBreaker.enabled ? {
        state: this.circuitBreaker.state,
        failures: this.circuitBreaker.failures,
        lastFailureTime: this.circuitBreaker.lastFailureTime
      } : null,
      healthCheck: this.healthCheck.enabled ? {
        lastCheck: this.healthCheck.lastCheck,
        lastStatus: this.healthCheck.lastStatus
      } : null
    };
  }

  /**
   * Obtém informações do MCP provider
   */
  getInfo() {
    return {
      id: this.id,
      class: this.class,
      version: this.version,
      name: this.name,
      description: this.description,
      type: this.type,
      enabled: this.enabled,
      initialized: this.initialized,
      connected: this.connected,
      authenticated: this.authenticated,
      models: this.listModels(),
      defaultModel: this.defaultModel,
      fallback: this.fallbackId,
      metrics: this.getMetrics()
    };
  }

  /**
   * Habilita o provider
   */
  enable() {
    this.enabled = true;
    this.log('MCP provider enabled', 'info');
    this.emit('enabled');
  }

  /**
   * Desabilita o provider
   */
  disable() {
    this.enabled = false;
    this.log('MCP provider disabled', 'info');
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
   * Destrói o provider
   */
  async destroy() {
    this.log('Destroying MCP provider', 'info');

    // Para health check
    this.stopHealthCheck();

    // Desconecta
    if (this.connected) {
      try {
        await this.disconnect();
      } catch (error) {
        this.log(`Error disconnecting: ${error.message}`, 'error');
      }
    }

    // Chama hook
    await this.onDestroy();

    this.models.clear();
    this.initialized = false;
    this.connected = false;

    this.emit('destroyed');
    this.removeAllListeners();
  }
}
