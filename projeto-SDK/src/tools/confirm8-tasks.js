/**
 * Confirm8TasksTool - Gerenciamento de Tarefas/Checklists da API Confirm8
 */

import axios from 'axios';

export class Confirm8TasksTool {
  constructor(config = {}) {
    this.id = 'confirm8_tasks';
    this.name = 'Confirm8 Tasks Management';
    this.description = 'Gerencia tarefas e checklists na API Confirm8 (CRUD completo)';
    this.version = '1.0.0';
    
    this.baseUrl = config.baseUrl || process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3';
    this.authTool = config.authTool;
    
    this.routing = {
      keywords: ['task', 'tarefa', 'tasks', 'tarefas', 'checklist', 'checklists', 'criar tarefa', 'listar tarefas']
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
        return await this.createTask(data);
      case 'list':
        return await this.listTasks(data);
      case 'get':
        return await this.getTask(data.task_id);
      case 'update':
        return await this.updateTask(data.task_id, data);
      case 'activate':
        return await this.activateTask(data.task_id);
      case 'deactivate':
        return await this.deactivateTask(data.task_id);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async createTask(data) {
    const { 
      task_type_id, 
      item_type_id, 
      task_type = 'order', 
      name,
      info,
      estimated_time = '00:30:00',
      mandatory = 'N',
      editable = 'Y',
      multipliable = 'N',
      priority = 1,
      has_feedback = 'N'
    } = data;

    if (!name) throw new Error('name is required');

    try {
      const response = await axios.post(
        `${this.baseUrl}/tasks`,
        {
          task_type_id,
          item_type_id,
          task_type,
          name,
          info,
          estimated_time,
          mandatory,
          editable,
          multipliable,
          priority,
          has_feedback
        },
        { headers: this._getHeaders() }
      );
      return { success: true, status: response.status, message: 'Task created', data: response.data };
    } catch (error) {
      return this._handleError(error, 'create task');
    }
  }

  async listTasks(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/tasks`,
        { headers: this._getHeaders(), params: filters }
      );
      return { success: true, count: response.data?.length || 0, data: response.data };
    } catch (error) {
      return this._handleError(error, 'list tasks');
    }
  }

  async getTask(task_id) {
    if (!task_id) throw new Error('task_id is required');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/tasks/${task_id}`,
        { headers: this._getHeaders() }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error, 'get task');
    }
  }

  async updateTask(task_id, data) {
    if (!task_id) throw new Error('task_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/tasks/${task_id}`,
        data,
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Task updated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'update task');
    }
  }

  async activateTask(task_id) {
    if (!task_id) throw new Error('task_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/tasks/${task_id}/active`,
        { deleted: 'N' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Task activated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'activate task');
    }
  }

  async deactivateTask(task_id) {
    if (!task_id) throw new Error('task_id is required');
    
    try {
      const response = await axios.put(
        `${this.baseUrl}/tasks/${task_id}/inactive`,
        { deleted: 'Y' },
        { headers: this._getHeaders() }
      );
      return { success: true, message: 'Task deactivated', data: response.data };
    } catch (error) {
      return this._handleError(error, 'deactivate task');
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

export default Confirm8TasksTool;
