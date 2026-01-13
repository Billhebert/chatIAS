/**
 * Confirm8AuthTool - Ferramenta de Autenticação da API Confirm8
 * 
 * Gerencia autenticação e obtenção de tokens JWT
 */

import axios from 'axios';

export class Confirm8AuthTool {
  constructor(config = {}) {
    this.id = 'confirm8_auth';
    this.name = 'Confirm8 Authentication';
    this.description = 'Autentica usuário na API Confirm8 e gerencia tokens JWT';
    this.version = '1.0.0';
    
    this.baseUrl = config.baseUrl || process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3';
    
    // Credenciais fixas da API Confirm8
    this.bearerToken = config.bearerToken || process.env.CONFIRM8_BEARER_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjo4LCJ0b2tlbiI6IiQyYiQxMCRYWS9zYncycUJjYUl5R1g3eXlvMXJlIiwiaWF0IjoxNzU5MTE2NDg1fQ.YLwDzggLa56F4as9ehaGOnXgWOUFfgyogZVLcW9c2os';
    this.apiDomain = config.apiDomain || process.env.CONFIRM8_API_DOMAIN || 'suatec';
    this.apiKeyToken = config.apiKeyToken || process.env.CONFIRM8_APIKEY_TOKEN || '$2b$10$XY/sbw2qBcaIyGX7yyo1re';
    
    // Dados do usuário logado (se houver)
    this.refreshToken = null;
    this.account = null;
    this.user = null;
    
    this.routing = {
      keywords: ['login', 'autenticar', 'authenticate', 'token', 'confirm8', 'logout']
    };
  }

  /**
   * Initialize - Required by SystemLoader
   */
  async initialize() {
    return this;
  }

  /**
   * Executa ação da ferramenta
   */
  async execute(params = {}) {
    const { action = 'login', username, password } = params;

    switch (action) {
      case 'login':
        return await this.login(username, password);
      
      case 'logout':
        return this.logout();
      
      case 'getToken':
        return this.getToken();
      
      case 'getUser':
        return this.getUser();
      
      case 'isAuthenticated':
        return this.isAuthenticated();
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Login - Autentica usuário
   * POST /login
   * 
   * NOTA: A API Confirm8 já usa Bearer Token fixo, mas o endpoint /login
   * pode retornar dados adicionais do usuário
   */
  async login(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/login`,
        { username, password },
        { headers: this.getAuthHeaders() }
      );

      if (response.status === 200 && response.data) {
        // Armazena dados do usuário (se a API retornar)
        if (response.data.refreshToken) {
          this.refreshToken = response.data.refreshToken;
        }
        if (response.data.account) {
          this.account = response.data.account;
        }
        if (response.data.user) {
          this.user = response.data.user;
        }

        return {
          success: true,
          message: 'Login successful',
          data: {
            user: this.user,
            account: this.account,
            authenticated: true
          }
        };
      }

      return {
        success: false,
        message: 'Login failed - no data returned'
      };

    } catch (error) {
      if (error.response) {
        // Erro da API (400, 403, etc)
        return {
          success: false,
          status: error.response.status,
          message: error.response.data?.message || 'Invalid Username or Password',
          error: error.response.data
        };
      }

      // Erro de rede ou outro
      return {
        success: false,
        message: `Connection error: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Logout - Limpa sessão local
   */
  logout() {
    this.refreshToken = null;
    this.account = null;
    this.user = null;

    return {
      success: true,
      message: 'Logged out successfully'
    };
  }

  /**
   * Retorna token atual (Bearer Token é fixo)
   */
  getToken() {
    return {
      success: true,
      data: this.bearerToken,
      message: 'Bearer token retrieved',
      metadata: {
        bearerToken: this.bearerToken,
        apiDomain: this.apiDomain,
        refreshToken: this.refreshToken
      }
    };
  }

  /**
   * Retorna usuário atual
   */
  getUser() {
    return {
      success: !!this.user,
      data: this.user,
      message: this.user ? 'User data retrieved' : 'No user data available',
      metadata: {
        user: this.user,
        account: this.account
      }
    };
  }

  /**
   * Verifica se está autenticado
   * NOTA: Bearer Token é sempre válido (fixo na API)
   */
  isAuthenticated() {
    return {
      success: true,
      data: true, // Bearer token sempre disponível
      message: 'Authentication active',
      metadata: {
        authenticated: true,
        hasUser: !!this.user,
        hasAccount: !!this.account,
        bearerTokenActive: !!this.bearerToken
      }
    };
  }

  /**
   * Retorna headers com autenticação COMPLETOS para Confirm8
   * Inclui: Authorization Bearer + X-API-DOMAIN + X-APIKEY-TOKEN
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.bearerToken}`,
      'X-API-DOMAIN': this.apiDomain,
      'X-APIKEY-TOKEN': this.apiKeyToken,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Validação de parâmetros
   */
  validateParams(params, action) {
    if (action === 'login') {
      if (!params.username) {
        throw new Error('Parameter "username" is required for login');
      }
      if (!params.password) {
        throw new Error('Parameter "password" is required for login');
      }
    }
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
        {
          name: 'login',
          description: 'Authenticate user and get JWT token',
          params: ['username', 'password'],
          required: ['username', 'password']
        },
        {
          name: 'logout',
          description: 'Clear local session',
          params: [],
          required: []
        },
        {
          name: 'getToken',
          description: 'Get current JWT token',
          params: [],
          required: []
        },
        {
          name: 'getUser',
          description: 'Get current user information',
          params: [],
          required: []
        },
        {
          name: 'isAuthenticated',
          description: 'Check if user is authenticated',
          params: [],
          required: []
        }
      ],
      status: {
        authenticated: this.isAuthenticated().authenticated,
        hasUser: !!this.user
      }
    };
  }
}

export default Confirm8AuthTool;
