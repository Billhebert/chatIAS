/**
 * Confirm8 Integration - Native Business Management Integration
 * 
 * This module provides native integration with Confirm8 Business Management.
 * Supports users, clients, tasks, tickets, items, WOs, services, and more.
 * 
 * Configuration (JSON):
 * ```json
 * {
 *   "id": "confirm8",
 *   "name": "Confirm8",
 *   "enabled": true,
 *   "baseUrl": "https://api.confirm8.com",
 *   "authentication": {
 *     "type": "bearer",
 *     "token": "${CONFIRM8_TOKEN}"
 *   }
 * }
 * ```
 */

import { BaseIntegration, IntegrationConfig, IntegrationError } from '../index.js';
import { z } from 'zod';

// ============================================================================
// CONFIRM8 INTEGRATION CLASS
// ============================================================================

export class Confirm8Integration extends BaseIntegration {
  private readonly API_VERSION = 'v1';

  constructor(config: Confirm8IntegrationConfig) {
    super({
      ...config,
      name: 'Confirm8',
      description: 'Business Management integration with Confirm8'
    });
  }

  async initialize(): Promise<void> {
    const health = await this.healthCheck();
    if (!health) {
      throw new IntegrationError(
        'Failed to connect to Confirm8 API',
        'CONNECTION_FAILED',
        'confirm8'
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
  // AUTHENTICATION
  // ==========================================================================

  /**
   * Login to Confirm8
   */
  async action_login(params: {
    username: string;
    password: string;
  }): Promise<any> {
    const schema = z.object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required')
    });

    const { username, password } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/auth/login`, {
      username,
      password
    });
  }

  /**
   * Logout
   */
  async action_logout(): Promise<any> {
    return await this.request('POST', `/${this.API_VERSION}/auth/logout`);
  }

  /**
   * Get current user
   */
  async action_getCurrentUser(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/auth/me`);
  }

  /**
   * Check authentication status
   */
  async action_isAuthenticated(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/auth/status`);
  }

  // ==========================================================================
  // USERS
  // ==========================================================================

  /**
   * Create user
   */
  async action_createUser(params: {
    username: string;
    password: string;
    name: string;
    email?: string;
    role?: string;
    employeeId?: string;
  }): Promise<any> {
    const schema = z.object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required'),
      name: z.string().min(1, 'Name is required'),
      email: z.string().email().optional(),
      role: z.string().optional(),
      employeeId: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/users`, { user: data });
  }

  /**
   * Get user by ID
   */
  async action_getUser(params: {
    userId: string;
  }): Promise<any> {
    const schema = z.object({
      userId: z.string().min(1, 'User ID is required')
    });

    const { userId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/users/${userId}`);
  }

  /**
   * List all users
   */
  async action_listUsers(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/users`);
  }

  /**
   * Update user
   */
  async action_updateUser(params: {
    userId: string;
    name?: string;
    email?: string;
    role?: string;
    employeeId?: string;
  }): Promise<any> {
    const schema = z.object({
      userId: z.string().min(1, 'User ID is required'),
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.string().optional(),
      employeeId: z.string().optional()
    });

    const { userId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/users/${userId}`, { user: updateData });
  }

  /**
   * Activate user
   */
  async action_activateUser(params: {
    userId: string;
  }): Promise<any> {
    const schema = z.object({
      userId: z.string().min(1, 'User ID is required')
    });

    const { userId } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/users/${userId}/activate`);
  }

  /**
   * Deactivate user
   */
  async action_deactivateUser(params: {
    userId: string;
  }): Promise<any> {
    const schema = z.object({
      userId: z.string().min(1, 'User ID is required')
    });

    const { userId } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/users/${userId}/deactivate`);
  }

  /**
   * Get user tasks
   */
  async action_getUserTasks(params: {
    userId: string;
  }): Promise<any> {
    const schema = z.object({
      userId: z.string().min(1, 'User ID is required')
    });

    const { userId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/users/${userId}/tasks`);
  }

  /**
   * Get user tickets
   */
  async action_getUserTickets(params: {
    userId: string;
  }): Promise<any> {
    const schema = z.object({
      userId: z.string().min(1, 'User ID is required')
    });

    const { userId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/users/${userId}/tickets`);
  }

  // ==========================================================================
  // CLIENTS
  // ==========================================================================

  /**
   * Create client
   */
  async action_createClient(params: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    document?: string;
  }): Promise<any> {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
      document: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/clients`, { client: data });
  }

  /**
   * Get client by ID
   */
  async action_getClient(params: {
    clientId: string;
  }): Promise<any> {
    const schema = z.object({
      clientId: z.string().min(1, 'Client ID is required')
    });

    const { clientId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/clients/${clientId}`);
  }

  /**
   * List all clients
   */
  async action_listClients(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/clients`);
  }

  /**
   * Update client
   */
  async action_updateClient(params: {
    clientId: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  }): Promise<any> {
    const schema = z.object({
      clientId: z.string().min(1, 'Client ID is required'),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional()
    });

    const { clientId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/clients/${clientId}`, { client: updateData });
  }

  /**
   * Activate client
   */
  async action_activateClient(params: {
    clientId: string;
  }): Promise<any> {
    const schema = z.object({
      clientId: z.string().min(1, 'Client ID is required')
    });

    const { clientId } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/clients/${clientId}/activate`);
  }

  /**
   * Deactivate client
   */
  async action_deactivateClient(params: {
    clientId: string;
  }): Promise<any> {
    const schema = z.object({
      clientId: z.string().min(1, 'Client ID is required')
    });

    const { clientId } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/clients/${clientId}/deactivate`);
  }

  // ==========================================================================
  // TASKS
  // ==========================================================================

  /**
   * Create task
   */
  async action_createTask(params: {
    title: string;
    type: string;
    description?: string;
    clientId?: string;
    assignedTo?: string;
    dueDate?: string;
    priority?: number;
  }): Promise<any> {
    const schema = z.object({
      title: z.string().min(1, 'Title is required'),
      type: z.string().min(1, 'Type is required'),
      description: z.string().optional(),
      clientId: z.string().optional(),
      assignedTo: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.number().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/tasks`, { task: data });
  }

  /**
   * Get task by ID
   */
  async action_getTask(params: {
    taskId: string;
  }): Promise<any> {
    const schema = z.object({
      taskId: z.string().min(1, 'Task ID is required')
    });

    const { taskId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/tasks/${taskId}`);
  }

  /**
   * List all tasks
   */
  async action_listTasks(params?: {
    status?: string;
    type?: string;
    assignedTo?: string;
  }): Promise<any> {
    const query = new URLSearchParams(params as any).toString();
    return await this.request('GET', `/${this.API_VERSION}/tasks?${query}`);
  }

  /**
   * Update task
   */
  async action_updateTask(params: {
    taskId: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: number;
    dueDate?: string;
  }): Promise<any> {
    const schema = z.object({
      taskId: z.string().min(1, 'Task ID is required'),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.number().optional(),
      dueDate: z.string().optional()
    });

    const { taskId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/tasks/${taskId}`, { task: updateData });
  }

  /**
   * Activate task
   */
  async action_activateTask(params: {
    taskId: string;
  }): Promise<any> {
    const schema = z.object({
      taskId: z.string().min(1, 'Task ID is required')
    });

    const { taskId } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/tasks/${taskId}/activate`);
  }

  /**
   * Deactivate task
   */
  async action_deactivateTask(params: {
    taskId: string;
  }): Promise<any> {
    const schema = z.object({
      taskId: z.string().min(1, 'Task ID is required')
    });

    const { taskId } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/tasks/${taskId}/deactivate`);
  }

  // ==========================================================================
  // TICKETS
  // ==========================================================================

  /**
   * Create ticket
   */
  async action_createTicket(params: {
    title: string;
    description?: string;
    clientId?: string;
    priority?: number;
    category?: string;
  }): Promise<any> {
    const schema = z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      clientId: z.string().optional(),
      priority: z.number().optional(),
      category: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/tickets`, { ticket: data });
  }

  /**
   * Get ticket by ID
   */
  async action_getTicket(params: {
    ticketId: string;
  }): Promise<any> {
    const schema = z.object({
      ticketId: z.string().min(1, 'Ticket ID is required')
    });

    const { ticketId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/tickets/${ticketId}`);
  }

  /**
   * List all tickets
   */
  async action_listTickets(params?: {
    status?: string;
    priority?: number;
    clientId?: string;
  }): Promise<any> {
    const query = new URLSearchParams(params as any).toString();
    return await this.request('GET', `/${this.API_VERSION}/tickets?${query}`);
  }

  /**
   * Update ticket
   */
  async action_updateTicket(params: {
    ticketId: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: number;
  }): Promise<any> {
    const schema = z.object({
      ticketId: z.string().min(1, 'Ticket ID is required'),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.number().optional()
    });

    const { ticketId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/tickets/${ticketId}`, { ticket: updateData });
  }

  /**
   * Activate multiple tickets
   */
  async action_activateBatchTickets(params: {
    ticketIds: string[];
  }): Promise<any> {
    const schema = z.object({
      ticketIds: z.array(z.string()).min(1, 'At least one ticket ID is required')
    });

    const { ticketIds } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/tickets/activateBatch`, { ticketIds });
  }

  /**
   * Deactivate multiple tickets
   */
  async action_deactivateBatchTickets(params: {
    ticketIds: string[];
  }): Promise<any> {
    const schema = z.object({
      ticketIds: z.array(z.string()).min(1, 'At least one ticket ID is required')
    });

    const { ticketIds } = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/tickets/deactivateBatch`, { ticketIds });
  }

  // ==========================================================================
  // ITEMS
  // ==========================================================================

  /**
   * Create item
   */
  async action_createItem(params: {
    name: string;
    itemTypeId: string;
    description?: string;
    price?: number;
    sku?: string;
  }): Promise<any> {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      itemTypeId: z.string().min(1, 'Item type ID is required'),
      description: z.string().optional(),
      price: z.number().optional(),
      sku: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/items`, { item: data });
  }

  /**
   * Get item by ID
   */
  async action_getItem(params: {
    itemId: string;
  }): Promise<any> {
    const schema = z.object({
      itemId: z.string().min(1, 'Item ID is required')
    });

    const { itemId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/items/${itemId}`);
  }

  /**
   * List all items
   */
  async action_listItems(): Promise<any> {
    return await this.request('GET', `/${this.API_VERSION}/items`);
  }

  /**
   * Update item
   */
  async action_updateItem(params: {
    itemId: string;
    name?: string;
    description?: string;
    price?: number;
    sku?: string;
  }): Promise<any> {
    const schema = z.object({
      itemId: z.string().min(1, 'Item ID is required'),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional(),
      sku: z.string().optional()
    });

    const { itemId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/items/${itemId}`, { item: updateData });
  }

  // ==========================================================================
  // WORK ORDERS (WOs)
  // ==========================================================================

  /**
   * Create work order
   */
  async action_createWO(params: {
    title: string;
    clientId: string;
    description?: string;
    serviceId?: string;
    assignedTo?: string;
    scheduledDate?: string;
    status?: string;
  }): Promise<any> {
    const schema = z.object({
      title: z.string().min(1, 'Title is required'),
      clientId: z.string().min(1, 'Client ID is required'),
      description: z.string().optional(),
      serviceId: z.string().optional(),
      assignedTo: z.string().optional(),
      scheduledDate: z.string().optional(),
      status: z.string().optional()
    });

    const data = this.validateParams(params, schema);

    return await this.request('POST', `/${this.API_VERSION}/workorders`, { workOrder: data });
  }

  /**
   * Get work order by ID
   */
  async action_getWO(params: {
    woId: string;
  }): Promise<any> {
    const schema = z.object({
      woId: z.string().min(1, 'Work Order ID is required')
    });

    const { woId } = this.validateParams(params, schema);

    return await this.request('GET', `/${this.API_VERSION}/workorders/${woId}`);
  }

  /**
   * List all work orders
   */
  async action_listWOs(params?: {
    status?: string;
    clientId?: string;
    assignedTo?: string;
  }): Promise<any> {
    const query = new URLSearchParams(params as any).toString();
    return await this.request('GET', `/${this.API_VERSION}/workorders?${query}`);
  }

  /**
   * Update work order
   */
  async action_updateWO(params: {
    woId: string;
    title?: string;
    description?: string;
    status?: string;
    assignedTo?: string;
  }): Promise<any> {
    const schema = z.object({
      woId: z.string().min(1, 'Work Order ID is required'),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      assignedTo: z.string().optional()
    });

    const { woId, ...updateData } = this.validateParams(params, schema);

    return await this.request('PATCH', `/${this.API_VERSION}/workorders/${woId}`, { workOrder: updateData });
  }
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface Confirm8IntegrationConfig extends IntegrationConfig {
  apiVersion?: string;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createConfirm8Integration(config: Confirm8IntegrationConfig): Confirm8Integration {
  return new Confirm8Integration(config);
}

// ============================================================================
// TOOL CONFIG FOR REGISTRY
// ============================================================================

import { ToolConfig } from '../index.js';

export const confirm8ToolConfig: ToolConfig = {
  id: 'confirm8',
  name: 'Confirm8',
  description: 'Business Management integration - users, clients, tasks, tickets, items, WOs',
  category: 'api',
  enabled: true,
  version: '1.0.0',
  parameters: {
    action: {
      type: 'string',
      required: true,
      enum: [
        'login', 'logout', 'getCurrentUser', 'isAuthenticated',
        'createUser', 'getUser', 'listUsers', 'updateUser', 'activateUser', 'deactivateUser',
        'createClient', 'getClient', 'listClients', 'updateClient', 'activateClient', 'deactivateClient',
        'createTask', 'getTask', 'listTasks', 'updateTask', 'activateTask', 'deactivateTask',
        'createTicket', 'getTicket', 'listTickets', 'updateTicket', 'activateBatchTickets', 'deactivateBatchTickets',
        'createItem', 'getItem', 'listItems', 'updateItem',
        'createWO', 'getWO', 'listWOs', 'updateWO'
      ]
    }
  },
  actions: [
    { id: 'login', description: 'Login to Confirm8', params: ['username', 'password'] },
    { id: 'listUsers', description: 'List all users', params: [] },
    { id: 'listClients', description: 'List all clients', params: [] },
    { id: 'listTasks', description: 'List all tasks', params: [] },
    { id: 'listTickets', description: 'List all tickets', params: [] },
    { id: 'listItems', description: 'List all items', params: [] },
    { id: 'listWOs', description: 'List all work orders', params: [] }
  ]
};