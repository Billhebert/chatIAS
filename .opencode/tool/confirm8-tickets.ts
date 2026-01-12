import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'

const baseUrl = process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3'
const bearerToken = process.env.CONFIRM8_BEARER_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjo4LCJ0b2tlbiI6IiQyYiQxMCRYWS9zYncycUJjYUl5R1g3eXlvMXJlIiwiaWF0IjoxNzU5MTE2NDg1fQ.YLwDzggLa56F4as9ehaGOnXgWOUFfgyogZVLcW9c2os'
const apiDomain = process.env.CONFIRM8_API_DOMAIN || 'suatec'
const apiKeyToken = process.env.CONFIRM8_APIKEY_TOKEN || '$2b$10$XY/sbw2qBcaIyGX7yyo1re'

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${bearerToken}`,
    'X-API-DOMAIN': apiDomain,
    'X-APIKEY-TOKEN': apiKeyToken,
    'Content-Type': 'application/json'
  }
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
