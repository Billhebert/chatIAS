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
  description: 'Gerencia usuários, tarefas, permissões, fotos e assinaturas na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate', 'getTasks', 'getTickets', 'linkTasks', 'unlinkTasks', 'unlinkAllTasks', 'getPermissions', 'uploadPhoto', 'uploadSignature'])
      .optional()
      .describe('Ação a executar'),
    user_id: tool.schema.string().optional().describe('ID do usuário'),
    username: tool.schema.string().optional().describe('Nome de usuário'),
    password: tool.schema.string().optional().describe('Senha'),
    name: tool.schema.string().optional().describe('Nome completo'),
    email: tool.schema.string().optional().describe('Email'),
    phone: tool.schema.string().optional().describe('Telefone'),
    employee_id: tool.schema.string().optional().describe('ID do colaborador'),
    task_id: tool.schema.string().optional().describe('ID da tarefa'),
    image_url: tool.schema.string().optional().describe('URL da imagem para upload'),
    tasks: tool.schema.string().optional().describe('Tarefas em JSON para linkTasks'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', user_id, username, password, name, email, phone, employee_id, task_id, image_url, tasks: tasksStr, filters: filtersStr, data: dataStr } = args

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

      let result
      switch (action) {
        case 'create': {
          if (!username || !password) {
            return JSON.stringify({ success: false, message: 'Username e password obrigatórios' })
          }
          data = { username, password, name, email, phone, ...data }
          result = (await axios.post(`${baseUrl}/users`, data, { headers: getAuthHeaders() })).data
          break
        }
        case 'list': {
          const response = await axios.get(`${baseUrl}/users`, { headers: getAuthHeaders(), params: filters })
          result = { count: response.data?.length || 0, users: response.data }
          break
        }
        case 'get': {
          const identifier = user_id || username
          if (!identifier) return JSON.stringify({ success: false, message: 'user_id ou username obrigatório' })
          const isNumeric = !isNaN(parseInt(identifier))
          const endpoint = isNumeric ? `${baseUrl}/users/${identifier}` : `${baseUrl}/users/${identifier}/user`
          result = (await axios.get(endpoint, { headers: getAuthHeaders() })).data
          break
        }
        case 'update': {
          if (!user_id) return JSON.stringify({ success: false, message: 'user_id obrigatório' })
          if (name) data.name = name
          if (email) data.email = email
          if (phone) data.phone = phone
          result = (await axios.put(`${baseUrl}/users/${user_id}`, data, { headers: getAuthHeaders() })).data
          break
        }
        case 'activate': {
          if (!user_id) return JSON.stringify({ success: false, message: 'user_id obrigatório' })
          result = (await axios.put(`${baseUrl}/users/${user_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        }
        case 'deactivate': {
          if (!user_id) return JSON.stringify({ success: false, message: 'user_id obrigatório' })
          result = (await axios.put(`${baseUrl}/users/${user_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
          break
        }
        case 'getTasks': {
          if (!user_id) return JSON.stringify({ success: false, message: 'user_id obrigatório' })
          result = (await axios.get(`${baseUrl}/users/${user_id}/tasks`, { headers: getAuthHeaders() })).data
          break
        }
        case 'getTickets': {
          if (!user_id) return JSON.stringify({ success: false, message: 'user_id obrigatório' })
          result = (await axios.get(`${baseUrl}/users/${user_id}/tickets`, { headers: getAuthHeaders() })).data
          break
        }
        case 'linkTasks': {
          if (!tasksStr) return JSON.stringify({ success: false, message: 'tasks obrigatório' })
          let tasks: any[] = []
          try {
            tasks = JSON.parse(tasksStr)
          } catch (e) {
            return JSON.stringify({ success: false, message: 'tasks deve ser um JSON válido' })
          }
          result = (await axios.post(`${baseUrl}/users/link-tasks`, { tasks }, { headers: getAuthHeaders() })).data
          break
        }
        case 'unlinkTasks': {
          if (!employee_id || !user_id || !task_id) {
            return JSON.stringify({ success: false, message: 'employee_id, user_id e task_id obrigatórios' })
          }
          result = (await axios.put(
            `${baseUrl}/users/${user_id}/tasks/${task_id}`,
            { employee_id },
            { headers: getAuthHeaders() }
          )).data
          break
        }
        case 'unlinkAllTasks': {
          if (!employee_id) return JSON.stringify({ success: false, message: 'employee_id obrigatório' })
          result = (await axios.delete(`${baseUrl}/users/${employee_id}/tasks`, { headers: getAuthHeaders() })).data
          break
        }
        case 'getPermissions': {
          if (!user_id) return JSON.stringify({ success: false, message: 'user_id obrigatório' })
          result = (await axios.get(`${baseUrl}/users/${user_id}/permissions`, { headers: getAuthHeaders() })).data
          break
        }
        case 'uploadPhoto': {
          if (!user_id || !image_url) return JSON.stringify({ success: false, message: 'user_id e image_url obrigatórios' })
          result = (await axios.post(`${baseUrl}/users/${user_id}/photo`, { image_url }, { headers: getAuthHeaders() })).data
          break
        }
        case 'uploadSignature': {
          if (!user_id || !image_url) return JSON.stringify({ success: false, message: 'user_id e image_url obrigatórios' })
          result = (await axios.post(`${baseUrl}/users/${user_id}/signature`, { image_url }, { headers: getAuthHeaders() })).data
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
