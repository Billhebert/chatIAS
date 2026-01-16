import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Broadcast {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused'
  channel: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  content: string
  createdAt: string
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [formData, setFormData] = useState({
    name: '',
    channel: 'whatsapp',
    content: '',
    scheduledAt: ''
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadBroadcasts()
  }, [])

  const loadBroadcasts = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/broadcasts`)
      if (res.ok) setBroadcasts(await res.json())
      else setBroadcasts(getDefaultBroadcasts())
    } catch {
      setBroadcasts(getDefaultBroadcasts())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultBroadcasts = (): Broadcast[] => [
    {
      id: '1',
      name: 'Promoção Janeiro',
      status: 'completed',
      channel: 'whatsapp',
      totalRecipients: 1500,
      sentCount: 1500,
      deliveredCount: 1456,
      openedCount: 892,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 30).toISOString(),
      content: 'Olá! Temos uma promoção especial para você. Aproveite 20% de desconto em todos os produtos!',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()
    },
    {
      id: '2',
      name: 'Newsletter Semanal',
      status: 'scheduled',
      channel: 'email',
      totalRecipients: 2500,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      content: 'Sua dose semanal de novidades está chegada! Veja as últimas atualizações...',
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
      id: '3',
      name: 'Lançamento Produto',
      status: 'sending',
      channel: 'whatsapp',
      totalRecipients: 3000,
      sentCount: 1876,
      deliveredCount: 1823,
      openedCount: 456,
      startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      content: '🎉 Chegou! O produto mais esperado do ano está disponível agora!',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: '4',
      name: 'Rascunho Teste',
      status: 'draft',
      channel: 'whatsapp',
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      content: 'Conteúdo do broadcast...',
      createdAt: new Date().toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduledAt: formData.scheduledAt || undefined
        })
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', channel: 'whatsapp', content: '', scheduledAt: '' })
        loadBroadcasts()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handlePauseBroadcast = async (broadcastId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/broadcasts/${broadcastId}/pause`, {
        method: 'POST'
      })
      loadBroadcasts()
    } catch (e) {
      console.error(e)
    }
  }

  const handleResumeBroadcast = async (broadcastId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/broadcasts/${broadcastId}/resume`, {
        method: 'POST'
      })
      loadBroadcasts()
    } catch (e) {
      console.error(e)
    }
  }

  const handleCancelBroadcast = async (broadcastId: string) => {
    if (!confirm('Cancelar este broadcast?')) return
    try {
      await fetchWithAuth(`${API_URL}/api/broadcasts/${broadcastId}/cancel`, {
        method: 'POST'
      })
      loadBroadcasts()
    } catch (e) {
      console.error(e)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/30 text-gray-300'
      case 'scheduled': return 'bg-blue-500/30 text-blue-300'
      case 'sending': return 'bg-yellow-500/30 text-yellow-300'
      case 'completed': return 'bg-green-500/30 text-green-300'
      case 'paused': return 'bg-orange-500/30 text-orange-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return '📝'
      case 'scheduled': return '📅'
      case 'sending': return '📤'
      case 'completed': return '✅'
      case 'paused': return '⏸️'
      default: return '📋'
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return '💬'
      case 'email': return '📧'
      case 'telegram': return '✈️'
      case 'sms': return '📱'
      default: return '📢'
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredBroadcasts = filterStatus === 'all'
    ? broadcasts
    : broadcasts.filter(b => b.status === filterStatus)

  const calculateProgress = (broadcast: Broadcast) => {
    if (broadcast.totalRecipients === 0) return 0
    return Math.round((broadcast.sentCount / broadcast.totalRecipients) * 100)
  }

  const calculateOpenRate = (broadcast: Broadcast) => {
    if (broadcast.deliveredCount === 0) return 0
    return Math.round((broadcast.openedCount / broadcast.deliveredCount) * 100)
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Broadcasts</h1>
            <p className="text-sm text-text-subtle">Envio de mensagens em massa</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo Broadcast
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'draft', 'scheduled', 'sending', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm capitalize whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-text-interactive-base text-white'
                  : 'bg-surface-raised-base text-text-base hover:bg-surface-raised-hover'
              }`}
            >
              {status === 'all' ? 'Todos' : status}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : filteredBroadcasts.length > 0 ? (
          <div className="space-y-4">
            {filteredBroadcasts.map(broadcast => (
              <div key={broadcast.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getChannelIcon(broadcast.channel)}</span>
                      <span className="font-medium text-text-strong">{broadcast.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getStatusColor(broadcast.status)}`}>
                        {getStatusIcon(broadcast.status)} {broadcast.status}
                      </span>
                    </div>
                    <p className="text-sm text-text-subtle line-clamp-2">{broadcast.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {broadcast.status === 'draft' && (
                      <button className="btn-primary text-sm">📤 Enviar Agora</button>
                    )}
                    {broadcast.status === 'sending' && (
                      <button onClick={() => handlePauseBroadcast(broadcast.id)} className="btn-secondary text-sm">
                        ⏸️ Pausar
                      </button>
                    )}
                    {broadcast.status === 'paused' && (
                      <button onClick={() => handleResumeBroadcast(broadcast.id)} className="btn-primary text-sm">
                        ▶️ Continuar
                      </button>
                    )}
                    {(broadcast.status === 'draft' || broadcast.status === 'scheduled') && (
                      <button onClick={() => handleCancelBroadcast(broadcast.id)} className="btn-secondary text-sm text-red-400">
                        ❌
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-border-weak-base">
                  {broadcast.status === 'sending' && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-text-subtle">Progresso</span>
                        <span className="text-text-strong">{broadcast.sentCount}/{broadcast.totalRecipients} ({calculateProgress(broadcast)}%)</span>
                      </div>
                      <div className="h-2 bg-surface-raised-base rounded-full overflow-hidden">
                        <div
                          className="h-full bg-text-interactive-base rounded-full transition-all"
                          style={{ width: `${calculateProgress(broadcast)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-text-subtle">Recipientes</div>
                      <div className="font-medium text-text-strong">{broadcast.totalRecipients.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-text-subtle">Entregues</div>
                      <div className="font-medium text-text-strong">{broadcast.deliveredCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-text-subtle">Abertos</div>
                      <div className="font-medium text-text-strong">{broadcast.openedCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-text-subtle">Taxa Abertura</div>
                      <div className="font-medium text-text-strong">{calculateOpenRate(broadcast)}%</div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-4 pt-4 border-t border-border-weak-base text-xs text-text-subtle">
                    <span>📅 Criado: {formatDate(broadcast.createdAt)}</span>
                    {broadcast.scheduledAt && <span>📆 Agendado: {formatDate(broadcast.scheduledAt)}</span>}
                    {broadcast.completedAt && <span>✅ Concluído: {formatDate(broadcast.completedAt)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum broadcast encontrado.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Broadcast</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                  className="input"
                  placeholder="Nome do broadcast"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Canal</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.currentTarget.value })}
                  className="input"
                >
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="email">📧 Email</option>
                  <option value="telegram">✈️ Telegram</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Conteúdo</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.currentTarget.value })}
                  className="input font-mono text-sm"
                  rows={4}
                  placeholder="Sua mensagem..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Agendar (opcional)</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.currentTarget.value })}
                  className="input"
                />
                <p className="text-xs text-text-subtle mt-1">Deixe vazio para enviar imediatamente</p>
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
