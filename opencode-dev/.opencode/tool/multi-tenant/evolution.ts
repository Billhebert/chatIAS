/**
 * Multi-Tenant Evolution API Tool (WhatsApp Business)
 * 
 * Adapted from OpenCode to support multi-tenant isolation.
 */

import { MultiTenantTool, ToolResult } from '../../core/tool-base.js';
import { z } from 'zod';

// Configuration
interface EvolutionConfig {
  baseUrl: string;
  apiKey?: string;
  instance: string;
  timeout?: number;
}

function getConfig(): EvolutionConfig {
  return {
    baseUrl: process.env.EVOLUTION_BASE_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE || 'default',
    timeout: 30000
  };
}

// ============================================================================
// EVOLUTION API TOOL
// ============================================================================

export class EvolutionTool extends MultiTenantTool {
  private config: EvolutionConfig;

  constructor() {
    super();
    this.config = getConfig();
  }

  getDefinition() {
    return {
      id: 'evolution',
      name: 'Evolution API',
      description: 'WhatsApp Business integration via Evolution API',
      args: {
        action: tool.schema
          .enum([
            'sendText', 'sendMedia', 'sendLocation', 'sendContact',
            'sendList', 'sendButtons', 'sendReaction',
            'getMessages', 'getChats', 'getChat',
            'createGroup', 'addParticipant', 'removeParticipant',
            'getGroupInfo', 'getGroupParticipants',
            'getContact', 'getInstanceStatus', 'getQrCode'
          ])
          .optional()
          .describe('Action to perform (default: sendText)'),
        phone: tool.schema
          .string()
          .optional()
          .describe('Phone number with country code'),
        text: tool.schema
          .string()
          .optional()
          .describe('Message text'),
        mediaType: tool.schema
          .enum(['image', 'video', 'audio', 'document', 'sticker'])
          .optional()
          .describe('Media type'),
        media: tool.schema
          .string()
          .optional()
          .describe('Media URL or base64'),
        caption: tool.schema
          .string()
          .optional()
          .describe('Media caption'),
        latitude: tool.schema
          .number()
          .optional()
          .describe('Latitude for location'),
        longitude: tool.schema
          .number()
          .optional()
          .describe('Longitude for location'),
        name: tool.schema
          .string()
          .optional()
          .describe('Group name or contact name'),
        participants: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe('Group participant phone numbers'),
        groupJid: tool.schema
          .string()
          .optional()
          .describe('Group JID for group operations'),
        messageId: tool.schema
          .string()
          .optional()
          .describe('Message ID for reactions or quotes'),
        emoji: tool.schema
          .string()
          .optional()
          .describe('Reaction emoji'),
        limit: tool.schema
          .number()
          .optional()
          .describe('Number of messages/chats to return')
      }
    };
  }

  getRequiredPermissions(): string[] {
    return ['evolution:messages', 'evolution:groups', 'evolution:contacts'];
  }

  getCategory(): string {
    return 'evolution';
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { action = 'sendText', ...params } = args;

    try {
      switch (action) {
        case 'sendText':
          return await this.sendText(params.phone, params.text);
        case 'sendMedia':
          return await this.sendMedia(params);
        case 'sendLocation':
          return await this.sendLocation(params.phone, params.latitude, params.longitude, params.name, params.address);
        case 'sendContact':
          return await this.sendContact(params.phone, params.name, params.phone);
        case 'sendReaction':
          return await this.sendReaction(params.messageId, params.emoji);
        case 'getMessages':
          return await this.getMessages(params.phone, params.limit);
        case 'getChats':
          return await this.getChats(params.limit);
        case 'getChat':
          return await this.getChat(params.phone);
        case 'createGroup':
          return await this.createGroup(params.name, params.participants || []);
        case 'addParticipant':
          return await this.addParticipant(params.groupJid, params.participants || []);
        case 'removeParticipant':
          return await this.removeParticipant(params.groupJid, params.participants || []);
        case 'getGroupInfo':
          return await this.getGroupInfo(params.groupJid);
        case 'getGroupParticipants':
          return await this.getGroupParticipants(params.groupJid);
        case 'getContact':
          return await this.getContact(params.phone);
        case 'getInstanceStatus':
          return await this.getInstanceStatus();
        case 'getQrCode':
          return await this.getQrCode();
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

  private async sendText(phone: string | undefined, text: string | undefined): Promise<ToolResult> {
    if (!phone || !text) {
      return {
        success: false,
        error: 'Phone and text are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/message/sendText/${this.config.instance}`,
        {
          phone: this.formatPhone(phone),
          text
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          messageId: response.key?.id,
          to: phone
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'SEND_TEXT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async sendMedia(params: Record<string, any>): Promise<ToolResult> {
    const { phone, mediaType, media, caption } = params;
    
    if (!phone || !mediaType || !media) {
      return {
        success: false,
        error: 'Phone, mediaType, and media are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/message/sendMedia/${this.config.instance}`,
        {
          phone: this.formatPhone(phone),
          mediatype: mediaType,
          media,
          caption
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          mediaType,
          to: phone
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'SEND_MEDIA_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async sendLocation(phone: string | undefined, latitude: number | undefined, longitude: number | undefined, name?: string, address?: string): Promise<ToolResult> {
    if (!phone || latitude === undefined || longitude === undefined) {
      return {
        success: false,
        error: 'Phone, latitude, and longitude are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/message/sendLocation/${this.config.instance}`,
        {
          phone: this.formatPhone(phone),
          latitude,
          longitude,
          name: name || '',
          address: address || ''
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          location: { latitude, longitude },
          to: phone
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'SEND_LOCATION_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async sendContact(phone: string | undefined, name: string | undefined, contactPhone: string | undefined): Promise<ToolResult> {
    if (!phone || !name || !contactPhone) {
      return {
        success: false,
        error: 'Phone, name, and contactPhone are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/message/sendContact/${this.config.instance}`,
        {
          phone: this.formatPhone(phone),
          contact: {
            name,
            phone: this.formatPhone(contactPhone)
          }
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          contact: { name, phone: contactPhone },
          to: phone
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'SEND_CONTACT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async sendReaction(messageId: string | undefined, emoji: string | undefined): Promise<ToolResult> {
    if (!messageId || !emoji) {
      return {
        success: false,
        error: 'Message ID and emoji are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/message/sendReaction/${this.config.instance}`,
        {
          key: { id: messageId },
          reaction: { emoji }
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          messageId,
          emoji
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'SEND_REACTION_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getMessages(phone: string | undefined, limit?: number): Promise<ToolResult> {
    try {
      const url = phone
        ? `${this.config.baseUrl}/message/list/${this.config.instance}/${this.formatPhone(phone)}?limit=${limit || 100}`
        : `${this.config.baseUrl}/message/list/${this.config.instance}?limit=${limit || 100}`;
      
      const response = await this.httpRequest<any>('GET', url);

      return {
        success: true,
        data: {
          messages: response.messages || [],
          chat: phone
        },
        metadata: {
          tenantId: this.tenantId,
          limit: limit || 100
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_MESSAGES_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getChats(limit?: number): Promise<ToolResult> {
    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/chat/list/${this.config.instance}?limit=${limit || 100}`
      );

      return {
        success: true,
        data: {
          chats: response.chats || [],
          total: response.total || (response.chats?.length || 0)
        },
        metadata: {
          tenantId: this.tenantId,
          limit: limit || 100
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_CHATS_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getChat(phone: string | undefined): Promise<ToolResult> {
    if (!phone) {
      return {
        success: false,
        error: 'Phone is required',
        code: 'MISSING_PHONE'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/chat/find/${this.config.instance}/${this.formatPhone(phone)}`
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          phone
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_CHAT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async createGroup(name: string | undefined, participants: string[]): Promise<ToolResult> {
    if (!name) {
      return {
        success: false,
        error: 'Group name is required',
        code: 'MISSING_NAME'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/group/create/${this.config.instance}`,
        {
          name,
          participants: participants.map(p => this.formatPhone(p))
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          groupName: name,
          participantCount: participants.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'CREATE_GROUP_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async addParticipant(groupJid: string | undefined, participants: string[]): Promise<ToolResult> {
    if (!groupJid || participants.length === 0) {
      return {
        success: false,
        error: 'Group JID and participants are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/group/addParticipant/${this.config.instance}`,
        {
          groupJid,
          participants: participants.map(p => this.formatPhone(p))
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          groupJid,
          addedCount: participants.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'ADD_PARTICIPANT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async removeParticipant(groupJid: string | undefined, participants: string[]): Promise<ToolResult> {
    if (!groupJid || participants.length === 0) {
      return {
        success: false,
        error: 'Group JID and participants are required',
        code: 'MISSING_PARAMS'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'POST',
        `${this.config.baseUrl}/group/removeParticipant/${this.config.instance}`,
        {
          groupJid,
          participants: participants.map(p => this.formatPhone(p))
        }
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          groupJid,
          removedCount: participants.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'REMOVE_PARTICIPANT_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getGroupInfo(groupJid: string | undefined): Promise<ToolResult> {
    if (!groupJid) {
      return {
        success: false,
        error: 'Group JID is required',
        code: 'MISSING_GROUP_JID'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/group/info/${this.config.instance}/${groupJid}`
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          groupJid
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_GROUP_INFO_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getGroupParticipants(groupJid: string | undefined): Promise<ToolResult> {
    if (!groupJid) {
      return {
        success: false,
        error: 'Group JID is required',
        code: 'MISSING_GROUP_JID'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/group/participants/${this.config.instance}/${groupJid}`
      );

      return {
        success: true,
        data: {
          participants: response.participants || [],
          groupJid
        },
        metadata: {
          tenantId: this.tenantId,
          count: (response.participants?.length || 0)
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_GROUP_PARTICIPANTS_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getContact(phone: string | undefined): Promise<ToolResult> {
    if (!phone) {
      return {
        success: false,
        error: 'Phone is required',
        code: 'MISSING_PHONE'
      };
    }

    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/contact/find/${this.config.instance}/${this.formatPhone(phone)}`
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          phone
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

  private async getInstanceStatus(): Promise<ToolResult> {
    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/instance/status/${this.config.instance}`
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          instance: this.config.instance
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_INSTANCE_STATUS_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private async getQrCode(): Promise<ToolResult> {
    try {
      const response = await this.httpRequest<any>(
        'GET',
        `${this.config.baseUrl}/instance/qrcode/${this.config.instance}`
      );

      return {
        success: true,
        data: response,
        metadata: {
          tenantId: this.tenantId,
          instance: this.config.instance,
          qrCode: response.base64 || response.qrcode
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: 'GET_QR_CODE_ERROR',
        metadata: { tenantId: this.tenantId }
      };
    }
  }

  private formatPhone(phone: string): string {
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    // Add country code if not present
    if (digits.length === 11 && !digits.startsWith('55')) {
      return '55' + digits;
    }
    return digits;
  }
}

// ============================================================================
// EXPORT FOR OPENCODE
// ============================================================================

export default new EvolutionTool().createTool();