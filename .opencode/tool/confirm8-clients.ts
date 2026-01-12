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
  description: 'Gerencia clientes na API Confirm8 (CRUD completo)',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    client_id: tool.schema
      .string()
      .optional()
      .describe('ID do cliente'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome do cliente'),
    email: tool.schema
      .string()
      .optional()
      .describe('Email do cliente'),
    phone: tool.schema
      .string()
      .optional()
      .describe('Telefone do cliente'),
    filters: tool.schema
      .string()
      .optional()
      .describe('Filtros em JSON para listagem'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON para create/update')
  },
  async execute(args) {
    const { action = 'list', client_id, name, email, phone, filters: filtersStr, data: dataStr } = args

    try {
      let filters: any = {}
      let data: any = {}

      if (filtersStr) {
        try {
          filters = JSON.parse(filtersStr)
        } catch (e) {
          // Usa como está
        }
      }

      if (dataStr) {
        try {
          data = JSON.parse(dataStr)
        } catch (e) {
          // Usa como está
        }
      }

      // Monta dados para create/update
      if (name || email || phone) {
        data = { ...data, name: name || data.name, email: email || data.email, phone: phone || data.phone }
      }

      let result
      switch (action) {
        case 'create': {
          if (!data || !data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome do cliente é obrigatório'
            })
          }
          const response = await axios.post(`${baseUrl}/clients`, data, { headers: getAuthHeaders() })
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const response = await axios.get(`${baseUrl}/clients`, { headers: getAuthHeaders(), params: filters })
          result = { success: true, count: response.data?.length || 0, data: response.data }
          break
        }
        case 'get': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.get(`${baseUrl}/clients/${client_id}`, { headers: getAuthHeaders() })
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.put(`${baseUrl}/clients/${client_id}`, data, { headers: getAuthHeaders() })
          result = { success: true, message: 'Cliente atualizado', data: response.data }
          break
        }
        case 'activate': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.put(
            `${baseUrl}/clients/${client_id}/active`,
            { deleted: 'N' },
            { headers: getAuthHeaders() }
          )
          result = { success: true, message: 'Cliente ativado', data: response.data }
          break
        }
        case 'deactivate': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.put(
            `${baseUrl}/clients/${client_id}/inactive`,
            { deleted: 'Y' },
            { headers: getAuthHeaders() }
          )
          result = { success: true, message: 'Cliente desativado', data: response.data }
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
