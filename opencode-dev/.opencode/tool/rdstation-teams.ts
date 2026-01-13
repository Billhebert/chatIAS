import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

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
