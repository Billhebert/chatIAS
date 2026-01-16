import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Workflow {
  id: string
  name: string
  description?: string
  trigger: { type: string }
  steps: any[]
  isActive: boolean
  runCount: number
  lastRun?: string
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('manual')

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/workflows`)
      if (res.ok) setWorkflows(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, trigger: triggerType, triggerConfig: {}, steps: [] })
      })
      if (res.ok) {
        setShowModal(false)
        setName('')
        setDescription('')
        setTriggerType('manual')
        loadWorkflows()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggle = async (workflow: Workflow) => {
    try {
      await fetchWithAuth(`${API_URL}/api/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !workflow.isActive })
      })
      loadWorkflows()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (workflow: Workflow) => {
    if (!confirm(`Excluir "${workflow.name}"?`)) return
    try {
      await fetchWithAuth(`${API_URL}/api/workflows/${workflow.id}`, { method: 'DELETE' })
      loadWorkflows()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🔄</span>
          <h1 className="text-2xl font-bold text-text-strong">Workflows</h1>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-bold text-text-strong">{workflows.length}</div>
            <div className="text-xs text-text-subtle">Total</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-green-400">{workflows.filter(w => w.isActive).length}</div>
            <div className="text-xs text-text-subtle">Ativos</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-blue-400">{workflows.reduce((acc, w) => acc + w.runCount, 0)}</div>
            <div className="text-xs text-text-subtle">Execuções</div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-text-strong">Automações</h2>
          <button onClick={() => setShowModal(true)} className="btn-primary">➕ Novo</button>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : workflows.length > 0 ? (
          <div className="space-y-3">
            {workflows.map(workflow => (
              <div key={workflow.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-strong">{workflow.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        workflow.isActive ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30 text-gray-300'
                      }`}>{workflow.isActive ? 'Ativo' : 'Pausado'}</span>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-text-subtle mt-1">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-subtle">
                      <span>⚡ {workflow.trigger.type}</span>
                      <span>▶ {workflow.steps.length} passos</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(workflow)} className="p-2 hover:bg-red-500/20 text-red-400 rounded">🗑️</button>
                    <button onClick={() => handleToggle(workflow)} className="p-2 hover:bg-surface-raised-hover rounded">
                      {workflow.isActive ? '⏸️' : '▶️'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">Nenhum workflow.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Workflow</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input type="text" value={name} onChange={(e) => setName(e.currentTarget.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.currentTarget.value)} className="input" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Gatilho</label>
                <select value={triggerType} onChange={(e) => setTriggerType(e.currentTarget.value)} className="input">
                  <option value="manual">Manual</option>
                  <option value="scheduled">Agendado</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
