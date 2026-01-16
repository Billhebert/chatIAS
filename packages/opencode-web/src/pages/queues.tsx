import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Queue {
  id: string
  name: string
  description?: string
  channel: string
  priority: number
  maxWaitTime: number
  agents: number
  waiting: number
  status: 'active' | 'paused' | 'closed'
  createdAt: string
}

interface QueueStats {
  today: number
  avgWaitTime: number
  avgResolutionTime: number
  satisfaction: number
}

export default function QueuesPage() {
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [stats, setStats] = useState<QueueStats>({ today: 0, avgWaitTime: 0, avgResolutionTime: 0, satisfaction: 0 })
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channel: 'web',
    priority: 1,
    maxWaitTime: 30
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadQueues()
    loadStats()
  }, [])

  const loadQueues = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/queues`)
      if (res.ok) setQueues(await res.json())
      else setQueues(getDefaultQueues())
    } catch {
      setQueues(getDefaultQueues())
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/queues/stats`)
      if (res.ok) setStats(await res.json())
    } catch {
      setStats({ today: 156, avgWaitTime: 2.5, avgResolutionTime: 8.3, satisfaction: 94 })
    }
  }

  const getDefaultQueues = (): Queue[] => [
    {
      id: '1',
      name: 'Fila Principal',
      description: 'Atendimento geral',
      channel: 'web',
      priority: 1,
      maxWaitTime: 30,
      agents: 3,
      waiting: 5,
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Suporte Técnico',
      description: 'Chamados de suporte',
      channel: 'whatsapp',
      priority: 2,
      maxWaitTime: 15,
      agents: 2,
      waiting: 3,
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Vendas',
      description: 'Atendimento comercial',
      channel: 'whatsapp',
      priority: 1,
      maxWaitTime: 20,
      agents: 4,
      waiting: 8,
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Financeiro',
      description: 'Pagamentos e cobranças',
      channel: 'email',
      priority: 3,
      maxWaitTime: 60,
      agents: 1,
      waiting: 0,
      status: 'paused',
      createdAt: new Date().toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/queues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', description: '', channel: 'web', priority: 1, maxWaitTime: 30 })
        loadQueues()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleStatus = async (queue: Queue) => {
    try {
      await fetchWithAuth(`${API_URL}/api/queues/${queue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: queue.status === 'active' ? 'paused' : 'active'
        })
      })
      loadQueues()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAssignAgent = async (queueId: string, action: 'add' | 'remove') => {
    try {
      await fetchWithAuth(`${API_URL}/api/queues/${queueId}/agents`, {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
      loadQueues()
    } catch (e) {
      console.error(e)
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return '💬'
      case 'telegram': return '✈️'
      case 'email': return '📧'
      case 'instagram': return '📷'
      case 'web': return '🌐'
      default: return '📋'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/30 text-green-300'
      case 'paused': return 'bg-yellow-500/30 text-yellow-300'
      case 'closed': return 'bg-red-500/30 text-red-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Filas de Atendimento</h1>
            <p className="text-sm text-text-subtle">Gerencie as filas de atendimento</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Nova Fila
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-2xl font-bold text-text-strong">{stats.today}</div>
            <div className="text-sm text-text-subtle">Atendimentos Hoje</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl mb-2">⏱️</div>
            <div className="text-2xl font-bold text-text-strong">{stats.avgWaitTime}m</div>
            <div className="text-sm text-text-subtle">Tempo Médio Espera</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-2xl font-bold text-text-strong">{stats.avgResolutionTime}m</div>
            <div className="text-sm text-text-subtle">Tempo Médio Resolução</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl mb-2">⭐</div>
            <div className="text-2xl font-bold text-text-strong">{stats.satisfaction}%</div>
            <div className="text-sm text-text-subtle">Satisfação</div>
          </div>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : queues.length > 0 ? (
          <div className="space-y-4">
            {queues.map(queue => (
              <div key={queue.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getChannelIcon(queue.channel)}</span>
                      <span className="font-medium text-text-strong">{queue.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(queue.status)}`}>
                        {queue.status}
                      </span>
                      <span className="text-xs text-text-subtle">
                        Prioridade: {queue.priority}
                      </span>
                    </div>
                    {queue.description && (
                      <p className="text-sm text-text-subtle mb-3">{queue.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-text-subtle">
                      <span>⏱️ Max espera: {queue.maxWaitTime}m</span>
                      <span>👥 {queue.agents} agente(s)</span>
                      <span>🟡 {queue.waiting} aguardando</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(queue)}
                      className={`px-3 py-1 rounded text-sm ${
                        queue.status === 'active'
                          ? 'bg-yellow-500/30 text-yellow-300'
                          : 'bg-green-500/30 text-green-300'
                      }`}
                    >
                      {queue.status === 'active' ? 'Pausar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleAssignAgent(queue.id, 'add')}
                      className="p-2 hover:bg-surface-raised-hover rounded text-text-interactive-base"
                      title="Adicionar Agente"
                    >
                      ➕
                    </button>
                    <button
                      onClick={() => handleAssignAgent(queue.id, 'remove')}
                      className="p-2 hover:bg-surface-raised-hover rounded text-red-400"
                      title="Remover Agente"
                    >
                      ➖
                    </button>
                  </div>
                </div>

                {queue.waiting > 0 && (
                  <div className="mt-4 pt-4 border-t border-border-weak-base">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-subtle">Aguardando:</span>
                      <span className="text-sm text-text-strong">{queue.waiting} pessoas</span>
                    </div>
                    <div className="h-2 bg-surface-raised-base rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full"
                        style={{ width: `${Math.min(queue.waiting * 10, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhuma fila configurada.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Nova Fila</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Canal</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.currentTarget.value })}
                  className="input"
                >
                  <option value="web">🌐 Web Chat</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="telegram">✈️ Telegram</option>
                  <option value="email">📧 Email</option>
                  <option value="instagram">📷 Instagram</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Prioridade</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.currentTarget.value) })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Max Espera (min)</label>
                  <input
                    type="number"
                    value={formData.maxWaitTime}
                    onChange={(e) => setFormData({ ...formData, maxWaitTime: parseInt(e.currentTarget.value) })}
                    className="input"
                  />
                </div>
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
