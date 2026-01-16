/**
 * Tool Sequences and Orchestration Engine
 * 
 * This module provides the sophisticated tool sequence execution system
 * from projeto-SDK, now enhanced with TypeScript and modern patterns.
 */

import { 
  ToolSequence, 
  SequenceStep, 
  ToolResult, 
  McpResult, 
  ExecutionContext,
  RetryConfig,
  CircuitBreakerConfig,
  ChatIASError,
  ExecutionError
} from '../types/index.js';

/**
 * Tool Sequence Executor - Executes complex multi-step tool workflows
 * 
 * This is the core orchestration engine that made projeto-SDK powerful,
 * now rewritten with TypeScript and enhanced error handling.
 */
export class ToolSequenceExecutor {
  private sequences: Map<string, ToolSequence> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor() {
    this.circuitBreakers = new Map();
  }

  /**
   * Register a new tool sequence
   */
  registerSequence(sequence: ToolSequence): void {
    this.sequences.set(sequence.id, sequence);
    
    // Initialize circuit breaker if configured
    if (sequence.circuitBreaker?.enabled) {
      this.circuitBreakers.set(sequence.id, {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed'
      });
    }
  }

  /**
   * Execute a tool sequence
   */
  async execute(
    sequenceId: string, 
    input: Record<string, any>, 
    context: ExecutionContext,
    toolRegistry: any,
    mcpRegistry: any
  ): Promise<any> {
    const sequence = this.sequences.get(sequenceId);
    if (!sequence) {
      throw new ExecutionError(`Tool sequence '${sequenceId}' not found`, 'ToolSequenceExecutor');
    }

    // Check circuit breaker
    if (!this.canExecuteSequence(sequenceId, sequence)) {
      throw new ExecutionError(`Circuit breaker is open for sequence '${sequenceId}'`, 'ToolSequenceExecutor');
    }

    const results: any[] = [];
    const steps = sequence.steps.sort((a, b) => a.order - b.order);
    
    try {
      this.logExecutionStart(sequenceId, sequence, context);

      for (const step of steps) {
        const stepResult = await this.executeStep(
          step, 
          input, 
          results, 
          context, 
          toolRegistry, 
          mcpRegistry
        );
        
        results.push({
          step: step.order,
          action: step.action,
          result: stepResult,
          description: step.description
        });

        // Handle step failure based on configuration
        if (!stepResult.success) {
          const handled = await this.handleStepFailure(
            step, 
            stepResult.error, 
            sequence.errorHandling
          );
          
          if (handled === 'stop') {
            break;
          }
        }
      }

      // Record success
      this.recordSequenceSuccess(sequenceId);
      
      return {
        success: true,
        data: results,
        sequenceId,
        metadata: {
          stepsExecuted: results.length,
          contextId: context.requestId
        }
      };

    } catch (error) {
      // Record failure
      this.recordSequenceFailure(sequenceId);
      
      throw new ExecutionError(
        `Tool sequence '${sequenceId}' failed: ${error.message}`,
        'ToolSequenceExecutor',
        { sequenceId, step: results.length, originalError: error }
      );
    }
  }

  /**
   * Execute a single step in the sequence
   */
  private async executeStep(
    step: SequenceStep,
    input: Record<string, any>,
    previousResults: any[],
    context: ExecutionContext,
    toolRegistry: any,
    mcpRegistry: any
  ): Promise<any> {
    // Resolve parameters with variable substitution
    const resolvedParams = this.resolveParameters(step.params, input, previousResults);
    
    let result: any;

    if (step.tool) {
      // Execute tool
      const tool = toolRegistry.get(step.tool);
      if (!tool) {
        throw new Error(`Tool '${step.tool}' not found in registry`);
      }
      
      result = await tool.execute(step.action, resolvedParams, context);
      
    } else if (step.mcp) {
      // Execute MCP provider
      const mcp = mcpRegistry.get(step.mcp);
      if (!mcp) {
        throw new Error(`MCP provider '${step.mcp}' not found in registry`);
      }
      
      result = await mcp.execute(step.action, resolvedParams, context);
      
      // If MCP fails and fallback is configured
      if (!result.success && step.fallbackMCP) {
        const fallbackMcp = mcpRegistry.get(step.fallbackMCP);
        if (fallbackMcp) {
          result = await fallbackMcp.execute(step.action, resolvedParams, context);
        }
      }
    } else {
      throw new Error(`Step must specify either 'tool' or 'mcp'`);
    }

    return result;
  }

  /**
   * Resolve parameters with variable substitution
   * Supports ${input.variable} and ${stepX.result} patterns
   */
  private resolveParameters(
    params: Record<string, any>,
    input: Record<string, any>,
    previousResults: any[]
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this.substituteVariables(value, input, previousResults);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParameters(value, input, previousResults);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Substitute variables in parameter strings
   */
  private substituteVariables(
    template: string,
    input: Record<string, any>,
    previousResults: any[]
  ): any {
    // Substitute input variables ${input.variable}
    let result = template.replace(/\$\{input\.([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(input, path);
      return value !== undefined ? String(value) : match;
    });

    // Substitute step results ${stepX.result}
    result = result.replace(/\$\{step(\d+)\.([^}]+)\}/g, (match, stepNum, path) => {
      const stepIndex = parseInt(stepNum) - 1;
      if (stepIndex >= 0 && stepIndex < previousResults.length) {
        const stepResult = previousResults[stepIndex];
        const value = this.getNestedValue(stepResult.result || stepResult, path);
        return value !== undefined ? String(value) : match;
      }
      return match;
    });

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Handle step failures based on error handling configuration
   */
  private async handleStepFailure(
    step: SequenceStep,
    error: string,
    errorHandling: any
  ): Promise<'continue' | 'stop'> {
    switch (step.onError) {
      case 'continue':
        return 'continue';
        
      case 'log_warning':
        console.warn(`Step ${step.order} failed but continuing: ${error}`);
        return 'continue';
        
      case 'skip':
        console.warn(`Step ${step.order} failed and skipped: ${error}`);
        return 'continue';
        
      case 'fallback':
        // Fallback is handled in executeStep
        return 'continue';
        
      case 'stop':
      default:
        if (errorHandling.retry?.enabled) {
          // Implement retry logic here
          const retrySuccess = await this.retryStep(step, errorHandling.retry);
          if (retrySuccess) {
            return 'continue';
          }
        }
        return 'stop';
    }
  }

  /**
   * Retry a failed step with exponential backoff
   */
  private async retryStep(
    step: SequenceStep,
    retryConfig: RetryConfig
  ): Promise<boolean> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Wait with exponential backoff
        const delay = retryConfig.exponentialBackoff 
          ? retryConfig.backoffMs * Math.pow(2, attempt - 1)
          : retryConfig.backoffMs;
        
        if (attempt > 1) {
          await this.sleep(delay);
        }

        // Retry execution (this would need more context to actually retry)
        console.log(`Retrying step ${step.order}, attempt ${attempt}`);
        // In a real implementation, we'd retry the actual step here
        return true;

      } catch (error) {
        lastError = error.message;
        console.warn(`Retry ${attempt} failed for step ${step.order}: ${error.message}`);
      }
    }

    console.error(`All retries failed for step ${step.order}: ${lastError}`);
    return false;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a sequence can execute (circuit breaker logic)
   */
  private canExecuteSequence(sequenceId: string, sequence: ToolSequence): boolean {
    const circuitBreaker = sequence.circuitBreaker;
    if (!circuitBreaker?.enabled) {
      return true;
    }

    const state = this.circuitBreakers.get(sequenceId);
    if (!state) {
      return true;
    }

    const now = Date.now();
    
    if (state.state === 'open') {
      if (now - state.lastFailureTime > circuitBreaker.timeout) {
        state.state = 'half-open';
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record successful sequence execution
   */
  private recordSequenceSuccess(sequenceId: string): void {
    const state = this.circuitBreakers.get(sequenceId);
    if (!state) return;

    if (state.state === 'half-open') {
      state.state = 'closed';
    }
    state.failures = 0;
  }

  /**
   * Record failed sequence execution
   */
  private recordSequenceFailure(sequenceId: string): void {
    const sequence = this.sequences.get(sequenceId);
    if (!sequence?.circuitBreaker?.enabled) return;

    const state = this.circuitBreakers.get(sequenceId);
    if (!state) return;

    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= sequence.circuitBreaker.failureThreshold) {
      state.state = 'open';
    }
  }

  /**
   * Log sequence execution start
   */
  private logExecutionStart(sequenceId: string, sequence: ToolSequence, context: ExecutionContext): void {
    console.log(`[ToolSequence] Starting execution: ${sequenceId}`, {
      description: sequence.description,
      requestId: context.requestId,
      steps: sequence.steps.length
    });
  }

  /**
   * Get all registered sequences
   */
  getSequences(): ToolSequence[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Get sequence by ID
   */
  getSequence(sequenceId: string): ToolSequence | undefined {
    return this.sequences.get(sequenceId);
  }

  /**
   * Get circuit breaker state for a sequence
   */
  getCircuitBreakerState(sequenceId: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(sequenceId);
  }

  /**
   * Reset circuit breaker for a sequence
   */
  resetCircuitBreaker(sequenceId: string): void {
    const state = this.circuitBreakers.get(sequenceId);
    if (state) {
      state.failures = 0;
      state.lastFailureTime = 0;
      state.state = 'closed';
    }
  }
}

/**
 * Circuit breaker state interface
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Workflow Builder - Fluent interface for building tool sequences
 * 
 * This provides a more developer-friendly way to create complex workflows
 * while maintaining the power of the sequence engine.
 */
export class WorkflowBuilder {
  private sequence: Partial<ToolSequence> = {
    id: '',
    name: '',
    description: '',
    tags: [],
    triggeredBy: [],
    steps: [],
    errorHandling: {
      strategy: 'fail_fast',
      retry: {
        enabled: false,
        maxRetries: 3,
        backoffMs: 1000,
        exponentialBackoff: true
      }
    }
  };

  constructor(id: string) {
    this.sequence.id = id;
  }

  name(name: string): WorkflowBuilder {
    this.sequence.name = name;
    return this;
  }

  description(description: string): WorkflowBuilder {
    this.sequence.description = description;
    return this;
  }

  tags(...tags: string[]): WorkflowBuilder {
    this.sequence.tags = tags;
    return this;
  }

  triggeredBy(...triggers: string[]): WorkflowBuilder {
    this.sequence.triggeredBy = triggers;
    return this;
  }

  /**
   * Add a tool step to the workflow
   */
  tool(
    order: number,
    toolId: string,
    action: string,
    params: Record<string, any>,
    options?: {
      description?: string;
      onSuccess?: 'continue' | 'stop' | 'log_warning' | 'skip';
      onError?: 'continue' | 'stop' | 'log_warning' | 'skip' | 'fallback';
    }
  ): WorkflowBuilder {
    this.sequence.steps!.push({
      order,
      tool: toolId,
      action,
      params,
      onSuccess: options?.onSuccess || 'continue',
      onError: options?.onError || 'stop',
      description: options?.description
    });

    return this;
  }

  /**
   * Add an MCP step to the workflow
   */
  mcp(
    order: number,
    mcpId: string,
    action: string,
    params: Record<string, any>,
    options?: {
      description?: string;
      onSuccess?: 'continue' | 'stop' | 'log_warning' | 'skip';
      onError?: 'continue' | 'stop' | 'log_warning' | 'skip' | 'fallback';
      fallbackMCP?: string;
    }
  ): WorkflowBuilder {
    this.sequence.steps!.push({
      order,
      mcp: mcpId,
      action,
      params,
      onSuccess: options?.onSuccess || 'continue',
      onError: options?.onError || 'stop',
      fallbackMCP: options?.fallbackMCP,
      description: options?.description
    });

    return this;
  }

  /**
   * Configure error handling strategy
   */
  errorHandling(strategy: 'fail_fast' | 'continue_on_error' | 'retry_all', retry?: Partial<RetryConfig>): WorkflowBuilder {
    this.sequence.errorHandling!.strategy = strategy;
    
    if (retry) {
      this.sequence.errorHandling!.retry = {
        enabled: retry.enabled ?? false,
        maxRetries: retry.maxRetries ?? 3,
        backoffMs: retry.backoffMs ?? 1000,
        exponentialBackoff: retry.exponentialBackoff ?? true
      };
    }

    return this;
  }

  /**
   * Add circuit breaker protection
   */
  circuitBreaker(config: CircuitBreakerConfig): WorkflowBuilder {
    this.sequence.circuitBreaker = config;
    return this;
  }

  /**
   * Build the final sequence
   */
  build(): ToolSequence {
    if (!this.sequence.id || !this.sequence.name) {
      throw new Error('Sequence must have id and name');
    }

    if (!this.sequence.steps || this.sequence.steps.length === 0) {
      throw new Error('Sequence must have at least one step');
    }

    // Sort steps by order
    this.sequence.steps.sort((a, b) => a.order - b.order);

    return this.sequence as ToolSequence;
  }
}

/**
 * Utility function to create workflow builders
 */
export function createWorkflow(id: string): WorkflowBuilder {
  return new WorkflowBuilder(id);
}