import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

export default tool({
  description: 'Gerencia tickets/ocorrências na API Confirm8 com operações em lote',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activateBatch', 'deactivateBatch'])
      .optional()
      .describe('Ação a executar'),
    ticket_id: tool.schema.string().optional().describe('ID do ticket'),
    ticket_ids: tool.schema.string().optional().describe('IDs dos tickets em JSON para lote'),
    content: tool.schema.string().optional().describe('Conteúdo/descrição do ticket'),
    subject: tool.schema.string().optional().describe('Assunto do ticket'),
    client_id: tool.schema.string().optional().describe('ID do cliente'),
    item_id: tool.schema.string().optional().describe('ID do item'),
    subject_id: tool.schema.string().optional().describe('ID do assunto'),
    category_id: tool.schema.string().optional().describe('ID da categoria'),
    priority_id: tool.schema.string().optional().describe('ID da prioridade'),
    status_id: tool.schema.string().optional().describe('ID do status'),
    owner_user_id: tool.schema.string().optional().describe('ID do usuário proprietário'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', ticket_id, ticket_ids: ticketIdsStr, content, subject, client_id, item_id, subject_id, category_id, priority_id, status_id, owner_user_id, filters: filtersStr, data: dataStr } = args

    try {
      let filters: any = {}
      let data: any = {}

      if (filtersStr) {
        try {
          filters = JSON.parse(filtersStr)
        } catch (e) {
          // Ignora
        }
      }
      if (dataStr) {
        try {
          data = JSON.parse(dataStr)
        } catch (e) {
          // Ignora
        }
      }

      if (content) data.content = content
      if (subject) data.subject = subject
      if (client_id) data.client_id = client_id
      if (item_id) data.item_id = item_id
      if (subject_id) data.subject_id = subject_id
      if (category_id) data.category_id = category_id
      if (priority_id) data.priority_id = priority_id
      if (status_id) data.status_id = status_id
      if (owner_user_id) data.owner_user_id = owner_user_id

      let result
      switch (action) {
        case 'create':
          if (!content) return JSON.stringify({ success: false, message: 'Conteúdo obrigatório' })
          result = (await axios.post(`${baseUrl}/tickets`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/tickets`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!ticket_id) return JSON.stringify({ success: false, message: 'ticket_id obrigatório' })
          result = (await axios.get(`${baseUrl}/tickets/${ticket_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!ticket_id) return JSON.stringify({ success: false, message: 'ticket_id obrigatório' })
          result = (await axios.put(`${baseUrl}/tickets/${ticket_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activateBatch': {
          if (!ticketIdsStr) return JSON.stringify({ success: false, message: 'ticket_ids obrigatório' })
          let ids: string[] = []
          try {
            ids = JSON.parse(ticketIdsStr)
          } catch (e) {
            ids = [ticketIdsStr]
          }
          result = (await axios.put(
            `${baseUrl}/tickets/batch/active`,
            { ids, deleted: 'N' },
            { headers: getAuthHeaders() }
          )).data
          break
        }
        case 'deactivateBatch': {
          if (!ticketIdsStr) return JSON.stringify({ success: false, message: 'ticket_ids obrigatório' })
          let ids: string[] = []
          try {
            ids = JSON.parse(ticketIdsStr)
          } catch (e) {
            ids = [ticketIdsStr]
          }
          result = (await axios.put(
            `${baseUrl}/tickets/batch/inactive`,
            { ids, deleted: 'Y' },
            { headers: getAuthHeaders() }
          )).data
          break
        }
        default:
          return JSON.stringify({ success: false, message: `Ação desconhecida: ${action}` })
      }

      return JSON.stringify({ success: true, data: result })
    } catch (error) {
      return JSON.stringify(handleError(error, action || 'operação'))
    }
  }
})
