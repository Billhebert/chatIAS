import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/chatias-core';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

function Users() {
  const { user: currentUser, tenant } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'developer' as UserRole, password: '' });
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('chatias_token');
        const response = await fetch(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.name.trim()) return;

    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        const user = await response.json();
        setUsers([...users, user]);
        setShowModal(false);
        setNewUser({ email: '', name: '', role: 'developer', password: '' });
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '3rem' }}>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Usuários</h2>
          <p className="text-muted">Gerencie os usuários da sua organização.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingUser(null); setShowModal(true); }}>
          + Adicionar Usuário
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Função</th>
              <th>Status</th>
              <th>Criado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="flex gap-2" style={{ alignItems: 'center' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: '500' }}>{user.name}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <select
                    className="input"
                    style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    value={user.role}
                    onChange={e => handleUpdateUserRole(user.id, e.target.value)}
                    disabled={user.id === currentUser?.id}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td>
                  <span className={`badge badge-${user.status === 'ACTIVE' ? 'success' : user.status === 'PENDING' ? 'warning' : 'danger'}`}>
                    {user.status === 'ACTIVE' ? 'Ativo' : user.status === 'PENDING' ? 'Pendente' : 'Inativo'}
                  </span>
                </td>
                <td className="text-muted text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <div className="flex gap-1">
                    {user.id !== currentUser?.id && (
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUser(user.id)}
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

        {users.length === 0 && (
          <div className="text-center" style={{ padding: '3rem' }}>
            <p className="text-muted">Nenhum usuário encontrado.</p>
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
            <h3 style={{ marginBottom: '1.5rem' }}>Novo Usuário</h3>
            
            <div className="input-group">
              <label>Nome Completo *</label>
              <input
                type="text"
                className="input"
                placeholder="Nome do usuário"
                value={newUser.name}
                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Email *</label>
              <input
                type="email"
                className="input"
                placeholder="email@empresa.com"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Senha {editingUser ? '(deixe vazio para manter)' : '*'}</label>
              <input
                type="password"
                className="input"
                placeholder="Senha do usuário"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Função</label>
              <select 
                className="input"
                value={newUser.role}
                onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              >
                <option value="admin">Admin - Acesso total</option>
                <option value="manager">Manager - Gerenciar recursos</option>
                <option value="developer">Developer - Usar ferramentas e agentes</option>
                <option value="viewer">Viewer - Acesso apenas leitura</option>
              </select>
            </div>

            <div className="flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateUser}
                disabled={!newUser.email.trim() || !newUser.name.trim()}
              >
                Criar Usuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
