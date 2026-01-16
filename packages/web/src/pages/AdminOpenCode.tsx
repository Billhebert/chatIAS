import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { api } from '@/lib/api'

type Tab = 'users' | 'access-levels' | 'rag' | 'integrations'

interface User {
  id: string
  username: string
  email: string
  role: 'master' | 'admin' | 'user'
  accessLevelId?: string
  isActive: boolean
  createdAt: string
}

interface AccessLevel {
  id: string
  name: string
  description?: string
  permissions: {
    providers: string[]
    models: string[]
    agents: string[]
    tools: string[]
    canCreateSessions: boolean
    canArchiveSessions: boolean
    canShareSessions: boolean
    canAccessTerminal: boolean
    canAccessFiles: boolean
    canExecuteCommands: boolean
    maxSessionsPerDay: number
    maxMessagesPerSession: number
  }
  createdAt: string
}

interface KnowledgeBase {
  id: string
  name: string
  description?: string
  embeddingProvider: string
  embeddingModel: string
  documentCount: number
  createdAt: string
  updatedAt: string
}

interface RAGDocument {
  id: string
  knowledgeBaseId: string
  filename: string
  mimeType: string
  size: number
  status: 'pending' | 'processing' | 'indexed' | 'error'
  errorMessage?: string
  chunkCount: number
  createdAt: string
  updatedAt: string
}

interface Integration {
  id: string
  type: string
  name: string
  description: string
  isActive: boolean
  credentials: Array<{ key: string; hasValue?: boolean }>
}

interface IntegrationTemplate {
  name: string
  fields: string[]
}

export default function AdminOpenCode() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateAccessLevel, setShowCreateAccessLevel] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingAccessLevel, setEditingAccessLevel] = useState<AccessLevel | null>(null)
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null)

  const [users, setUsers] = useState<User[]>([])
  const [accessLevels, setAccessLevels] = useState<AccessLevel[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me')
      if (res.ok) {
        const user = await res.json()
        setCurrentUser(user)

        if (user.role !== 'master' && user.role !== 'admin') {
          navigate('/')
          return
        }

        await Promise.all([loadUsers(), loadAccessLevels()])
      } else {
        navigate('/login')
      }
    } catch (e) {
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await api.get('/users')
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (e) {
      console.error('Error loading users:', e)
    }
  }

  const loadAccessLevels = async () => {
    try {
      const res = await api.get('/access-levels')
      if (res.ok) {
        setAccessLevels(await res.json())
      }
    } catch (e) {
      console.error('Error loading access levels:', e)
    }
  }

  const isMaster = () => currentUser?.role === 'master'
  const isAdmin = () => currentUser?.role === 'master' || currentUser?.role === 'admin'

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-text-subtle">Carregando...</div>
        </div>
      </Layout>
    )
  }

  if (!isMaster() && !isAdmin()) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <span className="text-4xl">🔒</span>
          <h1 className="text-xl font-bold text-text-strong">Acesso Negado</h1>
          <p className="text-text-subtle">Você não tem permissão para acessar esta página.</p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => navigate('/')}
          >
            Voltar ao Início
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-surface-raised-base border border-border-weak-base p-4 rounded-lg shadow-lg">
          <div className="font-medium text-text-strong">{toast.title}</div>
          {toast.description && <div className="text-sm text-text-subtle">{toast.description}</div>}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-bold text-text-strong">Administração</h1>
          </div>

          <p className="text-text-subtle mt-1 mb-6">
            Gerencie usuários, níveis de acesso e permissões do sistema.
          </p>

          <div className="flex gap-2 mb-6 border-b border-border-weak-base overflow-x-auto">
            <button
              className={`px-4 py-2 text-14-medium transition-colors whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                  : 'text-text-subtle hover:text-text-base'
              }`}
              onClick={() => setActiveTab('users')}
            >
              Usuários ({users.length})
            </button>
            {isMaster() && (
              <button
                className={`px-4 py-2 text-14-medium transition-colors whitespace-nowrap ${
                  activeTab === 'access-levels'
                    ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                    : 'text-text-subtle hover:text-text-base'
                }`}
                onClick={() => setActiveTab('access-levels')}
              >
                Níveis de Acesso
              </button>
            )}
            {(isMaster() || isAdmin()) && (
              <button
                className={`px-4 py-2 text-14-medium transition-colors whitespace-nowrap ${
                  activeTab === 'rag'
                    ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                    : 'text-text-subtle hover:text-text-base'
                }`}
                onClick={() => setActiveTab('rag')}
              >
                Base de Conhecimento
              </button>
            )}
            {isMaster() && (
              <button
                className={`px-4 py-2 text-14-medium transition-colors whitespace-nowrap ${
                  activeTab === 'integrations'
                    ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                    : 'text-text-subtle hover:text-text-base'
                }`}
                onClick={() => setActiveTab('integrations')}
              >
                Integrações
              </button>
            )}
          </div>

          {activeTab === 'users' && (
            <UsersTab
              users={users}
              accessLevels={accessLevels}
              currentUser={currentUser}
              showCreate={showCreateUser}
              setShowCreate={setShowCreateUser}
              editingUser={editingUser}
              setEditingUser={setEditingUser}
              onUserChange={loadUsers}
              setToast={setToast}
            />
          )}

          {activeTab === 'access-levels' && isMaster() && (
            <AccessLevelsTab
              accessLevels={accessLevels}
              showCreate={showCreateAccessLevel}
              setShowCreate={setShowCreateAccessLevel}
              editingLevel={editingAccessLevel}
              setEditingLevel={setEditingAccessLevel}
              onChange={loadAccessLevels}
              setToast={setToast}
            />
          )}

          {activeTab === 'rag' && (isMaster() || isAdmin()) && (
            <RAGTab setToast={setToast} />
          )}

          {activeTab === 'integrations' && isMaster() && (
            <IntegrationsTab setToast={setToast} />
          )}
        </div>
      </div>
    </Layout>
  )
}

function UsersTab({ users, accessLevels, currentUser, showCreate, setShowCreate, editingUser, setEditingUser, onUserChange, setToast }: any) {
  const roleLabel: Record<string, string> = {
    master: 'Master',
    admin: 'Administrador',
    user: 'Usuário',
  }

  const roleColor: Record<string, string> = {
    master: 'bg-purple-500/30 text-purple-300 border border-purple-500/40',
    admin: 'bg-blue-500/30 text-blue-300 border border-blue-500/40',
    user: 'bg-gray-500/30 text-gray-300 border border-gray-500/40',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text-strong">Usuários</h2>
        <button
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-2"
          onClick={() => setShowCreate(true)}
        >
          ➕ Novo Usuário
        </button>
      </div>

      {showCreate && (
        <CreateUserForm
          accessLevels={accessLevels}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onUserChange(); }}
          setToast={setToast}
        />
      )}

      {editingUser && (
        <EditUserForm
          user={editingUser}
          accessLevels={accessLevels}
          onClose={() => setEditingUser(null)}
          onUpdated={() => { setEditingUser(null); onUserChange(); }}
          setToast={setToast}
        />
      )}

      <div className="space-y-2">
        {users.map((user: User) => (
          <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-surface-raised-base-hover flex items-center justify-center">
                <span className="text-lg font-medium text-text-strong">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-strong">{user.username}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${roleColor[user.role]}`}>
                    {roleLabel[user.role]}
                  </span>
                  {!user.isActive && (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-500/30 text-red-300 border border-red-500/40">
                      Inativo
                    </span>
                  )}
                </div>
                <div className="text-12-regular text-text-subtle">
                  {user.accessLevelId ? (
                    () => {
                      const level = accessLevels.find((a: AccessLevel) => a.id === user.accessLevelId)
                      return level ? `Nível: ${level.name}` : ''
                    }
                  ) : user.role === 'user' ? 'Nível: Padrão' : 'Acesso completo'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.id !== currentUser?.id && (
                <>
                  <button
                    className="p-2 hover:bg-surface-raised-base-hover rounded"
                    onClick={() => setEditingUser(user)}
                  >
                    ✏️
                  </button>
                  {(currentUser?.role === 'master' || (currentUser?.role === 'admin' && user.role === 'user')) && (
                    <button
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja excluir o usuário "${user.username}"?`)) {
                          const res = await api.delete(`/users/${user.id}`)
                          if (res.ok) {
                            setToast({ title: 'Usuário excluído', description: user.username })
                            onUserChange()
                          } else {
                            setToast({ title: 'Erro', description: 'Falha ao excluir' })
                          }
                        }
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateUserForm({ accessLevels, onClose, onCreated, setToast }: any) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'master' | 'admin' | 'user'>('user')
  const [accessLevelId, setAccessLevelId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Nome de usuário e senha são obrigatórios')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/users', {
        username,
        password,
        role,
        accessLevelId: role === 'user' ? accessLevelId : null,
      })

      if (res.ok) {
        setToast({ title: 'Usuário criado', description: username })
        onCreated()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao criar usuário')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 className="font-medium text-text-strong">Novo Usuário</h3>

      {error && <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Nome de usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            placeholder="usuario"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
        <div>
          <label className="block text-sm text-text-subtle mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="••••••"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Função</label>
          <select
            value={role}
            onChange={(e) => setRole(e.currentTarget.value as any)}
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="user">Usuário</option>
            <option value="admin">Administrador</option>
            <option value="master">Master</option>
          </select>
        </div>
        {role === 'user' && (
          <div>
            <label className="block text-sm text-text-subtle mb-1">Nível de Acesso</label>
            <select
              value={accessLevelId || ''}
              onChange={(e) => setAccessLevelId(e.currentTarget.value || null)}
              className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            >
              <option value="">Padrão (Restrito)</option>
              {accessLevels.map((level: AccessLevel) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? 'Criando...' : 'Criar Usuário'}
        </button>
      </div>
    </form>
  )
}

function EditUserForm({ user, accessLevels, onClose, onUpdated, setToast }: any) {
  const [username, setUsername] = useState(user.username)
  const [role, setRole] = useState(user.role)
  const [accessLevelId, setAccessLevelId] = useState(user.accessLevelId || null)
  const [isActive, setIsActive] = useState(user.isActive)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const updateRes = await api.put(`/users/${user.id}`, {
        username,
        role,
        accessLevelId: role === 'user' ? accessLevelId : null,
        isActive,
      })

      if (!updateRes.ok) {
        const data = await updateRes.json()
        setError(data.error || 'Erro ao atualizar usuário')
        return
      }

      if (newPassword) {
        const passwordRes = await api.put(`/users/${user.id}/password`, { password: newPassword })
        if (!passwordRes.ok) {
          setError('Erro ao redefinir senha')
          return
        }
      }

      setToast({ title: 'Usuário atualizado', description: username })
      onUpdated()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 className="font-medium text-text-strong">Editar Usuário: {user.username}</h3>

      {error && <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Nome de usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
        <div>
          <label className="block text-sm text-text-subtle mb-1">Nova senha (deixe em branco para manter)</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            placeholder="••••••"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Função</label>
          <select
            value={role}
            onChange={(e) => setRole(e.currentTarget.value as any)}
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="user">Usuário</option>
            <option value="admin">Administrador</option>
            <option value="master">Master</option>
          </select>
        </div>
        {role === 'user' && (
          <div>
            <label className="block text-sm text-text-subtle mb-1">Nível de Acesso</label>
            <select
              value={accessLevelId || ''}
              onChange={(e) => setAccessLevelId(e.currentTarget.value || null)}
              className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            >
              <option value="">Padrão (Restrito)</option>
              {accessLevels.map((level: AccessLevel) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm text-text-subtle mb-1">Status</label>
          <select
            value={isActive ? 'active' : 'inactive'}
            onChange={(e) => setIsActive(e.currentTarget.value === 'active')}
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded">
          Salvar Alterações
        </button>
      </div>
    </form>
  )
}

function AccessLevelsTab({ accessLevels, showCreate, setShowCreate, editingLevel, setEditingLevel, onChange, setToast }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text-strong">Níveis de Acesso ({accessLevels.length})</h2>
        <button
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-2"
          onClick={() => setShowCreate(true)}
        >
          ➕ Novo Nível
        </button>
      </div>

      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <span className="text-blue-400">ℹ️</span>
          <div>
            <h4 className="font-medium text-blue-400">Nível Padrão</h4>
            <p className="text-sm text-blue-300/80 mt-1">
              Usuários sem nível de acesso atribuído terão permissões restritas:
              sem acesso a provedores, modelos, agentes ou ferramentas específicas.
            </p>
          </div>
        </div>
      </div>

      {showCreate && (
        <AccessLevelForm
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); onChange(); }}
          setToast={setToast}
        />
      )}

      {editingLevel && (
        <AccessLevelForm
          level={editingLevel}
          onClose={() => setEditingLevel(null)}
          onSaved={() => { setEditingLevel(null); onChange(); }}
          setToast={setToast}
        />
      )}

      {accessLevels.length === 0 ? (
        <div className="text-center py-8 text-text-subtle">
          Nenhum nível de acesso criado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {accessLevels.map((level: AccessLevel) => (
            <div key={level.id} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-strong">{level.name}</span>
                  </div>
                  <p className="text-sm text-text-subtle mt-1">{level.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`px-2 py-1 rounded text-xs ${level.permissions.providers?.includes('*') ? 'bg-green-500/30 text-green-300 border border-green-500/40' : 'bg-gray-500/30 text-gray-300 border border-gray-500/40'}`}>
                      Provedores: {level.permissions.providers?.includes('*') ? 'Todos' : level.permissions.providers?.length || 0}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${level.permissions.canAccessTerminal ? 'bg-green-500/30 text-green-300 border border-green-500/40' : 'bg-gray-500/30 text-gray-300 border border-gray-500/40'}`}>
                      Terminal: {level.permissions.canAccessTerminal ? 'Sim' : 'Não'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${level.permissions.canAccessFiles ? 'bg-green-500/30 text-green-300 border border-green-500/40' : 'bg-gray-500/30 text-gray-300 border border-gray-500/40'}`}>
                      Arquivos: {level.permissions.canAccessFiles ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-surface-raised-base-hover rounded" onClick={() => setEditingLevel(level)}>
                    ✏️
                  </button>
                  <button
                    className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                    onClick={async () => {
                      if (confirm(`Tem certeza que deseja excluir o nível "${level.name}"?`)) {
                        const res = await api.delete(`/access-levels/${level.id}`)
                        if (res.ok) {
                          setToast({ title: 'Nível excluído', description: level.name })
                          onChange()
                        } else {
                          setToast({ title: 'Erro', description: 'Falha ao excluir' })
                        }
                      }
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccessLevelForm({ level, onClose, onSaved, setToast }: any) {
  const isEditing = !!level
  const [name, setName] = useState(level?.name || '')
  const [description, setDescription] = useState(level?.description || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [permissions, setPermissions] = useState({
    providers: level?.permissions?.providers || ['*'],
    models: level?.permissions?.models || [],
    agents: level?.permissions?.agents || [],
    tools: level?.permissions?.tools || [],
    canCreateSessions: level?.permissions?.canCreateSessions ?? true,
    canArchiveSessions: level?.permissions?.canArchiveSessions ?? false,
    canShareSessions: level?.permissions?.canShareSessions ?? false,
    canAccessTerminal: level?.permissions?.canAccessTerminal ?? false,
    canAccessFiles: level?.permissions?.canAccessFiles ?? false,
    canExecuteCommands: level?.permissions?.canExecuteCommands ?? false,
    maxSessionsPerDay: level?.permissions?.maxSessionsPerDay || 0,
    maxMessagesPerSession: level?.permissions?.maxMessagesPerSession || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name) {
      setError('Nome é obrigatório')
      return
    }

    setLoading(true)
    try {
      const url = isEditing ? `/access-levels/${level.id}` : '/access-levels'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await api[method](url, {
        name,
        description,
        permissions,
      })

      if (res.ok) {
        setToast({ title: isEditing ? 'Nível atualizado' : 'Nível criado', description: name })
        onSaved()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 className="font-medium text-text-strong">
        {isEditing ? `Editar Nível: ${level.name}` : 'Novo Nível de Acesso'}
      </h3>

      {error && <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Ex: Operador"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
        <div>
          <label className="block text-sm text-text-subtle mb-1">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Ex: Acesso limitado para operadores"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-strong">Recursos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-subtle mb-1">Provedores (separados por vírgula, * para todos)</label>
            <input
              type="text"
              value={permissions.providers.join(', ')}
              onChange={(e) => {
                const items = e.currentTarget.value.split(',').map(s => s.trim()).filter(Boolean)
                setPermissions(prev => ({ ...prev, providers: items }))
              }}
              placeholder="* ou provider1, provider2"
              className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            />
          </div>
          <div>
            <label className="block text-sm text-text-subtle mb-1">Modelos (separados por vírgula, * para todos)</label>
            <input
              type="text"
              value={permissions.models.join(', ')}
              onChange={(e) => {
                const items = e.currentTarget.value.split(',').map(s => s.trim()).filter(Boolean)
                setPermissions(prev => ({ ...prev, models: items }))
              }}
              placeholder="* ou gpt-4, claude-3"
              className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-strong">Funcionalidades</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: 'canCreateSessions', label: 'Criar sessões' },
            { key: 'canArchiveSessions', label: 'Arquivar sessões' },
            { key: 'canShareSessions', label: 'Compartilhar sessões' },
            { key: 'canAccessTerminal', label: 'Acessar terminal' },
            { key: 'canAccessFiles', label: 'Acessar arquivos' },
            { key: 'canExecuteCommands', label: 'Executar comandos' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions[key as keyof typeof permissions] as boolean}
                onChange={(e) => setPermissions(prev => ({ ...prev, [key]: e.currentTarget.checked }))}
                className="rounded border-border-weak-base bg-background-base"
              />
              <span className="text-sm text-text-base">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Nível'}
        </button>
      </div>
    </form>
  )
}

function RAGTab({ setToast }: { setToast: (t: any) => void }) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateKB, setShowCreateKB] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    loadKnowledgeBases()
  }, [])

  useEffect(() => {
    if (selectedKB) {
      loadDocuments(selectedKB.id)
    } else {
      setDocuments([])
    }
  }, [selectedKB])

  const loadKnowledgeBases = async () => {
    try {
      const res = await api.get('/rag/knowledge-bases')
      if (res.ok) {
        setKnowledgeBases(await res.json())
      }
    } catch (e) {
      console.error('Error loading KBs:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async (kbId: string) => {
    try {
      const res = await api.get(`/rag/knowledge-bases/${kbId}/documents`)
      if (res.ok) {
        setDocuments(await res.json())
      }
    } catch (e) {
      console.error('Error loading documents:', e)
    }
  }

  const handleDeleteKB = async (kb: KnowledgeBase) => {
    if (!confirm(`Excluir base de conhecimento "${kb.name}"?`)) return

    try {
      const res = await api.delete(`/rag/knowledge-bases/${kb.id}`)
      if (res.ok) {
        setToast({ title: 'Base excluída', description: kb.name })
        if (selectedKB?.id === kb.id) setSelectedKB(null)
        loadKnowledgeBases()
      } else {
        setToast({ title: 'Erro', description: 'Falha ao excluir' })
      }
    } catch (e) {
      setToast({ title: 'Erro', description: 'Erro de conexão' })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const statusLabel: Record<string, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    indexed: 'Indexado',
    error: 'Erro'
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40',
    processing: 'bg-blue-500/30 text-blue-300 border border-blue-500/40',
    indexed: 'bg-green-500/30 text-green-300 border border-green-500/40',
    error: 'bg-red-500/30 text-red-300 border border-red-500/40'
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text-strong">Base de Conhecimento (RAG)</h2>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 border border-border-weak-base hover:bg-surface-raised-base-hover rounded flex items-center gap-2"
            onClick={() => setShowCreateKB(true)}
          >
            ➕ Nova Base
          </button>
        </div>
      </div>

      {showCreateKB && (
        <CreateKnowledgeBaseForm
          onClose={() => setShowCreateKB(false)}
          onCreated={() => { setShowCreateKB(false); loadKnowledgeBases(); }}
          setToast={setToast}
        />
      )}

      {showUpload && selectedKB && (
        <DocumentUploadForm
          knowledgeBase={selectedKB}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); loadDocuments(selectedKB.id); loadKnowledgeBases(); }}
          setToast={setToast}
        />
      )}

      {loading ? (
        <div className="text-center py-8 text-text-subtle">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-subtle">Bases de Conhecimento ({knowledgeBases.length})</h3>
            {knowledgeBases.length === 0 ? (
              <div className="p-8 text-center text-text-subtle rounded-lg border border-dashed border-border-weak-base">
                Nenhuma base criada ainda.
              </div>
            ) : (
              knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedKB?.id === kb.id
                      ? 'bg-surface-raised-base-hover border-text-interactive-base'
                      : 'bg-surface-raised-base border-border-weak-base hover:border-border-strong-base'
                  }`}
                  onClick={() => setSelectedKB(kb)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-text-strong">{kb.name}</div>
                      <div className="text-xs text-text-subtle mt-1">
                        {kb.embeddingProvider}/{kb.embeddingModel} | {kb.documentCount} docs
                      </div>
                      {kb.description && (
                        <div className="text-sm text-text-subtle mt-1">{kb.description}</div>
                      )}
                    </div>
                    <button
                      className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        handleDeleteKB(kb)
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-subtle">
                Documentos {selectedKB ? `(${documents.length})` : ''}
              </h3>
              {selectedKB && (
                <button
                  className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                  onClick={() => setShowUpload(true)}
                >
                  Upload
                </button>
              )}
            </div>

            {!selectedKB ? (
              <div className="p-8 text-center text-text-subtle rounded-lg border border-dashed border-border-weak-base">
                Selecione uma base para ver os documentos.
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center text-text-subtle rounded-lg border border-dashed border-border-weak-base">
                Nenhum documento nesta base.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="p-3 rounded-lg bg-surface-raised-base border border-border-weak-base">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-text-subtle">📄</span>
                        <span className="font-medium text-text-strong truncate">{doc.filename}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColor[doc.status]}`}>
                          {statusLabel[doc.status]}
                        </span>
                      </div>
                      <div className="text-xs text-text-subtle mt-1 ml-6">
                        {formatFileSize(doc.size)} | {doc.chunkCount} chunks
                      </div>
                      {doc.status === 'error' && doc.errorMessage && (
                        <div className="text-xs text-red-400 mt-1 ml-6">{doc.errorMessage}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                        onClick={async () => {
                          if (confirm(`Excluir documento "${doc.filename}"?`)) {
                            const res = await api.delete(`/rag/documents/${doc.id}`)
                            if (res.ok) {
                              setToast({ title: 'Documento excluído', description: doc.filename })
                              loadDocuments(selectedKB.id)
                              loadKnowledgeBases()
                            }
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CreateKnowledgeBaseForm({ onClose, onCreated, setToast }: any) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState('ollama')
  const [model, setModel] = useState('nomic-embed-text')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/rag/knowledge-bases', {
        name,
        description,
        embeddingProvider: provider,
        embeddingModel: model,
      })

      if (res.ok) {
        setToast({ title: 'Base criada', description: name })
        onCreated()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao criar base')
      }
    } catch (e) {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 className="font-medium text-text-strong">Nova Base de Conhecimento</h3>

      {error && <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Ex: Documentação SUATEC"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-text-subtle mb-1">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Ex: Manuais e guias de uso"
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-subtle mb-1">Provider de Embeddings</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.currentTarget.value)
              if (e.currentTarget.value === 'ollama') {
                setModel('nomic-embed-text')
              } else if (e.currentTarget.value === 'openai') {
                setModel('text-embedding-3-small')
              }
            }}
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-subtle mb-1">Modelo</label>
          <select
            value={model}
            onChange={(e) => setModel(e.currentTarget.value)}
            className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            {provider === 'ollama' && (
              <>
                <option value="nomic-embed-text">nomic-embed-text</option>
                <option value="mxbai-embed-large">mxbai-embed-large</option>
                <option value="all-minilm">all-minilm</option>
              </>
            )}
            {provider === 'openai' && (
              <>
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-3-large">text-embedding-3-large</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? 'Criando...' : 'Criar Base'}
        </button>
      </div>
    </form>
  )
}

function DocumentUploadForm({ knowledgeBase, onClose, onUploaded, setToast }: any) {
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    const fileList = files
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    setError('')

    let uploaded = 0
    const total = fileList.length

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await api.upload(`/rag/knowledge-bases/${knowledgeBase.id}/documents`, formData)
        if (!res.ok) {
          const data = await res.json()
          setError(`Erro em ${file.name}: ${data.error || 'Falha no upload'}`)
        }
        uploaded++
      } catch (e) {
        setError(`Erro em ${file.name}: Falha de conexão`)
      }
    }

    setUploading(false)
    if (!error) {
      setToast({ title: 'Upload concluído', description: `${uploaded} arquivo(s) enviado(s)` })
      onUploaded()
    }
  }

  return (
    <div className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 className="font-medium text-text-strong">Upload de Documentos - {knowledgeBase.name}</h3>

      {error && <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div>
        <label className="block text-sm text-text-subtle mb-2">Selecionar arquivos</label>
        <input
          type="file"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx,.json"
          onChange={(e) => setFiles(e.currentTarget.files)}
          className="w-full text-text-base file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-surface-raised-base-hover file:text-text-strong file:cursor-pointer"
        />
        <p className="text-xs text-text-subtle mt-1">Formatos: TXT, MD, PDF, DOC, DOCX, JSON</p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded"
          onClick={onClose}
          disabled={uploading}
        >
          Cancelar
        </button>
        <button
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          onClick={handleUpload}
          disabled={uploading || !files || files.length === 0}
        >
          {uploading ? 'Enviando...' : 'Enviar Arquivos'}
        </button>
      </div>
    </div>
  )
}

function IntegrationsTab({ setToast }: { setToast: (t: any) => void }) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [templates, setTemplates] = useState<Record<string, IntegrationTemplate>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Integration | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [integrationsRes, templatesRes] = await Promise.all([
        api.get('/integration'),
        api.get('/integration/templates'),
      ])

      if (integrationsRes.ok) {
        setIntegrations(await integrationsRes.json())
      }
      if (templatesRes.ok) {
        setTemplates(await templatesRes.json())
      }
    } catch (err: any) {
      setToast({ title: 'Erro ao carregar integrações', description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta integração?')) return

    try {
      const res = await api.delete(`/integration/${id}`)
      if (res.ok) {
        setToast({ title: 'Integração removida com sucesso' })
        loadData()
      } else {
        throw new Error('Falha ao remover')
      }
    } catch (err: any) {
      setToast({ title: 'Erro ao remover integração', description: err.message })
    }
  }

  const toggleActive = async (integration: Integration) => {
    try {
      const res = await api.patch(`/integration/${integration.id}`, { isActive: !integration.isActive })
      if (res.ok) {
        setToast({ title: integration.isActive ? 'Integração desativada' : 'Integração ativada' })
        loadData()
      }
    } catch (err: any) {
      setToast({ title: 'Erro', description: err.message })
    }
  }

  const typeLabels: Record<string, string> = {
    confirm8: 'Confirm8',
    rdstation: 'RD Station',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    custom: 'Personalizado',
  }

  const typeColors: Record<string, string> = {
    confirm8: 'bg-green-500/30 text-green-300 border border-green-500/40',
    rdstation: 'bg-orange-500/30 text-orange-300 border border-orange-500/40',
    openai: 'bg-purple-500/30 text-purple-300 border border-purple-500/40',
    anthropic: 'bg-amber-500/30 text-amber-300 border border-amber-500/40',
    custom: 'bg-gray-500/30 text-gray-300 border border-gray-500/40',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-text-strong">Integrações</h2>
          <p className="text-sm text-text-subtle">Gerencie credenciais de APIs externas (Confirm8, RD Station, etc.)</p>
        </div>
        <button
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          onClick={() => setShowCreate(true)}
        >
          ➕ Nova Integração
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-subtle">Carregando...</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-8 text-text-subtle">
          <span className="text-4xl mb-4 block">🔌</span>
          <p>Nenhuma integração configurada.</p>
          <p className="text-xs mt-1">Adicione credenciais para usar as ferramentas de integração.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div key={integration.id} className="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-text-strong">{integration.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${typeColors[integration.type] || typeColors.custom}`}>
                      {typeLabels[integration.type] || integration.type}
                    </span>
                    {!integration.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40">
                        Inativo
                      </span>
                    )}
                  </div>
                  {integration.description && (
                    <p className="text-sm text-text-subtle mb-2">{integration.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {integration.credentials.map((cred, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded bg-background-base border border-border-weak-base">
                        {cred.key}: {cred.hasValue ? '••••••••' : '(não configurado)'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    className="p-2 hover:bg-surface-raised-base-hover rounded"
                    onClick={() => toggleActive(integration)}
                    title={integration.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {integration.isActive ? '⏸️' : '▶️'}
                  </button>
                  <button
                    className="p-2 hover:bg-surface-raised-base-hover rounded"
                    onClick={() => setEditing(integration)}
                  >
                    ✏️
                  </button>
                  <button
                    className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                    onClick={() => handleDelete(integration.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editing) && (
        <IntegrationForm
          templates={templates}
          integration={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSave={() => { setShowCreate(false); setEditing(null); loadData(); }}
          setToast={setToast}
        />
      )}
    </div>
  )
}

function IntegrationForm({ templates, integration, onClose, onSave, setToast }: any) {
  const isEdit = !!integration
  const [type, setType] = useState(integration?.type || 'confirm8')
  const [name, setName] = useState(integration?.name || '')
  const [description, setDescription] = useState(integration?.description || '')
  const [credentials, setCredentials] = useState<Array<{ key: string; value: string }>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const template = templates[type]
    if (template && !isEdit) {
      setCredentials(template.fields.map(f => ({ key: f, value: '' })))
    } else if (integration) {
      setCredentials(integration.credentials.map((c: any) => ({ key: c.key, value: '' })))
    }
  }, [type, templates, integration, isEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setToast({ title: 'Nome é obrigatório' })
      return
    }

    if (!isEdit) {
      const emptyCredentials = credentials.filter(c => !c.value.trim())
      if (emptyCredentials.length > 0) {
        setToast({ title: `Preencha: ${emptyCredentials.map(c => c.key).join(', ')}` })
        return
      }
    }

    setSaving(true)
    try {
      const filledCredentials = credentials.filter(c => c.value.trim())
      const body: any = { name, description }

      if (!isEdit) {
        body.type = type
        body.credentials = credentials
      } else if (filledCredentials.length > 0) {
        body.credentials = filledCredentials
      }

      const url = isEdit ? `/integration/${integration.id}` : '/integration'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await api[method](url, body)

      if (res.ok) {
        setToast({ title: isEdit ? 'Integração atualizada' : 'Integração criada' })
        onSave()
      } else {
        const data = await res.json()
        throw new Error(data.message || 'Falha ao salvar')
      }
    } catch (err: any) {
      setToast({ title: 'Erro', description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const updateCredential = (index: number, value: string) => {
    setCredentials(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], value }
      return updated
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
        <h3 className="text-lg font-medium text-text-strong mb-4">
          {isEdit ? 'Editar Integração' : 'Nova Integração'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-text-base mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.currentTarget.value)}
                className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
              >
                {Object.entries(templates).map(([key, template]) => (
                  <option key={key} value={key}>{template.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Ex: Confirm8 Produção"
              className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-base mb-1">Descrição (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              placeholder="Descrição da integração"
              className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-base mb-2">Credenciais</label>
            <div className="space-y-2">
              {credentials.map((cred, index) => (
                <div key={index}>
                  <label className="block text-xs text-text-subtle mb-1">{cred.key}</label>
                  <input
                    type="password"
                    value={cred.value}
                    onChange={(e) => updateCredential(index, e.currentTarget.value)}
                    placeholder={isEdit ? '(deixe vazio para manter)' : 'Digite o valor'}
                    className="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className="px-4 py-2 text-text-base hover:bg-surface-raised-base-hover rounded" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
