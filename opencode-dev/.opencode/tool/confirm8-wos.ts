import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

export default tool({
  description: 'Gerencia ordens de serviço (WOS) na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    wos_id: tool.schema.string().optional().describe('ID da ordem de serviço'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', wos_id, filters: filtersStr, data: dataStr } = args

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

      let result
      switch (action) {
        case 'create':
          result = (await axios.post(`${baseUrl}/wos`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/wos`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!wos_id) return JSON.stringify({ success: false, message: 'wos_id obrigatório' })
          result = (await axios.get(`${baseUrl}/wos/${wos_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!wos_id) return JSON.stringify({ success: false, message: 'wos_id obrigatório' })
          result = (await axios.put(`${baseUrl}/wos/${wos_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activate':
          if (!wos_id) return JSON.stringify({ success: false, message: 'wos_id obrigatório' })
          result = (await axios.put(`${baseUrl}/wos/${wos_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivate':
          if (!wos_id) return JSON.stringify({ success: false, message: 'wos_id obrigatório' })
          result = (await axios.put(`${baseUrl}/wos/${wos_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
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
