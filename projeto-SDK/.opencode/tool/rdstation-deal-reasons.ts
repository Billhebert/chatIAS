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
  description: 'Gerencia motivos de perda de negociação no RD Station CRM - criar, listar, buscar e atualizar',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update'])
      .optional()
      .describe('Ação: create, list, get, update'),
    reason_id: tool.schema
      .string()
      .optional()
      .describe('ID do motivo de perda'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome do motivo'),
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
      reason_id,
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
              message: 'Nome do motivo é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/deal_lost_reasons'),
            { deal_lost_reason: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          const response = await axios.get(getUrl('/deal_lost_reasons', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.deal_lost_reasons?.length || 0,
            data: response.data.deal_lost_reasons || response.data
          }
          break
        }
        case 'get': {
          if (!reason_id) {
            return JSON.stringify({ success: false, message: 'reason_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/deal_lost_reasons/${reason_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!reason_id) {
            return JSON.stringify({ success: false, message: 'reason_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/deal_lost_reasons/${reason_id}`),
            { deal_lost_reason: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Motivo atualizado', data: response.data }
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
