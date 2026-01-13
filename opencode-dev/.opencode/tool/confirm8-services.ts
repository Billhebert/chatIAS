import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

export default tool({
  description: 'Gerencia serviços/levantamentos na API Confirm8',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    service_id: tool.schema.string().optional().describe('ID do serviço'),
    task_id: tool.schema.string().optional().describe('ID da tarefa'),
    name: tool.schema.string().optional().describe('Nome do serviço'),
    info: tool.schema.string().optional().describe('Informações/descrição'),
    mandatory: tool.schema.string().optional().describe('Obrigatório (Y/N)'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'list', service_id, task_id, name, info, mandatory, filters: filtersStr, data: dataStr } = args

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
      if (task_id) data.task_id = task_id
      if (info) data.info = info
      if (mandatory) data.mandatory = mandatory

      let result
      switch (action) {
        case 'create':
          if (!name) return JSON.stringify({ success: false, message: 'Nome obrigatório' })
          result = (await axios.post(`${baseUrl}/services`, data, { headers: getAuthHeaders() })).data
          break
        case 'list':
          result = (await axios.get(`${baseUrl}/services`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'get':
          if (!service_id) return JSON.stringify({ success: false, message: 'service_id obrigatório' })
          result = (await axios.get(`${baseUrl}/services/${service_id}`, { headers: getAuthHeaders() })).data
          break
        case 'update':
          if (!service_id) return JSON.stringify({ success: false, message: 'service_id obrigatório' })
          result = (await axios.put(`${baseUrl}/services/${service_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activate':
          if (!service_id) return JSON.stringify({ success: false, message: 'service_id obrigatório' })
          result = (await axios.put(`${baseUrl}/services/${service_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivate':
          if (!service_id) return JSON.stringify({ success: false, message: 'service_id obrigatório' })
          result = (await axios.put(`${baseUrl}/services/${service_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
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
