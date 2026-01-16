import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Role {
  id: string
  name: string
  description?: string
  permissions: string[]
  usersCount: number
  isSystem: boolean
  createdAt: string
}

const ALL_PERMISSIONS = [
  { id: 'conversations.view', label: 'Ver Conversas', category: 'Conversas' },
  { id: 'conversations.reply', label: 'Responder Conversas', category: 'Conversas' },
  { id: 'conversations.transfer', label: 'Transferir Conversas', category: 'Conversas' },
  { id: 'conversations.assign', label: 'Atribuir Conversas', category: 'Conversas' },
  { id: 'users.view', label: 'Ver Usuários', category: 'Usuários' },
  { id: 'users.create', label: 'Criar Usuários', category: 'Usuários' },
  { id: 'users.edit', label: 'Editar Usuários', category: 'Usuários' },
  { id: 'users.delete', label: 'Excluir Usuários', category: 'Usuários' },
  { id: 'companies.view', label: 'Ver Empresas', category: 'Empresas' },
  { id: 'companies.edit', label: 'Editar Empresas', category: 'Empresas' },
  { id: 'reports.view', label: 'Ver Relatórios', category: 'Relatórios' },
  { id: 'reports.export', label: 'Exportar Relatórios', category: 'Relatórios' },
  { id: 'settings.view', label: 'Ver Configurações', category: 'Configurações' },
  { id: 'settings.edit', label: 'Editar Configurações', category: 'Configurações' },
  { id: 'admin', label: 'Acesso Admin Total', category: 'Admin' },
]

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/roles`)
      if (res.ok) setRoles(await res.json())
      else setRoles(getDefaultRoles())
    } catch {
      setRoles(getDefaultRoles())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultRoles = (): Role[] => [
    {
      id: '1',
      name: 'Admin',
      description: 'Acesso total ao sistema',
      permissions: ['admin'],
      usersCount: 1,
      isSystem: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Manager',
      description: 'Gerenciador de equipe',
      permissions: ['conversations.view', 'conversations.reply', 'conversations.transfer', 'conversations.assign', 'users.view', 'reports.view', 'reports.export'],
      usersCount: 3,
      isSystem: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Agent',
      description: 'Atendente padrão',
      permissions: ['conversations.view', 'conversations.reply', 'conversations.assign'],
      usersCount: 8,
      isSystem: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Supervisor',
      description: 'Supervisão de qualidade',
      permissions: ['conversations.view', 'conversations.reply', 'reports.view', 'reports.export'],
      usersCount: 2,
      isSystem: false,
      createdAt: new Date().toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', description: '', permissions: [] })
        loadRoles()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions
    })
    setShowModal(true)
  }

  const handleUpdateRole = async () => {
    if (!selectedRole) return
    try {
      await fetchWithAuth(`${API_URL}/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      setShowModal(false)
      setSelectedRole(null)
      setFormData({ name: '', description: '', permissions: [] })
      loadRoles()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Excluir este papel?')) return
    try {
      await fetchWithAuth(`${API_URL}/api/roles/${roleId}`, {
        method: 'DELETE'
      })
      loadRoles()
    } catch (e) {
      console.error(e)
    }
  }

  const togglePermission = (permId: string) => {
    if (formData.permissions.includes(permId)) {
      setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== permId) })
    } else {
      setFormData({ ...formData, permissions: [...formData.permissions, permId] })
    }
  }

  const groupedPermissions = ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = []
    acc[perm.category].push(perm)
    return acc
  }, {} as Record<string, typeof ALL_PERMISSIONS>)

  const getPermissionCount = (permissions: string[]) => {
    if (permissions.includes('admin')) return 'Admin Total'
    return `${permissions.length} permissão${permissions.length !== 1 ? 'ções' : ''}`
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Papéis e Permissões</h1>
            <p className="text-sm text-text-subtle">Gerencie acessos e permissões de usuários</p>
          </div>
          <button onClick={() => { setShowModal(true); setSelectedRole(null); setFormData({ name: '', description: '', permissions: [] }); }} className="btn-primary">
            ➕ Novo Papel
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : roles.length > 0 ? (
          <div className="space-y-4">
            {roles.map(role => (
              <div key={role.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-text-strong">{role.name}</span>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs rounded">
                          Sistema
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-text-subtle mb-3">{role.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-text-subtle">
                      <span>👥 {role.usersCount} usuário(s)</span>
                      <span>🔐 {getPermissionCount(role.permissions)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!role.isSystem && (
                      <>
                        <button
                          onClick={() => handleEditRole(role)}
                          className="p-2 hover:bg-surface-raised-hover rounded text-text-interactive-base"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setSelectedRole(role); setFormData({ name: role.name, description: role.description || '', permissions: role.permissions }); setShowModal(true); }}
                      className="btn-secondary text-sm"
                    >
                      Ver Permissões
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border-weak-base flex flex-wrap gap-1">
                  {role.permissions.includes('admin') ? (
                    <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded">
                      🔑 Admin Total
                    </span>
                  ) : (
                    role.permissions.slice(0, 5).map(perm => {
                      const permInfo = ALL_PERMISSIONS.find(p => p.id === perm)
                      return permInfo ? (
                        <span key={perm} className="px-2 py-0.5 bg-surface-raised-base text-text-subtle text-xs rounded">
                          {permInfo.label}
                        </span>
                      ) : null
                    })
                  )}
                  {role.permissions.length > 5 && !role.permissions.includes('admin') && (
                    <span className="px-2 py-0.5 bg-surface-raised-base text-text-subtle text-xs rounded">
                      +{role.permissions.length - 5} mais
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum papel configurado.
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-medium text-text-strong mb-4">Todas as Permissões Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category} className="card p-4">
                <h3 className="font-medium text-text-strong mb-3">{category}</h3>
                <div className="space-y-2">
                  {permissions.map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="size-4 rounded"
                        disabled={showModal && !selectedRole && formData.permissions.length > 0 && !formData.permissions.includes(perm.id)}
                      />
                      <span className="text-sm text-text-base">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-text-strong mb-4">
              {selectedRole ? 'Editar Papel' : 'Novo Papel'}
            </h3>
            <form onSubmit={selectedRole ? (e) => { e.preventDefault(); handleUpdateRole(); } : handleSubmit} className="space-y-4">
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
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-2">Permissões</label>
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <div key={category}>
                      <h4 className="text-sm text-text-subtle mb-2">{category}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {permissions.map(perm => (
                          <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="size-4 rounded"
                            />
                            <span className="text-sm text-text-base">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setSelectedRole(null); }} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {selectedRole ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
