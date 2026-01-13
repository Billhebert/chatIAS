import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

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
