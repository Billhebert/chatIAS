/**
 * Core Base Classes for ChatIAS 3.0
 * 
 * These base classes provide enterprise-grade governance and structure
 * while maintaining the flexibility and developer experience of modern TypeScript.
 */

import { EventEmitter } from 'eventemitter3';
import { 
  AgentConfig, 
  AgentResult, 
  ToolConfig, 
  ToolResult, 
  McpProviderConfig,
  McpResult,
  KnowledgeBaseConfig,
  QueryResult,
  ExecutionContext,
  ChatIASError,
  ExecutionError
} from '../types/index.js';

/**
 * Base Agent Class - Foundation for all AI agents
 * Combines enterprise governance from projeto-SDK with modern TypeScript patterns
 */
export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected initialized: boolean = false;
  protected metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecutionTime: number;
  };

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0
    };
  }

  /**
   * Initialize the agent with resources
   */
  async initialize(): Promise<void> {
    try {
      this.emit('agent:initializing', { agentId: this.config.id });
      await this.onInit();
      this.initialized = true;
      this.emit('agent:initialized', { agentId: this.config.id });
    } catch (error) {
      this.emit('agent:error', { 
        agentId: this.config.id, 
        error: error.message 
      });
      throw new ExecutionError(
        `Failed to initialize agent ${this.config.id}: ${error.message}`,
        this.config.id
      );
    }
  }

  /**
   * Execute the agent with validated input
   */
  async execute(input: unknown, context?: ExecutionContext): Promise<AgentResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      this.emit('agent:execute:start', { 
        agentId: this.config.id, 
        input, 
        context 
      });

      // Validate input
      const validatedInput = await this.validateInput(input);
      
      // Pre-execution hook
      const processedInput = await this.beforeExecute(validatedInput, context);
      
      // Core execution
      const result = await this.onExecute(processedInput, context);
      
      // Post-execution hook
      const finalResult = await this.afterExecute(result, context);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      this.emit('agent:execute:success', { 
        agentId: this.config.id, 
        result: finalResult, 
        duration 
      });

      return {
        success: true,
        data: finalResult,
        metadata: {
          duration,
          requestId: context?.requestId
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false);

      this.emit('agent:execute:error', { 
        agentId: this.config.id, 
        error: error.message, 
        duration 
      });

      return {
        success: false,
        error: error.message,
        metadata: {
          duration,
          requestId: context?.requestId
        }
      };
    }
  }

  /**
   * Destroy the agent and cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      this.emit('agent:destroying', { agentId: this.config.id });
      await this.onDestroy();
      this.initialized = false;
      this.emit('agent:destroyed', { agentId: this.config.id });
    } catch (error) {
      this.emit('agent:error', { 
        agentId: this.config.id, 
        error: error.message 
      });
    }
  }

  /**
   * Get agent metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecutions > 0 
        ? this.metrics.successfulExecutions / this.metrics.totalExecutions 
        : 0,
      failureRate: this.metrics.totalExecutions > 0 
        ? this.metrics.failedExecutions / this.metrics.totalExecutions 
        : 0
    };
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  // Abstract methods to be implemented by concrete agents

  /**
   * Core agent logic - must be implemented
   */
  protected abstract onExecute(input: unknown, context?: ExecutionContext): Promise<any>;

  /**
   * Validate input before execution
   */
  protected abstract validateInput(input: unknown): Promise<any>;

  // Optional lifecycle hooks (can be overridden)

  /**
   * Initialize resources (optional)
   */
  protected async onInit(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Cleanup resources (optional)
   */
  protected async onDestroy(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Pre-processing hook (optional)
   */
  protected async beforeExecute(input: any, context?: ExecutionContext): Promise<any> {
    return input;
  }

  /**
   * Post-processing hook (optional)
   */
  protected async afterExecute(result: any, context?: ExecutionContext): Promise<any> {
    return result;
  }

  // Utility methods

  /**
   * Log agent activity
   */
  protected log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    this.emit('agent:log', { 
      agentId: this.config.id, 
      message, 
      level,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(duration: number, success: boolean): void {
    this.metrics.lastExecutionTime = duration;
    
    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + duration;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;
  }
}

/**
 * Base Tool Class - Foundation for all tools
 * Combines enterprise constraints with modern TypeScript tooling
 */
export abstract class BaseTool {
  protected config: ToolConfig;
  protected initialized: boolean = false;
  protected metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    actionStats: Record<string, number>;
  };

  constructor(config: ToolConfig) {
    this.config = config;
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      actionStats: {}
    };
  }

  /**
   * Initialize the tool
   */
  async initialize(): Promise<void> {
    try {
      await this.onInit();
      this.initialized = true;
    } catch (error) {
      throw new ExecutionError(
        `Failed to initialize tool ${this.config.id}: ${error.message}`,
        this.config.id
      );
    }
  }

  /**
   * Execute a specific action on the tool
   */
  async execute(action: string, params: Record<string, any>, context?: ExecutionContext): Promise<ToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check constraints
    await this.checkConstraints(params, context);

    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      // Validate parameters
      const validatedParams = await this.validateParameters(action, params);
      
      // Check if action exists
      const actionMethod = this.getActionMethod(action);
      if (!actionMethod) {
        throw new Error(`Action '${action}' not found in tool ${this.config.id}`);
      }

      // Execute action
      const result = await actionMethod.call(this, validatedParams, context);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true, action);

      return {
        success: true,
        data: result,
        metadata: {
          duration,
          action,
          params
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false, action);

      return {
        success: false,
        error: error.message,
        metadata: {
          duration,
          action,
          params
        }
      };
    }
  }

  /**
   * Destroy the tool
   */
  async destroy(): Promise<void> {
    await this.onDestroy();
    this.initialized = false;
  }

  /**
   * Get tool metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecutions > 0 
        ? this.metrics.successfulExecutions / this.metrics.totalExecutions 
        : 0
    };
  }

  /**
   * Get tool configuration
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }

  // Abstract methods

  /**
   * Main tool execution logic
   */
  protected abstract executeCore(params: Record<string, any>, context?: ExecutionContext): Promise<any>;

  /**
   * Validate parameters against tool schema
   */
  protected abstract validateParameters(action: string, params: Record<string, any>): Promise<Record<string, any>>;

  // Optional hooks

  /**
   * Initialize tool resources
   */
  protected async onInit(): Promise<void> {
    // Override if needed
  }

  /**
   * Cleanup tool resources
   */
  protected async onDestroy(): Promise<void> {
    // Override if needed
  }

  /**
   * Check tool constraints before execution
   */
  protected async checkConstraints(params: Record<string, any>, context?: ExecutionContext): Promise<void> {
    if (!this.config.constraints) return;

    // Check execution time
    if (this.config.constraints.maxExecutionTime) {
      // This would be checked by a timeout wrapper
    }

    // Check file system access
    if (this.config.constraints.noFileSystem && params.filePath) {
      throw new Error('File system access is not allowed by this tool');
    }

    // Check network access
    if (this.config.constraints.noNetwork && params.url) {
      throw new Error('Network access is not allowed by this tool');
    }

    // Check allowed paths
    if (this.config.constraints.allowedPaths && params.filePath) {
      const isAllowed = this.config.constraints.allowedPaths.some(allowedPath => 
        params.filePath.startsWith(allowedPath)
      );
      if (!isAllowed) {
        throw new Error(`Access to path '${params.filePath}' is not allowed`);
      }
    }
  }

  // Utility methods

  /**
   * Get action method by name
   */
  private getActionMethod(action: string): Function | null {
    // First check for specific action method
    const actionMethod = (this as any)[`action_${action}`];
    if (typeof actionMethod === 'function') {
      return actionMethod;
    }

    // Fall back to core execution
    if (typeof this.executeCore === 'function') {
      return this.executeCore.bind(this);
    }

    return null;
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(duration: number, success: boolean, action: string): void {
    // Update action stats
    this.metrics.actionStats[action] = (this.metrics.actionStats[action] || 0) + 1;

    // Update execution stats
    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + duration;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;
  }
}

/**
 * Base MCP Provider Class - Foundation for all Model Context Protocol providers
 */
export abstract class BaseMCP {
  protected config: McpProviderConfig;
  protected connected: boolean = false;
  protected circuitBreakerState: {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
  };

  constructor(config: McpProviderConfig) {
    this.config = config;
    this.circuitBreakerState = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    };
  }

  /**
   * Connect to the MCP provider
   */
  async connect(): Promise<void> {
    try {
      await this.onConnect();
      this.connected = true;
      this.resetCircuitBreaker();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Disconnect from the MCP provider
   */
  async disconnect(): Promise<void> {
    await this.onDisconnect();
    this.connected = false;
  }

  /**
   * Execute a query/action on the MCP provider
   */
  async execute(action: string, params: Record<string, any>, context?: ExecutionContext): Promise<McpResult> {
    // Check circuit breaker
    if (!this.canExecute()) {
      return {
        success: false,
        error: 'Circuit breaker is open'
      };
    }

    try {
      const result = await this.onExecute(action, params, context);
      this.recordSuccess();
      
      return {
        success: true,
        content: result.content || result,
        metadata: {
          model: result.model || this.config.defaultModel,
          tokens: result.tokens,
          duration: result.duration || 0
        }
      };

    } catch (error) {
      this.recordFailure();
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if the provider is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      return await this.onHealthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Get provider info
   */
  getInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      connected: this.connected,
      circuitBreakerState: this.circuitBreakerState
    };
  }

  // Abstract methods

  /**
   * Connect to provider
   */
  protected abstract onConnect(): Promise<void>;

  /**
   * Disconnect from provider
   */
  protected abstract onDisconnect(): Promise<void>;

  /**
   * Execute action/query
   */
  protected abstract onExecute(action: string, params: Record<string, any>, context?: ExecutionContext): Promise<any>;

  /**
   * Health check implementation
   */
  protected abstract onHealthCheck(): Promise<boolean>;

  // Circuit breaker methods

  /**
   * Check if execution is allowed
   */
  private canExecute(): boolean {
    if (!this.config.circuitBreaker?.enabled) {
      return true;
    }

    const { failureThreshold, timeout } = this.config.circuitBreaker;
    const now = Date.now();

    if (this.circuitBreakerState.state === 'open') {
      if (now - this.circuitBreakerState.lastFailureTime > timeout) {
        this.circuitBreakerState.state = 'half-open';
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(): void {
    if (this.circuitBreakerState.state === 'half-open') {
      this.circuitBreakerState.state = 'closed';
    }
    this.circuitBreakerState.failures = 0;
  }

  /**
   * Record a failed execution
   */
  private recordFailure(): void {
    this.circuitBreakerState.failures++;
    this.circuitBreakerState.lastFailureTime = Date.now();

    if (this.circuitBreakerState.failures >= (this.config.circuitBreaker?.failureThreshold || 5)) {
      this.circuitBreakerState.state = 'open';
    }
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(): void {
    this.circuitBreakerState = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    };
  }
}

/**
 * Base Knowledge Base Class - Foundation for all knowledge bases
 */
export abstract class BaseKnowledgeBase {
  protected config: KnowledgeBaseConfig;
  protected documents: Map<string, any> = new Map();
  protected initialized: boolean = false;

  constructor(config: KnowledgeBaseConfig) {
    this.config = config;
  }

  /**
   * Initialize the knowledge base
   */
  async initialize(): Promise<void> {
    await this.onInit();
    await this.loadDocuments();
    this.initialized = true;
  }

  /**
   * Add a document to the knowledge base
   */
  addDocument(document: any): void {
    this.documents.set(document.id, document);
    this.onDocumentAdded(document);
  }

  /**
   * Remove a document from the knowledge base
   */
  removeDocument(documentId: string): boolean {
    const removed = this.documents.delete(documentId);
    if (removed) {
      this.onDocumentRemoved(documentId);
    }
    return removed;
  }

  /**
   * Search the knowledge base
   */
  async search(query: string, options?: { topK?: number; scoreThreshold?: number }): Promise<QueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.onSearch(query, options);
  }

  /**
   * Get knowledge base info
   */
  getInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      documentCount: this.documents.size,
      initialized: this.initialized
    };
  }

  // Abstract methods

  /**
   * Initialize knowledge base resources
   */
  protected abstract onInit(): Promise<void>;

  /**
   * Load documents into memory/index
   */
  protected abstract loadDocuments(): Promise<void>;

  /**
   * Search implementation
   */
  protected abstract onSearch(query: string, options?: any): Promise<QueryResult>;

  // Optional hooks

  /**
   * Called when a document is added
   */
  protected onDocumentAdded(document: any): void {
    // Override if needed
  }

  /**
   * Called when a document is removed
   */
  protected onDocumentRemoved(documentId: string): void {
    // Override if needed
  }

  /**
   * Destroy knowledge base and cleanup
   */
  async destroy(): Promise<void> {
    this.documents.clear();
    await this.onDestroy();
    this.initialized = false;
  }

  /**
   * Cleanup resources
   */
  protected async onDestroy(): Promise<void> {
    // Override if needed
  }
}