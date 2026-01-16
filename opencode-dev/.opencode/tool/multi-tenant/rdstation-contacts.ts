/**
 * Multi-Tenant RD Station Contacts Tool
 * 
 * Adapted from OpenCode to support multi-tenant isolation.
 */

import { MultiTenantTool, ToolResult } from '../../core/tool-base.js';
import { z } from 'zod';

// Configuration
interface RDStationConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

function getConfig(): RDStationConfig {
  return {
    baseUrl: process.env.RDSTATION_BASE_URL || 'https://api.rd.services',
    apiKey: process.env.RDSTATION_API_KEY,
    timeout: 30000
  };
}

// ============================================================================
// RD STATION CONTACTS TOOL
// ============================================================================

export class RDStationContactsTool extends MultiTenantTool {
  private config: RDStationConfig;

  constructor() {
    super();
    this.config = getConfig();
  }

  getDefinition() {
    return {
      id: 'rdstation-contacts',
      name: 'RD Station Contacts',
      description: 'Manage contacts in RD Station CRM',
      args: {
        action: tool.schema
          .enum(['create', 'get', 'update', 'list', 'search', 'delete', 'tags', 'convert'])
          .optional()
          .describe('Action to perform (default: list)'),
        contactId: tool.schema
          .string()
          .optional()
          .describe('Contact ID (required for get, update, delete, tags, convert)'),
        email: tool.schema
          .string()
          .optional()
          .describe('Email address (required for create, search)'),
        name: tool.schema
          .string()
          .optional()
          .describe('Contact name'),
        phone: tool.schema
          .string()
          .optional()
          .describe('Phone number'),
        mobilePhone: tool.schema
          .string()
          .optional()
          .describe('Mobile phone number'),
        company: tool.schema
          .string()
          .optional()
          .describe('Company name'),
        jobTitle: tool.schema
          .string()
          .optional()
          .describe('Job title'),
        city: tool.schema
          .string()
          .optional()
          .describe('City'),
        state: tool.schema
          .string()
          .optional()
          .describe('State'),
        country: tool.schema
          .string()
          .optional()
          .describe('Country'),
        tags: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe('Tags to add or update'),
        customFields: tool.schema
          .object()
          .optional()
          .describe('Custom fields as key-value pairs'),
        stage: tool.schema
          .string()
          .optional()
          .describe('Lifecycle stage (lead, customer, etc.)'),
        limit: tool.schema
          .number()
          .optional()
          .describe('Maximum number of contacts to return (default: 100)'),
        page: tool.schema
          .number()
          .optional()
          .describe('Page number for pagination')
      }
    };
  }

  getRequiredPermissions(): string[] {
    return ['rdstation:contacts'];
  }

  getCategory(): string {
    return 'rdstation';
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { action = 'list', ...params } = args;

    try {
      switch (action) {
        case 'create':
          return await this.createContact(params);
        case 'get':
          return await this.getContact(params.contactId);
        case 'update':
          return await this.updateContact(params.contactId, params);
        case 'list':
          return await this.listContacts(params);
        case 'search':
          return await this.searchContacts(params.email);
        case 'delete':
          return await this.deleteContact(params.contactId);
        case 'tags':
          return await this.updateContactTags(params.contactId, params.tags || []);
        case 'convert':
          return await this.convertLead(params.contactId, params);
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

  private async createContact(params: Record<string, any>): Promise<ToolResult> {
    const schema = z.object({
      email: z.string().email('Valid email is required'),
      name: z.string().optional(),
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

    const data = this.validateParams(schema, params);
    
    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/v1/contacts`,
        {
          contact: {
            email: data.email,
            name: data.name,
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
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          contactId: response.contact?.uuid || response.uuid
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'CREATE_CONTACT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getContact(contactId: string | undefined): Promise<ToolResult> {
    if (!contactId) {
      return {
        success: false,
        error: 'Contact ID is required',
        code: 'MISSING_CONTACT_ID'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/v1/contacts/${contactId}`
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          contactId
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_CONTACT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async updateContact(contactId: string | undefined, params: Record<string, any>): Promise<ToolResult> {
    if (!contactId) {
      return {
        success: false,
        error: 'Contact ID is required',
        code: 'MISSING_CONTACT_ID'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'PATCH',
        `${this.config.baseUrl}/v1/contacts/${contactId}`,
        {
          contact: {
            name: params.name,
            phone: params.phone,
            mobile_phone: params.mobilePhone,
            company: params.company,
            job_title: params.jobTitle,
            city: params.city,
            state: params.state,
            country: params.country,
            tags: params.tags,
            custom_fields: params.customFields
          }
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          contactId
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'UPDATE_CONTACT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async listContacts(params: Record<string, any>): Promise<ToolResult> {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.page) queryParams.set('page', String(params.page));

      const url = `${this.config.baseUrl}/v1/contacts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.httpRequest<any>('GET', url);

      return {
        success: true,
        data: {
          contacts: response.contacts || [],
          total: response.total || (response.contacts?.length || 0),
          page: params.page || 1,
          limit: params.limit || 100
        },
        metadata: {
          tenantId: this.tenantId,
          pagination: {
            page: params.page || 1,
            limit: params.limit || 100
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'LIST_CONTACTS_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async searchContacts(email: string | undefined): Promise<ToolResult> {
    if (!email) {
      return {
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/v1/contacts/search?email=${encodeURIComponent(email)}`
      );

      return {
        success: true,
        data: {
          contacts: response.contacts || [],
          found: (response.contacts?.length || 0) > 0
        },
        metadata: {
          tenantId: this.tenantId,
          searchEmail: email
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'SEARCH_CONTACTS_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async deleteContact(contactId: string | undefined): Promise<ToolResult> {
    if (!contactId) {
      return {
        success: false,
        error: 'Contact ID is required',
        code: 'MISSING_CONTACT_ID'
      };
    }

    try {
      await this.httpRequest<any>(
        'DELETE',
        `${this.config.baseUrl}/v1/contacts/${contactId}`
      );

      return {
        success: true,
        data: { deleted: true, contactId },
        metadata: {
          tenantId: this.tenantId,
          deletedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'DELETE_CONTACT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async updateContactTags(contactId: string | undefined, tags: string[]): Promise<ToolResult> {
    if (!contactId) {
      return {
        success: false,
        error: 'Contact ID is required',
        code: 'MISSING_CONTACT_ID'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'PATCH',
        `${this.config.baseUrl}/v1/contacts/${contactId}/tags`,
        { tags }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          contactId,
          tags
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'UPDATE_TAGS_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async convertLead(contactId: string | undefined, params: Record<string, any>): Promise<ToolResult> {
    if (!contactId) {
      return {
        success: false,
        error: 'Contact ID is required',
        code: 'MISSING_CONTACT_ID'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/v1/contacts/${contactId}/convert`,
        {
          lifecycle_stage: params.stage || 'customer'
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          contactId,
          convertedTo: params.stage || 'customer'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'CONVERT_LEAD_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }
}

// ============================================================================
// EXPORT FOR OPENCODE
// ============================================================================

export default new RDStationContactsTool().createTool();