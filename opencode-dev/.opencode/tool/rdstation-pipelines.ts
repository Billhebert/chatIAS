import { tool } from '@opencode-ai/plugin/tool'
import axios from 'axios'
import { getUrl, handleError } from './lib/rdstation-config'

export default tool({
  description: 'Gerencia funis (pipelines) e etapas (stages) no RD Station CRM',
  args: {
    action: tool.schema
      .enum(['listPipelines', 'createPipeline', 'getPipeline', 'updatePipeline', 'listStages', 'createStage', 'getStage', 'updateStage'])
      .optional()
      .describe('Ação: listPipelines, createPipeline, getPipeline, updatePipeline, listStages, createStage, getStage, updateStage'),
    pipeline_id: tool.schema
      .string()
      .optional()
      .describe('ID do funil'),
    stage_id: tool.schema
      .string()
      .optional()
      .describe('ID da etapa'),
    name: tool.schema
      .string()
      .optional()
      .describe('Nome do funil/etapa'),
    nickname: tool.schema
      .string()
      .optional()
      .describe('Apelido do funil'),
    order: tool.schema
      .number()
      .optional()
      .describe('Ordem da etapa no funil'),
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
      action = 'listPipelines', 
      pipeline_id,
      stage_id,
      name,
      nickname,
      order: stageOrder,
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

      if (name) data.name = name
      if (nickname) data.nickname = nickname
      if (stageOrder !== undefined) data.order = stageOrder

      let result
      switch (action) {
        // Pipeline actions
        case 'listPipelines': {
          const params: Record<string, any> = { page, limit }
          const response = await axios.get(getUrl('/deal_pipelines', params))
          result = { 
            success: true, 
            page,
            limit,
            total: response.data.total || response.data.deal_pipelines?.length || 0,
            data: response.data.deal_pipelines || response.data
          }
          break
        }
        case 'createPipeline': {
          if (!data.name) {
            return JSON.stringify({ success: false, message: 'Nome do funil é obrigatório' })
          }
          const response = await axios.post(
            getUrl('/deal_pipelines'),
            { deal_pipeline: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'getPipeline': {
          if (!pipeline_id) {
            return JSON.stringify({ success: false, message: 'pipeline_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/deal_pipelines/${pipeline_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'updatePipeline': {
          if (!pipeline_id) {
            return JSON.stringify({ success: false, message: 'pipeline_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/deal_pipelines/${pipeline_id}`),
            { deal_pipeline: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Funil atualizado', data: response.data }
          break
        }
        // Stage actions
        case 'listStages': {
          if (!pipeline_id) {
            return JSON.stringify({ success: false, message: 'pipeline_id é obrigatório para listar etapas' })
          }
          const response = await axios.get(getUrl(`/deal_pipelines/${pipeline_id}/deal_stages`))
          result = { 
            success: true, 
            pipeline_id,
            data: response.data.deal_stages || response.data
          }
          break
        }
        case 'createStage': {
          if (!pipeline_id) {
            return JSON.stringify({ success: false, message: 'pipeline_id é obrigatório' })
          }
          if (!data.name) {
            return JSON.stringify({ success: false, message: 'Nome da etapa é obrigatório' })
          }
          const response = await axios.post(
            getUrl(`/deal_pipelines/${pipeline_id}/deal_stages`),
            { deal_stage: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, status: response.status, data: response.data }
          break
        }
        case 'getStage': {
          if (!stage_id) {
            return JSON.stringify({ success: false, message: 'stage_id é obrigatório' })
          }
          const response = await axios.get(getUrl(`/deal_stages/${stage_id}`))
          result = { success: true, data: response.data }
          break
        }
        case 'updateStage': {
          if (!stage_id) {
            return JSON.stringify({ success: false, message: 'stage_id é obrigatório' })
          }
          const response = await axios.put(
            getUrl(`/deal_stages/${stage_id}`),
            { deal_stage: data },
            { headers: { 'Content-Type': 'application/json' } }
          )
          result = { success: true, message: 'Etapa atualizada', data: response.data }
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
