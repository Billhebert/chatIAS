/**
 * Confirm8ItemsTool - Gerenciamento de Itens da API Confirm8
 */

import axios from 'axios';

export class Confirm8ItemsTool {
  constructor(config = {}) {
    this.id = 'confirm8_items';
    this.name = 'Confirm8 Items Management';
    this.description = 'Gerencia itens e tipos de itens na API Confirm8';
    this.version = '1.0.0';
    
    this.baseUrl = config.baseUrl || process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3';
    this.authTool = config.authTool;
    
    this.routing = {
      keywords: ['item', 'items', 'itens', 'criar item', 'listar itens', 'item type', 'tipo de item']
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
      // Items
      case 'createItem':
        return await this.createItem(data);
      case 'listItems':
        return await this.listItems(data);
      case 'getItem':
        return await this.getItem(data.item_id);
      case 'updateItem':
        return await this.updateItem(data.item_id, data);
      case 'activateItem':
        return await this.activateItem(data.item_id);
      case 'deactivateItem':
        return await this.deactivateItem(data.item_id);
      
      // Item Types
      case 'createItemType':
        return await this.createItemType(data);
      case 'listItemTypes':
        return await this.listItemTypes(data);
      case 'getItemType':
        return await this.getItemType(data.item_type_id);
      case 'updateItemType':
        return await this.updateItemType(data.item_type_id, data);
      case 'activateItemType':
        return await this.activateItemType(data.item_type_id);
      case 'deactivateItemType':
        return await this.deactivateItemType(data.item_type_id);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ===== ITEMS =====

  async createItem(data) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/items`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, status: response.status, message: 'Item created', data: response.data };
    } catch (error) {
      return this._handleError(error, 'create item');
    }
  }

  async listItems(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/items`,
        { headers: this._getHeaders(), params: filters }
      );
      return { success: true, count: response.data?.length || 0, data: response.data };
    } catch (error) {
      return this._handleError(error, 'list items');
    }
  }

  async getItem(item_id) {
    if (!item_id) throw new Error('item_id is required');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/items/${item_id}`,
        { headers: this._getHeaders() }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error, 'get item');
    }
  }

  async updateItem(item_id, data) {
    if (!item_id) throw new Error('item_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/items/${item_id}`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Item updated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'update item');
    }
  }

  async activateItem(item_id) {
    if (!item_id) throw new Error('item_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/items/${item_id}/active`,
        { deleted: 'N' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Item activated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'activate item');
    }
  }

  async deactivateItem(item_id) {
    if (!item_id) throw new Error('item_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/items/${item_id}/inactive`,
        { deleted: 'Y' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Item deactivated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'deactivate item');
    }
  }

  // ===== ITEM TYPES =====

  async createItemType(data) {
    const { name, info } = data;
    if (!name) throw new Error('name is required');

    try {
      const response = await axios.post(
        `${this.baseUrl}/itemTypes`,
        { name, info },
        { headers: this._getHeaders() }
      );
      return { success: true, status: response.status, message: 'ItemType created', data: response.data };
    } catch (error) {
      return this._handleError(error, 'create itemType');
    }
  }

  async listItemTypes(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/itemTypes`,
        { headers: this._getHeaders(), params: filters }
      );
      return { success: true, count: response.data?.length || 0, data: response.data };
    } catch (error) {
      return this._handleError(error, 'list itemTypes');
    }
  }

  async getItemType(item_type_id) {
    if (!item_type_id) throw new Error('item_type_id is required');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/itemTypes/${item_type_id}`,
        { headers: this._getHeaders() }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error, 'get itemType');
    }
  }

  async updateItemType(item_type_id, data) {
    if (!item_type_id) throw new Error('item_type_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/itemTypes/${item_type_id}`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'ItemType updated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'update itemType');
    }
  }

  async activateItemType(item_type_id) {
    if (!item_type_id) throw new Error('item_type_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/itemTypes/${item_type_id}/active`,
        { deleted: 'N' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'ItemType activated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'activate itemType');
    }
  }

  async deactivateItemType(item_type_id) {
    if (!item_type_id) throw new Error('item_type_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/itemTypes/${item_type_id}/inactive`,
        { deleted: 'Y' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'ItemType deactivated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'deactivate itemType');
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
      actions: [
        'createItem', 'listItems', 'getItem', 'updateItem', 'activateItem', 'deactivateItem',
        'createItemType', 'listItemTypes', 'getItemType', 'updateItemType', 'activateItemType', 'deactivateItemType'
      ]
    };
  }
}

export default Confirm8ItemsTool;
