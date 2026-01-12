/**
 * Confirm8ClientsTool - Gerenciamento de Clientes da API Confirm8
 */

import axios from 'axios';

export class Confirm8ClientsTool {
  constructor(config = {}) {
    this.id = 'confirm8_clients';
    this.name = 'Confirm8 Clients Management';
    this.description = 'Gerencia clientes na API Confirm8 (CRUD completo)';
    this.version = '1.0.0';
    
    this.baseUrl = config.baseUrl || process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3';
    this.authTool = config.authTool;
    
    this.routing = {
      keywords: ['client', 'cliente', 'clients', 'clientes', 'criar cliente', 'listar clientes']
    };
  }

  async initialize() {
    if (!this.authTool) {
      const { Confirm8AuthTool } = await import('./confirm8-auth.js');
      this.authTool = new Confirm8AuthTool();
    }
    return this;
  }

  async execute(params = {}) {
    const { action, ...data } = params;

    switch (action) {
      case 'create':
        return await this.createClient(data);
      case 'list':
        return await this.listClients(data);
      case 'get':
        return await this.getClient(data.client_id);
      case 'update':
        return await this.updateClient(data.client_id, data);
      case 'activate':
        return await this.activateClient(data.client_id);
      case 'deactivate':
        return await this.deactivateClient(data.client_id);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async createClient(data) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/clients`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      return this._handleError(error, 'create client');
    }
  }

  async listClients(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/clients`,
        { headers: this._getHeaders(), params: filters }
      );
      return { success: true, count: response.data?.length || 0, data: response.data };
    } catch (error) {
      return this._handleError(error, 'list clients');
    }
  }

  async getClient(client_id) {
    if (!client_id) throw new Error('client_id is required');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/clients/${client_id}`,
        { headers: this._getHeaders() }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error, 'get client');
    }
  }

  async updateClient(client_id, data) {
    if (!client_id) throw new Error('client_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/clients/${client_id}`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Client updated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'update client');
    }
  }

  async activateClient(client_id) {
    if (!client_id) throw new Error('client_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/clients/${client_id}/active`,
        { deleted: 'N' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Client activated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'activate client');
    }
  }

  async deactivateClient(client_id) {
    if (!client_id) throw new Error('client_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/clients/${client_id}/inactive`,
        { deleted: 'Y' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Client deactivated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'deactivate client');
    }
  }

  _getHeaders() {
    if (this.authTool && this.authTool.getAuthHeaders) {
      return this.authTool.getAuthHeaders();
    }
    throw new Error('AuthTool not configured');
  }

  _handleError(error, action) {
    if (error.response) {
      return {
        success: false,
        status: error.response.status,
        action,
        message: error.response.data?.message || `Failed to ${action}`,
        error: error.response.data
      };
    }
    return {
      success: false,
      action,
      message: `Connection error: ${error.message}`
    };
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      actions: ['create', 'list', 'get', 'update', 'activate', 'deactivate']
    };
  }
}

export default Confirm8ClientsTool;
