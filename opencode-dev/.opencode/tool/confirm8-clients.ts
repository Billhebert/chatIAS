import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { confirm8Config, getAuthHeaders, handleError } from './lib/confirm8-config'

const baseUrl = confirm8Config.baseUrl

export default tool({
  description: 'Gerencia clientes na API Confirm8 (CRUD completo)',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'activate', 'deactivate'])
      .optional()
      .describe('Ação CRUD a executar'),
    client_id: tool.schema
      .string()
      .optional()
      .describe('ID do cliente'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome do cliente'),
    email: tool.schema
      .string()
      .optional()
      .describe('Email do cliente'),
    phone: tool.schema
      .string()
      .optional()
      .describe('Telefone do cliente'),
    filters: tool.schema
      .string()
      .optional()
      .describe('Filtros em JSON para listagem'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON para create/update')
  },
  async execute(args) {
    const { action = 'list', client_id, name, email, phone, filters: filtersStr, data: dataStr } = args

    try {
      let filters: any = {}
      let data: any = {}

      if (filtersStr) {
        try {
          filters = JSON.parse(filtersStr)
        } catch (e) {
          // Usa como está
        }
      }

      if (dataStr) {
        try {
          data = JSON.parse(dataStr)
        } catch (e) {
          // Usa como está
        }
      }

      // Monta dados para create/update
      if (name || email || phone) {
        data = { ...data, name: name || data.name, email: email || data.email, phone: phone || data.phone }
      }

      let result
      switch (action) {
        case 'create': {
          if (!data || !data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome do cliente é obrigatório'
            })
          }
          const response = await axios.post(`${baseUrl}/clients`, data, { headers: getAuthHeaders() })
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const response = await axios.get(`${baseUrl}/clients?offset=0&limit=0&order=asc&relations=wos&relations=items&relations=headquarter&relations=userGroup&relations=properties`, { headers: getAuthHeaders(), params: filters })
          result = { success: true, count: response.data?.length || 0, data: response.data }
          break
        }
        case 'get': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.get(`${baseUrl}/clients/${client_id}?offset=0&limit=0&order=asc&relations=wos&relations=items&relations=headquarter&relations=userGroup&relations=properties`, { headers: getAuthHeaders() })
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.put(`${baseUrl}/clients/${client_id}`, data, { headers: getAuthHeaders() })
          result = { success: true, message: 'Cliente atualizado', data: response.data }
          break
        }
        case 'activate': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.put(
            `${baseUrl}/clients/${client_id}/active`,
            { deleted: 'N' },
            { headers: getAuthHeaders() }
          )
          result = { success: true, message: 'Cliente ativado', data: response.data }
          break
        }
        case 'deactivate': {
          if (!client_id) {
            return JSON.stringify({ success: false, message: 'client_id é obrigatório' })
          }
          const response = await axios.put(
            `${baseUrl}/clients/${client_id}/inactive`,
            { deleted: 'Y' },
            { headers: getAuthHeaders() }
          )
          result = { success: true, message: 'Cliente desativado', data: response.data }
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
