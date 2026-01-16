import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TenantPlan } from '../types/chatias-core'

const API_URL = import.meta.env.VITE_API_URL || ''

function Tenants() {
  const { user, tenant: currentTenant } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tenants, setTenants] = useState<any[]>([])
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'starter' as TenantPlan })

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const token = localStorage.getItem('chatias_token')
        const response = await fetch(`${API_URL}/api/tenants`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setTenants(data)
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error)
      }
    }
    fetchTenants()
  }, [])

  const handleCreateTenant = async () => {
    if (!newTenant.name.trim()) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('chatias_token')
      const response = await fetch(`${API_URL}/api/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTenant)
      })
      
      if (response.ok) {
        const tenant = await response.json()
        setTenants([...tenants, tenant])
        setShowModal(false)
        setNewTenant({ name: '', slug: '', plan: 'starter' })
      }
    } catch (error) {
      console.error('Failed to create tenant:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('Tem certeza que deseja excluir este tenant?')) return
    
    try {
      const token = localStorage.getItem('chatias_token')
      await fetch(`${API_URL}/api/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setTenants(tenants.filter(t => t.id !== tenantId))
    } catch (error) {
      console.error('Failed to delete tenant:', error)
    }
  }

  if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
    return (
      <div className="text-center" style={{ padding: '3rem' }}>
        <h2>Acesso Negado</h2>
        <p className="text-muted">Você não tem permissão para gerenciar tenants.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Tenants</h2>
          <p className="text-muted">Gerencie suas organizações multi-tenant.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Criar Tenant
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Criado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(tenant => (
              <tr key={tenant.id}>
                <td>
                  <div style={{ fontWeight: '500' }}>{tenant.name}</div>
                  <div className="text-xs text-muted">ID: {tenant.id.substring(0, 8)}...</div>
                </td>
                <td>
                  <code style={{ background: 'var(--color-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {tenant.slug}
                  </code>
                </td>
                <td>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {tenant.plan?.toLowerCase()}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${tenant.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="text-muted text-sm">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <div className="flex gap-1">
                    {currentTenant?.id !== tenant.id && (
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteTenant(tenant.id)}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tenants.length === 0 && (
          <div className="text-center" style={{ padding: '3rem' }}>
            <p className="text-muted">Nenhum tenant encontrado.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Criar Novo Tenant</h3>
            
            <div className="input-group">
              <label>Nome do Tenant *</label>
              <input
                type="text"
                className="input"
                placeholder="Nome da organização"
                value={newTenant.name}
                onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Slug (opcional)</label>
              <input
                type="text"
                className="input"
                placeholder="auto-gerado se vazio"
                value={newTenant.slug}
                onChange={e => setNewTenant({ ...newTenant, slug: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Plano</label>
              <select 
                className="input"
                value={newTenant.plan}
                onChange={e => setNewTenant({ ...newTenant, plan: e.target.value as TenantPlan })}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div className="flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateTenant}
                disabled={!newTenant.name.trim() || loading}
              >
                {loading ? 'Criando...' : 'Criar Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tenants
