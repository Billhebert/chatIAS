import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { api } from '@/lib/api'

interface Workflow {
  id: string
  name: string
  description?: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastRun?: string
  runCount: number
}

interface WorkflowTrigger {
  type: 'scheduled' | 'webhook' | 'event' | 'manual'
  config: Record<string, any>
}

interface WorkflowStep {
  id: string
  type: 'send_message' | 'send_followup' | 'ai_response' | 'condition' | 'http_request' | 'delay'
  name: string
  config: Record<string, any>
  nextStepId?: string
}

interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  logs: ExecutionLog[]
}

interface ExecutionLog {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  timestamp: string
}

export default function WorkflowsOpenCode() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [showExecutions, setShowExecutions] = useState(false)
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState<'scheduled' | 'webhook' | 'event' | 'manual'>('manual')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({})
  const [steps, setSteps] = useState<WorkflowStep[]>([])

  useEffect(() => {
    loadWorkflows()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadWorkflows = async () => {
    try {
      const res = await api.get('/workflows')
      if (res.ok) {
        const data = await res.json()
        setWorkflows(data)
      }
    } catch (e) {
      console.error('Error loading workflows:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadExecutions = async (workflowId: string) => {
    try {
      const res = await api.get(`/workflows/${workflowId}/executions`)
      if (res.ok) {
        const data = await res.json()
        setExecutions(data)
      }
    } catch (e) {
      console.error('Error loading executions:', e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name) {
      setToast({ title: 'Erro', description: 'Nome é obrigatório' })
      return
    }

    try {
      let res
      const body = {
        name,
        description,
        trigger: {
          type: triggerType,
          config: triggerConfig
        },
        steps
      }

      if (editingWorkflow) {
        res = await api.put(`/workflows/${editingWorkflow.id}`, body)
      } else {
        res = await api.post('/workflows', body)
      }

      if (res.ok) {
        setToast({ title: editingWorkflow ? 'Workflow atualizado' : 'Workflow criado' })
        setShowModal(false)
        resetForm()
        await loadWorkflows()
      } else {
        const data = await res.json()
        setToast({ title: 'Erro', description: data.error || 'Falha ao salvar' })
      }
    } catch (e: any) {
      setToast({ title: 'Erro', description: e.message })
    }
  }

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      const res = await api.patch(`/workflows/${workflow.id}`, { isActive: !workflow.isActive })

      if (res.ok) {
        setToast({ title: workflow.isActive ? 'Workflow pausado' : 'Workflow ativado' })
        await loadWorkflows()
      }
    } catch (e: any) {
      setToast({ title: 'Erro', description: e.message })
    }
  }

  const handleDelete = async (workflow: Workflow) => {
    if (!confirm(`Excluir workflow "${workflow.name}"?`)) return

    try {
      const res = await api.delete(`/workflows/${workflow.id}`)

      if (res.ok) {
        setToast({ title: 'Workflow excluído' })
        await loadWorkflows()
      }
    } catch (e: any) {
      setToast({ title: 'Erro', description: e.message })
    }
  }

  const handleExecute = async (workflow: Workflow) => {
    try {
      const res = await api.post(`/workflows/${workflow.id}/execute`, {})

      if (res.ok) {
        setToast({ title: 'Workflow iniciado', description: 'Execução iniciada com sucesso' })
        if (selectedWorkflow?.id === workflow.id) {
          await loadExecutions(workflow.id)
        }
      } else {
        setToast({ title: 'Erro', description: 'Falha ao iniciar workflow' })
      }
    } catch (e: any) {
      setToast({ title: 'Erro', description: e.message })
    }
  }

  const resetForm = () => {
    setEditingWorkflow(null)
    setName('')
    setDescription('')
    setTriggerType('manual')
    setTriggerConfig({})
    setSteps([])
  }

  const openEditModal = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setName(workflow.name)
    setDescription(workflow.description || '')
    setTriggerType(workflow.trigger.type)
    setTriggerConfig(workflow.trigger.config)
    setSteps(workflow.steps)
    setShowModal(true)
  }

  const addStep = (type: WorkflowStep['type']) => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      type,
      name: getStepName(type),
      config: getStepDefaultConfig(type)
    }
    setSteps(prev => [...prev, newStep])
  }

  const removeStep = (stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId))
  }

  const getStepName = (type: string) => {
    const names: Record<string, string> = {
      send_message: 'Enviar Mensagem',
      send_followup: 'Agendar Follow-up',
      ai_response: 'Resposta IA',
      condition: 'Condição',
      http_request: 'Requisição HTTP',
      delay: 'Aguardar/Delay'
    }
    return names[type] || type
  }

  const getStepDefaultConfig = (type: string) => {
    const configs: Record<string, Record<string, any>> = {
      send_message: { message: '', instance: '' },
      send_followup: { message: '', delayHours: 24 },
      ai_response: { prompt: '', agentId: '' },
      condition: { field: '', operator: 'equals', value: '' },
      http_request: { url: '', method: 'GET', body: '' },
      delay: { seconds: 60 }
    }
    return configs[type] || {}
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTriggerLabel = (trigger: WorkflowTrigger) => {
    switch (trigger.type) {
      case 'scheduled': return `Agendado: ${trigger.config.cron || trigger.config.interval || 'diário'}`
      case 'webhook': return `Webhook: ${trigger.config.path || '/'}`
      case 'event': return `Evento: ${trigger.config.event || 'custom'}`
      case 'manual': return 'Manual'
      default: return trigger.type
    }
  }

  const stats = useMemo(() => {
    return {
      total: workflows.length,
      active: workflows.filter(w => w.isActive).length,
      totalRuns: workflows.reduce((acc, w) => acc + w.runCount, 0)
    }
  }, [workflows])

  return (
    <Layout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-surface-raised-base border border-border-weak-base p-4 rounded-lg shadow-lg">
          <div className="font-medium text-text-strong">{toast.title}</div>
          {toast.description && <div className="text-sm text-text-subtle">{toast.description}</div>}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">🔄</span>
            <h1 className="text-2xl font-bold text-text-strong">Workflows</h1>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div className="text-2xl font-bold text-text-strong">{stats.total}</div>
              <div className="text-xs text-text-subtle">Total</div>
            </div>
            <div className="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div className="text-2xl font-bold text-green-400">{stats.active}</div>
              <div className="text-xs text-text-subtle">Ativos</div>
            </div>
            <div className="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalRuns}</div>
              <div className="text-xs text-text-subtle">Execuções</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-text-strong">Automações</h2>
            <button
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2"
              onClick={() => { resetForm(); setShowModal(true); }}
            >
              <span>➕</span> Novo Workflow
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-text-subtle">Carregando...</div>
          ) : workflows.length > 0 ? (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-strong">{workflow.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          workflow.isActive
                            ? 'bg-green-500/30 text-green-300 border border-green-500/40'
                            : 'bg-gray-500/30 text-gray-300 border border-gray-500/40'
                        }`}>
                          {workflow.isActive ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-text-subtle mt-1">{workflow.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-subtle">
                        <span className="flex items-center gap-1">
                          ⚡ {getTriggerLabel(workflow.trigger)}
                        </span>
                        <span className="flex items-center gap-1">
                          ▶ {workflow.steps.length} passos
                        </span>
                        {workflow.lastRun && (
                          <span>Última execução: {formatDateTime(workflow.lastRun)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-2 hover:bg-surface-raised-base-hover rounded"
                        onClick={() => handleExecute(workflow)}
                        title="Executar"
                      >
                        ▶️
                      </button>
                      <button
                        className="p-2 hover:bg-surface-raised-base-hover rounded"
                        onClick={() => {
                          setSelectedWorkflow(workflow)
                          setShowExecutions(true)
                          loadExecutions(workflow.id)
                        }}
                        title="Ver execuções"
                      >
                        📋
                      </button>
                      <button
                        className="p-2 hover:bg-surface-raised-base-hover rounded"
                        onClick={() => openEditModal(workflow)}
                      >
                        ✏️
                      </button>
                      <button
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                        onClick={() => handleDelete(workflow)}
                      >
                        🗑️
                      </button>
                      <button
                        className="p-2 hover:bg-surface-raised-base-hover rounded"
                        onClick={() => handleToggleActive(workflow)}
                      >
                        {workflow.isActive ? '⏸️' : '▶️'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-text-subtle">
              <div className="text-4xl mb-3">🔄</div>
              <p>Nenhum workflow criado ainda</p>
              <button
                className="mt-4 px-4 py-2 text-blue-400 hover:text-blue-300"
                onClick={() => { resetForm(); setShowModal(true); }}
              >
                Criar primeiro workflow
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-text-strong mb-4 flex items-center gap-2">
              <span className="text-purple-400">🔄</span>
              {editingWorkflow ? 'Editar Workflow' : 'Novo Workflow'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    placeholder="Nome do workflow"
                    className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">
                    Gatilho (Trigger)
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.currentTarget.value as any)}
                    className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
                  >
                    <option value="manual">Manual</option>
                    <option value="scheduled">Agendado</option>
                    <option value="webhook">Webhook</option>
                    <option value="event">Evento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.currentTarget.value)}
                  placeholder="O que este workflow faz?"
                  rows={2}
                  className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-text-base">
                    Passos do Workflow
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      size="small"
                      className="px-2 py-1 text-xs hover:bg-surface-raised-base-hover rounded flex items-center gap-1"
                      onClick={(e) => { e.preventDefault(); addStep('send_message') }}
                    >
                      💬 Mensagem
                    </button>
                    <button
                      type="button"
                      size="small"
                      className="px-2 py-1 text-xs hover:bg-surface-raised-base-hover rounded flex items-center gap-1"
                      onClick={(e) => { e.preventDefault(); addStep('ai_response') }}
                    >
                      🧠 IA
                    </button>
                    <button
                      type="button"
                      size="small"
                      className="px-2 py-1 text-xs hover:bg-surface-raised-base-hover rounded flex items-center gap-1"
                      onClick={(e) => { e.preventDefault(); addStep('delay') }}
                    >
                      ⏱️ Delay
                    </button>
                  </div>
                </div>

                {steps.length > 0 ? (
                  <div className="space-y-2">
                    {steps.map((step, index) => (
                      <div key={step.id} className="p-3 rounded bg-background-base border border-border-weak-base flex items-center gap-3">
                        <span className="size-6 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-text-strong">{step.name}</div>
                          <div className="text-xs text-text-subtle">{step.type}</div>
                        </div>
                        <button
                          type="button"
                          className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                          onClick={() => removeStep(step.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-text-subtle rounded border border-dashed border-border-weak-base">
                    Nenhum passo adicionado. Clique nos botões acima para adicionar.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  {editingWorkflow ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExecutions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-text-strong flex items-center gap-2">
                <span className="text-blue-400">📋</span>
                Execuções: {selectedWorkflow?.name}
              </h3>
              <button
                className="p-2 hover:bg-surface-raised-base-hover rounded"
                onClick={() => setShowExecutions(false)}
              >
                ❌
              </button>
            </div>

            {executions.length > 0 ? (
              <div className="space-y-2">
                {executions.map((exec) => (
                  <div key={exec.id} className="p-3 rounded bg-background-base border border-border-weak-base">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${
                          exec.status === 'completed' ? 'bg-green-400' :
                          exec.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                          exec.status === 'failed' ? 'bg-red-400' : 'bg-gray-400'
                        }`} />
                        <span className="font-medium text-text-strong capitalize">{exec.status}</span>
                      </div>
                      <span className="text-xs text-text-subtle">
                        {formatDateTime(exec.startedAt)}
                      </span>
                    </div>
                    {exec.logs.length > 0 && (
                      <div className="mt-2 pl-4 space-y-1">
                        {exec.logs.slice(0, 5).map((log, i) => (
                          <div key={i} className="text-xs text-text-subtle">
                            <span className={
                              log.status === 'completed' ? 'text-green-400' :
                              log.status === 'failed' ? 'text-red-400' :
                              log.status === 'running' ? 'text-yellow-400' : 'text-gray-400'
                            }>●</span> {log.message || log.stepId}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-subtle">
                <p>Nenhuma execução encontrada</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
