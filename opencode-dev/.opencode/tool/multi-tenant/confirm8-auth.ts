/**
 * Multi-Tenant Confirm8 Auth Tool
 * 
 * Adapted from OpenCode to support multi-tenant isolation.
 * Uses the MultiTenantTool base class.
 */

import { MultiTenantTool, ToolResult } from '../core/tool-base.js';
import { z } from 'zod';

// Configuration
interface Confirm8Config {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

// Get config from environment or use defaults
function getConfig(): Confirm8Config {
  return {
    baseUrl: process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com',
    apiKey: process.env.CONFIRM8_API_KEY,
    timeout: 30000
  };
}

// ============================================================================
// AUTH STATE (Per-request, not global)
// ============================================================================

interface AuthState {
  user: any | null;
  account: any | null;
  token: string | null;
  expiresAt: number | null;
}

// ============================================================================
// CONFIRM8 AUTH TOOL
// ============================================================================

export class Confirm8AuthTool extends MultiTenantTool {
  private config: Confirm8Config;
  private authState: AuthState | null = null;

  constructor() {
    super();
    this.config = getConfig();
  }

  getDefinition() {
    return {
      id: 'confirm8-auth',
      name: 'Confirm8 Authentication',
      description: 'Authenticate with Confirm8 API and manage JWT tokens',
      args: {
        action: tool.schema
          .enum(['login', 'logout', 'getToken', 'getUser', 'isAuthenticated'])
          .optional()
          .describe('Action to perform (default: login)'),
        username: tool.schema
          .string()
          .optional()
          .describe('Username (required for login)'),
        password: tool.schema
          .string()
          .optional()
          .describe('Password (required for login)')
      }
    };
  }

  getRequiredPermissions(): string[] {
    return ['confirm8:auth'];
  }

  getCategory(): string {
    return 'confirm8';
  }

  validateArgs(args: Record<string, any>): { valid: boolean; errors?: string[] } {
    const schema = z.object({
      action: z.enum(['login', 'logout', 'getToken', 'getUser', 'isAuthenticated']).optional(),
      username: z.string().optional(),
      password: z.string().optional()
    });

    const result = schema.safeParse(args);
    if (!result.success) {
      return { valid: false, errors: result.error.errors.map(e => e.message) };
    }
    return { valid: true };
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { action = 'login', username, password } = args;

    // Per-request auth state
    const state = this.getAuthState();

    try {
      switch (action) {
        case 'login':
          return await this.login(username, password, state);
        case 'logout':
          return this.logout(state);
        case 'getToken':
          return this.getToken(state);
        case 'getUser':
          return this.getUser(state);
        case 'isAuthenticated':
          return this.isAuthenticated(state);
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            code: 'INVALID_ACTION'
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'EXECUTION_ERROR'
      };
    }
  }

  private async login(username: string | undefined, password: string | undefined, state: AuthState): Promise<ToolResult> {
    if (!username || !password) {
      return {
        success: false,
        error: 'Username and password are required for login',
        code: 'MISSING_CREDENTIALS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/auth/login`,
        { username, password }
      );

      if (response.status === 200 && response.data) {
        // Store in per-request state (not global)
        state.user = response.data.user;
        state.account = response.data.account;
        state.token = response.data.token || response.data.access_token;
        state.expiresAt = response.data.expiresAt 
          ? new Date(response.data.expiresAt).getTime() 
          : Date.now() + (24 * 60 * 60 * 1000); // 24 hours

        // Store in config for other tools
        process.env.CONFIRM8_API_KEY = state.token;

        return {
          success: true,
          data: {
            user: state.user,
            account: state.account,
            authenticated: true,
            tenantId: this.tenantId
          },
          metadata: {
            tokenPrefix: state.token?.substring(0, 10),
            expiresAt: state.expiresAt
          }
        };
      }

      return {
        success: false,
        error: 'Login failed - no data returned',
        code: 'LOGIN_FAILED'
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'LOGIN_ERROR',
        metadata: {
          tenantId: this.tenantId
        }
      };
    }
  }

  private logout(state: AuthState): ToolResult {
    // Clear state
    state.user = null;
    state.account = null;
    state.token = null;
    state.expiresAt = null;
    
    // Clear env var
    delete process.env.CONFIRM8_API_KEY;

    return {
      success: true,
      data: { authenticated: false },
      metadata: { tenantId: this.tenantId }
    };
  }

  private getToken(state: AuthState): ToolResult {
    if (!state.token) {
      return {
        success: false,
        error: 'No token available. Please login first.',
        code: 'NO_TOKEN'
      };
    }

    // Check expiration
    if (state.expiresAt && Date.now() > state.expiresAt) {
      return {
        success: false,
        error: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      };
    }

    return {
      success: true,
      data: {
        token: state.token,
        prefix: state.token.substring(0, 10),
        expiresAt: state.expiresAt
      },
      metadata: {
        tenantId: this.tenantId,
        authenticated: true
      }
    };
  }

  private getUser(state: AuthState): ToolResult {
    if (!state.user) {
      return {
        success: false,
        error: 'No user data. Please login first.',
        code: 'NO_USER'
      };
    }

    return {
      success: true,
      data: {
        user: state.user,
        account: state.account
      },
      metadata: {
        tenantId: this.tenantId,
        authenticated: !!state.user
      }
    };
  }

  private isAuthenticated(state: AuthState): ToolResult {
    const isAuth = !!state.token && (!state.expiresAt || Date.now() < state.expiresAt);

    return {
      success: true,
      data: {
        authenticated: isAuth,
        hasUser: !!state.user,
        hasAccount: !!state.account,
        tokenActive: !!state.token,
        tenantId: this.tenantId
      },
      metadata: {
        tenantId: this.tenantId
      }
    };
  }

  private getAuthState(): AuthState {
    if (!this.authState) {
      this.authState = {
        user: null,
        account: null,
        token: process.env.CONFIRM8_API_KEY || null,
        expiresAt: null
      };
    }
    return this.authState;
  }
}

// ============================================================================
// EXPORT FOR OPENCODE
// ============================================================================

// Export the tool for use with @opencode-ai/plugin/tool
export default new Confirm8AuthTool().createTool();