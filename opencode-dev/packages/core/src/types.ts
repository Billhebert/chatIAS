/**
 * OpenCode Multi-Tenant Tool Types
 */

import type { Tool } from '@opencode-ai/plugin/tool';

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface MultiTenantToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  permissions: string[];
  args: Record<string, ToolSchemaProperty>;
  returns?: ToolSchemaProperty;
}

export interface ToolSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
  optional?: boolean;
  describe?: string;
  default?: any;
  enum?: string[];
  items?: ToolSchemaProperty;
  properties?: Record<string, ToolSchemaProperty>;
}

export interface ToolExecuteOptions {
  tenantId?: string;
  tenantSlug?: string;
  userId?: string;
  permissions?: string[];
  verbose?: boolean;
  timeout?: number;
}

export interface ToolExecutionContext {
  requestId: string;
  timestamp: Date;
  tenantId: string | null;
  tenantSlug: string | null;
  userId: string | null;
  permissions: string[];
  verbose: boolean;
  metadata: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  metadata?: {
    duration: number;
    tokens?: { input: number; output: number };
    tenantId?: string;
    cacheHit?: boolean;
  };
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

export interface IntegrationConfig {
  id: string;
  name: string;
  baseUrl: string;
  auth: IntegrationAuth;
  timeout?: number;
  retries?: number;
  enabled?: boolean;
}

export interface IntegrationAuth {
  type: 'none' | 'api-key' | 'bearer' | 'basic';
  apiKey?: string;
  token?: string;
  username?: string;
  password?: string;
  header?: string;
}

export interface IntegrationRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  options?: {
    timeout?: number;
    retries?: number;
    queryParams?: Record<string, string>;
  };
}

export interface IntegrationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    statusCode: number;
    headers: Record<string, string>;
    duration: number;
  };
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  type: string;
  version: string;
  enabled: boolean;
  tools: string[];
  mcpProviders: string[];
  knowledgeBases: string[];
  parameters: Record<string, ToolSchemaProperty>;
  permissions: string[];
}

export interface AgentExecutionContext {
  requestId: string;
  conversationId?: string;
  userId: string;
  tenantId: string;
  message: string;
  history?: Message[];
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  id: string;
  type: 'function';
  function: {
    name: string;
    output: string;
  };
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
  settings?: TenantSettings;
}

export interface TenantSettings {
  displayName?: string;
  logo?: string;
  website?: string;
  email?: string;
  features: Record<string, boolean>;
  limits: TenantLimits;
}

export interface TenantLimits {
  users: number;
  apiCalls: number;
  storage: number;
  agents: number;
  tools: number;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'developer' | 'viewer';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface CLIConfig {
  defaultTenant?: string;
  verbose?: boolean;
  output?: 'json' | 'pretty';
  configFile?: string;
}

export interface SystemConfig {
  system: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  database: {
    provider: 'postgresql' | 'mysql' | 'sqlite';
    url: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiry: string;
    cookieName: string;
  };
  integrations: Record<string, IntegrationConfig>;
  observability: {
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
    };
    metrics: {
      enabled: boolean;
    };
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  MultiTenantToolDefinition,
  ToolSchemaProperty,
  ToolExecuteOptions,
  ToolExecutionContext,
  ToolExecutionResult,
  IntegrationConfig,
  IntegrationAuth,
  IntegrationRequest,
  IntegrationResponse,
  AgentConfig,
  AgentExecutionContext,
  Message,
  ToolCall,
  ToolResult,
  Tenant,
  TenantSettings,
  TenantLimits,
  User,
  CLIConfig,
  SystemConfig
};