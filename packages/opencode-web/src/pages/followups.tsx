import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface FollowUp {
  id: string
  title?: string
  description?: string
  type?: string
  priority?: string
  status: string
  dueDate?: string
  createdAt: string
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('TASK')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadFollowUps()
  }, [])

  const loadFollowUps = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/followups`)
      if (res.ok) setFollowUps(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type, priority, dueDate: dueDate || undefined })
      })
      if (res.ok) {
        setShowModal(false)
        setTitle('')
        setDescription('')
        setType('TASK')
        setPriority('MEDIUM')
        setDueDate('')
        loadFollowUps()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const filteredFollowUps = filterStatus === 'all' 
    ? followUps 
    : followUps.filter(f => f.status === filterStatus)

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Follow-ups</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {['all', 'PENDING', 'COMPLETED', 'IN_PROGRESS'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded text-sm ${
                filterStatus === status
                  ? 'bg-text-interactive-base text-white'
                  : 'bg-surface-raised-base text-text-base hover:bg-surface-raised-hover'
              }`}
            >
              {status === 'all' ? 'Todos' : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : filteredFollowUps.length > 0 ? (
          <div className="space-y-3">
            {filteredFollowUps.map(followUp => (
              <div key={followUp.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-strong">{followUp.title || 'Sem título'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        followUp.status === 'PENDING' ? 'bg-yellow-500/30 text-yellow-300' :
                        followUp.status === 'COMPLETED' ? 'bg-green-500/30 text-green-300' :
                        'bg-blue-500/30 text-blue-300'
                      }`}>{followUp.status}</span>
                    </div>
                    {followUp.description && (
                      <p className="text-sm text-text-subtle mt-1">{followUp.description}</p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      await fetchWithAuth(`${API_URL}/api/followups/${followUp.id}`, { method: 'DELETE' })
                      loadFollowUps()
                    }}
                    className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">Nenhum follow-up encontrado.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Follow-up</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Título</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.currentTarget.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.currentTarget.value)} className="input" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Tipo</label>
                  <select value={type} onChange={(e) => setType(e.currentTarget.value)} className="input">
                    <option value="TASK">Tarefa</option>
                    <option value="MEETING">Reunião</option>
                    <option value="CALL">Ligação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Prioridade</label>
                  <select value={priority} onChange={(e) => setPriority(e.currentTarget.value)} className="input">
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
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
