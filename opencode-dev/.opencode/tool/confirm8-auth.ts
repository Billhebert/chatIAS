import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

// Estado compartilhado
let authState = {
  user: null as any,
  account: null as any,
  refreshToken: null as string | null
}

export default tool({
  description: 'Autentica usuário na API Confirm8 e gerencia tokens JWT',
  args: {
    action: tool.schema
      .enum(['login', 'logout', 'getToken', 'getUser', 'isAuthenticated'])
      .optional()
      .describe('Ação a executar (padrão: login)'),
    username: tool.schema
      .string()
      .optional()
      .describe('Nome de usuário (obrigatório para login)'),
    password: tool.schema
      .string()
      .optional()
      .describe('Senha (obrigatório para login)')
  },
  async execute(args) {
    const { action = 'login', username, password } = args

    try {
      switch (action) {
        case 'login':
          if (!username || !password) {
            return JSON.stringify({
              success: false,
              message: 'Username e password são obrigatórios para login'
            })
          }
          return JSON.stringify(await login(username, password))
        case 'logout':
          return JSON.stringify(logout())
        case 'getToken':
          return JSON.stringify(getToken())
        case 'getUser':
          return JSON.stringify(getUser())
        case 'isAuthenticated':
          return JSON.stringify(isAuthenticated())
        default:
          return JSON.stringify({
            success: false,
            message: `Ação desconhecida: ${action}`
          })
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        message: `Erro: ${(error as any).message}`
      })
    }
  }
})

async function login(username: string, password: string) {
  try {
    const response = await axios.post(
      `${baseUrl}/login`,
      { username, password },
      { headers: getAuthHeaders() }
    )

    if (response.status === 200 && response.data) {
      if (response.data.refreshToken) {
        authState.refreshToken = response.data.refreshToken
      }
      if (response.data.account) {
        authState.account = response.data.account
      }
      if (response.data.user) {
        authState.user = response.data.user
      }

      return {
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: authState.user,
          account: authState.account,
          authenticated: true
        }
      }
    }

    return {
      success: false,
      message: 'Login falhou - sem dados retornados'
    }
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        status: error.response.status,
        message: error.response.data?.message || 'Usuário ou senha inválidos',
        error: error.response.data
      }
    }

    return {
      success: false,
      message: `Erro de conexão: ${error.message}`,
      error: error.message
    }
  }
}

function logout() {
  authState.refreshToken = null
  authState.account = null
  authState.user = null

  return {
    success: true,
    message: 'Logout realizado com sucesso'
  }
}

function getToken() {
  return {
    success: true,
    data: confirm8Config.bearerToken,
    message: 'Bearer token recuperado',
    metadata: {
      bearerToken: confirm8Config.bearerToken,
      apiDomain: confirm8Config.apiDomain,
      refreshToken: authState.refreshToken
    }
  }
}

function getUser() {
  return {
    success: !!authState.user,
    data: authState.user,
    message: authState.user ? 'Dados do usuário recuperados' : 'Sem dados do usuário disponível',
    metadata: {
      user: authState.user,
      account: authState.account
    }
  }
}

function isAuthenticated() {
  return {
    success: true,
    data: true,
    message: 'Autenticação ativa',
    metadata: {
      authenticated: true,
      hasUser: !!authState.user,
      hasAccount: !!authState.account,
      bearerTokenActive: !!confirm8Config.bearerToken
    }
  }
}
