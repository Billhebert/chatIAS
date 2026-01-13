import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'

const baseUrl = 'https://crm.rdstation.com/api/v1'
const apiToken = process.env.RDSTATION_API_TOKEN || '684c0df9ab0fa6001e9745fd'

function getUrl(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${baseUrl}${endpoint}`)
  url.searchParams.set('token', apiToken)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
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
  description: 'Gerencia campanhas de marketing no RD Station CRM - criar, listar, buscar e atualizar',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update'])
      .optional()
      .describe('Ação: create, list, get, update'),
    campaign_id: tool.schema
      .string()
      .optional()
      .describe('ID da campanha'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome da campanha'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página'),
    order: tool.schema
      .enum(['created_at', 'updated_at', 'name'])
      .optional()
      .describe('Campo para ordenação'),
    direction: tool.schema
      .enum(['asc', 'desc'])
      .optional()
      .describe('Direção da ordenação'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { 
      action = 'list', 
      campaign_id,
      name,
      page = 1,
      limit = 20,
      order,
      direction,
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

      if (name) data.name = name

      let result
      switch (action) {
        case 'create': {
          if (!data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome da campanha é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/campaigns'),
            { campaign: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          if (order) params.order = order
          if (direction) params.direction = direction
          
          const response = await axios.get(getUrl('/campaigns', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.campaigns?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.campaigns || response.data
          }
          break
        }
        case 'get': {
          if (!campaign_id) {
            return JSON.stringify({ success: false, message: 'campaign_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/campaigns/${campaign_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!campaign_id) {
            return JSON.stringify({ success: false, message: 'campaign_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/campaigns/${campaign_id}`),
            { campaign: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Campanha atualizada', data: response.data }
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
