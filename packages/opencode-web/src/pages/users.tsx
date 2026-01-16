import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  departmentId?: string
  companyId?: string
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'USER', departmentId: '', companyId: '' })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadUsers()
    loadDepartments()
    loadCompanies()
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

  const loadDepartments = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/departments`)
      if (res.ok) setDepartments(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const loadCompanies = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/companies`)
      if (res.ok) setCompanies(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', email: '', password: '', role: 'USER', departmentId: '', companyId: '' })
        loadUsers()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'MASTER': return 'bg-purple-500/30 text-purple-300'
      case 'OWNER': return 'bg-yellow-500/30 text-yellow-300'
      case 'ADMIN': return 'bg-blue-500/30 text-blue-300'
      case 'MANAGER': return 'bg-green-500/30 text-green-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Users</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : users.length > 0 ? (
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-text-strong">{user.name}</div>
                      <div className="text-sm text-text-subtle">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      user.status === 'ACTIVE' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
                    }`}>{user.status}</span>
                    <button
                      onClick={async () => {
                        if (confirm('Excluir usuário?')) {
                          await fetchWithAuth(`${API_URL}/api/users/${user.id}`, { method: 'DELETE' })
                          loadUsers()
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
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Usuário</h3>
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
                <label className="block text-sm font-medium text-text-base mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Senha</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.currentTarget.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Cargo</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.currentTarget.value })}
                  className="input"
                >
                  <option value="USER">User</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Empresa</label>
                  <select
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.currentTarget.value })}
                    className="input"
                  >
                    <option value="">Selecionar</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Departamento</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.currentTarget.value })}
                    className="input"
                  >
                    <option value="">Selecionar</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
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
