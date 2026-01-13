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
  description: 'Gerencia propriedades na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    property_id: tool.schema.string().optional().describe('ID da propriedade'),
    property: tool.schema.string().optional().describe('Nome da propriedade'),
    type: tool.schema
      .enum(['text', 'number', 'date', 'select', 'checkbox', 'textarea'])
      .optional()
      .describe('Tipo da propriedade'),
    description: tool.schema.string().optional().describe('Descrição da propriedade'),
    options: tool.schema.string().optional().describe('Opções em JSON (para tipo select)'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', property_id, property, type = 'text', description, options: optionsStr, filters: filtersStr, data: dataStr } = args

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

      if (property) data.property = property
      if (type) data.type = type
      if (description) data.description = description
      if (optionsStr) {
        try {
          data.options = JSON.parse(optionsStr)
        } catch (e) {
          data.options = optionsStr
        }
      }

      let result
      switch (action) {
        case 'create':
          if (!property) return JSON.stringify({ success: false, message: 'Propriedade obrigatória' })
          result = (await axios.post(`${baseUrl}/properties`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/properties`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!property_id) return JSON.stringify({ success: false, message: 'property_id obrigatório' })
          result = (await axios.get(`${baseUrl}/properties/${property_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!property_id) return JSON.stringify({ success: false, message: 'property_id obrigatório' })
          result = (await axios.put(`${baseUrl}/properties/${property_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activate':
          if (!property_id) return JSON.stringify({ success: false, message: 'property_id obrigatório' })
          result = (await axios.patch(`${baseUrl}/properties/${property_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivate':
          if (!property_id) return JSON.stringify({ success: false, message: 'property_id obrigatório' })
          result = (await axios.patch(`${baseUrl}/properties/${property_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
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
