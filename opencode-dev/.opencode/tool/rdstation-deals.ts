import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

export default tool({
  description: 'Gerencia negociações (deals) no RD Station CRM - criar, listar, buscar, atualizar e gerenciar produtos da negociação',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'listProducts', 'addProduct', 'updateProduct', 'removeProduct'])
      .optional()
      .describe('Ação: create, list, get, update, listProducts, addProduct, updateProduct, removeProduct'),
    deal_id: tool.schema
      .string()
      .optional()
      .describe('ID da negociação'),
    deal_product_id: tool.schema
      .string()
      .optional()
      .describe('ID do produto na negociação (para updateProduct/removeProduct)'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome da negociação'),
    amount: tool.schema
      .number()
      .optional()
      .describe('Valor total da negociação'),
    deal_stage_id: tool.schema
      .string()
      .optional()
      .describe('ID da etapa do funil'),
    deal_source_id: tool.schema
      .string()
      .optional()
      .describe('ID da fonte'),
    user_id: tool.schema
      .string()
      .optional()
      .describe('ID do usuário responsável'),
    organization_id: tool.schema
      .string()
      .optional()
      .describe('ID da empresa'),
    contact_id: tool.schema
      .string()
      .optional()
      .describe('ID do contato principal'),
    campaign_id: tool.schema
      .string()
      .optional()
      .describe('ID da campanha'),
    product_id: tool.schema
      .string()
      .optional()
      .describe('ID do produto (para addProduct)'),
    product_price: tool.schema
      .number()
      .optional()
      .describe('Preço do produto na negociação'),
    product_quantity: tool.schema
      .number()
      .optional()
      .describe('Quantidade do produto'),
    win: tool.schema
      .enum(['true', 'false', 'null'])
      .optional()
      .describe('Status: true=ganho, false=perdido, null=em andamento'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página (max 200)'),
    order: tool.schema
      .enum(['created_at', 'updated_at', 'name', 'amount', 'rating'])
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
      deal_id,
      deal_product_id,
      name, 
      amount,
      deal_stage_id,
      deal_source_id,
      user_id,
      organization_id,
      contact_id,
      campaign_id,
      product_id,
      product_price,
      product_quantity,
      win,
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
      if (amount !== undefined) data.amount = amount
      if (deal_stage_id) data.deal_stage_id = deal_stage_id
      if (deal_source_id) data.deal_source_id = deal_source_id
      if (user_id) data.user_id = user_id
      if (organization_id) data.organization_id = organization_id
      if (contact_id) data.contact_id = contact_id
      if (campaign_id) data.campaign_id = campaign_id
      if (win !== undefined) {
        data.win = win === 'true' ? true : win === 'false' ? false : null
      }

      let result
      switch (action) {
        case 'create': {
          if (!data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome da negociação é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/deals'),
            { deal: data },
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
          if (win !== undefined) params.win = win
          if (deal_stage_id) params.deal_stage_id = deal_stage_id
          if (user_id) params.user_id = user_id
          
          const response = await axios.get(getUrl('/deals', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.deals?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.deals || response.data
          }
          break
        }
        case 'get': {
          if (!deal_id) {
            return JSON.stringify({ success: false, message: 'deal_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/deals/${deal_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!deal_id) {
            return JSON.stringify({ success: false, message: 'deal_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/deals/${deal_id}`),
            { deal: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Negociação atualizada', data: response.data }
          break
        }
        case 'listProducts': {
          if (!deal_id) {
            return JSON.stringify({ success: false, message: 'deal_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/deals/${deal_id}/deal_products`))
          result = { 
            success: true, 
            deal_id,
            data: response.data.deal_products || response.data
          }
          break
        }
        case 'addProduct': {
          if (!deal_id) {
            return JSON.stringify({ success: false, message: 'deal_id é obrigatório' })
          }
          if (!product_id) {
            return JSON.stringify({ success: false, message: 'product_id é obrigatório' })
          }
          const productData: any = { product_id }
          if (product_price !== undefined) productData.price = product_price
          if (product_quantity !== undefined) productData.amount = product_quantity
          
          const response = await axios.post(
            getUrl(`/deals/${deal_id}/deal_products`),
            { deal_product: productData },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Produto adicionado à negociação', data: response.data }
          break
        }
        case 'updateProduct': {
          if (!deal_id) {
            return JSON.stringify({ success: false, message: 'deal_id é obrigatório' })
          }
          if (!deal_product_id) {
            return JSON.stringify({ success: false, message: 'deal_product_id é obrigatório' })
          }
          const productData: any = {}
          if (product_price !== undefined) productData.price = product_price
          if (product_quantity !== undefined) productData.amount = product_quantity
          
          const response = await axios.put(
            getUrl(`/deals/${deal_id}/deal_products/${deal_product_id}`),
            { deal_product: productData },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Produto atualizado na negociação', data: response.data }
          break
        }
        case 'removeProduct': {
          if (!deal_id) {
            return JSON.stringify({ success: false, message: 'deal_id é obrigatório' })
          }
          if (!deal_product_id) {
            return JSON.stringify({ success: false, message: 'deal_product_id é obrigatório' })
          }
          await axios.delete(getUrl(`/deals/${deal_id}/deal_products/${deal_product_id}`))
          result = { success: true, message: 'Produto removido da negociação' }
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
