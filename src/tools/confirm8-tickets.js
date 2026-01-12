/**
 * Confirm8TicketsTool - Gerenciamento de Ocorrências/Tickets da API Confirm8
 */

import axios from 'axios';

export class Confirm8TicketsTool {
  constructor(config = {}) {
    this.id = 'confirm8_tickets';
    this.name = 'Confirm8 Tickets Management';
    this.description = 'Gerencia ocorrências/tickets na API Confirm8 (CRUD completo)';
    this.version = '1.0.0';
    
    this.baseUrl = config.baseUrl || process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3';
    this.authTool = config.authTool;
    
    this.routing = {
      keywords: ['ticket', 'tickets', 'ocorrência', 'ocorrências', 'occurrence', 'criar ticket', 'listar tickets']
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
        return await this.createTicket(data);
      case 'list':
        return await this.listTickets(data);
      case 'get':
        return await this.getTicket(data.ticket_id);
      case 'update':
        return await this.updateTicket(data.ticket_id, data);
      case 'activateBatch':
        return await this.activateTickets(data.ticket_ids);
      case 'deactivateBatch':
        return await this.deactivateTickets(data.ticket_ids);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async createTicket(data) {
    const {
      client_id,
      item_id,
      subject_id,
      category_id,
      priority_id,
      status_id,
      owner_user_id,
      subject,
      content
    } = data;

    if (!content) throw new Error('content is required');

    try {
      const response = await axios.post(
        `${this.baseUrl}/tickets`,
        {
          client_id,
          item_id,
          subject_id,
          category_id,
          priority_id,
          status_id,
          owner_user_id,
          subject,
          content
        },
        { headers: this._getHeaders() }
      );
      return { success: true, status: response.status, message: 'Ticket created', data: response.data };
    } catch (error) {
      return this._handleError(error, 'create ticket');
    }
  }

  async listTickets(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/tickets`,
        { headers: this._getHeaders(), params: filters }
      );
      return { success: true, count: response.data?.length || 0, data: response.data };
    } catch (error) {
      return this._handleError(error, 'list tickets');
    }
  }

  async getTicket(ticket_id) {
    if (!ticket_id) throw new Error('ticket_id is required');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/tickets/${ticket_id}`,
        { headers: this._getHeaders() }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error, 'get ticket');
    }
  }

  async updateTicket(ticket_id, data) {
    if (!ticket_id) throw new Error('ticket_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/tickets/${ticket_id}`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Ticket updated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'update ticket');
    }
  }

  async activateTickets(ticket_ids) {
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      throw new Error('ticket_ids array is required');
    }
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/tickets/active`,
        ticket_ids,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Tickets activated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'activate tickets');
    }
  }

  async deactivateTickets(ticket_ids) {
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      throw new Error('ticket_ids array is required');
    }
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/tickets/inactive`,
        ticket_ids,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Tickets deactivated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'deactivate tickets');
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

export default Confirm8TicketsTool;
