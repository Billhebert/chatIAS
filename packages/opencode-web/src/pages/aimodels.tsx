import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface AIModel {
  id: string
  name: string
  provider: string
  modelId: string
  status: 'active' | 'inactive'
  temperature: number
  maxTokens: number
  capabilities: string[]
  createdAt: string
}

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Groq', 'DeepSeek', 'Ollama']

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('OpenAI')
  const [formData, setFormData] = useState({
    name: '',
    modelId: '',
    apiKey: '',
    temperature: '0.7',
    maxTokens: '1000'
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/ai/models`)
      if (res.ok) setModels(await res.json())
      else setModels(getDefaultModels())
    } catch {
      setModels(getDefaultModels())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultModels = (): AIModel[] => [
    {
      id: '1',
      name: 'GPT-4o',
      provider: 'OpenAI',
      modelId: 'gpt-4o',
      status: 'active',
      temperature: 0.7,
      maxTokens: 4096,
      capabilities: ['chat', 'function_call', 'vision'],
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'GPT-4o-mini',
      provider: 'OpenAI',
      modelId: 'gpt-4o-mini',
      status: 'active',
      temperature: 0.7,
      maxTokens: 4096,
      capabilities: ['chat', 'function_call'],
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      modelId: 'claude-sonnet-4-20250514',
      status: 'active',
      temperature: 0.7,
      maxTokens: 4096,
      capabilities: ['chat', 'vision', 'reasoning'],
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'DeepSeek Chat',
      provider: 'DeepSeek',
      modelId: 'deepseek-chat',
      status: 'inactive',
      temperature: 0.7,
      maxTokens: 4096,
      capabilities: ['chat'],
      createdAt: new Date().toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/ai/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          provider: selectedProvider,
          temperature: parseFloat(formData.temperature),
          maxTokens: parseInt(formData.maxTokens)
        })
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', modelId: '', apiKey: '', temperature: '0.7', maxTokens: '1000' })
        loadModels()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleStatus = async (model: AIModel) => {
    try {
      await fetchWithAuth(`${API_URL}/api/ai/models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: model.status === 'active' ? 'inactive' : 'active' })
      })
      loadModels()
    } catch (e) {
      console.error(e)
    }
  }

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'OpenAI': return 'bg-green-500/30 text-green-300'
      case 'Anthropic': return 'bg-orange-500/30 text-orange-300'
      case 'Google': return 'bg-blue-500/30 text-blue-300'
      case 'Groq': return 'bg-purple-500/30 text-purple-300'
      case 'DeepSeek': return 'bg-cyan-500/30 text-cyan-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  const getCapabilityIcon = (cap: string) => {
    switch (cap) {
      case 'chat': return '💬'
      case 'vision': return '👁️'
      case 'function_call': return '🔧'
      case 'reasoning': return '🧠'
      default: return '⚡'
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">AI Models</h1>
            <p className="text-sm text-text-subtle">Configure modelos de IA para seu chatbot</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo Modelo
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {PROVIDERS.map(provider => {
            const count = models.filter(m => m.provider === provider && m.status === 'active').length
            return (
              <div key={provider} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${getProviderColor(provider)}`}>
                      {provider}
                    </span>
                  </div>
                  <span className="text-sm text-text-subtle">{count} ativo(s)</span>
                </div>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : models.length > 0 ? (
          <div className="space-y-4">
            {models.map(model => (
              <div key={model.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-text-strong">{model.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getProviderColor(model.provider)}`}>
                        {model.provider}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        model.status === 'active' ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30 text-gray-300'
                      }`}>
                        {model.status}
                      </span>
                    </div>
                    <div className="text-sm text-text-subtle mb-2">Model ID: {model.modelId}</div>
                    <div className="flex flex-wrap gap-2">
                      {model.capabilities.map(cap => (
                        <span key={cap} className="px-2 py-0.5 bg-surface-raised-base text-text-subtle text-xs rounded flex items-center gap-1">
                          {getCapabilityIcon(cap)} {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(model)}
                      className={`px-3 py-1 rounded text-sm ${
                        model.status === 'active'
                          ? 'bg-yellow-500/30 text-yellow-300 hover:bg-yellow-500/50'
                          : 'bg-green-500/30 text-green-300 hover:bg-green-500/50'
                      }`}
                    >
                      {model.status === 'active' ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className="p-2 hover:bg-surface-raised-hover rounded text-text-subtle">
                      ⚙️
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border-weak-base flex gap-6 text-sm text-text-subtle">
                  <span>Temperature: {model.temperature}</span>
                  <span>Max Tokens: {model.maxTokens}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum modelo configurado.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Modelo de IA</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Provedor</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.currentTarget.value)}
                  className="input"
                >
                  {PROVIDERS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                  className="input"
                  placeholder="GPT-4o"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Model ID</label>
                <input
                  type="text"
                  value={formData.modelId}
                  onChange={(e) => setFormData({ ...formData, modelId: e.currentTarget.value })}
                  className="input"
                  placeholder="gpt-4o"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">API Key</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.currentTarget.value })}
                  className="input"
                  placeholder="sk-..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.currentTarget.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData({ ...formData, maxTokens: e.currentTarget.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
