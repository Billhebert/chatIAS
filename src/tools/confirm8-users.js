/**
 * Confirm8UsersTool - Ferramenta de Gerenciamento de Usuários da API Confirm8
 * 
 * CRUD completo de usuários, tarefas, permissões e uploads
 */

import axios from 'axios';

export class Confirm8UsersTool {
  constructor(config = {}) {
    this.id = 'confirm8_users';
    this.name = 'Confirm8 Users Management';
    this.description = 'Gerencia usuários, tarefas, permissões, fotos e assinaturas na API Confirm8';
    this.version = '1.0.0';
    
    this.baseUrl = config.baseUrl || process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3';
    this.authTool = config.authTool; // Referência para Confirm8AuthTool
    
    this.routing = {
      keywords: ['user', 'usuário', 'users', 'usuários', 'criar usuário', 'listar usuários', 'atualizar usuário', 'permission', 'permissão', 'task user', 'foto usuário', 'assinatura']
    };
  }

  /**
   * Initialize - Cria authTool se necessário
   */
  async initialize() {
    if (!this.authTool) {
      const { Confirm8AuthTool } = await import('./confirm8-auth.js');
      this.authTool = new Confirm8AuthTool();
    }
    return this;
  }

  /**
   * Executa ação da ferramenta
   */
  async execute(params = {}) {
    const { action, ...data } = params;

    switch (action) {
      // CRUD Básico
      case 'create':
        return await this.createUser(data);
      case 'list':
        return await this.listUsers(data);
      case 'get':
        return await this.getUser(data.user_id || data.username);
      case 'update':
        return await this.updateUser(data.user_id, data);
      case 'activate':
        return await this.activateUser(data.user_id);
      case 'deactivate':
        return await this.deactivateUser(data.user_id);
      
      // Tasks
      case 'getTasks':
        return await this.getUserTasks(data.user_id);
      case 'getTickets':
        return await this.getUserTickets(data.user_id);
      case 'linkTasks':
        return await this.linkTasks(data.tasks);
      case 'unlinkTasks':
        return await this.unlinkTasks(data);
      case 'unlinkAllTasks':
        return await this.unlinkAllUserTasks(data.employee_id);
      
      // Permissões
      case 'getPermissions':
        return await this.getUserPermissions(data.user_id);
      
      // Uploads
      case 'uploadPhoto':
        return await this.uploadPhoto(data.user_id, data.image_url);
      case 'uploadSignature':
        return await this.uploadSignature(data.user_id, data.image_url);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * POST /users - Create User
   */
  async createUser(data) {
    const { username, password, name, phone, email } = data;

    if (!username || !password) {
      throw new Error('username and password are required');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/users`,
        { username, password, name, phone, email },
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'User created successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'create user');
    }
  }

  /**
   * GET /users - Get Users List
   */
  async listUsers(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/users`,
        { 
          headers: this._getHeaders(),
          params: filters
        }
      );

      return {
        success: true,
        status: response.status,
        count: response.data?.length || 0,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'list users');
    }
  }

  /**
   * GET /users/{user_id} ou /users/{username}/user - Show user information
   */
  async getUser(identifier) {
    if (!identifier) {
      throw new Error('user_id or username is required');
    }

    try {
      // Se for número, usa /users/{user_id}, senão /users/{username}/user
      const isNumeric = !isNaN(identifier);
      const endpoint = isNumeric 
        ? `${this.baseUrl}/users/${identifier}`
        : `${this.baseUrl}/users/${identifier}/user`;

      const response = await axios.get(endpoint, {
        headers: this._getHeaders()
      });

      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'get user');
    }
  }

  /**
   * PUT /users/{user_id} - Update user
   */
  async updateUser(user_id, data) {
    if (!user_id) {
      throw new Error('user_id is required');
    }

    try {
      const response = await axios.put(
        `${this.baseUrl}/users/${user_id}`,
        data,
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'User updated successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'update user');
    }
  }

  /**
   * PATCH /users/{user_id}/active - Active user
   */
  async activateUser(user_id) {
    if (!user_id) {
      throw new Error('user_id is required');
    }

    try {
      const response = await axios.patch(
        `${this.baseUrl}/users/${user_id}/active`,
        { deleted: 'N' },
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'User activated successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'activate user');
    }
  }

  /**
   * PATCH /users/{user_id}/inactive - Inactive user
   */
  async deactivateUser(user_id) {
    if (!user_id) {
      throw new Error('user_id is required');
    }

    try {
      const response = await axios.patch(
        `${this.baseUrl}/users/${user_id}/inactive`,
        { deleted: 'Y' },
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'User deactivated successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'deactivate user');
    }
  }

  /**
   * GET /users/{user_id}/tasks - Show user linked tasks
   */
  async getUserTasks(user_id) {
    if (!user_id) {
      throw new Error('user_id is required');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/users/${user_id}/tasks`,
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'get user tasks');
    }
  }

  /**
   * GET /users/{user_id}/tickets - Show tickets by owner
   */
  async getUserTickets(user_id) {
    if (!user_id) {
      throw new Error('user_id is required');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/users/${user_id}/tickets`,
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'get user tickets');
    }
  }

  /**
   * POST /users/tasks - Link tasks with user
   * tasks = [{ employee_id, user_id, task_id }]
   */
  async linkTasks(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('tasks array is required');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/users/tasks`,
        tasks,
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'Tasks linked successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'link tasks');
    }
  }

  /**
   * DELETE /users/tasks - Delete linked tasks
   */
  async unlinkTasks(data) {
    const { employee_id, user_id, task_id } = data;

    if (!employee_id || !user_id || !task_id) {
      throw new Error('employee_id, user_id and task_id are required');
    }

    try {
      const response = await axios.delete(
        `${this.baseUrl}/users/tasks`,
        {
          headers: this._getHeaders(),
          data: { employee_id, user_id, task_id }
        }
      );

      return {
        success: true,
        status: response.status,
        message: 'Tasks unlinked successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'unlink tasks');
    }
  }

  /**
   * DELETE /users/tasks/{employee_id} - Delete linked tasks by user
   */
  async unlinkAllUserTasks(employee_id) {
    if (!employee_id) {
      throw new Error('employee_id is required');
    }

    try {
      const response = await axios.delete(
        `${this.baseUrl}/users/tasks/${employee_id}`,
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'All user tasks unlinked successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'unlink all user tasks');
    }
  }

  /**
   * GET /users/{user_id}/permissions - Show permissions of user
   */
  async getUserPermissions(user_id) {
    if (!user_id) {
      throw new Error('user_id is required');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/users/${user_id}/permissions`,
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'get user permissions');
    }
  }

  /**
   * PATCH /users/{user_id}/photos - Upload a user photo file
   */
  async uploadPhoto(user_id, image_url) {
    if (!user_id || !image_url) {
      throw new Error('user_id and image_url are required');
    }

    try {
      const response = await axios.patch(
        `${this.baseUrl}/users/${user_id}/photos`,
        { image_url },
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'Photo uploaded successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'upload photo');
    }
  }

  /**
   * PATCH /users/{user_id}/signatures - Upload a user signature file
   */
  async uploadSignature(user_id, image_url) {
    if (!user_id || !image_url) {
      throw new Error('user_id and image_url are required');
    }

    try {
      const response = await axios.patch(
        `${this.baseUrl}/users/${user_id}/signatures`,
        { image_url },
        { headers: this._getHeaders() }
      );

      return {
        success: true,
        status: response.status,
        message: 'Signature uploaded successfully',
        data: response.data
      };
    } catch (error) {
      return this._handleError(error, 'upload signature');
    }
  }

  /**
   * Retorna headers com autenticação
   */
  _getHeaders() {
    if (this.authTool && this.authTool.getAuthHeaders) {
      return this.authTool.getAuthHeaders();
    }
    
    throw new Error('AuthTool not configured - cannot authenticate requests');
  }

  /**
   * Trata erros de requisição
   */
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
      message: `Connection error while trying to ${action}: ${error.message}`,
      error: error.message
    };
  }

  /**
   * Informações da ferramenta
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      baseUrl: this.baseUrl,
      actions: [
        'create', 'list', 'get', 'update', 'activate', 'deactivate',
        'getTasks', 'getTickets', 'linkTasks', 'unlinkTasks', 'unlinkAllTasks',
        'getPermissions', 'uploadPhoto', 'uploadSignature'
      ]
    };
  }
}

export default Confirm8UsersTool;
