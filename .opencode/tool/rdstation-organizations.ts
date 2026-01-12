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
  description: 'Gerencia empresas/organizações no RD Station CRM - criar, listar, buscar, atualizar e gerenciar contatos',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'listContacts'])
      .optional()
      .describe('Ação: create, list, get, update, listContacts'),
    organization_id: tool.schema
      .string()
      .optional()
      .describe('ID da empresa'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome da empresa'),
    legal_name: tool.schema
      .string()
      .optional()
      .describe('Razão social'),
    cnpj: tool.schema
      .string()
      .optional()
      .describe('CNPJ da empresa'),
    url: tool.schema
      .string()
      .optional()
      .describe('Website da empresa'),
    address: tool.schema
      .string()
      .optional()
      .describe('Endereço'),
    city: tool.schema
      .string()
      .optional()
      .describe('Cidade'),
    state: tool.schema
      .string()
      .optional()
      .describe('Estado'),
    country: tool.schema
      .string()
      .optional()
      .describe('País'),
    user_id: tool.schema
      .string()
      .optional()
      .describe('ID do usuário responsável'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página (max 200)'),
    order: tool.schema
      .enum(['created_at', 'updated_at', 'name'])
      .optional()
      .describe('Campo para ordenação'),
    direction: tool.schema
      .enum(['asc', 'desc'])
      .optional()
      .describe('Direção da ordenação'),
    q: tool.schema
      .string()
      .optional()
      .describe('Busca por texto'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { 
      action = 'list', 
      organization_id,
      name, 
      legal_name,
      cnpj,
      url,
      address,
      city,
      state,
      country,
      user_id,
      page = 1,
      limit = 20,
      order,
      direction,
      q,
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

      // Monta dados para create/update
      if (name) data.name = name
      if (legal_name) data.legal_name = legal_name
      if (cnpj) data.cnpj = cnpj
      if (url) data.url = url
      if (address) data.address = address
      if (city) data.city = city
      if (state) data.state = state
      if (country) data.country = country
      if (user_id) data.user_id = user_id

      let result
      switch (action) {
        case 'create': {
          if (!data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome da empresa é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/organizations'),
            { organization: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          if (order) params.order = order
          if (direction) params.direction = direction
          if (q) params.q = q
          if (user_id) params.user_id = user_id
          
          const response = await axios.get(getUrl('/organizations', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.organizations?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.organizations || response.data
          }
          break
        }
        case 'get': {
          if (!organization_id) {
            return JSON.stringify({ success: false, message: 'organization_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/organizations/${organization_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!organization_id) {
            return JSON.stringify({ success: false, message: 'organization_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/organizations/${organization_id}`),
            { organization: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Empresa atualizada', data: response.data }
          break
        }
        case 'listContacts': {
          if (!organization_id) {
            return JSON.stringify({ success: false, message: 'organization_id é obrigatório' })
          }
          const params: Record<string, any> = { page, limit }
          const response = await axios.get(getUrl(`/organizations/${organization_id}/contacts`, params))
          result = { 
            success: true, 
            organization_id,
            page,
            limit,
            data: response.data.contacts || response.data
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
