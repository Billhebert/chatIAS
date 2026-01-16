import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Company {
  id: string
  name: string
  legalName?: string
  document?: string
  email?: string
  phone?: string
  status: string
  createdAt: string
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', legalName: '', document: '', email: '', phone: '' })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/companies`)
      if (res.ok) setCompanies(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', legalName: '', document: '', email: '', phone: '' })
        loadCompanies()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Companies</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Nova
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : companies.length > 0 ? (
          <div className="space-y-3">
            {companies.map(company => (
              <div key={company.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-strong">{company.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        company.status === 'ACTIVE' ? 'bg-green-500/30 text-green-300' :
                        'bg-gray-500/30 text-gray-300'
                      }`}>{company.status}</span>
                    </div>
                    {company.legalName && (
                      <p className="text-sm text-text-subtle mt-1">{company.legalName}</p>
                    )}
                    {company.document && (
                      <p className="text-sm text-text-subtle">CNPJ: {company.document}</p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Excluir empresa?')) {
                        await fetchWithAuth(`${API_URL}/api/companies/${company.id}`, { method: 'DELETE' })
                        loadCompanies()
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
            Nenhuma empresa encontrada.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Nova Empresa</h3>
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
                <label className="block text-sm font-medium text-text-base mb-1">Razão Social</label>
                <input
                  type="text"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.currentTarget.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">CNPJ</label>
                <input
                  type="text"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.currentTarget.value })}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.currentTarget.value })}
                    className="input"
                  />
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
