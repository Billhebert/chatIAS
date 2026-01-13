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
  description: 'Gerencia equipes no RD Station CRM - listar e buscar equipes (somente leitura)',
  args: {
    action: tool.schema
      .enum(['list', 'get'])
      .optional()
      .describe('Ação: list, get'),
    team_id: tool.schema
      .string()
      .optional()
      .describe('ID da equipe'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página')
  },
  async execute(args) {
    const { 
      action = 'list', 
      team_id,
      page = 1,
      limit = 20
    } = args

    try {
      let result
      switch (action) {
        case 'list': {
          const params: Record<string, any> = { page, limit }
          const response = await axios.get(getUrl('/teams', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.teams?.length || 0,
            data: response.data.teams || response.data
          }
          break
        }
        case 'get': {
          if (!team_id) {
            return JSON.stringify({ success: false, message: 'team_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/teams/${team_id}`))
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
