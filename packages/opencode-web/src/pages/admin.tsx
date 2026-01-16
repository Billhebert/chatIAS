import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface User {
  id: string
  username?: string
  email?: string
  name?: string
  role: string
  status?: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')

  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    if (user.role !== 'master' && user.role !== 'admin') return
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users`)
      if (res.ok) setUsers(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (user.role !== 'master' && user.role !== 'admin') {
    return (
      <div className="size-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-text-strong mb-2">Acesso Negado</h1>
          <p className="text-text-subtle">Você não tem permissão.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-strong mb-6">Administração</h1>

        <div className="flex gap-2 mb-6 border-b border-border-weak-base">
          {['users', 'access-levels', 'rag', 'integrations'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm ${
                activeTab === tab
                  ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                  : 'text-text-subtle hover:text-text-base'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <div>
            <h2 className="text-lg font-medium text-text-strong mb-4">Usuários ({users.length})</h2>
            {loading ? (
              <div className="card text-center text-text-subtle">Carregando...</div>
            ) : users.length > 0 ? (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium">
                        {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-text-strong">{u.name || u.username}</div>
                        <div className="text-xs text-text-subtle">{u.email}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      u.role === 'master' ? 'bg-purple-500/30 text-purple-300' :
                      u.role === 'admin' ? 'bg-blue-500/30 text-blue-300' :
                      'bg-gray-500/30 text-gray-300'
                    }`}>{u.role}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center text-text-subtle">Nenhum usuário.</div>
            )}
          </div>
        )}

        {activeTab === 'access-levels' && (
          <div className="card text-center text-text-subtle">
            Níveis de acesso em desenvolvimento.
          </div>
        )}

        {activeTab === 'rag' && (
          <div className="card text-center text-text-subtle">
            Base de conhecimento em desenvolvimento.
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="card text-center text-text-subtle">
            Integrações em desenvolvimento.
          </div>
        )}
      </div>
    </div>
  )
}
