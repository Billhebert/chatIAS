import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

type FollowUpType = 'TASK' | 'MEETING' | 'CALL' | 'EMAIL' | 'DEADLINE' | 'REMINDER';
type FollowUpPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

interface FollowUp {
  id: string;
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  dueDate?: string;
  assignedToId?: string;
  createdAt: string;
}

function FollowUps() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [newFollowUp, setNewFollowUp] = useState({
    title: '',
    description: '',
    type: 'TASK' as FollowUpType,
    priority: 'MEDIUM' as FollowUpPriority,
    dueDate: '',
    assignedToId: ''
  });

  const fetchFollowUps = async () => {
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/followups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFollowUps(data);
      }
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const filteredFollowUps = followUps.filter(fu => {
    if (filter === 'pending') return fu.status !== 'COMPLETED';
    if (filter === 'completed') return fu.status === 'COMPLETED';
    return true;
  });

  const handleCreateFollowUp = async () => {
    if (!newFollowUp.title.trim()) return;

    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/followups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newFollowUp,
          dueDate: newFollowUp.dueDate || undefined,
          assignedToId: newFollowUp.assignedToId || undefined
        })
      });

      if (response.ok) {
        const followUp = await response.json();
        setFollowUps([...followUps, followUp]);
        setShowModal(false);
        setNewFollowUp({
          title: '', description: '', type: 'TASK', priority: 'MEDIUM', dueDate: '', assignedToId: ''
        });
      }
    } catch (error) {
      console.error('Failed to create follow-up:', error);
    }
  };

  const handleStatusChange = async (id: string, status: FollowUpStatus) => {
    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/followups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      setFollowUps(followUps.map(fu => fu.id === id ? { ...fu, status } : fu));
    } catch (error) {
      console.error('Failed to update follow-up:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este follow-up?')) return;

    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/followups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFollowUps(followUps.filter(fu => fu.id !== id));
    } catch (error) {
      console.error('Failed to delete follow-up:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      TASK: '📋', MEETING: '📅', CALL: '📞', EMAIL: '📧', DEADLINE: '⏰', REMINDER: '🔔'
    };
    return icons[type] || '📌';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'var(--color-text-secondary)', MEDIUM: 'var(--color-primary)',
      HIGH: 'var(--color-warning)', URGENT: 'var(--color-danger)'
    };
    return colors[priority] || 'var(--color-text)';
  };

  const stats = {
    total: followUps.length,
    pending: followUps.filter(f => f.status === 'PENDING').length,
    inProgress: followUps.filter(f => f.status === 'IN_PROGRESS').length,
    completed: followUps.filter(f => f.status === 'COMPLETED').length
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Follow-ups e Tarefas</h2>
          <p className="text-muted">Gerencie suas tarefas, reuniões e lembretes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Novo Follow-up
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>{stats.total}</div>
          <div className="text-muted text-sm">Total</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-warning)' }}>{stats.pending}</div>
          <div className="text-muted text-sm">Pendentes</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-primary)' }}>{stats.inProgress}</div>
          <div className="text-muted text-sm">Em Andamento</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-success)' }}>{stats.completed}</div>
          <div className="text-muted text-sm">Concluídos</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {['all', 'pending', 'completed'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f as 'all' | 'pending' | 'completed')}
          >
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Concluídos'}
            ({f === 'all' ? stats.total : f === 'pending' ? stats.pending + stats.inProgress : stats.completed})
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center" style={{ padding: '3rem' }}><p>Carregando...</p></div>
        ) : filteredFollowUps.length > 0 ? (
          <div>
            {filteredFollowUps.map(fu => (
              <div key={fu.id} style={{
                padding: '1rem', borderBottom: '1px solid var(--color-border)',
                opacity: fu.status === 'COMPLETED' ? 0.6 : 1,
                textDecoration: fu.status === 'COMPLETED' ? 'line-through' : 'none'
              }}>
                <div className="flex flex-between">
                  <div className="flex gap-3" style={{ alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getTypeIcon(fu.type)}</span>
                    <div>
                      <div className="font-bold">{fu.title}</div>
                      {fu.description && <div className="text-sm text-muted mt-1">{fu.description}</div>}
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs text-muted">
                          {fu.type} • <span style={{ color: getPriorityColor(fu.priority) }}>{fu.priority}</span>
                        </span>
                        {fu.dueDate && <span className="text-xs text-muted">📅 {formatDate(fu.dueDate)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ alignItems: 'center' }}>
                    <select
                      className="input"
                      style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      value={fu.status}
                      onChange={e => handleStatusChange(fu.id, e.target.value as FollowUpStatus)}
                    >
                      <option value="PENDING">Pendente</option>
                      <option value="IN_PROGRESS">Em Andamento</option>
                      <option value="COMPLETED">Concluído</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(fu.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center" style={{ padding: '3rem' }}><p className="text-muted">Nenhum follow-up encontrado.</p></div>
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '450px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Novo Follow-up</h3>
            <div className="input-group">
              <label>Título *</label>
              <input type="text" className="input" placeholder="O que precisa ser feito?"
                value={newFollowUp.title} onChange={e => setNewFollowUp({ ...newFollowUp, title: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Descrição</label>
              <textarea className="input" rows={3} placeholder="Detalhes adicionais..."
                value={newFollowUp.description} onChange={e => setNewFollowUp({ ...newFollowUp, description: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="input-group">
                <label>Tipo</label>
                <select className="input" value={newFollowUp.type}
                  onChange={e => setNewFollowUp({ ...newFollowUp, type: e.target.value as FollowUpType })}>
                  <option value="TASK">Tarefa</option>
                  <option value="MEETING">Reunião</option>
                  <option value="CALL">Ligação</option>
                  <option value="EMAIL">Email</option>
                  <option value="DEADLINE">Prazo</option>
                  <option value="REMINDER">Lembrete</option>
                </select>
              </div>
              <div className="input-group">
                <label>Prioridade</label>
                <select className="input" value={newFollowUp.priority}
                  onChange={e => setNewFollowUp({ ...newFollowUp, priority: e.target.value as FollowUpPriority })}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="input-group">
                <label>Data de Vencimento</label>
                <input type="date" className="input" value={newFollowUp.dueDate}
                  onChange={e => setNewFollowUp({ ...newFollowUp, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-1 mt-4" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateFollowUp} disabled={!newFollowUp.title.trim()}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FollowUps;
