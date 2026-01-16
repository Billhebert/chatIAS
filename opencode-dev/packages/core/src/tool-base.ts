/**
 * Multi-Tenant Tool Base for OpenCode
 * 
 * This base class provides tenant isolation for all OpenCode tools.
 * Tools extend this class to get automatic multi-tenant support.
 */

import { tool } from '@opencode-ai/plugin/tool';
import type { ToolExecuteContext, ToolResult } from './types.js';

// ============================================================================
// TOOL BASE CLASS
// ============================================================================

/**
 * Base class for multi-tenant tools
 * 
 * Features:
 * - Automatic tenant context injection
 * - Tenant-aware HTTP client
 * - Permission checking
 * - Usage tracking
 */
export abstract class MultiTenantTool {
  protected tenantId: string | null = null;
  protected tenantSlug: string | null = null;
  protected userId: string | null = null;
  protected permissions: string[] = [];
  protected verbose: boolean = false;

  /**
   * Get the tool definition for OpenCode
   */
  abstract getDefinition(): ToolDefinition;

  /**
   * Execute the tool logic
   */
  abstract execute(args: Record<string, any>, context: ToolExecuteContext): Promise<ToolResult>;

  /**
   * Get required permissions for this tool
   */
  getRequiredPermissions(): string[] {
    return [];
  }

  /**
   * Get tool category
   */
  getCategory(): string {
    return 'general';
  }

  /**
   * Validate arguments before execution
   */
  validateArgs(args: Record<string, any>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  /**
   * Pre-execution hook
   */
  async beforeExecute(args: Record<string, any>, context: ToolExecuteContext): Promise<void> {
    // Extract tenant context from environment
    this.tenantId = context.tenantId || process.env.CHATIAS_TENANT_ID || null;
    this.tenantSlug = context.tenantSlug || process.env.CHATIAS_TENANT_SLUG || null;
    this.userId = context.userId || process.env.CHATIAS_USER_ID || null;
    this.permissions = context.permissions || [];
    this.verbose = context.verbose || false;
  }

  /**
   * Post-execution hook
   */
  async afterExecute(result: ToolResult, context: ToolExecuteContext): Promise<ToolResult> {
    // Track usage if configured
    if (this.tenantId && process.env.CHATIAS_TRACK_USAGE === 'true') {
      await this.trackUsage(context);
    }
    return result;
  }

  /**
   * Create OpenCode tool wrapper
   */
  createTool() {
    const definition = this.getDefinition();

    return tool({
      description: definition.description,
      args: definition.args,
      async execute(args) {
        try {
          // Create context from environment
          const context: ToolExecuteContext = {
            tenantId: process.env.CHATIAS_TENANT_ID || null,
            tenantSlug: process.env.CHATIAS_TENANT_SLUG || null,
            userId: process.env.CHATIAS_USER_ID || null,
            permissions: parsePermissions(process.env.CHATIAS_PERMISSIONS || ''),
            verbose: process.env.CHATIAS_VERBOSE === 'true'
          };

          // Check permissions
          const requiredPerms = this.getRequiredPermissions();
          if (requiredPerms.length > 0) {
            const hasPermission = requiredPerms.some(p => 
              context.permissions.includes('admin') || context.permissions.includes(p)
            );
            if (!hasPermission) {
              return JSON.stringify({
                success: false,
                error: `Permission required: ${requiredPerms.join(' or ')}`,
                code: 'PERMISSION_DENIED'
              });
            }
          }

          // Validate args
          const validation = this.validateArgs(args);
          if (!validation.valid) {
            return JSON.stringify({
              success: false,
              error: `Invalid arguments: ${validation.errors?.join(', ')}`,
              code: 'INVALID_ARGS'
            });
          }

          // Before execute hook
          await this.beforeExecute(args, context);

          // Execute tool logic
          const result = await this.execute(args, context);

          // After execute hook
          const finalResult = await this.afterExecute(result, context);

          return JSON.stringify(finalResult);

        } catch (error: any) {
          return JSON.stringify({
            success: false,
            error: error.message,
            code: 'EXECUTION_ERROR'
          });
        }
      }
    });
  }

  /**
   * Make authenticated HTTP request
   */
  protected async httpRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers
    };

    // Add tenant headers
    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId;
    }
    if (this.tenantSlug) {
      headers['X-Tenant-Slug'] = this.tenantSlug;
    }

    // Add auth header
    const apiKey = process.env.CHATIAS_API_KEY;
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(options?.timeout || 30000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ToolError(
        errorData.message || `HTTP ${response.status}`,
        `HTTP_${response.status}`,
        errorData
      );
    }

    return await response.json();
  }

  /**
   * Track usage for the tenant
   */
  private async trackUsage(context: ToolExecuteContext): Promise<void> {
    try {
      await fetch(`${process.env.CHATIAS_API_URL || 'http://localhost:3000'}/api/usage/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CHATIAS_API_KEY}`
        },
        body: JSON.stringify({
          tenantId: this.tenantId,
          tool: this.getDefinition().id,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      // Silently fail - usage tracking should not break tools
      if (this.verbose) {
        console.warn('Failed to track usage:', error);
      }
    }
  }

  /**
   * Log message (respects verbose mode)
   */
  protected log(...args: any[]): void {
    if (this.verbose) {
      console.log(`[${this.getDefinition().id}]`, ...args);
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  args: Record<string, any>;
}

export interface ToolExecuteContext {
  tenantId: string | null;
  tenantSlug: string | null;
  userId: string | null;
  permissions: string[];
  verbose: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  metadata?: Record<string, any>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parsePermissions(permissionsStr: string): string[] {
  if (!permissionsStr) return [];
  return permissionsStr.split(',').map(p => p.trim()).filter(p => p);
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ToolDefinition, ToolExecuteContext, ToolResult, RequestOptions };
export { MultiTenantTool, ToolError };