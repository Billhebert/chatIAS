import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Department {
  id: string
  name: string
  code?: string
  description?: string
  companyId?: string
  status: string
  createdAt: string
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', code: '', description: '', companyId: '' })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadDepartments()
    loadCompanies()
  }, [])

  const loadDepartments = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/departments`)
      if (res.ok) setDepartments(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
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
      const res = await fetchWithAuth(`${API_URL}/api/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', code: '', description: '', companyId: '' })
        loadDepartments()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Departments</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : departments.length > 0 ? (
          <div className="space-y-3">
            {departments.map(dept => (
              <div key={dept.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-strong">{dept.name}</span>
                      {dept.code && (
                        <span className="px-2 py-0.5 rounded text-xs bg-surface-raised-base text-text-subtle">
                          {dept.code}
                        </span>
                      )}
                    </div>
                    {dept.description && (
                      <p className="text-sm text-text-subtle mt-1">{dept.description}</p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Excluir departamento?')) {
                        await fetchWithAuth(`${API_URL}/api/departments/${dept.id}`, { method: 'DELETE' })
                        loadDepartments()
                      }
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
          <div className="card text-center text-text-subtle">
            Nenhum departamento encontrado.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Departamento</h3>
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
                <label className="block text-sm font-medium text-text-base mb-1">Código</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.currentTarget.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Empresa</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.currentTarget.value })}
                  className="input"
                >
                  <option value="">Selecionar empresa</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
