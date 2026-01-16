/**
 * RD Station Integration - Native CRM Integration
 * 
 * This module provides native integration with RD Station CRM.
 * Supports contacts, deals, pipelines, activities, and more.
 * 
 * Configuration (JSON):
 * ```json
 * {
 *   "id": "rdstation",
 *   "name": "RD Station CRM",
 *   "enabled": true,
 *   "baseUrl": "https://api.rd.services",
 *   "authentication": {
 *     "type": "bearer",
 *     "token": "${RD_STATION_TOKEN}"
 *   }
 * }
 * ```
 */

import { BaseIntegration, IntegrationConfig, IntegrationError } from '../index.js';
import { z } from 'zod';

// ============================================================================
// RD STATION INTEGRATION CLASS
// ============================================================================

export class RDStationIntegration extends BaseIntegration {
  private readonly API_VERSION = 'v1';

  constructor(config: RDStationIntegrationConfig) {
    super({
      ...config,
      name: 'RD Station CRM',
      description: 'CRM integration with RD Station'
    });
  }

  async initialize(): Promise<void> {
    const health = await this.healthCheck();
    if (!health) {
      throw new IntegrationError(
        'Failed to connect to RD Station API',
        'CONNECTION_FAILED',
        'rdstation'
      );
    }
  }

  async destroy(): Promise<void> {
    // Cleanup if needed
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', `/${this.API_VERSION}/health`);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // CONTACTS
  // ==========================================================================

  /**
   * Create a new contact
   */
  async action_createContact(params: {
    name: string;
    email: string;
    phone?: string;
    mobilePhone?: string;
    company?: string;
    jobTitle?: string;
    city?: string;
    state?: string;
    country?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  }): Promise<any> {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Valid email is required'),
      phone: z.string().optional(),
      mobilePhone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      tags: z.array(z.string()).optional(),
      customFields: z.record(z.any()).optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/contacts`, {
      contact: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        mobile_phone: data.mobilePhone,
        company: data.company,
        job_title: data.jobTitle,
        city: data.city,
        state: data.state,
        country: data.country,
        tags: data.tags,
        custom_fields: data.customFields
      }
    });
  }

  /**
   * Get contact by ID
   */
  async action_getContact(params: {
    contactId: string;
  }): Promise<any> {
    const schema = z.object({
      contactId: z.string().min(1, 'Contact ID is required')
    });

    const { contactId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/contacts/${contactId}`);
  }

  /**
   * Update contact
   */
  async action_updateContact(params: {
    contactId: string;
    name?: string;
    phone?: string;
    mobilePhone?: string;
    company?: string;
    jobTitle?: string;
    city?: string;
    state?: string;
    country?: string;
    tags?: string[];
    stage?: string;
  }): Promise<any> {
    const schema = z.object({
      contactId: z.string().min(1, 'Contact ID is required'),
      name: z.string().optional(),
      phone: z.string().optional(),
      mobilePhone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      tags: z.array(z.string()).optional(),
      stage: z.string().optional()
    });

    const { contactId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/contacts/${contactId}`, {
      contact: updateData
    });
  }

  /**
   * List contacts with pagination
   */
  async action_listContacts(params?: {
    page?: number;
    pageSize?: number;
    sort?: string;
    direction?: 'asc' | 'desc';
  }): Promise<any> {
    const schema = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      sort: z.string().optional(),
      direction: z.enum(['asc', 'desc']).optional()
    });

    const query = this.validateParams(params || {}, schema);
    const queryString = new URLSearchParams(query as any).toString();

    return await this.request('GET', `/${this.API_VERSION}/contacts?${queryString}`);
  }

  /**
   * Search contacts by email
   */
  async action_searchContacts(params: {
    email: string;
  }): Promise<any> {
    const schema = z.object({
      email: z.string().email('Valid email is required')
    });

    const { email } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/contacts/search?email=${encodeURIComponent(email)}`);
  }

  /**
   * Delete contact
   */
  async action_deleteContact(params: {
    contactId: string;
  }): Promise<any> {
    const schema = z.object({
      contactId: z.string().min(1, 'Contact ID is required')
    });

    const { contactId } = this.validateParams(params, schema);

    return await this.request('DELETE', `/${this.API_VERSION}/contacts/${contactId}`);
  }

  // ==========================================================================
  // DEALS
  // ==========================================================================

  /**
   * Create a new deal
   */
  async action_createDeal(params: {
    dealTitle: string;
    contactId?: string;
    organizationId?: string;
    amount?: number;
    currency?: string;
    pipelineId: string;
    stageId: string;
    dueDate?: string;
    description?: string;
  }): Promise<any> {
    const schema = z.object({
      dealTitle: z.string().min(1, 'Deal title is required'),
      contactId: z.string().optional(),
      organizationId: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      pipelineId: z.string().min(1, 'Pipeline ID is required'),
      stageId: z.string().min(1, 'Stage ID is required'),
      dueDate: z.string().optional(),
      description: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/deals`, {
      deal: {
        title: data.dealTitle,
        contact_id: data.contactId,
        organization_id: data.organizationId,
        amount: data.amount,
        currency: data.currency,
        pipeline_id: data.pipelineId,
        stage_id: data.stageId,
        due_date: data.dueDate,
        description: data.description
      }
    });
  }

  /**
   * Get deal by ID
   */
  async action_getDeal(params: {
    dealId: string;
  }): Promise<any> {
    const schema = z.object({
      dealId: z.string().min(1, 'Deal ID is required')
    });

    const { dealId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/deals/${dealId}`);
  }

  /**
   * Update deal
   */
  async action_updateDeal(params: {
    dealId: string;
    dealTitle?: string;
    amount?: number;
    currency?: string;
    stageId?: string;
    dueDate?: string;
    description?: string;
  }): Promise<any> {
    const schema = z.object({
      dealId: z.string().min(1, 'Deal ID is required'),
      dealTitle: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      stageId: z.string().optional(),
      dueDate: z.string().optional(),
      description: z.string().optional()
    });

    const { dealId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/deals/${dealId}`, {
      deal: updateData
    });
  }

  /**
   * List deals
   */
  async action_listDeals(params?: {
    page?: number;
    pageSize?: number;
    pipelineId?: string;
  }): Promise<any> {
    const schema = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      pipelineId: z.string().optional()
    });

    const query = this.validateParams(params || {}, schema);
    const queryString = new URLSearchParams(query as any).toString();

    return await this.request('GET', `/${this.API_VERSION}/deals?${queryString}`);
  }

  /**
   * Move deal to stage
   */
  async action_moveDealStage(params: {
    dealId: string;
    stageId: string;
  }): Promise<any> {
    const schema = z.object({
      dealId: z.string().min(1, 'Deal ID is required'),
      stageId: z.string().min(1, 'Stage ID is required')
    });

    const { dealId, stageId } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/deals/${dealId}/stage`, {
      stage_id: stageId
    });
  }

  // ==========================================================================
  // PIPELINES
  // ==========================================================================

  /**
   * List pipelines
   */
  async action_listPipelines(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/pipelines`);
  }

  /**
   * Get pipeline stages
   */
  async action_getPipelineStages(params: {
    pipelineId: string;
  }): Promise<any> {
    const schema = z.object({
      pipelineId: z.string().min(1, 'Pipeline ID is required')
    });

    const { pipelineId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/pipelines/${pipelineId}/stages`);
  }

  // ==========================================================================
  // ORGANIZATIONS
  // ==========================================================================

  /**
   * Create organization
   */
  async action_createOrganization(params: {
    name: string;
    domain?: string;
    phone?: string;
    address?: {
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
  }): Promise<any> {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      domain: z.string().optional(),
      phone: z.string().optional(),
      address: z.object({
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postal_code: z.string().optional()
      }).optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/organizations`, {
      organization: data
    });
  }

  /**
   * Get organization
   */
  async action_getOrganization(params: {
    organizationId: string;
  }): Promise<any> {
    const schema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required')
    });

    const { organizationId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/organizations/${organizationId}`);
  }

  /**
   * List organizations
   */
  async action_listOrganizations(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const schema = z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional()
    });

    const query = this.validateParams(params || {}, schema);
    const queryString = new URLSearchParams(query as any).toString();

    return await this.request('GET', `/${this.API_VERSION}/organizations?${queryString}`);
  }

  // ==========================================================================
  // ACTIVITIES
  // ==========================================================================

  /**
   * Create activity
   */
  async action_createActivity(params: {
    contactId?: string;
    dealId?: string;
    organizationId?: string;
    activityType: string;
    subject: string;
    description?: string;
    dueDate?: string;
    createdAt?: string;
  }): Promise<any> {
    const schema = z.object({
      contactId: z.string().optional(),
      dealId: z.string().optional(),
      organizationId: z.string().optional(),
      activityType: z.string().min(1, 'Activity type is required'),
      subject: z.string().min(1, 'Subject is required'),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      createdAt: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/activities`, {
      activity: data
    });
  }

  /**
   * List activities
   */
  async action_listActivities(params?: {
    contactId?: string;
    dealId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const schema = z.object({
      contactId: z.string().optional(),
      dealId: z.string().optional(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional()
    });

    const query = this.validateParams(params || {}, schema);
    const queryString = new URLSearchParams(query as any).toString();

    return await this.request('GET', `/${this.API_VERSION}/activities?${queryString}`);
  }

  // ==========================================================================
  // CUSTOM FIELDS
  // ==========================================================================

  /**
   * List custom fields
   */
  async action_listCustomFields(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/custom_fields`);
  }
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface RDStationIntegrationConfig extends IntegrationConfig {
  apiVersion?: string;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createRDStationIntegration(config: RDStationIntegrationConfig): RDStationIntegration {
  return new RDStationIntegration(config);
}

// ============================================================================
// TOOL CONFIG FOR REGISTRY
// ============================================================================

import { ToolConfig } from '../index.js';

export const rdStationToolConfig: ToolConfig = {
  id: 'rdstation',
  name: 'RD Station CRM',
  description: 'RD Station CRM integration for contacts, deals, and activities',
  category: 'api',
  enabled: true,
  version: '1.0.0',
  parameters: {
    action: {
      type: 'string',
      required: true,
      enum: [
        'createContact', 'getContact', 'updateContact', 'listContacts', 'searchContacts', 'deleteContact',
        'createDeal', 'getDeal', 'updateDeal', 'listDeals', 'moveDealStage',
        'listPipelines', 'getPipelineStages',
        'createOrganization', 'getOrganization', 'listOrganizations',
        'createActivity', 'listActivities',
        'listCustomFields'
      ]
    },
    contactId: { type: 'string', required: false },
    dealId: { type: 'string', required: false },
    email: { type: 'string', required: false },
    name: { type: 'string', required: false }
  },
  actions: [
    { id: 'createContact', description: 'Create a new contact', params: ['name', 'email'] },
    { id: 'getContact', description: 'Get contact by ID', params: ['contactId'] },
    { id: 'listContacts', description: 'List all contacts', params: [] },
    { id: 'createDeal', description: 'Create a new deal', params: ['dealTitle', 'pipelineId', 'stageId'] },
    { id: 'listDeals', description: 'List all deals', params: [] },
    { id: 'listPipelines', description: 'List all pipelines', params: [] },
    { id: 'listCustomFields', description: 'List custom fields', params: [] }
  ]
};