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
  description: 'Gerencia contatos (pessoas) no RD Station CRM - criar, listar, buscar e atualizar',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update'])
      .optional()
      .describe('Ação a executar: create, list, get, update'),
    contact_id: tool.schema
      .string()
      .optional()
      .describe('ID do contato (para get/update)'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome do contato'),
    title: tool.schema
      .string()
      .optional()
      .describe('Cargo do contato'),
    email: tool.schema
      .string()
      .optional()
      .describe('Email do contato'),
    phone: tool.schema
      .string()
      .optional()
      .describe('Telefone do contato'),
    organization_id: tool.schema
      .string()
      .optional()
      .describe('ID da empresa associada'),
    page: tool.schema
      .number()
      .optional()
      .describe('Número da página (paginação)'),
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
      .describe('Busca por texto (nome, email, telefone)'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON para create/update')
  },
  async execute(args) {
    const { 
      action = 'list', 
      contact_id, 
      name, 
      title,
      email, 
      phone,
      organization_id,
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
      if (title) data.title = title
      if (email) data.email = email
      if (phone) data.phone = phone
      if (organization_id) data.organization_id = organization_id

      let result
      switch (action) {
        case 'create': {
          if (!data.name) {
            return JSON.stringify({
              success: false,
              message: 'Nome do contato é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/contacts'),
            { contact: data },
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
          
          const response = await axios.get(getUrl('/contacts', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.contacts?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.contacts || response.data
          }
          break
        }
        case 'get': {
          if (!contact_id) {
            return JSON.stringify({ success: false, message: 'contact_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/contacts/${contact_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!contact_id) {
            return JSON.stringify({ success: false, message: 'contact_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/contacts/${contact_id}`),
            { contact: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Contato atualizado', data: response.data }
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
