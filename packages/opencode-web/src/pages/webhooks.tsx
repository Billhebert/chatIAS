import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  status: 'active' | 'inactive'
  secret?: string
  lastTriggered?: string
  successRate: number
  totalCalls: number
  createdAt: string
}

const AVAILABLE_EVENTS = [
  { id: 'conversation.started', label: 'Conversa Iniciada', icon: '💬' },
  { id: 'conversation.ended', label: 'Conversa Encerrada', icon: '🔚' },
  { id: 'message.received', label: 'Mensagem Recebida', icon: '📥' },
  { id: 'message.sent', label: 'Mensagem Enviada', icon: '📤' },
  { id: 'user.created', label: 'Usuário Criado', icon: '👤' },
  { id: 'ticket.created', label: 'Ticket Criado', icon: '🎫' },
  { id: 'ticket.resolved', label: 'Ticket Resolvido', icon: '✅' },
]

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState<Webhook | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: ''
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadWebhooks()
  }, [])

  const loadWebhooks = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/webhooks`)
      if (res.ok) setWebhooks(await res.json())
      else setWebhooks(getDefaultWebhooks())
    } catch {
      setWebhooks(getDefaultWebhooks())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultWebhooks = (): Webhook[] => [
    {
      id: '1',
      name: 'CRM Integration',
      url: 'https://api.crm.exemplo.com/webhooks/chatias',
      events: ['conversation.ended', 'message.received'],
      status: 'active',
      secret: 'whsec_xxxx',
      lastTriggered: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      successRate: 98.5,
      totalCalls: 1250,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
    },
    {
      id: '2',
      name: 'Analytics',
      url: 'https://analytics.exemplo.com/track',
      events: ['message.sent', 'message.received'],
      status: 'active',
      lastTriggered: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      successRate: 100,
      totalCalls: 5432,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()
    },
    {
      id: '3',
      name: 'Slack Notifications',
      url: 'https://hooks.slack.com/services/xxx/yyy/zzz',
      events: ['ticket.created', 'ticket.resolved'],
      status: 'inactive',
      successRate: 0,
      totalCalls: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', url: '', events: [], secret: '' })
        loadWebhooks()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleStatus = async (webhook: Webhook) => {
    try {
      await fetchWithAuth(`${API_URL}/api/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: webhook.status === 'active' ? 'inactive' : 'active' })
      })
      loadWebhooks()
    } catch (e) {
      console.error(e)
    }
  }

  const handleTestWebhook = async (webhook: Webhook) => {
    setTestingWebhook(webhook)
    try {
      await fetchWithAuth(`${API_URL}/api/webhooks/${webhook.id}/test`, {
        method: 'POST'
      })
      await new Promise(r => setTimeout(r, 2000))
      loadWebhooks()
    } catch (e) {
      console.error(e)
    } finally {
      setTestingWebhook(null)
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Excluir este webhook?')) return
    try {
      await fetchWithAuth(`${API_URL}/api/webhooks/${webhookId}`, {
        method: 'DELETE'
      })
      loadWebhooks()
    } catch (e) {
      console.error(e)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-300'
    if (rate >= 80) return 'text-yellow-300'
    return 'text-red-300'
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Webhooks</h1>
            <p className="text-sm text-text-subtle">Configure webhooks para integrar com sistemas externos</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo Webhook
          </button>
        </div>

        <div className="card p-4 mb-6 bg-blue-500/10 border-blue-500/30">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <div className="font-medium text-text-strong">O que são webhooks?</div>
              <div className="text-sm text-text-subtle">
                Webhooks permitem que sua aplicação receba notificações em tempo real quando eventos
                acontecem no ChatIAS. Configure uma URL para receber requisições HTTP.
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : webhooks.length > 0 ? (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-text-strong">{webhook.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        webhook.status === 'active' ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30 text-gray-300'
                      }`}>
                        {webhook.status}
                      </span>
                    </div>
                    <code className="text-sm text-text-interactive-base bg-surface-raised-base px-2 py-1 rounded block mb-3 w-fit">
                      {webhook.url}
                    </code>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map(eventId => {
                        const event = AVAILABLE_EVENTS.find(e => e.id === eventId)
                        return (
                          <span key={eventId} className="px-2 py-0.5 bg-surface-raised-base text-text-subtle text-xs rounded flex items-center gap-1">
                            {event?.icon} {event?.label || eventId}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestWebhook(webhook)}
                      className="btn-secondary text-sm"
                      disabled={testingWebhook?.id === webhook.id}
                    >
                      {testingWebhook?.id === webhook.id ? '⏳' : '🧪'} Testar
                    </button>
                    <button
                      onClick={() => handleToggleStatus(webhook)}
                      className={`px-3 py-1 rounded text-sm ${
                        webhook.status === 'active'
                          ? 'bg-yellow-500/30 text-yellow-300'
                          : 'bg-green-500/30 text-green-300'
                      }`}
                    >
                      {webhook.status === 'active' ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-weak-base flex gap-6 text-sm text-text-subtle">
                  <span>📅 Criado: {formatDate(webhook.createdAt)}</span>
                  <span>🕐 Último: {formatDate(webhook.lastTriggered)}</span>
                  <span>📊 Total: {webhook.totalCalls} chamadas</span>
                  <span className={getSuccessRateColor(webhook.successRate)}>
                    ✓ {webhook.successRate}% sucesso
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum webhook configurado.
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-medium text-text-strong mb-4">Eventos Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AVAILABLE_EVENTS.map(event => (
              <div key={event.id} className="card p-3 flex items-center gap-3">
                <span className="text-xl">{event.icon}</span>
                <span className="text-sm text-text-base">{event.label}</span>
                <code className="text-xs text-text-subtle ml-auto">{event.id}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Webhook</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                  className="input"
                  placeholder="Meu Webhook"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.currentTarget.value })}
                  className="input"
                  placeholder="https://..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-2">Eventos</label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map(event => (
                    <label key={event.id} className="flex items-center gap-3 p-2 hover:bg-surface-raised-base rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.id)}
                        onChange={(e) => {
                          if (e.currentTarget.checked) {
                            setFormData({ ...formData, events: [...formData.events, event.id] })
                          } else {
                            setFormData({ ...formData, events: formData.events.filter(e => e !== event.id) })
                          }
                        }}
                        className="size-4 rounded"
                      />
                      <span>{event.icon}</span>
                      <span className="text-text-base">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Secret (opcional)</label>
                <input
                  type="text"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.currentTarget.value })}
                  className="input"
                  placeholder="Used for HMAC signature verification"
                />
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
