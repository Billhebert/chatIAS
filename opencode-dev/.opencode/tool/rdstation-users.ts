import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

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
