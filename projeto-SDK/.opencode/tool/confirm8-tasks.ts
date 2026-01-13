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
  description: 'Gerencia tarefas e checklists na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    task_id: tool.schema.string().optional().describe('ID da tarefa'),
    name: tool.schema.string().optional().describe('Nome da tarefa'),
    task_type: tool.schema.string().optional().describe('Tipo da tarefa'),
    estimated_time: tool.schema.string().optional().describe('Tempo estimado'),
    priority: tool.schema.number().optional().describe('Prioridade (padrão: 1)'),
    mandatory: tool.schema.string().optional().describe('Obrigatória (Y/N)'),
    editable: tool.schema.string().optional().describe('Editável (Y/N)'),
    multipliable: tool.schema.string().optional().describe('Multiplicável (Y/N)'),
    has_feedback: tool.schema.string().optional().describe('Tem feedback (Y/N)'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', task_id, name, task_type, estimated_time, priority = 1, mandatory, editable, multipliable, has_feedback, filters: filtersStr, data: dataStr } = args

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

      if (name) data.name = name
      if (task_type) data.task_type = task_type
      if (estimated_time) data.estimated_time = estimated_time
      if (priority) data.priority = priority
      if (mandatory) data.mandatory = mandatory
      if (editable) data.editable = editable
      if (multipliable) data.multipliable = multipliable
      if (has_feedback) data.has_feedback = has_feedback

      let result
      switch (action) {
        case 'create':
          if (!name) return JSON.stringify({ success: false, message: 'Nome obrigatório' })
          result = (await axios.post(`${baseUrl}/tasks`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/tasks`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!task_id) return JSON.stringify({ success: false, message: 'task_id obrigatório' })
          result = (await axios.get(`${baseUrl}/tasks/${task_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!task_id) return JSON.stringify({ success: false, message: 'task_id obrigatório' })
          result = (await axios.put(`${baseUrl}/tasks/${task_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activate':
          if (!task_id) return JSON.stringify({ success: false, message: 'task_id obrigatório' })
          result = (await axios.put(`${baseUrl}/tasks/${task_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivate':
          if (!task_id) return JSON.stringify({ success: false, message: 'task_id obrigatório' })
          result = (await axios.put(`${baseUrl}/tasks/${task_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
          break
        default:
          return JSON.stringify({ success: false, message: `Ação desconhecida: ${action}` })
      }

      return JSON.stringify({ success: true, data: result })
    } catch (error) {
      return JSON.stringify(handleError(error, action || 'operação'))
    }
  }
})
