import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

export default tool({
  description: 'Gerencia tarefas no RD Station CRM - criar, listar, buscar e atualizar tarefas de negociações',
  args: {
    action: tool.schema
      .enum(['create', 'list', 'get', 'update'])
      .optional()
      .describe('Ação: create, list, get, update'),
    task_id: tool.schema
      .string()
      .optional()
      .describe('ID da tarefa (para get/update)'),
    deal_id: tool.schema
      .string()
      .optional()
      .describe('ID da negociação associada'),
    user_id: tool.schema
      .string()
      .optional()
      .describe('ID do usuário responsável'),
    subject: tool.schema
      .string()
      .optional()
      .describe('Assunto/título da tarefa'),
    type: tool.schema
      .enum(['call', 'email', 'meeting', 'task', 'lunch', 'whatsapp'])
      .optional()
      .describe('Tipo de tarefa'),
    date: tool.schema
      .string()
      .optional()
      .describe('Data da tarefa (ISO 8601)'),
    hour: tool.schema
      .string()
      .optional()
      .describe('Hora da tarefa (HH:mm)'),
    done: tool.schema
      .enum(['true', 'false'])
      .optional()
      .describe('Tarefa concluída?'),
    page: tool.schema
      .number()
      .optional()
      .describe('Página (paginação)'),
    limit: tool.schema
      .number()
      .optional()
      .describe('Itens por página (max 200)'),
    order: tool.schema
      .enum(['created_at', 'updated_at', 'date'])
      .optional()
      .describe('Campo para ordenação'),
    direction: tool.schema
      .enum(['asc', 'desc'])
      .optional()
      .describe('Direção da ordenação'),
    data: tool.schema
      .string()
      .optional()
      .describe('Dados adicionais em JSON')
  },
  async execute(args) {
    const { 
      action = 'list', 
      task_id,
      deal_id,
      user_id,
      subject,
      type,
      date,
      hour,
      done,
      page = 1,
      limit = 20,
      order,
      direction,
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
      if (deal_id) data.deal_id = deal_id
      if (user_id) data.user_id = user_id
      if (subject) data.subject = subject
      if (type) data.type = type
      if (date) data.date = date
      if (hour) data.hour = hour
      if (done !== undefined) data.done = done === 'true'

      let result
      switch (action) {
        case 'create': {
          if (!data.subject) {
            return JSON.stringify({
              success: false,
              message: 'Assunto da tarefa é obrigatório'
            })
          }
          if (!data.deal_id) {
            return JSON.stringify({
              success: false,
              message: 'deal_id é obrigatório'
            })
          }
          const response = await axios.post(
            getUrl('/tasks'),
            { task: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'list': {
          const params: Record<string, any> = { page, limit }
          if (order) params.order = order
          if (direction) params.direction = direction
          if (deal_id) params.deal_id = deal_id
          if (user_id) params.user_id = user_id
          if (done !== undefined) params.done = done
          if (type) params.type = type
          
          const response = await axios.get(getUrl('/tasks', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.tasks?.length || 0,
            has_more: response.data.has_more || false,
            data: response.data.tasks || response.data
          }
          break
        }
        case 'get': {
          if (!task_id) {
            return JSON.stringify({ success: false, message: 'task_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/tasks/${task_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'update': {
          if (!task_id) {
            return JSON.stringify({ success: false, message: 'task_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/tasks/${task_id}`),
            { task: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Tarefa atualizada', data: response.data }
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
