import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Company {
  id: string;
  name: string;
  document?: string;
  documentType?: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    document: '',
    documentType: 'CNPJ',
    email: '',
    phone: ''
  });

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/companies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateCompany = async () => {
    if (!newCompany.name.trim()) return;
    
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newCompany)
      });

      if (response.ok) {
        const company = await response.json();
        setCompanies([...companies, company]);
        setShowModal(false);
        setNewCompany({ name: '', document: '', documentType: 'CNPJ', email: '', phone: '' });
      }
    } catch (error) {
      console.error('Failed to create company:', error);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta empresa?')) return;
    
    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/companies/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanies(companies.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Empresas</h2>
          <p className="text-muted">Gerencie as empresas/clientes da sua organização.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nova Empresa
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>{companies.length}</div>
          <div className="text-muted text-sm">Total de Empresas</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-success)' }}>
            {companies.filter(c => c.status === 'ACTIVE').length}
          </div>
          <div className="text-muted text-sm">Ativas</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-primary)' }}>
            {companies.filter(c => c.status === 'SUSPENDED').length}
          </div>
          <div className="text-muted text-sm">Suspensas</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center" style={{ padding: '3rem' }}>
            <p>Carregando empresas...</p>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Documento</th>
                  <th>Contato</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr key={company.id}>
                    <td>
                      <div className="font-bold">{company.name}</div>
                    </td>
                    <td>
                      <code style={{ background: 'var(--color-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                        {company.document || '-'}
                      </code>
                      {company.documentType && (
                        <span className="text-xs text-muted ml-2">{company.documentType}</span>
                      )}
                    </td>
                    <td>
                      <div className="text-sm">{company.email || '-'}</div>
                      <div className="text-xs text-muted">{company.phone || '-'}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${company.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                        {company.status === 'ACTIVE' ? 'ATIVA' : company.status === 'SUSPENDED' ? 'SUSPENSA' : 'INATIVA'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-secondary">Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCompany(company.id)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {companies.length === 0 && (
              <div className="text-center" style={{ padding: '3rem' }}>
                <p className="text-muted">Nenhuma empresa cadastrada ainda.</p>
                <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
                  Cadastrar Primeira Empresa
                </button>
              </div>
            )}
          </>
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
          <div className="card" style={{ width: '500px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Nova Empresa</h3>
            
            <div className="input-group">
              <label>Nome da Empresa *</label>
              <input
                type="text"
                className="input"
                placeholder="Nome da empresa"
                value={newCompany.name}
                onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
              />
            </div>

            <div className="grid grid-2">
              <div className="input-group">
                <label>Documento</label>
                <input
                  type="text"
                  className="input"
                  placeholder="CNPJ/CPF"
                  value={newCompany.document}
                  onChange={e => setNewCompany({ ...newCompany, document: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Tipo</label>
                <select 
                  className="input"
                  value={newCompany.documentType}
                  onChange={e => setNewCompany({ ...newCompany, documentType: e.target.value })}
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                </select>
              </div>
            </div>

            <div className="grid grid-2">
              <div className="input-group">
                <label>Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="email@empresa.com"
                  value={newCompany.email}
                  onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Telefone</label>
                <input
                  type="text"
                  className="input"
                  placeholder="(11) 99999-9999"
                  value={newCompany.phone}
                  onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-1 mt-4" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateCompany}
                disabled={!newCompany.name.trim()}
              >
                Cadastrar Empresa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Companies;
