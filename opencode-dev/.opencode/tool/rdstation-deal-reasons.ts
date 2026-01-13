import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

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
