import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface APIKey {
  id: string
  name: string
  key: string
  prefix: string
  permissions: string[]
  lastUsed?: string
  expiresAt?: string
  status: 'active' | 'revoked'
  createdAt: string
}

export default function APIKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newKey, setNewKey] = useState<APIKey | null>(null)
  const [formData, setFormData] = useState({ name: '', permissions: [] as string[] })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/api-keys`)
      if (res.ok) setKeys(await res.json())
      else setKeys(getDefaultKeys())
    } catch {
      setKeys(getDefaultKeys())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultKeys = (): APIKey[] => [
    {
      id: '1',
      name: 'Produção',
      key: 'ck_xxxx_prod_xxxxxxxxxxxxx',
      prefix: 'ck_xxxx_prod_',
      permissions: ['read', 'write', 'webhooks'],
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      lastUsed: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      id: '2',
      name: 'Desenvolvimento',
      key: 'ck_xxxx_dev_xxxxxxxxxxxx',
      prefix: 'ck_xxxx_dev_',
      permissions: ['read', 'write'],
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
      id: '3',
      name: 'Antiga Chave',
      key: 'ck_old_xxxx_xxxxxxxxxxxxx',
      prefix: 'ck_old_xxxx_',
      permissions: ['read'],
      status: 'revoked',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString()
    },
  ]

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        const key = await res.json()
        setNewKey(key)
        setFormData({ name: '', permissions: [] })
        loadKeys()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Revogar esta chave? Esta ação não pode ser desfeita.')) return
    try {
      await fetchWithAuth(`${API_URL}/api/api-keys/${keyId}`, {
        method: 'DELETE'
      })
      loadKeys()
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copiado para a área de transferência!')
  }

  const ALL_PERMISSIONS = [
    { id: 'read', label: 'Leitura', icon: '👁️' },
    { id: 'write', label: 'Escrita', icon: '✏️' },
    { id: 'webhooks', label: 'Webhooks', icon: '🪝' },
    { id: 'admin', label: 'Admin', icon: '⚙️' },
  ]

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">API Keys</h1>
            <p className="text-sm text-text-subtle">Gerencie as chaves de acesso à API</p>
          </div>
          <button onClick={() => { setShowModal(true); setNewKey(null); }} className="btn-primary">
            ➕ Nova Chave
          </button>
        </div>

        <div className="card p-4 mb-6 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-medium text-text-strong">Mantenha suas chaves seguras</div>
              <div className="text-sm text-text-subtle">
                Nunca compartilhe suas chaves em repositórios públicos ou mensagens.
                A chave só é mostrada uma vez após a criação.
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : keys.length > 0 ? (
          <div className="space-y-4">
            {keys.map(key => (
              <div key={key.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-text-strong">{key.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        key.status === 'active' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
                      }`}>
                        {key.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-sm bg-surface-raised-base px-2 py-1 rounded text-text-base">
                        {key.prefix}•••••••••••••••
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="p-1 hover:bg-surface-raised-hover rounded text-text-subtle"
                        title="Copiar chave completa"
                      >
                        📋
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {key.permissions.map(perm => {
                        const permInfo = ALL_PERMISSIONS.find(p => p.id === perm)
                        return (
                          <span key={perm} className="px-2 py-0.5 bg-surface-raised-base text-text-subtle text-xs rounded flex items-center gap-1">
                            {permInfo?.icon} {permInfo?.label}
                          </span>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 text-sm text-text-subtle">
                      <span>📅 Criado: {formatDate(key.createdAt)}</span>
                      {key.lastUsed && <span>🕐 Último uso: {formatDate(key.lastUsed)}</span>}
                    </div>
                  </div>
                  {key.status === 'active' && (
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="btn-secondary text-sm text-red-400"
                    >
                      Revogar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhuma chave configurada.
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-medium text-text-strong mb-4">Documentação da API</h2>
          <div className="card p-4">
            <p className="text-sm text-text-subtle mb-4">
              Use suas chaves de API para integrar com sistemas externos.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-surface-raised-base rounded">
                <span className="text-sm text-text-base">Endpoint Base</span>
                <code className="text-sm text-text-interactive-base">/api/v1</code>
              </div>
              <div className="flex items-center justify-between p-2 bg-surface-raised-base rounded">
                <span className="text-sm text-text-base">Autenticação</span>
                <span className="text-sm text-text-subtle">Bearer Token</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-surface-raised-base rounded">
                <span className="text-sm text-text-base">Rate Limit</span>
                <span className="text-sm text-text-subtle">100 req/min</span>
              </div>
            </div>
            <button className="btn-secondary mt-4">📖 Ver Documentação</button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            {newKey ? (
              <>
                <h3 className="text-lg font-medium text-text-strong mb-4">Nova Chave Criada</h3>
                <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg mb-4">
                  <div className="text-sm text-text-subtle mb-2">
                    Esta é a única vez que você verá esta chave:
                  </div>
                  <code className="block p-3 bg-surface-raised-base rounded text-sm break-all">
                    {newKey.key}
                  </code>
                </div>
                <button onClick={() => copyToClipboard(newKey.key)} className="btn-primary w-full mb-4">
                  📋 Copiar Chave
                </button>
                <p className="text-sm text-text-subtle">
                  Guarde esta chave em um local seguro. Você não poderá vê-la novamente.
                </p>
                <button onClick={() => setShowModal(false)} className="btn-secondary w-full mt-4">
                  Já salvei minha chave
                </button>
              </>
            ) : (
              <form onSubmit={handleCreateKey}>
                <h3 className="text-lg font-medium text-text-strong mb-4">Nova API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                      className="input"
                      placeholder="Minha API Key"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-2">Permissões</label>
                    <div className="space-y-2">
                      {ALL_PERMISSIONS.map(perm => (
                        <label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-surface-raised-base rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.currentTarget.checked) {
                                setFormData({ ...formData, permissions: [...formData.permissions, perm.id] })
                              } else {
                                setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm.id) })
                              }
                            }}
                            className="size-4 rounded"
                          />
                          <span>{perm.icon}</span>
                          <span className="text-text-base">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border-weak-base">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary">Criar Chave</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
