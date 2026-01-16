/**
 * Evolution API Integration - Native WhatsApp Business Integration
 * 
 * This module provides native integration with Evolution API for WhatsApp Business.
 * Supports messaging, contacts, groups, and more.
 * 
 * Configuration (JSON):
 * ```json
 * {
 *   "id": "evolution",
 *   "name": "Evolution API",
 *   "enabled": true,
 *   "baseUrl": "http://localhost:8080",
 *   "authentication": {
 *     "type": "bearer",
 *     "token": "${EVOLUTION_TOKEN}"
 *   },
 *   "instance": "default"
 * }
 * ```
 */

import { BaseIntegration, IntegrationConfig, IntegrationError } from '../index.js';
import { z } from 'zod';

// ============================================================================
// EVOLUTION INTEGRATION CLASS
// ============================================================================

export class EvolutionIntegration extends BaseIntegration {
  private instance: string;

  constructor(config: EvolutionIntegrationConfig) {
    super({
      ...config,
      name: 'Evolution API',
      description: 'WhatsApp Business API integration via Evolution'
    });

    this.instance = config.instance || 'default';
  }

  async initialize(): Promise<void> {
    // Verify connection
    const health = await this.healthCheck();
    if (!health) {
      throw new IntegrationError(
        'Failed to connect to Evolution API',
        'CONNECTION_FAILED',
        'evolution'
      );
    }
  }

  async destroy(): Promise<void> {
    // Cleanup if needed
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', `/instance/health/${this.instance}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send text message
   */
  async action_sendMessage(params: {
    phone: string;
    text: string;
    previewUrl?: boolean;
  }): Promise<any> {
    const schema = z.object({
      phone: z.string().min(1, 'Phone is required'),
      text: z.string().min(1, 'Text is required'),
      previewUrl: z.boolean().optional()
    });

    const { phone, text, previewUrl = true } = this.validateParams(params, schema);

    return await this.request('POST', `/message/sendText/${this.instance}`, {
      phone,
      text,
      options: { previewUrl }
    });
  }

  /**
   * Send media message (image, video, document, audio)
   */
  async action_sendMedia(params: {
    phone: string;
    mediaType: 'image' | 'video' | 'document' | 'audio';
    media: string;      // URL or base64
    caption?: string;
    fileName?: string;
  }): Promise<any> {
    const schema = z.object({
      phone: z.string().min(1, 'Phone is required'),
      mediaType: z.enum(['image', 'video', 'document', 'audio']),
      media: z.string().min(1, 'Media URL or base64 is required'),
      caption: z.string().optional(),
      fileName: z.string().optional()
    });

    const { phone, mediaType, media, caption, fileName } = this.validateParams(params, schema);

    const endpoint = `/message/sendMedia/${this.instance}`;
    
    return await this.request('POST', endpoint, {
      phone,
      mediatype: mediaType,
      media,
      caption,
      fileName
    });
  }

  /**
   * Send location
   */
  async action_sendLocation(params: {
    phone: string;
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  }): Promise<any> {
    const schema = z.object({
      phone: z.string().min(1, 'Phone is required'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().optional(),
      address: z.string().optional()
    });

    const { phone, latitude, longitude, name, address } = this.validateParams(params, schema);

    return await this.request('POST', `/message/sendLocation/${this.instance}`, {
      phone,
      latitude,
      longitude,
      name,
      address
    });
  }

  /**
   * Create group
   */
  async action_createGroup(params: {
    name: string;
    participants: string[];
  }): Promise<any> {
    const schema = z.object({
      name: z.string().min(1, 'Group name is required'),
      participants: z.array(z.string()).min(1, 'At least one participant is required')
    });

    const { name, participants } = this.validateParams(params, schema);

    return await this.request('POST', `/group/create/${this.instance}`, {
      name,
      participants
    });
  }

  /**
   * Add participant to group
   */
  async action_addParticipant(params: {
    groupId: string;
    participant: string;
  }): Promise<any> {
    const schema = z.object({
      groupId: z.string().min(1, 'Group ID is required'),
      participant: z.string().min(1, 'Participant is required')
    });

    const { groupId, participant } = this.validateParams(params, schema);

    return await this.request('POST', `/group/addParticipant/${this.instance}`, {
      groupJid: groupId,
      participant
    });
  }

  /**
   * Remove participant from group
   */
  async action_removeParticipant(params: {
    groupId: string;
    participant: string;
  }): Promise<any> {
    const schema = z.object({
      groupId: z.string().min(1, 'Group ID is required'),
      participant: z.string().min(1, 'Participant is required')
    });

    const { groupId, participant } = this.validateParams(params, schema);

    return await this.request('POST', `/group/removeParticipant/${this.instance}`, {
      groupJid: groupId,
      participant
    });
  }

  /**
   * Get group info
   */
  async action_getGroupInfo(params: {
    groupId: string;
  }): Promise<any> {
    const schema = z.object({
      groupId: z.string().min(1, 'Group ID is required')
    });

    const { groupId } = this.validateParams(params, schema);

    return await this.request('GET', `/group/info/${this.instance}/${groupId}`);
  }

  /**
   * List group participants
   */
  async action_listParticipants(params: {
    groupId: string;
  }): Promise<any> {
    const schema = z.object({
      groupId: z.string().min(1, 'Group ID is required')
    });

    const { groupId } = this.validateParams(params, schema);

    return await this.request('GET', `/group/participants/${this.instance}/${groupId}`);
  }

  /**
   * Get contact info
   */
  async action_getContact(params: {
    phone: string;
  }): Promise<any> {
    const schema = z.object({
      phone: z.string().min(1, 'Phone is required')
    });

    const { phone } = this.validateParams(params, schema);

    return await this.request('GET', `/contact/info/${this.instance}/${phone}`);
  }

  /**
   * List contacts
   */
  async action_listContacts(): Promise<any> {
    return await this.request('GET', `/contact/list/${this.instance}`);
  }

  /**
   * Mark message as read
   */
  async action_markRead(params: {
    messageId: string;
  }): Promise<any> {
    const schema = z.object({
      messageId: z.string().min(1, 'Message ID is required')
    });

    const { messageId } = this.validateParams(params, schema);

    return await this.request('POST', `/message/markMessagesAsRead/${this.instance}`, {
      messageId
    });
  }

  /**
   * Get instance status
   */
  async action_getStatus(): Promise<any> {
    return await this.request('GET', `/instance/status/${this.instance}`);
  }

  /**
   * Restart instance
   */
  async action_restart(): Promise<any> {
    return await this.request('POST', `/instance/restart/${this.instance}`);
  }

  /**
   * Disconnect instance
   */
  async action_disconnect(): Promise<any> {
    return await this.request('POST', `/instance/logout/${this.instance}`);
  }

  /**
   * Get QR code for connection
   */
  async action_getQrCode(): Promise<any> {
    return await this.request('GET', `/instance/qrcode/${this.instance}`);
  }
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface EvolutionIntegrationConfig extends IntegrationConfig {
  instance?: string;
  webhookToken?: string;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createEvolutionIntegration(config: EvolutionIntegrationConfig): EvolutionIntegration {
  return new EvolutionIntegration(config);
}

// ============================================================================
// TOOL CONFIG FOR REGISTRY
// ============================================================================

export const evolutionToolConfig: ToolConfig = {
  id: 'evolution',
  name: 'Evolution API',
  description: 'WhatsApp Business integration via Evolution API',
  category: 'api',
  enabled: true,
  version: '1.0.0',
  parameters: {
    action: {
      type: 'string',
      required: true,
      enum: [
        'sendMessage', 'sendMedia', 'sendLocation',
        'createGroup', 'addParticipant', 'removeParticipant',
        'getGroupInfo', 'listParticipants',
        'getContact', 'listContacts',
        'markRead', 'getStatus', 'restart', 'disconnect', 'getQrCode'
      ]
    },
    phone: { type: 'string', required: false },
    text: { type: 'string', required: false },
    mediaType: { type: 'string', required: false },
    media: { type: 'string', required: false },
    caption: { type: 'string', required: false },
    groupId: { type: 'string', required: false }
  },
  actions: [
    { id: 'sendMessage', description: 'Send text message', params: ['phone', 'text'] },
    { id: 'sendMedia', description: 'Send media message', params: ['phone', 'mediaType', 'media'] },
    { id: 'sendLocation', description: 'Send location', params: ['phone', 'latitude', 'longitude'] },
    { id: 'createGroup', description: 'Create group', params: ['name', 'participants'] },
    { id: 'getGroupInfo', description: 'Get group info', params: ['groupId'] },
    { id: 'listParticipants', description: 'List group participants', params: ['groupId'] },
    { id: 'getContact', description: 'Get contact info', params: ['phone'] },
    { id: 'listContacts', description: 'List all contacts', params: [] },
    { id: 'getStatus', description: 'Get instance status', params: [] },
    { id: 'getQrCode', description: 'Get QR code for connection', params: [] }
  ]
};

import { ToolConfig } from '../index.js';