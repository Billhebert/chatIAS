import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

export default tool({
  description: 'Gerencia modalidades na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    modality_id: tool.schema.string().optional().describe('ID da modalidade'),
    modality: tool.schema.string().optional().describe('Nome da modalidade'),
    modality_color: tool.schema.string().optional().describe('Cor em formato hex (#RRGGBB)'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', modality_id, modality, modality_color, filters: filtersStr, data: dataStr } = args

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

      if (modality) data.modality = modality
      if (modality_color) data.modality_color = modality_color

      let result
      switch (action) {
        case 'create':
          if (!modality) return JSON.stringify({ success: false, message: 'Modalidade obrigatória' })
          result = (await axios.post(`${baseUrl}/modalities`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/modalities`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!modality_id) return JSON.stringify({ success: false, message: 'modality_id obrigatório' })
          result = (await axios.get(`${baseUrl}/modalities/${modality_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!modality_id) return JSON.stringify({ success: false, message: 'modality_id obrigatório' })
          result = (await axios.put(`${baseUrl}/modalities/${modality_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activate':
          if (!modality_id) return JSON.stringify({ success: false, message: 'modality_id obrigatório' })
          result = (await axios.put(`${baseUrl}/modalities/${modality_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivate':
          if (!modality_id) return JSON.stringify({ success: false, message: 'modality_id obrigatório' })
          result = (await axios.put(`${baseUrl}/modalities/${modality_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
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
