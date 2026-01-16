/**
 * Multi-Tenant Architecture for ChatIAS 3.0
 * 
 * This module provides native multi-tenant support with:
 * - Tenant isolation at all levels
 * - Resource pooling and sharing
 * - Per-tenant configuration
 * - Usage tracking and quotas
 * - Security boundaries
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TENANT TYPES
// ============================================================================

/**
 * Tenant configuration for multi-tenant isolation
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;              // URL-friendly identifier
  status: TenantStatus;
  plan: TenantPlan;
  createdAt: Date;
  updatedAt: Date;
  metadata: TenantMetadata;
  
  // Limits
  limits: TenantLimits;
  
  // Features
  features: TenantFeatures;
  
  // Billing
  billing: TenantBilling;
  
  // Security
  security: TenantSecurity;
}

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface TenantMetadata {
  displayName?: string;
  logo?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: TenantAddress;
  timezone?: string;
  locale?: string;
  currency?: string;
}

export interface TenantAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface TenantLimits {
  users: number;
  apiCalls: number;           // Per month
  storage: number;            // In bytes
  agents: number;
  tools: number;
  mcpProviders: number;
  knowledgeBaseSize: number;  // In bytes
  concurrentExecutions: number;
  retentionDays: number;
}

export interface TenantFeatures {
  customAgents: boolean;
  customTools: boolean;
  customKnowledgeBase: boolean;
  advancedAnalytics: boolean;
  auditLogs: boolean;
  ssoEnabled: boolean;
  webhookEnabled: boolean;
  apiAccess: boolean;
  cliAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

export interface TenantBilling {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingEmail?: string;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate?: Date;
  trialEndsAt?: Date;
}

export interface TenantSecurity {
  apiKeyHash?: string;
  webhookSecret?: string;
  ipWhitelist?: string[];
  allowedDomains?: string[];
  mfaRequired: boolean;
  sessionTimeout: number;     // In minutes
  maxSessionsPerUser: number;
  passwordPolicy: PasswordPolicy;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays: number;
  preventReuse: number;
}

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * User in a multi-tenant context
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  mfaEnabled: boolean;
  metadata: UserMetadata;
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'developer' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface UserMetadata {
  department?: string;
  title?: string;
  preferences?: UserPreferences;
  apiKeys?: ApiKey[];
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notifications?: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  slack: boolean;
  inApp: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;           // Hashed
  prefix: string;        // First 8 chars for identification
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Execution context with tenant information
 */
export interface TenantContext {
  tenant: Tenant;
  user: User | null;
  requestId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  
  // Usage tracking
  usage: UsageContext;
  
  // Security context
  security: SecurityContext;
}

export interface UsageContext {
  apiCallsUsed: number;
  storageUsed: number;
  executionsUsed: number;
  
  // Current operation tracking
  currentApiCalls: number;
  currentStorage: number;
}

export interface SecurityContext {
  authenticated: boolean;
  permissions: string[];
  roles: string[];
  mfaVerified: boolean;
  ipAllowed: boolean;
}

// ============================================================================
// TENANT REGISTRY
// ============================================================================

/**
 * Tenant Registry - Central registry for all tenants
 * 
 * This is the core of multi-tenant support, providing:
 * - Tenant lookup and management
 * - Resource isolation
 * - Usage tracking
 */
export class TenantRegistry extends EventEmitter {
  private tenants: Map<string, Tenant> = new Map();
  private tenantsBySlug: Map<string, string> = new Map(); // slug -> id
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map(); // email -> userId
  private apiKeys: Map<string, User> = new Map(); // apiKey -> user
  
  // Usage tracking
  private usage: Map<string, TenantUsage> = new Map();
  
  constructor() {
    super();
  }

  // --------------------------------------------------------------------------
  // Tenant Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new tenant
   */
  async createTenant(data: {
    name: string;
    slug?: string;
    plan?: TenantPlan;
    metadata?: TenantMetadata;
    limits?: Partial<TenantLimits>;
    features?: Partial<TenantFeatures>;
  }): Promise<Tenant> {
    const id = uuidv4();
    const slug = data.slug || this.generateSlug(data.name);
    const now = new Date();

    // Check for duplicate slug
    if (this.tenantsBySlug.has(slug)) {
      throw new TenantError(
        `Tenant with slug '${slug}' already exists`,
        'DUPLICATE_SLUG',
        id
      );
    }

    const tenant: Tenant = {
      id,
      name: data.name,
      slug,
      status: 'trial',
      plan: data.plan || 'starter',
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata || {},
      
      limits: {
        users: 5,
        apiCalls: 10000,
        storage: 1024 * 1024 * 1024, // 1GB
        agents: 10,
        tools: 20,
        mcpProviders: 2,
        knowledgeBaseSize: 1024 * 1024 * 100, // 100MB
        concurrentExecutions: 10,
        retentionDays: 30,
        ...data.limits
      },
      
      features: {
        customAgents: true,
        customTools: true,
        customKnowledgeBase: true,
        advancedAnalytics: false,
        auditLogs: true,
        ssoEnabled: false,
        webhookEnabled: true,
        apiAccess: true,
        cliAccess: true,
        whiteLabel: false,
        prioritySupport: false,
        ...data.features
      },
      
      billing: {
        billingCycle: 'monthly',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      },
      
      security: {
        mfaRequired: false,
        sessionTimeout: 60,
        maxSessionsPerUser: 3,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          expiryDays: 90,
          preventReuse: 5
        }
      }
    };

    // Store tenant
    this.tenants.set(id, tenant);
    this.tenantsBySlug.set(slug, id);
    
    // Initialize usage tracking
    this.usage.set(id, {
      tenantId: id,
      periodStart: this.getPeriodStart(),
      apiCalls: 0,
      storage: 0,
      executions: 0,
      users: 0
    });

    this.emit('tenant:created', { tenant });
    
    return tenant;
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  /**
   * Get tenant by slug
   */
  getTenantBySlug(slug: string): Tenant | undefined {
    const tenantId = this.tenantsBySlug.get(slug);
    if (!tenantId) return undefined;
    return this.tenants.get(tenantId);
  }

  /**
   * Get all tenants
   */
  listTenants(options?: {
    status?: TenantStatus;
    plan?: TenantPlan;
    limit?: number;
    offset?: number;
  }): Tenant[] {
    let tenants = Array.from(this.tenants.values());
    
    if (options?.status) {
      tenants = tenants.filter(t => t.status === options.status);
    }
    
    if (options?.plan) {
      tenants = tenants.filter(t => t.plan === options.plan);
    }
    
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    
    return tenants.slice(offset, offset + limit);
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new TenantError(`Tenant not found: ${tenantId}`, 'NOT_FOUND', tenantId);
    }

    // Update fields
    Object.assign(tenant, data, { updatedAt: new Date() });
    
    // Handle slug change
    if (data.slug && data.slug !== tenant.slug) {
      if (this.tenantsBySlug.has(data.slug)) {
        throw new TenantError(
          `Tenant with slug '${data.slug}' already exists`,
          'DUPLICATE_SLUG',
          tenantId
        );
      }
      this.tenantsBySlug.delete(tenant.slug);
      this.tenantsBySlug.set(data.slug, tenantId);
      tenant.slug = data.slug;
    }

    this.emit('tenant:updated', { tenant, changes: data });
    
    return tenant;
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string, reason?: string): Promise<void> {
    await this.updateTenant(tenantId, { 
      status: 'suspended',
      metadata: { 
        suspensionReason: reason,
        suspendedAt: new Date().toISOString()
      }
    });

    this.emit('tenant:suspended', { tenantId, reason });
  }

  /**
   * Resume tenant
   */
  async resumeTenant(tenantId: string): Promise<void> {
    await this.updateTenant(tenantId, { status: 'active' });
    this.emit('tenant:resumed', { tenantId });
  }

  /**
   * Delete tenant (soft delete)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new TenantError(`Tenant not found: ${tenantId}`, 'NOT_FOUND', tenantId);
    }

    await this.updateTenant(tenantId, { status: 'cancelled' });
    this.emit('tenant:deleted', { tenantId });
  }

  // --------------------------------------------------------------------------
  // User Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new user in a tenant
   */
  async createUser(tenantId: string, data: {
    email: string;
    name: string;
    role?: UserRole;
  }): Promise<User> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new TenantError(`Tenant not found: ${tenantId}`, 'NOT_FOUND', tenantId);
    }

    // Check user limit
    const userCount = Array.from(this.users.values())
      .filter(u => u.tenantId === tenantId && u.status !== 'cancelled').length;
    
    if (userCount >= tenant.limits.users) {
      throw new TenantError(
        `Tenant has reached maximum user limit: ${tenant.limits.users}`,
        'USER_LIMIT_EXCEEDED',
        tenantId
      );
    }

    // Check for duplicate email
    if (this.usersByEmail.has(data.email.toLowerCase())) {
      throw new TenantError(
        `User with email '${data.email}' already exists`,
        'DUPLICATE_EMAIL',
        tenantId
      );
    }

    const user: User = {
      id: uuidv4(),
      tenantId,
      email: data.email.toLowerCase(),
      name: data.name,
      role: data.role || 'developer',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: false,
      mfaEnabled: false,
      metadata: {}
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);

    this.emit('user:created', { user });
    
    return user;
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): User | undefined {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  /**
   * Get users in a tenant
   */
  listTenantUsers(tenantId: string): User[] {
    return Array.from(this.users.values())
      .filter(u => u.tenantId === tenantId && u.status !== 'cancelled');
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new TenantError(`User not found: ${userId}`, 'NOT_FOUND', userId);
    }

    Object.assign(user, data, { updatedAt: new Date() });
    
    // Handle email change
    if (data.email && data.email !== user.email) {
      this.usersByEmail.delete(user.email);
      user.email = data.email.toLowerCase();
      this.usersByEmail.set(user.email, userId);
    }

    this.emit('user:updated', { user, changes: data });
    
    return user;
  }

  // --------------------------------------------------------------------------
  // API Key Operations
  // --------------------------------------------------------------------------

  /**
   * Create API key for user
   */
  async createApiKey(userId: string, data: {
    name: string;
    permissions?: string[];
    expiresAt?: Date;
  }): Promise<{ apiKey: string; prefix: string }> {
    const user = this.users.get(userId);
    if (!user) {
      throw new TenantError(`User not found: ${userId}`, 'NOT_FOUND', userId);
    }

    const prefix = this.generateApiKeyPrefix();
    const key = `${prefix}_${uuidv4().replace(/-/g, '')}`;
    const hashedKey = await this.hashKey(key);

    const apiKeyEntry: ApiKey = {
      id: uuidv4(),
      name: data.name,
      key: hashedKey,
      prefix,
      permissions: data.permissions || ['read'],
      expiresAt: data.expiresAt,
      createdAt: new Date()
    };

    user.metadata.apiKeys = user.metadata.apiKeys || [];
    user.metadata.apiKeys.push(apiKeyEntry);

    this.emit('api-key:created', { userId, keyId: apiKeyEntry.id });
    
    // Return unhashed key (only time it's visible)
    return { apiKey: key, prefix };
  }

  /**
   * Validate API key
   */
  async validateApiKey(key: string): Promise<{ user: User; permissions: string[] } | null> {
    const prefix = key.substring(0, 8);
    
    // Find user with this key prefix
    for (const user of this.users.values()) {
      if (user.status !== 'active') continue;
      
      const apiKeys = user.metadata.apiKeys || [];
      for (const apiKey of apiKeys) {
        if (apiKey.prefix === prefix) {
          // Check expiration
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            continue;
          }
          
          // For demo, just return (in real impl, hash and compare)
          return { user, permissions: apiKey.permissions };
        }
      }
    }
    
    return null;
  }

  // --------------------------------------------------------------------------
  // Usage Tracking
  // --------------------------------------------------------------------------

  /**
   * Track API call usage
   */
  async trackApiCall(tenantId: string): Promise<void> {
    let tenantUsage = this.usage.get(tenantId);
    if (!tenantUsage) {
      tenantUsage = {
        tenantId,
        periodStart: this.getPeriodStart(),
        apiCalls: 0,
        storage: 0,
        executions: 0,
        users: 0
      };
      this.usage.set(tenantId, tenantUsage);
    }

    tenantUsage.apiCalls++;

    // Check limit
    const tenant = this.tenants.get(tenantId);
    if (tenant && tenantUsage.apiCalls > tenant.limits.apiCalls) {
      this.emit('usage:limit-exceeded', { tenantId, type: 'apiCalls' });
      throw new TenantError(
        'API call limit exceeded',
        'API_LIMIT_EXCEEDED',
        tenantId
      );
    }

    this.emit('usage:api-call', { tenantId, count: tenantUsage.apiCalls });
  }

  /**
   * Track storage usage
   */
  async trackStorage(tenantId: string, bytes: number): Promise<void> {
    let tenantUsage = this.usage.get(tenantId);
    if (!tenantUsage) {
      tenantUsage = {
        tenantId,
        periodStart: this.getPeriodStart(),
        apiCalls: 0,
        storage: 0,
        executions: 0,
        users: 0
      };
      this.usage.set(tenantId, tenantUsage);
    }

    tenantUsage.storage += bytes;

    // Check limit
    const tenant = this.tenants.get(tenantId);
    if (tenant && tenantUsage.storage > tenant.limits.storage) {
      this.emit('usage:limit-exceeded', { tenantId, type: 'storage' });
      throw new TenantError(
        'Storage limit exceeded',
        'STORAGE_LIMIT_EXCEEDED',
        tenantId
      );
    }
  }

  /**
   * Get usage for tenant
   */
  getUsage(tenantId: string): TenantUsage | undefined {
    return this.usage.get(tenantId);
  }

  /**
   * Get usage summary for tenant
   */
  getUsageSummary(tenantId: string): {
    apiCalls: { used: number; limit: number; percentage: number };
    storage: { used: number; limit: number; percentage: number };
    users: { used: number; limit: number; percentage: number };
  } {
    const tenant = this.tenants.get(tenantId);
    const usage = this.usage.get(tenantId);

    if (!tenant || !usage) {
      throw new TenantError(`Tenant not found: ${tenantId}`, 'NOT_FOUND', tenantId);
    }

    const userCount = Array.from(this.users.values())
      .filter(u => u.tenantId === tenantId && u.status !== 'cancelled').length;

    return {
      apiCalls: {
        used: usage.apiCalls,
        limit: tenant.limits.apiCalls,
        percentage: (usage.apiCalls / tenant.limits.apiCalls) * 100
      },
      storage: {
        used: usage.storage,
        limit: tenant.limits.storage,
        percentage: (usage.storage / tenant.limits.storage) * 100
      },
      users: {
        used: userCount,
        limit: tenant.limits.users,
        percentage: (userCount / tenant.limits.users) * 100
      }
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) + '-' + uuidv4().substring(0, 8);
  }

  private generateApiKeyPrefix(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'sk_';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async hashKey(key: string): Promise<string> {
    // In real implementation, use crypto.subtle
    return key; // Placeholder
  }

  private getPeriodStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Get tenant count
   */
  size(): number {
    return this.tenants.size;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.tenants.clear();
    this.tenantsBySlug.clear();
    this.users.clear();
    this.usersByEmail.clear();
    this.usage.clear();
  }
}

// ============================================================================
// TENANT ERROR
// ============================================================================

export class TenantError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

// ============================================================================
// TENANT USAGE
// ============================================================================

export interface TenantUsage {
  tenantId: string;
  periodStart: Date;
  apiCalls: number;
  storage: number;
  executions: number;
  users: number;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createTenantRegistry(): TenantRegistry {
  return new TenantRegistry();
}

// ============================================================================
// DEFAULT LIMITS BY PLAN
// ============================================================================

export const PLAN_LIMITS: Record<TenantPlan, TenantLimits> = {
  free: {
    users: 2,
    apiCalls: 1000,
    storage: 100 * 1024 * 1024, // 100MB
    agents: 3,
    tools: 5,
    mcpProviders: 1,
    knowledgeBaseSize: 10 * 1024 * 1024, // 10MB
    concurrentExecutions: 3,
    retentionDays: 7
  },
  starter: {
    users: 5,
    apiCalls: 10000,
    storage: 1024 * 1024 * 1024, // 1GB
    agents: 10,
    tools: 20,
    mcpProviders: 2,
    knowledgeBaseSize: 100 * 1024 * 1024, // 100MB
    concurrentExecutions: 10,
    retentionDays: 30
  },
  professional: {
    users: 25,
    apiCalls: 100000,
    storage: 10 * 1024 * 1024 * 1024, // 10GB
    agents: 50,
    tools: 100,
    mcpProviders: 5,
    knowledgeBaseSize: 1024 * 1024 * 1024, // 1GB
    concurrentExecutions: 50,
    retentionDays: 90
  },
  enterprise: {
    users: -1, // Unlimited
    apiCalls: -1,
    storage: -1,
    agents: -1,
    tools: -1,
    mcpProviders: -1,
    knowledgeBaseSize: -1,
    concurrentExecutions: -1,
    retentionDays: 365
  }
};

export const PLAN_FEATURES: Record<TenantPlan, TenantFeatures> = {
  free: {
    customAgents: true,
    customTools: true,
    customKnowledgeBase: true,
    advancedAnalytics: false,
    auditLogs: false,
    ssoEnabled: false,
    webhookEnabled: false,
    apiAccess: true,
    cliAccess: true,
    whiteLabel: false,
    prioritySupport: false
  },
  starter: {
    customAgents: true,
    customTools: true,
    customKnowledgeBase: true,
    advancedAnalytics: false,
    auditLogs: true,
    ssoEnabled: false,
    webhookEnabled: true,
    apiAccess: true,
    cliAccess: true,
    whiteLabel: false,
    prioritySupport: false
  },
  professional: {
    customAgents: true,
    customTools: true,
    customKnowledgeBase: true,
    advancedAnalytics: true,
    auditLogs: true,
    ssoEnabled: true,
    webhookEnabled: true,
    apiAccess: true,
    cliAccess: true,
    whiteLabel: false,
    prioritySupport: true
  },
  enterprise: {
    customAgents: true,
    customTools: true,
    customKnowledgeBase: true,
    advancedAnalytics: true,
    auditLogs: true,
    ssoEnabled: true,
    webhookEnabled: true,
    apiAccess: true,
    cliAccess: true,
    whiteLabel: true,
    prioritySupport: true
  }
};