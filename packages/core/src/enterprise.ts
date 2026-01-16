/**
 * Enterprise Management Types for ChatIAS 3.0
 * 
 * Includes:
 * - Company/Enterprise
 * - Departments and Sub-departments
 * - Follow-ups and Tasks
 * - Automations and Workflows
 * - Integration Configurations
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// COMPANY TYPES
// ============================================================================

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  legalName?: string;
  document?: string;
  documentType: DocumentType;
  website?: string;
  email?: string;
  phone?: string;
  address?: Address;
  logo?: string;
  settings: CompanySettings;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentType = 'CNPJ' | 'CPF' | 'PASSPORT' | 'OTHER';

export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface CompanySettings {
  defaultCurrency?: string;
  defaultTimezone?: string;
  businessHours?: BusinessHours;
  customFields?: Record<string, any>;
}

export interface BusinessHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  start?: string;  // HH:mm
  end?: string;    // HH:mm
}

// ============================================================================
// DEPARTMENT TYPES
// ============================================================================

export interface Department {
  id: string;
  tenantId: string;
  companyId?: string;
  name: string;
  code?: string;
  parentId?: string;
  parent?: Department;
  children?: Department[];
  description?: string;
  managerId?: string;
  settings: DepartmentSettings;
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export interface DepartmentSettings {
  budget?: number;
  costCenter?: string;
  customFields?: Record<string, any>;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  notes?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// FOLLOW-UP TYPES
// ============================================================================

export interface FollowUp {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  dueDate?: Date;
  completedAt?: Date;
  assignedToId?: string;
  assignedTo?: UserSummary;
  relatedContactId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type FollowUpType = 'TASK' | 'MEETING' | 'CALL' | 'EMAIL' | 'DEADLINE' | 'REMINDER' | 'CUSTOM';

export type FollowUpPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  department?: string;
}

// ============================================================================
// AUTOMATION TYPES
// ============================================================================

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  triggerConfig: AutomationTriggerConfig;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AutomationTrigger = 
  | 'SCHEDULE'
  | 'EVENT'
  | 'WEBHOOK'
  | 'MANUAL'
  | 'CONDITION_MET'
  | 'DATA_CHANGE'
  | 'EXTERNAL';

export interface AutomationTriggerConfig {
  schedule?: string;          // Cron expression
  eventType?: string;         // Event that triggers
  webhookPath?: string;       // Webhook endpoint
  conditions?: Record<string, any>;  // Condition configuration
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: any;
  logic?: 'AND' | 'OR';       // Logic with next condition
}

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  config: Record<string, any>;
  order: number;
}

export type AutomationActionType =
  | 'SEND_MESSAGE'
  | 'SEND_EMAIL'
  | 'CREATE_TASK'
  | 'UPDATE_FIELD'
  | 'CALL_WEBHOOK'
  | 'RUN_AGENT'
  | 'SEND_NOTIFICATION'
  | 'SCHEDULE_FOLLOWUP'
  | 'UPDATE_CONTACT'
  | 'CREATE_DEAL'
  | 'CUSTOM';

export interface AutomationLog {
  id: string;
  automationId: string;
  userId?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
  createdAt: Date;
}

// ============================================================================
// INTEGRATION CONFIG TYPES
// ============================================================================

export interface IntegrationConfig {
  id: string;
  tenantId: string;
  companyId?: string;
  type: IntegrationType;
  name: string;
  config: IntegrationCredentials;
  status: IntegrationStatus;
  lastSyncAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type IntegrationType = 
  | 'EVOLUTION'      // WhatsApp Business
  | 'RDSTATION'      // CRM
  | 'CONFIRM8'       // Business Management
  | 'WEBHOOK'        // Generic Webhook
  | 'SLACK'          // Slack
  | 'DISCORD'        // Discord
  | 'EMAIL'          // Email/SMTP
  | 'CUSTOM';        // Custom integration

export type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';

export interface IntegrationCredentials {
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
  accessToken?: string;
  refreshToken?: string;
  
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
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

// ============================================================================
// ACCESS LEVEL TYPES
// ============================================================================

export interface AccessLevel {
  id: string;
  tenantId: string;
  name: string;
  level: number;
  permissions: Permission[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export const DEFAULT_ACCESS_LEVELS: Record<string, AccessLevel> = {
  owner: {
    id: 'role-owner',
    tenantId: '',
    name: 'Owner',
    level: 100,
    permissions: [{ resource: '*', actions: ['create', 'read', 'update', 'delete'] }],
    description: 'Full access to all resources',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  admin: {
    id: 'role-admin',
    tenantId: '',
    name: 'Admin',
    level: 80,
    permissions: [
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'agents', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'integrations', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'automations', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'companies', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'departments', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'followups', actions: ['create', 'read', 'update', 'delete'] },
    ],
    description: 'Administrative access',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  manager: {
    id: 'role-manager',
    tenantId: '',
    name: 'Manager',
    level: 60,
    permissions: [
      { resource: 'users', actions: ['read', 'update'] },
      { resource: 'agents', actions: ['read'] },
      { resource: 'integrations', actions: ['read'] },
      { resource: 'automations', actions: ['create', 'read', 'update'] },
      { resource: 'companies', actions: ['read'] },
      { resource: 'departments', actions: ['create', 'read', 'update'] },
      { resource: 'followups', actions: ['create', 'read', 'update'] },
    ],
    description: 'Team management access',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  developer: {
    id: 'role-developer',
    tenantId: '',
    name: 'Developer',
    level: 40,
    permissions: [
      { resource: 'agents', actions: ['read'] },
      { resource: 'integrations', actions: ['read'] },
      { resource: 'automations', actions: ['read'] },
      { resource: 'followups', actions: ['create', 'read', 'update'] },
    ],
    description: 'Development access',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  viewer: {
    id: 'role-viewer',
    tenantId: '',
    name: 'Viewer',
    level: 20,
    permissions: [
      { resource: 'agents', actions: ['read'] },
      { resource: 'followups', actions: ['read'] },
    ],
    description: 'Read-only access',
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

// ============================================================================
// LLM AUTOMATION AGENT TYPES
// ============================================================================

export interface LLMAutomationConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  availableTools: string[];
  knowledgeBaseIds?: string[];
  contextLimit: number;
}

export interface LLMExecutionInput {
  prompt: string;
  userId?: string;
  context?: Record<string, any>;
  stream?: boolean;
}

export interface LLMExecutionResult {
  success: boolean;
  response: string;
  toolsUsed: ToolUsage[];
  tokensUsed: number;
  duration: number;
  error?: string;
}

export interface ToolUsage {
  tool: string;
  action: string;
  input: Record<string, any>;
  output: Record<string, any>;
  duration: number;
}

// ============================================================================
// REPOSITORY INTERFACES
// ============================================================================

export interface CompanyRepository {
  create(tenantId: string, data: Partial<Company>): Promise<Company>;
  findById(id: string): Promise<Company | null>;
  findByTenant(tenantId: string): Promise<Company[]>;
  update(id: string, data: Partial<Company>): Promise<Company>;
  delete(id: string): Promise<void>;
}

export interface DepartmentRepository {
  create(tenantId: string, data: Partial<Department>): Promise<Department>;
  findById(id: string): Promise<Department | null>;
  findByTenant(tenantId: string, options?: { companyId?: string; parentId?: string }): Promise<Department[]>;
  getTree(tenantId: string): Promise<Department[]>;
  update(id: string, data: Partial<Department>): Promise<Department>;
  delete(id: string): Promise<void>;
}

export interface FollowUpRepository {
  create(tenantId: string, data: Partial<FollowUp>): Promise<FollowUp>;
  findById(id: string): Promise<FollowUp | null>;
  findByTenant(tenantId: string, options?: { status?: FollowUpStatus; assignedToId?: string; priority?: FollowUpPriority }): Promise<FollowUp[]>;
  update(id: string, data: Partial<FollowUp>): Promise<FollowUp>;
  complete(id: string): Promise<FollowUp>;
  delete(id: string): Promise<void>;
}

export interface AutomationRepository {
  create(tenantId: string, data: Partial<Automation>): Promise<Automation>;
  findById(id: string): Promise<Automation | null>;
  findByTenant(tenantId: string): Promise<Automation[]>;
  findByTrigger(tenantId: string, trigger: AutomationTrigger): Promise<Automation[]>;
  update(id: string, data: Partial<Automation>): Promise<Automation>;
  execute(id: string, input: Record<string, any>): Promise<AutomationLog>;
  delete(id: string): Promise<void>;
}

export interface IntegrationConfigRepository {
  create(tenantId: string, data: Partial<IntegrationConfig>): Promise<IntegrationConfig>;
  findById(id: string): Promise<IntegrationConfig | null>;
  findByTenant(tenantId: string): Promise<IntegrationConfig[]>;
  findByType(tenantId: string, type: IntegrationType): Promise<IntegrationConfig | null>;
  update(id: string, data: Partial<IntegrationConfig>): Promise<IntegrationConfig>;
  testConnection(id: string): Promise<IntegrationTestResult>;
  delete(id: string): Promise<void>;
}

export interface AccessLevelRepository {
  create(tenantId: string, data: Partial<AccessLevel>): Promise<AccessLevel>;
  findById(id: string): Promise<AccessLevel | null>;
  findByTenant(tenantId: string): Promise<AccessLevel[]>;
  update(id: string, data: Partial<AccessLevel>): Promise<AccessLevel>;
  delete(id: string): Promise<void>;
}
