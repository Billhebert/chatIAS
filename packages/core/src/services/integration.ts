/**
 * Integration Service for ChatIAS 3.0
 * 
 * Native implementation of integration management:
 * - Integration Configuration
 * - Connection Testing
 * - Credential Encryption
 * - API Clients
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// ============================================================================
// INTEGRATION SERVICE
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

export interface IntegrationCredentials {
  // Evolution API
  baseUrl?: string;
  instanceName?: string;
  token?: string;
  
  // RD Station
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  
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
  
  // Custom
  [key: string]: any;
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  latency?: number;
  data?: Record<string, any>;
  error?: string;
}

export interface IntegrationHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastChecked: Date;
  message?: string;
}

export type IntegrationType = 
  | 'EVOLUTION'      // WhatsApp Business API
  | 'RDSTATION'      // RD Station CRM
  | 'CONFIRM8'       // Confirm8 Business Management
  | 'WEBHOOK'        // Generic Webhook
  | 'SLACK'          // Slack
  | 'DISCORD'        // Discord
  | 'EMAIL'          // Email/SMTP
  | 'CUSTOM';        // Custom integration

export type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';

export interface CreateIntegrationInput {
  type: IntegrationType;
  name: string;
  companyId?: string;
  credentials: IntegrationCredentials;
  metadata?: Record<string, any>;
}

export interface IntegrationApiClient {
  testConnection(credentials: IntegrationCredentials): Promise<IntegrationTestResult>;
  healthCheck(credentials: IntegrationCredentials): Promise<IntegrationHealthCheck>;
  call(action: string, params: Record<string, any>, credentials: IntegrationCredentials): Promise<Record<string, any>>;
}

export class IntegrationService extends EventEmitter {
  private integrations: Map<string, IntegrationConfig> = new Map();
  private byTenant: Map<string, Set<string>> = new Map();
  private byType: Map<string, string> = new Map(); // tenant:type -> integrationId
  private clients: Map<IntegrationType, IntegrationApiClient> = new Map();
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    super();
    // Use environment variable or generate a key
    this.encryptionKey = encryptionKey || process.env.INTEGRATION_ENCRYPTION_KEY || 'default-key-change-in-production';
    
    this.registerDefaultClients();
  }

  private registerDefaultClients(): void {
    // Evolution API Client
    this.clients.set('EVOLUTION', {
      async testConnection(credentials) {
        try {
          const start = Date.now();
          const response = await fetch(`${credentials.baseUrl}/instance/connectionState/${credentials.instanceName}`, {
            headers: { 'apikey': credentials.token }
          });
          const latency = Date.now() - start;
          
          if (response.ok) {
            return { success: true, message: 'Evolution API connected', latency };
          }
          return { success: false, message: 'Failed to connect', latency };
        } catch (error: any) {
          return { success: false, message: error.message, error: error.message };
        }
      },
      async healthCheck(credentials) {
        const start = Date.now();
        try {
          await fetch(`${credentials.baseUrl}/instance/connectionState/${credentials.instanceName}`, {
            headers: { 'apikey': credentials.token }
          });
          return { status: 'healthy', latency: Date.now() - start, lastChecked: new Date() };
        } catch {
          return { status: 'unhealthy', latency: Date.now() - start, lastChecked: new Date(), message: 'Connection failed' };
        }
      },
      async call(action, params, credentials) {
        const endpoint = this.getEvolutionEndpoint(action);
        const response = await fetch(`${credentials.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'apikey': credentials.token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ instanceName: credentials.instanceName, ...params })
        });
        return response.json();
      }
    });

    // RD Station Client
    this.clients.set('RDSTATION', {
      async testConnection(credentials) {
        try {
          const start = Date.now();
          const response = await fetch('https://api.rd.services/platform/users/me', {
            headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
          });
          const latency = Date.now() - start;
          
          if (response.ok) {
            return { success: true, message: 'RD Station connected', latency };
          }
          return { success: false, message: 'Failed to connect', latency };
        } catch (error: any) {
          return { success: false, message: error.message, error: error.message };
        }
      },
      async healthCheck(credentials) {
        const start = Date.now();
        try {
          await fetch('https://api.rd.services/platform/users/me', {
            headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
          });
          return { status: 'healthy', latency: Date.now() - start, lastChecked: new Date() };
        } catch {
          return { status: 'unhealthy', latency: Date.now() - start, lastChecked: new Date(), message: 'Connection failed' };
        }
      },
      async call(action, params, credentials) {
        const endpoints: Record<string, string> = {
          'getContact': '/platform/contacts',
          'createContact': '/platform/contacts',
          'updateContact': '/platform/contacts/{id}',
          'listDeals': '/platform/deals',
          'createDeal': '/platform/deals'
        };
        
        const response = await fetch(`https://api.rd.services${endpoints[action] || action}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        return response.json();
      }
    });

    // Confirm8 Client
    this.clients.set('CONFIRM8', {
      async testConnection(credentials) {
        try {
          const start = Date.now();
          const response = await fetch('https://api.confirm8.com/api/v1/user/me', {
            headers: { 
              'Authorization': `Bearer ${this.generateConfirm8Token(credentials)}`,
              'Content-Type': 'application/json'
            }
          });
          const latency = Date.now() - start;
          
          if (response.ok) {
            return { success: true, message: 'Confirm8 connected', latency };
          }
          return { success: false, message: 'Failed to connect', latency };
        } catch (error: any) {
          return { success: false, message: error.message, error: error.message };
        }
      },
      async healthCheck(credentials) {
        const start = Date.now();
        try {
          await fetch('https://api.confirm8.com/api/v1/user/me', {
            headers: { 
              'Authorization': `Bearer ${this.generateConfirm8Token(credentials)}`
            }
          });
          return { status: 'healthy', latency: Date.now() - start, lastChecked: new Date() };
        } catch {
          return { status: 'unhealthy', latency: Date.now() - start, lastChecked: new Date(), message: 'Connection failed' };
        }
      },
      async call(action, params, credentials) {
        const response = await fetch(`https://api.confirm8.com/api/v1/${action}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.generateConfirm8Token(credentials)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        return response.json();
      }
    });

    // Webhook Client
    this.clients.set('WEBHOOK', {
      async testConnection(credentials) {
        const start = Date.now();
        try {
          const response = await fetch(credentials.webhookUrl!, {
            method: 'HEAD'
          });
          const latency = Date.now() - start;
          return { success: response.ok, message: response.ok ? 'Webhook accessible' : 'Webhook not accessible', latency };
        } catch (error: any) {
          return { success: false, message: error.message, error: error.message };
        }
      },
      async healthCheck(credentials) {
        const start = Date.now();
        try {
          await fetch(credentials.webhookUrl!, { method: 'HEAD' });
          return { status: 'healthy', latency: Date.now() - start, lastChecked: new Date() };
        } catch {
          return { status: 'unhealthy', latency: Date.now() - start, lastChecked: new Date(), message: 'Webhook inaccessible' };
        }
      },
      async call(action, params, credentials) {
        const response = await fetch(credentials.webhookUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': credentials.webhookSecret || '',
            'X-Webhook-Action': action
          },
          body: JSON.stringify(params)
        });
        return { status: response.status, body: await response.json() };
      }
    });
  }

  private generateConfirm8Token(credentials: IntegrationCredentials): string {
    // Simplified token generation for Confirm8
    return Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
  }

  private getEvolutionEndpoint(action: string): string {
    const endpoints: Record<string, string> = {
      'sendText': '/messages/sendText',
      'sendMedia': '/messages/sendMedia',
      'sendLocation': '/messages/sendLocation',
      'getMessages': '/messages/list',
      'getChats': '/chats/list',
      'getChat': '/chats/{phone}',
      'getContact': '/contact/{phone}',
      'getInstanceStatus': '/instance/connectionState/{instanceName}'
    };
    return endpoints[action] || action;
  }

  private encryptCredentials(credentials: IntegrationCredentials): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted.toString('hex')
    });
  }

  private decryptCredentials(encrypted: string): IntegrationCredentials {
    const parsed = JSON.parse(encrypted);
    const iv = Buffer.from(parsed.iv, 'hex');
    const authTag = Buffer.from(parsed.authTag, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'hex')),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }

  async create(tenantId: string, input: CreateIntegrationInput): Promise<IntegrationConfig> {
    const id = uuidv4();
    const now = new Date();

    // Check for existing integration of same type for tenant
    const typeKey = `${tenantId}:${input.type}`;
    if (this.byType.has(typeKey)) {
      throw new Error(`Integration of type ${input.type} already exists for this tenant`);
    }

    const integration: IntegrationConfig = {
      id,
      tenantId,
      companyId: input.companyId,
      type: input.type,
      name: input.name,
      config: input.credentials,
      status: 'DISCONNECTED',
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now
    };

    this.integrations.set(id, integration);

    // Index by tenant
    if (!this.byTenant.has(tenantId)) {
      this.byTenant.set(tenantId, new Set());
    }
    this.byTenant.get(tenantId)!.add(id);

    // Index by type
    this.byType.set(typeKey, id);

    this.emit('integration:created', { integration });
    return integration;
  }

  async findById(id: string): Promise<IntegrationConfig | null> {
    return this.integrations.get(id) || null;
  }

  async findByTenant(tenantId: string): Promise<IntegrationConfig[]> {
    const integrationIds = this.byTenant.get(tenantId);
    if (!integrationIds) return [];
    
    return Array.from(integrationIds)
      .map(id => this.integrations.get(id)!)
      .filter(Boolean);
  }

  async findByType(tenantId: string, type: IntegrationType): Promise<IntegrationConfig | null> {
    const typeKey = `${tenantId}:${type}`;
    const integrationId = this.byType.get(typeKey);
    if (!integrationId) return null;
    return this.integrations.get(integrationId) || null;
  }

  async testConnection(id: string): Promise<IntegrationTestResult> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    const client = this.clients.get(integration.type);
    if (!client) {
      return { success: false, message: `No client registered for type: ${integration.type}` };
    }

    const result = await client.testConnection(integration.config);

    // Update status
    if (result.success) {
      await this.updateStatus(id, 'CONNECTED');
    } else {
      await this.updateStatus(id, 'ERROR');
    }

    this.emit('integration:tested', { integration, result });
    return result;
  }

  async healthCheck(id: string): Promise<IntegrationHealthCheck> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    const client = this.clients.get(integration.type);
    if (!client) {
      return { status: 'unhealthy', latency: 0, lastChecked: new Date(), message: 'No client' };
    }

    return client.healthCheck(integration.config);
  }

  async call(id: string, action: string, params: Record<string, any> = {}): Promise<Record<string, any>> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    if (integration.status !== 'CONNECTED') {
      throw new Error(`Integration is not connected: ${id}`);
    }

    const client = this.clients.get(integration.type);
    if (!client) {
      throw new Error(`No client registered for type: ${integration.type}`);
    }

    const result = await client.call(action, params, integration.config);

    // Update last sync time
    await this.update(id, { lastSyncAt: new Date() });

    this.emit('integration:called', { integration, action, result });
    return result;
  }

  async update(id: string, data: Partial<{
    name: string;
    credentials: IntegrationCredentials;
    metadata: Record<string, any>;
    lastSyncAt: Date;
  }>): Promise<IntegrationConfig> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    const updated: IntegrationConfig = {
      ...integration,
      name: data.name || integration.name,
      config: data.credentials || integration.config,
      metadata: { ...integration.metadata, ...data.metadata },
      lastSyncAt: data.lastSyncAt || integration.lastSyncAt,
      updatedAt: new Date()
    };

    this.integrations.set(id, updated);
    this.emit('integration:updated', { integration: updated, changes: data });
    return updated;
  }

  async updateStatus(id: string, status: IntegrationStatus): Promise<IntegrationConfig> {
    return this.update(id, { metadata: { ...this.integrations.get(id)?.metadata, status } });
  }

  async delete(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    this.integrations.delete(id);
    this.byTenant.get(integration.tenantId)?.delete(id);
    this.byType.delete(`${integration.tenantId}:${integration.type}`);

    this.emit('integration:deleted', { integrationId: id });
  }

  async syncAll(tenantId: string): Promise<void> {
    const integrations = await this.findByTenant(tenantId);
    
    for (const integration of integrations) {
      if (integration.status === 'CONNECTED') {
        try {
          await this.testConnection(integration.id);
        } catch (error) {
          console.error(`[Integration] Health check failed for ${integration.name}:`, error);
        }
      }
    }
  }

  getStatistics(tenantId: string): {
    total: number;
    connected: number;
    disconnected: number;
    errors: number;
    byType: Record<string, number>;
  } {
    const integrations = this.findByTenant(tenantId);
    
    const byType: Record<string, number> = {};
    integrations.forEach(i => {
      byType[i.type] = (byType[i.type] || 0) + 1;
    });

    return {
      total: integrations.length,
      connected: integrations.filter(i => i.status === 'CONNECTED').length,
      disconnected: integrations.filter(i => i.status === 'DISCONNECTED').length,
      errors: integrations.filter(i => i.status === 'ERROR').length,
      byType
    };
  }

  registerClient(type: IntegrationType, client: IntegrationApiClient): void {
    this.clients.set(type, client);
  }

  clear(): void {
    this.integrations.clear();
    this.byTenant.clear();
    this.byType.clear();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createIntegrationService(encryptionKey?: string): IntegrationService {
  return new IntegrationService(encryptionKey);
}
