import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

export default tool({
  description: 'Gerencia campos personalizados no RD Station CRM - criar, listar, buscar, atualizar e deletar',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update', 'delete'])
      .optional()
      .describe('Ação: create, list, get, update, delete'),
    custom_field_id: tool.schema
      .string()
      .optional()
      .describe('ID do campo personalizado'),
    label: tool.schema
      .string()
      .optional()
      .describe('Rótulo do campo'),
    field_type: tool.schema
      .enum(['text', 'text_area', 'integer', 'decimal', 'boolean', 'email_field', 'phone_field', 'url_field', 'selection', 'multi_selection', 'date_time'])
      .optional()
      .describe('Tipo do campo'),
    entity_type: tool.schema
      .enum(['Deal', 'Contact', 'Organization'])
      .optional()
      .describe('Entidade associada'),
    required: tool.schema
      .enum(['true', 'false'])
      .optional()
      .describe('Campo obrigatório?'),
    options: tool.schema
      .string()
      .optional()
      .describe('Opções para selection/multi_selection (JSON array)'),
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
      custom_field_id,
      label,
      field_type,
      entity_type,
      required,
      options,
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

      // Monta dados para create/update
      if (label) data.label = label
      if (field_type) data.field_type = field_type
      if (entity_type) data.entity_type = entity_type
      if (required !== undefined) data.required = required === 'true'
      if (options) {
        try {
          data.options = JSON.parse(options)
        } catch (e) {
          data.options = options.split(',').map((s: string) => s.trim())
        }
      }

      let result
      switch (action) {
        case 'create': {
          if (!data.label) {
            return JSON.stringify({
              success: false,
              message: 'Rótulo do campo é obrigatório'
            })
          }
          if (!data.field_type) {
            return JSON.stringify({
              success: false,
              message: 'Tipo do campo é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/custom_fields'),
            { custom_field: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          if (entity_type) params.entity_type = entity_type
          
          const response = await axios.get(getUrl('/custom_fields', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.custom_fields?.length || 0,
            data: response.data.custom_fields || response.data
          }
          break
        }
        case 'get': {
          if (!custom_field_id) {
            return JSON.stringify({ success: false, message: 'custom_field_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/custom_fields/${custom_field_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!custom_field_id) {
            return JSON.stringify({ success: false, message: 'custom_field_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/custom_fields/${custom_field_id}`),
            { custom_field: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Campo atualizado', data: response.data }
          break
        }
        case 'delete': {
          if (!custom_field_id) {
            return JSON.stringify({ success: false, message: 'custom_field_id é obrigatório' })
          }
          await axios.delete(getUrl(`/custom_fields/${custom_field_id}`))
          result = { success: true, message: 'Campo personalizado deletado' }
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
