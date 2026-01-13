import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

export default tool({
  description: 'Gerencia anotações/atividades no RD Station CRM - criar e listar anotações de negociações',
  args: {
    action: tool.schema
      .enum(['create', 'list'])
      .optional()
      .describe('Ação: create, list'),
    deal_id: tool.schema
      .string()
      .optional()
      .describe('ID da negociação (obrigatório)'),
    text: tool.schema
      .string()
      .optional()
      .describe('Texto da anotação'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página (max 200)'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { 
      action = 'list', 
      deal_id,
      text,
      page = 1,
      limit = 20,
      data: dataStr 
    } = args

    try {
      if (!deal_id) {
        return JSON.stringify({ success: false, message: 'deal_id é obrigatório para anotações' })
      }

      let data: any = {}

      if (dataStr) {
        try {
          data = JSON.parse(dataStr)
        } catch (e) {
          // Usa como está
        }
      }

      if (text) data.text = text

      let result
      switch (action) {
        case 'create': {
          if (!data.text) {
            return JSON.stringify({
              success: false,
              message: 'Texto da anotação é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl(`/deals/${deal_id}/activities`),
            { activity: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          const response = await axios.get(getUrl(`/deals/${deal_id}/activities`, params))
          result = { 
            success: true, 
            deal_id,
            page,
            limit,
            total: response.data.total || response.data.activities?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.activities || response.data
          }
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
