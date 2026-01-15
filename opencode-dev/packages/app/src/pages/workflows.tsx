import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { useAuth } from "@/context/auth"
import { useServer } from "@/context/server"
import { useLayout } from "@/context/layout"
import { getStoredToken } from "@/api/user-api"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"

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
  type: "scheduled" | "webhook" | "event" | "manual"
  config: Record<string, any>
}

interface WorkflowStep {
  id: string
  type: "send_message" | "send_followup" | "ai_response" | "condition" | "http_request" | "delay"
  name: string
  config: Record<string, any>
  nextStepId?: string
}

interface WorkflowExecution {
  id: string
  workflowId: string
  status: "running" | "completed" | "failed" | "cancelled"
  startedAt: string
  completedAt?: string
  logs: ExecutionLog[]
}

interface ExecutionLog {
  stepId: string
  status: "pending" | "running" | "completed" | "failed"
  message?: string
  timestamp: string
}

export default function WorkflowsPage() {
  const auth = useAuth()
  const server = useServer()
  const layout = useLayout()

  const [workflows, setWorkflows] = createSignal<Workflow[]>([])
  const [executions, setExecutions] = createSignal<WorkflowExecution[]>([])
  const [loading, setLoading] = createSignal(true)
  const [showModal, setShowModal] = createSignal(false)
  const [editingWorkflow, setEditingWorkflow] = createSignal<Workflow | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = createSignal<Workflow | null>(null)
  const [showExecutions, setShowExecutions] = createSignal(false)

  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [triggerType, setTriggerType] = createSignal<"scheduled" | "webhook" | "event" | "manual">("manual")
  const [triggerConfig, setTriggerConfig] = createSignal<Record<string, any>>({})
  const [steps, setSteps] = createSignal<WorkflowStep[]>([])

  const loadWorkflows = async () => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/workflows`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setWorkflows(data)
      }
    } catch (e) {
      console.error("Error loading workflows:", e)
    } finally {
      setLoading(false)
    }
  }

  const loadExecutions = async (workflowId: string) => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/workflows/${workflowId}/executions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setExecutions(data)
      }
    } catch (e) {
      console.error("Error loading executions:", e)
    }
  }

  onMount(() => {
    loadWorkflows()
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()

    if (!name()) {
      showToast({ title: "Erro", description: "Nome é obrigatório" })
      return
    }

    const token = getStoredToken()

    try {
      let res
      const body = {
        name: name(),
        description: description(),
        trigger: {
          type: triggerType(),
          config: triggerConfig()
        },
        steps: steps()
      }

      if (editingWorkflow()) {
        res = await fetch(`${server.url}/workflows/${editingWorkflow()!.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        })
      } else {
        res = await fetch(`${server.url}/workflows`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        })
      }

      if (res.ok) {
        showToast({ title: editingWorkflow() ? "Workflow atualizado" : "Workflow criado" })
        setShowModal(false)
        resetForm()
        await loadWorkflows()
      } else {
        const data = await res.json()
        showToast({ title: "Erro", description: data.error || "Falha ao salvar" })
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isActive: !workflow.isActive })
      })

      if (res.ok) {
        showToast({ title: workflow.isActive ? "Workflow pausado" : "Workflow ativado" })
        await loadWorkflows()
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const handleDelete = async (workflow: Workflow) => {
    if (!confirm(`Excluir workflow "${workflow.name}"?`)) return

    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/workflows/${workflow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        showToast({ title: "Workflow excluído" })
        await loadWorkflows()
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const handleExecute = async (workflow: Workflow) => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/workflows/${workflow.id}/execute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        showToast({ title: "Workflow iniciado", description: "Execução iniciada com sucesso" })
        if (selectedWorkflow()?.id === workflow.id) {
          await loadExecutions(workflow.id)
        }
      } else {
        showToast({ title: "Erro", description: "Falha ao iniciar workflow" })
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const resetForm = () => {
    setEditingWorkflow(null)
    setName("")
    setDescription("")
    setTriggerType("manual")
    setTriggerConfig({})
    setSteps([])
  }

  const openEditModal = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setName(workflow.name)
    setDescription(workflow.description || "")
    setTriggerType(workflow.trigger.type)
    setTriggerConfig(workflow.trigger.config)
    setSteps(workflow.steps)
    setShowModal(true)
  }

  const addStep = (type: WorkflowStep["type"]) => {
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
      send_message: "Enviar Mensagem",
      send_followup: "Agendar Follow-up",
      ai_response: "Resposta IA",
      condition: "Condição",
      http_request: "Requisição HTTP",
      delay: "Aguardar/Delay"
    }
    return names[type] || type
  }

  const getStepDefaultConfig = (type: string) => {
    const configs: Record<string, Record<string, any>> = {
      send_message: { message: "", instance: "" },
      send_followup: { message: "", delayHours: 24 },
      ai_response: { prompt: "", agentId: "" },
      condition: { field: "", operator: "equals", value: "" },
      http_request: { url: "", method: "GET", body: "" },
      delay: { seconds: 60 }
    }
    return configs[type] || {}
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getTriggerLabel = (trigger: WorkflowTrigger) => {
    switch (trigger.type) {
      case "scheduled": return `Agendado: ${trigger.config.cron || trigger.config.interval || "diário"}`
      case "webhook": return `Webhook: ${trigger.config.path || "/"}`
      case "event": return `Evento: ${trigger.config.event || "custom"}`
      case "manual": return "Manual"
      default: return trigger.type
    }
  }

  const stats = createMemo(() => {
    const all = workflows()
    return {
      total: all.length,
      active: all.filter(w => w.isActive).length,
      totalRuns: all.reduce((acc, w) => acc + w.runCount, 0)
    }
  })

  return (
    <div class="flex flex-col w-full h-full bg-background-base">
      {/* Header mobile */}
      <header class="xl:hidden h-12 shrink-0 bg-background-base border-b border-border-weak-base flex items-center">
        <button
          type="button"
          class="w-12 shrink-0 flex items-center justify-center border-r border-border-weak-base hover:bg-surface-raised-base-hover"
          onClick={layout.mobileSidebar.toggle}
        >
          <Icon name="menu" size="small" />
        </button>
        <div class="flex-1 flex items-center justify-center">
          <Icon name="workflow" size="small" class="mr-2 text-purple-400" />
          <span class="text-14-medium text-text-strong">Workflows</span>
        </div>
        <div class="w-12" />
      </header>

      <div class="flex-1 overflow-auto p-4 md:p-6">
        <div class="max-w-4xl mx-auto">
          {/* Stats */}
          <div class="grid grid-cols-3 gap-3 mb-6">
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-text-strong">{stats().total}</div>
              <div class="text-xs text-text-subtle">Total</div>
            </div>
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-green-400">{stats().active}</div>
              <div class="text-xs text-text-subtle">Ativos</div>
            </div>
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-blue-400">{stats().totalRuns}</div>
              <div class="text-xs text-text-subtle">Execuções</div>
            </div>
          </div>

          {/* Actions */}
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-medium text-text-strong">Automações</h2>
            <Button icon="plus" onClick={() => { resetForm(); setShowModal(true); }}>
              Novo Workflow
            </Button>
          </div>

          {/* Lista */}
          <Show when={!loading()}>
            <Show when={workflows().length > 0}>
              <div class="space-y-3">
                <For each={workflows()}>
                  {(workflow) => (
                    <div class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-text-strong">{workflow.name}</span>
                            <span class={`px-2 py-0.5 rounded text-xs ${
                              workflow.isActive
                                ? "bg-green-500/30 text-green-300 border border-green-500/40"
                                : "bg-gray-500/30 text-gray-300 border border-gray-500/40"
                            }`}>
                              {workflow.isActive ? "Ativo" : "Pausado"}
                            </span>
                          </div>
                          <Show when={workflow.description}>
                            <p class="text-sm text-text-subtle mt-1">{workflow.description}</p>
                          </Show>
                          <div class="flex items-center gap-3 mt-2 text-xs text-text-subtle">
                            <span class="flex items-center gap-1">
                              <Icon name="lightning" size="small" />
                              {getTriggerLabel(workflow.trigger)}
                            </span>
                            <span class="flex items-center gap-1">
                              <Icon name="step-forward" size="small" />
                              {workflow.steps.length} passos
                            </span>
                            <Show when={workflow.lastRun}>
                              <span>Última execução: {formatDateTime(workflow.lastRun!)}</span>
                            </Show>
                          </div>
                        </div>
                        <div class="flex items-center gap-1">
                          <IconButton
                            icon="play"
                            variant="ghost"
                            onClick={() => handleExecute(workflow)}
                            title="Executar"
                          />
                          <IconButton
                            icon="list"
                            variant="ghost"
                            onClick={() => {
                              setSelectedWorkflow(workflow)
                              setShowExecutions(true)
                              loadExecutions(workflow.id)
                            }}
                            title="Ver execuções"
                          />
                          <IconButton
                            icon="edit-small-2"
                            variant="ghost"
                            onClick={() => openEditModal(workflow)}
                          />
                          <IconButton
                            icon="trash"
                            variant="ghost"
                            class="text-icon-critical-base"
                            onClick={() => handleDelete(workflow)}
                          />
                          <IconButton
                            icon={workflow.isActive ? "pause" : "play"}
                            variant="ghost"
                            onClick={() => handleToggleActive(workflow)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={workflows().length === 0}>
              <div class="text-center py-12 text-text-subtle">
                <Icon name="workflow" size="large" class="mb-3 opacity-50" />
                <p>Nenhum workflow criado ainda</p>
                <Button variant="ghost" class="mt-4" onClick={() => { resetForm(); setShowModal(true); }}>
                  Criar primeiro workflow
                </Button>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Modal */}
      <Show when={showModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-medium text-text-strong mb-4 flex items-center gap-2">
              <Icon name="workflow" size="small" class="text-purple-400" />
              {editingWorkflow() ? "Editar Workflow" : "Novo Workflow"}
            </h3>

            <form onSubmit={handleSubmit} class="space-y-4">
              {/* Basic Info */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-base mb-1">
                    Nome *
                  </label>
                  <TextField
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    placeholder="Nome do workflow"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-base mb-1">
                    Gatilho (Trigger)
                  </label>
                  <select
                    value={triggerType()}
                    onChange={(e) => setTriggerType(e.currentTarget.value as any)}
                    class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
                  >
                    <option value="manual">Manual</option>
                    <option value="scheduled">Agendado</option>
                    <option value="webhook">Webhook</option>
                    <option value="event">Evento</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-base mb-1">
                  Descrição
                </label>
                <textarea
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  placeholder="O que este workflow faz?"
                  rows={2}
                  class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base resize-none"
                />
              </div>

              {/* Steps */}
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-text-base">
                    Passos do Workflow
                  </label>
                  <div class="flex gap-1">
                    <Button size="small" variant="ghost" onClick={(e) => { e.preventDefault(); addStep("send_message") }}>
                      <Icon name="bubble-5" size="small" /> Mensagem
                    </Button>
                    <Button size="small" variant="ghost" onClick={(e) => { e.preventDefault(); addStep("ai_response") }}>
                      <Icon name="brain" size="small" /> IA
                    </Button>
                    <Button size="small" variant="ghost" onClick={(e) => { e.preventDefault(); addStep("delay") }}>
                      <Icon name="clock" size="small" /> Delay
                    </Button>
                  </div>
                </div>

                <Show when={steps().length > 0}>
                  <div class="space-y-2">
                    <For each={steps()}>
                      {(step, index) => (
                        <div class="p-3 rounded bg-background-base border border-border-weak-base flex items-center gap-3">
                          <span class="size-6 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-medium">
                            {index() + 1}
                          </span>
                          <div class="flex-1">
                            <div class="font-medium text-text-strong">{step.name}</div>
                            <div class="text-xs text-text-subtle">{step.type}</div>
                          </div>
                          <IconButton
                            icon="trash"
                            variant="ghost"
                            size="small"
                            class="text-icon-critical-base"
                            onClick={() => removeStep(step.id)}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={steps().length === 0}>
                  <div class="p-8 text-center text-text-subtle rounded border border-dashed border-border-weak-base">
                    Nenhum passo adicionado. Clique nos botões acima para adicionar.
                  </div>
                </Show>
              </div>

              {/* Actions */}
              <div class="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingWorkflow() ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Executions Modal */}
      <Show when={showExecutions()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-text-strong flex items-center gap-2">
                <Icon name="list" size="small" class="text-blue-400" />
                Execuções: {selectedWorkflow()?.name}
              </h3>
              <IconButton icon="x" variant="ghost" onClick={() => setShowExecutions(false)} />
            </div>

            <Show when={executions().length > 0}>
              <div class="space-y-2">
                <For each={executions()}>
                  {(exec) => (
                    <div class="p-3 rounded bg-background-base border border-border-weak-base">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class={`size-2 rounded-full ${
                            exec.status === "completed" ? "bg-green-400" :
                            exec.status === "running" ? "bg-yellow-400 animate-pulse" :
                            exec.status === "failed" ? "bg-red-400" : "bg-gray-400"
                          }`} />
                          <span class="font-medium text-text-strong capitalize">{exec.status}</span>
                        </div>
                        <span class="text-xs text-text-subtle">
                          {formatDateTime(exec.startedAt)}
                        </span>
                      </div>
                      <Show when={exec.logs.length > 0}>
                        <div class="mt-2 pl-4 space-y-1">
                          <For each={exec.logs.slice(0, 5)}>
                            {(log) => (
                              <div class="text-xs text-text-subtle">
                                <span class={
                                  log.status === "completed" ? "text-green-400" :
                                  log.status === "failed" ? "text-red-400" :
                                  log.status === "running" ? "text-yellow-400" : "text-gray-400"
                                }>●</span> {log.message || log.stepId}
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={executions().length === 0}>
              <div class="text-center py-8 text-text-subtle">
                <p>Nenhuma execução encontrada</p>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
