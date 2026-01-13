import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

export default tool({
  description: 'Gerencia produtos no RD Station CRM - criar, listar, buscar e atualizar catálogo de produtos',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update'])
      .optional()
      .describe('Ação: create, list, get, update'),
    product_id: tool.schema
      .string()
      .optional()
      .describe('ID do produto'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome do produto'),
    description: tool.schema
      .string()
      .optional()
      .describe('Descrição do produto'),
    base_price: tool.schema
      .number()
      .optional()
      .describe('Preço base do produto'),
    recurrence: tool.schema
      .enum(['none', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual'])
      .optional()
      .describe('Tipo de recorrência'),
    visible: tool.schema
      .enum(['true', 'false'])
      .optional()
      .describe('Produto visível?'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página (max 200)'),
    order: tool.schema
      .enum(['created_at', 'updated_at', 'name', 'base_price'])
      .optional()
      .describe('Campo para ordenação'),
    direction: tool.schema
      .enum(['asc', 'desc'])
      .optional()
      .describe('Direção da ordenação'),
    q: tool.schema
      .string()
      .optional()
      .describe('Busca por texto'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { 
      action = 'list', 
      product_id,
      name,
      description,
      base_price,
      recurrence,
      visible,
      page = 1,
      limit = 20,
      order,
      direction,
      q,
      data: dataStr 
    } = args

    try {
      let data: any = {}

      if (dataStr) {
        try {
          data = JSON.parse(dataStr)
        } catch (e) {
          // Usa como está
        }
      }

      // Monta dados para create/update
      if (name) data.name = name
      if (description) data.description = description
      if (base_price !== undefined) data.base_price = base_price
      if (recurrence) data.recurrence = recurrence
      if (visible !== undefined) data.visible = visible === 'true'

      let result
      switch (action) {
        case 'create': {
          if (!data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome do produto é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/products'),
            { product: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          if (order) params.order = order
          if (direction) params.direction = direction
          if (q) params.q = q
          
          const response = await axios.get(getUrl('/products', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.products?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.products || response.data
          }
          break
        }
        case 'get': {
          if (!product_id) {
            return JSON.stringify({ success: false, message: 'product_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/products/${product_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!product_id) {
            return JSON.stringify({ success: false, message: 'product_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/products/${product_id}`),
            { product: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Produto atualizado', data: response.data }
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
