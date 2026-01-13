import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'

const baseUrl = 'https://crm.rdstation.com/api/v1'
const apiToken = process.env.RDSTATION_API_TOKEN || '684c0df9ab0fa6001e9745fd'

function getUrl(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${baseUrl}${endpoint}`)
  url.searchParams.set('token', apiToken)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

function handleError(error: any, action: string) {
  if (error.response) {
    return {
      success: false,
      status: error.response.status,
      action,
      message: error.response.data?.message || `Falha ao ${action}`,
      error: error.response.data
    }
  }
  return {
    success: false,
    action,
    message: `Erro de conexão: ${error.message}`
  }
}

export default tool({
  description: 'Gerencia usuários no RD Station CRM - listar e buscar usuários do sistema (somente leitura)',
  args: {
    action: tool.schema
      .enum(['list', 'get'])
      .optional()
      .describe('Ação: list, get'),
    user_id: tool.schema
      .string()
      .optional()
      .describe('ID do usuário'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página'),
    order: tool.schema
      .enum(['created_at', 'updated_at', 'name', 'email'])
      .optional()
      .describe('Campo para ordenação'),
    direction: tool.schema
      .enum(['asc', 'desc'])
      .optional()
      .describe('Direção da ordenação')
  },
  async execute(args) {
    const { 
      action = 'list', 
      user_id,
      page = 1,
      limit = 20,
      order,
      direction
    } = args

    try {
      let result
      switch (action) {
        case 'list': {
          const params: Record<string, any> = { page, limit }
          if (order) params.order = order
          if (direction) params.direction = direction
          
          const response = await axios.get(getUrl('/users', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.users?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.users || response.data
          }
          break
        }
        case 'get': {
          if (!user_id) {
            return JSON.stringify({ success: false, message: 'user_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/users/${user_id}`))
          result = { success: true, data: response.data }
          break
        }
        default:
          return JSON.stringify({ success: false, message: `Ação desconhecida: ${action}` })
      }

      return JSON.stringify(result)
    } catch (error) {
      return JSON.stringify(handleError(error, action || 'operação'))
    }
  }
})
