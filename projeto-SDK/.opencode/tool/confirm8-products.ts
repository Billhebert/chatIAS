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
  description: 'Gerencia produtos/insumos na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    product_id: tool.schema.string().optional().describe('ID do produto'),
    name: tool.schema.string().optional().describe('Nome do produto'),
    category: tool.schema
      .enum(['consumable', 'nonconsumable'])
      .optional()
      .describe('Categoria (consumable ou nonconsumable)'),
    price: tool.schema.number().optional().describe('Preço do produto'),
    stock: tool.schema.number().optional().describe('Quantidade em estoque'),
    description: tool.schema.string().optional().describe('Descrição do produto'),
    external_id: tool.schema.string().optional().describe('ID externo'),
    integration_id: tool.schema.string().optional().describe('ID de integração'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', product_id, name, category, price, stock, description, external_id, integration_id, filters: filtersStr, data: dataStr } = args

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
      if (category) data.category = category
      if (price !== undefined) data.price = price
      if (stock !== undefined) data.stock = stock
      if (description) data.description = description
      if (external_id) data.external_id = external_id
      if (integration_id) data.integration_id = integration_id

      let result
      switch (action) {
        case 'create':
          if (!name) return JSON.stringify({ success: false, message: 'Nome obrigatório' })
          result = (await axios.post(`${baseUrl}/products`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/products`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!product_id) return JSON.stringify({ success: false, message: 'product_id obrigatório' })
          result = (await axios.get(`${baseUrl}/products/${product_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!product_id) return JSON.stringify({ success: false, message: 'product_id obrigatório' })
          result = (await axios.put(`${baseUrl}/products/${product_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activate':
          if (!product_id) return JSON.stringify({ success: false, message: 'product_id obrigatório' })
          result = (await axios.put(`${baseUrl}/products/${product_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivate':
          if (!product_id) return JSON.stringify({ success: false, message: 'product_id obrigatório' })
          result = (await axios.put(`${baseUrl}/products/${product_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
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
