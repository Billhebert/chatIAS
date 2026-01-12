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
  description: 'Gerencia fontes de negociação no RD Station CRM - criar, listar, buscar e atualizar',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update'])
      .optional()
      .describe('Ação: create, list, get, update'),
    source_id: tool.schema
      .string()
      .optional()
      .describe('ID da fonte'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome da fonte'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { 
      action = 'list', 
      source_id,
      name,
      page = 1,
      limit = 20,
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
              message: 'Nome da fonte é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/deal_sources'),
            { deal_source: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          const response = await axios.get(getUrl('/deal_sources', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.deal_sources?.length || 0,
            data: response.data.deal_sources || response.data
          }
          break
        }
        case 'get': {
          if (!source_id) {
            return JSON.stringify({ success: false, message: 'source_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/deal_sources/${source_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!source_id) {
            return JSON.stringify({ success: false, message: 'source_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/deal_sources/${source_id}`),
            { deal_source: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Fonte atualizada', data: response.data }
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
