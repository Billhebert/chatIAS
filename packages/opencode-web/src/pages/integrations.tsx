import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Integration {
  id: string
  name: string
  type: string
  status: string
  config?: any
  createdAt: string
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedType, setSelectedType] = useState('EVOLUTION')
  const [formData, setFormData] = useState({ name: '', url: '', token: '', instance: '' })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/integrations`)
      if (res.ok) setIntegrations(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, type: selectedType })
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', url: '', token: '', instance: '' })
        loadIntegrations()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EVOLUTION': return '💬'
      case 'OPENAI': return '🤖'
      case 'ANTHROPIC': return '🧠'
      case 'DISCORD': return '🎮'
      case 'TELEGRAM': return '✈️'
      case 'WEBHOOK': return '🪝'
      default: return '🔌'
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'EVOLUTION': return 'Evolution API (WhatsApp)'
      case 'OPENAI': return 'OpenAI'
      case 'ANTHROPIC': return 'Anthropic Claude'
      case 'DISCORD': return 'Discord'
      case 'TELEGRAM': return 'Telegram'
      case 'WEBHOOK': return 'Webhook'
      default: return type
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Integrations</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Nova
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : integrations.length > 0 ? (
          <div className="space-y-3">
            {integrations.map(int => (
              <div key={int.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded bg-surface-raised-base flex items-center justify-center text-xl">
                      {getTypeIcon(int.type)}
                    </div>
                    <div>
                      <div className="font-medium text-text-strong">{int.name}</div>
                      <div className="text-sm text-text-subtle">{getTypeName(int.type)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      int.status === 'CONNECTED' ? 'bg-green-500/30 text-green-300' :
                      int.status === 'DISCONNECTED' ? 'bg-red-500/30 text-red-300' :
                      'bg-yellow-500/30 text-yellow-300'
                    }`}>{int.status}</span>
                    <button
                      onClick={async () => {
                        if (confirm('Excluir integração?')) {
                          await fetchWithAuth(`${API_URL}/api/integrations/${int.id}`, { method: 'DELETE' })
                          loadIntegrations()
                        }
                      }}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhuma integração encontrada.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Nova Integração</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Tipo</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.currentTarget.value)}
                  className="input"
                >
                  <option value="EVOLUTION">Evolution API (WhatsApp)</option>
                  <option value="OPENAI">OpenAI</option>
                  <option value="ANTHROPIC">Anthropic Claude</option>
                  <option value="DISCORD">Discord</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="WEBHOOK">Webhook</option>
                </select>
              </div>
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
              {selectedType === 'EVOLUTION' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-1">URL da API</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.currentTarget.value })}
                      className="input"
                      placeholder="http://localhost:8080"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-base mb-1">Token</label>
                      <input
                        type="text"
                        value={formData.token}
                        onChange={(e) => setFormData({ ...formData, token: e.currentTarget.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-base mb-1">Instância</label>
                      <input
                        type="text"
                        value={formData.instance}
                        onChange={(e) => setFormData({ ...formData, instance: e.currentTarget.value })}
                        className="input"
                      />
                    </div>
                  </div>
                </>
              )}
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
