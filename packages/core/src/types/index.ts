/**
 * Core Types for ChatIAS 3.0
 * 
 * This file contains the fundamental type definitions that power the unified platform,
 * combining enterprise features from projeto-SDK with modern developer experience from OpenCode.
 */

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
  tags: string[];
  capabilities: Record<string, boolean>;
  permissions: AgentPermissions;
  routing?: AgentRouting;
  mcp?: McpConfig;
}

export interface AgentPermissions {
  readFile: boolean;
  writeFile: boolean;
  executeCode: boolean;
  accessKB: boolean;
  useTools: boolean;
  callSubagents: boolean;
  networkAccess: boolean;
}

export interface AgentRouting {
  keywords: string[];
  priority: number;
  minConfidence: number;
}

export interface McpConfig {
  optional?: string[];
  preference: 'local' | 'cloud';
  fallback: boolean;
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  enabled: boolean;
  version: string;
  parameters: Record<string, ParameterConfig>;
  actions?: ToolAction[];
  constraints?: ToolConstraints;
  requiredBy?: string[];
  conflictsWith?: string[];
}

export type ToolCategory = 
  | 'execution' 
  | 'file' 
  | 'api' 
  | 'data' 
  | 'system' 
  | 'web' 
  | 'io';

export interface ParameterConfig {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: any;
  min?: number;
  max?: number;
  enum?: string[];
  description?: string;
}

export interface ToolAction {
  id: string;
  description: string;
  params: string[];
  returnType: 'object' | 'string' | 'number' | 'boolean';
}

export interface ToolConstraints {
  maxExecutionTime?: number;
  maxMemory?: string;
  noFileSystem?: boolean;
  noNetwork?: boolean;
  noChildProcess?: boolean;
  allowedPaths?: string[];
  allowedExtensions?: string[];
}

export interface ToolSequence {
  id: string;
  name: string;
  description: string;
  tags: string[];
  triggeredBy: string[];
  steps: SequenceStep[];
  errorHandling: SequenceErrorHandling;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface SequenceStep {
  order: number;
  tool?: string;
  mcp?: string;
  action: string;
  params: Record<string, any>;
  onSuccess: 'continue' | 'stop' | 'log_warning' | 'skip';
  onError: 'continue' | 'stop' | 'log_warning' | 'skip' | 'fallback';
  fallbackMCP?: string;
  description?: string;
}

export interface SequenceErrorHandling {
  strategy: 'fail_fast' | 'continue_on_error' | 'retry_all';
  retry: RetryConfig;
}

export interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff?: boolean;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  description?: string;
}

export interface KnowledgeBaseConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'vector' | 'document' | 'api' | 'hybrid';
  topics: string[];
  documents?: KBDocument[];
  usedBy: string[];
}

export interface KBDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
  priority: 'high' | 'medium' | 'low';
  tags?: string[];
}

export interface McpProviderConfig {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'cloud';
  enabled: boolean;
  baseUrl?: string;
  models?: McpModel[];
  defaultModel?: string;
  authentication?: McpAuthentication;
  healthCheck?: HealthCheckConfig;
  circuitBreaker?: CircuitBreakerConfig;
  fallback?: string;
}

export interface McpModel {
  id: string;
  name: string;
  contextWindow: number;
  speed: 'slow' | 'medium' | 'fast';
  quality: 'low' | 'medium' | 'high' | 'excellent';
  cost?: 'low' | 'medium' | 'high';
}

export interface McpAuthentication {
  type: 'api-key' | 'bearer' | 'basic';
  envVar?: string;
  required: boolean;
}

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint?: string;
  interval: number;
  timeout: number;
}

export interface SystemConfig {
  system: SystemSettings;
  routing: RoutingConfig;
  middleware: MiddlewareConfig;
  events: EventsConfig;
  
  // Enterprise features
  companies?: Record<string, CompanyConfig>;
  departments?: Record<string, DepartmentConfig>;
  accessLevels?: Record<string, AccessLevelConfig>;
  followUps?: Record<string, FollowUpConfig>;
  automations?: Record<string, AutomationConfig>;
  integrations?: Record<string, IntegrationConfig>;
  
  // Core features
  toolSequences: Record<string, ToolSequence>;
  agents: Record<string, AgentConfig>;
  tools: Record<string, ToolConfig>;
  knowledgeBase: Record<string, KnowledgeBaseConfig>;
  mcp: Record<string, McpProviderConfig>;
  
  governance: GovernanceConfig;
  observability: ObservabilityConfig;
}

// ============================================================================
// ENTERPRISE CONFIG TYPES
// ============================================================================

export interface SystemSettings {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  strict: boolean;
  hotReload: boolean;
  
  // Multi-tenant settings
  multiTenant: {
    enabled: boolean;
    defaultPlan: 'free' | 'starter' | 'professional' | 'enterprise';
    allowTenantCreation: boolean;
  };
}

export interface CompanyConfig {
  id: string;
  name: string;
  legalName?: string;
  document?: string;
  documentType?: 'CNPJ' | 'CPF' | 'PASSPORT' | 'OTHER';
  website?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  settings?: {
    defaultCurrency?: string;
    defaultTimezone?: string;
  };
  enabled: boolean;
}

export interface DepartmentConfig {
  id: string;
  name: string;
  code?: string;
  parentId?: string;
  description?: string;
  companyId?: string;
  settings?: {
    budget?: number;
    costCenter?: string;
  };
  enabled: boolean;
}

export interface AccessLevelConfig {
  id: string;
  name: string;
  level: number;
  description?: string;
  permissions: {
    resource: string;
    actions: ('create' | 'read' | 'update' | 'delete')[];
  }[];
}

export interface FollowUpConfig {
  id: string;
  title: string;
  description?: string;
  type: 'TASK' | 'MEETING' | 'CALL' | 'EMAIL' | 'DEADLINE' | 'REMINDER' | 'CUSTOM';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  assignedTo?: string;
  automations?: string[];
  enabled: boolean;
}

export interface AutomationConfig {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: 'SCHEDULE' | 'EVENT' | 'WEBHOOK' | 'MANUAL' | 'CONDITION_MET' | 'DATA_CHANGE';
    config: Record<string, any>;
  };
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
    value: any;
  }[];
  actions: {
    id: string;
    type: 'SEND_MESSAGE' | 'SEND_EMAIL' | 'CREATE_TASK' | 'UPDATE_FIELD' | 'CALL_WEBHOOK' | 'RUN_AGENT' | 'SEND_NOTIFICATION' | 'SCHEDULE_FOLLOWUP' | 'UPDATE_CONTACT' | 'CREATE_DEAL' | 'CUSTOM';
    config: Record<string, any>;
  }[];
  enabled: boolean;
  errorHandling?: {
    onError: 'stop' | 'continue' | 'retry';
    maxRetries: number;
  };
}

export interface IntegrationConfig {
  id: string;
  type: 'EVOLUTION' | 'RDSTATION' | 'CONFIRM8' | 'WEBHOOK' | 'SLACK' | 'DISCORD' | 'EMAIL' | 'CUSTOM';
  name: string;
  companyId?: string;
  credentials: {
    // Evolution API
    baseUrl?: string;
    instanceName?: string;
    token?: string;
    
    // RD Station
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    
    // Confirm8
    username?: string;
    password?: string;
    
    // Generic
    apiKey?: string;
    apiSecret?: string;
    
    // Webhook
    webhookUrl?: string;
    webhookSecret?: string;
    
    // Email
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    fromEmail?: string;
    fromName?: string;
  };
  settings?: Record<string, any>;
  enabled: boolean;
  sandbox?: boolean;
}

// ============================================================================
// ROUTING & MIDDLEWARE
// ============================================================================

export interface RoutingConfig {
  intelligent: boolean;
  strategies: RoutingStrategy[];
}

export interface RoutingStrategy {
  id: string;
  type: 'keyword_matching' | 'capability_matching' | 'performance_based';
  enabled: boolean;
  priority: number;
}

export interface MiddlewareConfig {
  chain: MiddlewareItem[];
}

export interface MiddlewareItem {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  config?: Record<string, any>;
}

export interface EventsConfig {
  enabled: boolean;
  eventBus: 'local' | 'redis' | 'memory';
  config: Record<string, any>;
}

export interface GovernanceConfig {
  validation: {
    enabled: boolean;
    onLoad: boolean;
    strict: boolean;
    failFast: boolean;
  };
  permissions: {
    agents: {
      maxConcurrent: number;
      timeout: number;
    };
  };
  audit: {
    enabled: boolean;
    logFile: string;
    trackActions: string[];
  };
}

export interface ObservabilityConfig {
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    transports: LogTransport[];
  };
  metrics: {
    enabled: boolean;
    backend: 'memory' | 'prometheus' | 'statsd';
  };
}

export interface LogTransport {
  type: 'console' | 'file' | 'external';
  enabled: boolean;
  format?: string;
  location?: string;
  maxSize?: string;
}

// Runtime Types
export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    usedTools?: string[];
    usedKB?: string[];
    requestId?: string;
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    action?: string;
    params?: Record<string, any>;
  };
}

export interface McpResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    model: string;
    tokens?: {
      input: number;
      output: number;
      total: number;
    };
    duration: number;
  };
}

export interface QueryResult {
  success: boolean;
  results?: QueryResultItem[];
  context?: string;
  score?: number;
  duration: number;
  error?: string;
}

export interface QueryResultItem {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
  metadata?: Record<string, any>;
}

// Event Types
export interface SystemEvent {
  type: string;
  timestamp: string;
  data: any;
  source?: string;
  requestId?: string;
}

export interface AgentEvent extends SystemEvent {
  agentId: string;
  action: 'execute' | 'init' | 'destroy' | 'error';
}

export interface ToolEvent extends SystemEvent {
  toolId: string;
  action: 'execute' | 'success' | 'error';
  actionName?: string;
}

export interface McpEvent extends SystemEvent {
  mcpId: string;
  action: 'query' | 'success' | 'error' | 'fallback';
  model?: string;
}

// Registry Types
export interface Registry<T> {
  register(id: string, item: T): void;
  unregister(id: string): void;
  get(id: string): T | undefined;
  list(): Array<{ id: string; item: T }>;
  size(): number;
  clear(): void;
}

// Context Types
export interface ExecutionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  agentId?: string;
  toolId?: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface DecisionContext extends ExecutionContext {
  message: string;
  intent?: string;
  confidence: number;
  availableAgents: string[];
  availableTools: string[];
  availableMCPs: string[];
  strategy?: 'llm' | 'rag' | 'agent' | 'tool';
  reasoning?: string;
}

// Error Types
export class ChatIASError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: 'agent' | 'tool' | 'mcp' | 'config' | 'system',
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'ChatIASError';
  }
}

export class ValidationError extends ChatIASError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 'config', metadata);
  }
}

export class ExecutionError extends ChatIASError {
  constructor(message: string, component: string, metadata?: Record<string, any>) {
    super(message, 'EXECUTION_ERROR', 'agent', { component, ...metadata });
  }
}

export class ConfigurationError extends ChatIASError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'CONFIG_ERROR', 'config', metadata);
  }
}