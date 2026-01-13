import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

export default tool({
  description: 'Gerencia itens e tipos de itens na API Confirm8',
  args: {
    action: tool.schema
      .enum(['createItem', 'listItems', 'getItem', 'updateItem', 'activateItem', 'deactivateItem', 'createItemType', 'listItemTypes', 'getItemType', 'updateItemType', 'activateItemType', 'deactivateItemType'])
      .optional()
      .describe('Ação a executar'),
    item_id: tool.schema.string().optional().describe('ID do item'),
    item_type_id: tool.schema.string().optional().describe('ID do tipo de item'),
    name: tool.schema.string().optional().describe('Nome do item/tipo'),
    info: tool.schema.string().optional().describe('Informações/descrição'),
    filters: tool.schema.string().optional().describe('Filtros em JSON'),
    data: tool.schema.string().optional().describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { action = 'listItems', item_id, item_type_id, name, info, filters: filtersStr, data: dataStr } = args

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
      if (info) data.info = info

      let result
      switch (action) {
        case 'createItem':
          if (!name) return JSON.stringify({ success: false, message: 'Nome obrigatório' })
          result = (await axios.post(`${baseUrl}/items`, data, { headers: getAuthHeaders() })).data
          break
        case 'listItems':
          result = (await axios.get(`${baseUrl}/items`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'getItem':
          if (!item_id) return JSON.stringify({ success: false, message: 'item_id obrigatório' })
          result = (await axios.get(`${baseUrl}/items/${item_id}`, { headers: getAuthHeaders() })).data
          break
        case 'updateItem':
          if (!item_id) return JSON.stringify({ success: false, message: 'item_id obrigatório' })
          result = (await axios.put(`${baseUrl}/items/${item_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activateItem':
          if (!item_id) return JSON.stringify({ success: false, message: 'item_id obrigatório' })
          result = (await axios.put(`${baseUrl}/items/${item_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivateItem':
          if (!item_id) return JSON.stringify({ success: false, message: 'item_id obrigatório' })
          result = (await axios.put(`${baseUrl}/items/${item_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
          break
        case 'createItemType':
          if (!name) return JSON.stringify({ success: false, message: 'Nome obrigatório' })
          result = (await axios.post(`${baseUrl}/item-types`, data, { headers: getAuthHeaders() })).data
          break
        case 'listItemTypes':
          result = (await axios.get(`${baseUrl}/item-types`, { headers: getAuthHeaders(), params: filters })).data
          break
        case 'getItemType':
          if (!item_type_id) return JSON.stringify({ success: false, message: 'item_type_id obrigatório' })
          result = (await axios.get(`${baseUrl}/item-types/${item_type_id}`, { headers: getAuthHeaders() })).data
          break
        case 'updateItemType':
          if (!item_type_id) return JSON.stringify({ success: false, message: 'item_type_id obrigatório' })
          result = (await axios.put(`${baseUrl}/item-types/${item_type_id}`, data, { headers: getAuthHeaders() })).data
          break
        case 'activateItemType':
          if (!item_type_id) return JSON.stringify({ success: false, message: 'item_type_id obrigatório' })
          result = (await axios.put(`${baseUrl}/item-types/${item_type_id}/active`, { deleted: 'N' }, { headers: getAuthHeaders() })).data
          break
        case 'deactivateItemType':
          if (!item_type_id) return JSON.stringify({ success: false, message: 'item_type_id obrigatório' })
          result = (await axios.put(`${baseUrl}/item-types/${item_type_id}/inactive`, { deleted: 'Y' }, { headers: getAuthHeaders() })).data
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
