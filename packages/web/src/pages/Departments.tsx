import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Department {
  id: string;
  name: string;
  code?: string;
  parentId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    code: '',
    parentId: '',
    companyId: ''
  });

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const buildTree = (items: Department[], parentId: string | null = null): (Department & { children: Department[] })[] => {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }));
  };

  const departmentTree = buildTree(departments);

  const handleCreateDepartment = async () => {
    if (!newDepartment.name.trim()) return;

    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newDepartment.name,
          code: newDepartment.code,
          parentId: newDepartment.parentId || undefined
        })
      });

      if (response.ok) {
        const department = await response.json();
        setDepartments([...departments, department]);
        setShowModal(false);
        setNewDepartment({ name: '', code: '', parentId: '', companyId: '' });
      }
    } catch (error) {
      console.error('Failed to create department:', error);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este departamento?')) return;

    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(departments.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  };

  const renderDepartment = (dept: Department & { children: Department[] }, level = 0) => (
    <div key={dept.id}>
      <div className="flex gap-2" style={{ 
        padding: '0.75rem', 
        borderBottom: '1px solid var(--color-border)',
        alignItems: 'center',
        marginLeft: level * 20
      }}>
        <span style={{ 
          fontSize: level === 0 ? '1.25rem' : '1rem',
          color: level === 0 ? 'var(--color-text)' : 'var(--color-text-secondary)'
        }}>
          {dept.children && dept.children.length > 0 ? '📁' : '📄'}
        </span>
        <div style={{ flex: 1 }}>
          <div className="font-bold">{dept.name}</div>
          {dept.code && <div className="text-xs text-muted">Código: {dept.code}</div>}
        </div>
        <div className={`badge badge-${dept.status === 'ACTIVE' ? 'success' : 'warning'}`}>
          {dept.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}
        </div>
        <div className="flex gap-1">
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setSelectedParent(dept.id);
              setShowModal(true);
            }}
          >
            + Sub-depto
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteDepartment(dept.id)}>
            Excluir
          </button>
        </div>
      </div>
      {dept.children?.map(child => renderDepartment(child, level + 1))}
    </div>
  );

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Departamentos</h2>
          <p className="text-muted">Organize usuários em departamentos e sub-departamentos.</p>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-primary" onClick={() => { setSelectedParent(null); setShowModal(true); }}>
            + Novo Departamento
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>{departments.length}</div>
          <div className="text-muted text-sm">Total de Departamentos</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>
            {departments.filter(d => d.children && d.children.length > 0).length}
          </div>
          <div className="text-muted text-sm">Com Sub-departamentos</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-primary)' }}>
            {departmentTree.length}
          </div>
          <div className="text-muted text-sm">Departamentos Raiz</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Hierarquia de Departamentos</h3>
        {loading ? (
          <div className="text-center" style={{ padding: '2rem' }}>
            <p>Carregando...</p>
          </div>
        ) : departmentTree.length > 0 ? (
          <div>
            {departmentTree.map(dept => renderDepartment(dept))}
          </div>
        ) : (
          <div className="text-center" style={{ padding: '2rem' }}>
            <p className="text-muted">Nenhum departamento cadastrado.</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
              Criar Primeiro Departamento
            </button>
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
          <div className="card" style={{ width: '450px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>
              {selectedParent ? 'Novo Sub-departamento' : 'Novo Departamento'}
            </h3>
            
            {selectedParent && (
              <div style={{ 
                marginBottom: '1rem', 
                padding: '0.5rem', 
                background: 'var(--color-bg)', 
                borderRadius: 'var(--radius)',
                fontSize: '0.875rem'
              }}>
                Pertence a: <strong>{departments.find(d => d.id === selectedParent)?.name}</strong>
              </div>
            )}

            <div className="input-group">
              <label>Nome do Departamento *</label>
              <input
                type="text"
                className="input"
                placeholder="Ex: Tecnologia, Vendas, RH"
                value={newDepartment.name}
                onChange={e => setNewDepartment({ ...newDepartment, name: e.target.value })}
              />
            </div>

            <div className="grid grid-2">
              <div className="input-group">
                <label>Código</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: TI, RH"
                  value={newDepartment.code}
                  onChange={e => setNewDepartment({ ...newDepartment, code: e.target.value })}
                />
              </div>
              {!selectedParent && (
                <div className="input-group">
                  <label>Departamento Pai</label>
                  <select 
                    className="input"
                    value={newDepartment.parentId}
                    onChange={e => setNewDepartment({ ...newDepartment, parentId: e.target.value })}
                  >
                    <option value="">Nenhum (Departamento principal)</option>
                    {departments.filter(d => !selectedParent || d.id !== selectedParent).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-1 mt-4" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateDepartment}
                disabled={!newDepartment.name.trim()}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Departments;
