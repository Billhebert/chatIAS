import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

interface FollowUp {
  id: string;
  phoneNumber: string;
  contactName?: string;
  message: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  instanceName?: string;
  createdAt: string;
  sentAt?: string;
}

export default function FollowUpsOpenCode() {
  const { token } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const filteredFollowUps = useMemo(() => {
    if (filterStatus === 'all') return followUps;
    return followUps.filter(f => f.status === filterStatus);
  }, [followUps, filterStatus]);

  const stats = useMemo(() => ({
    total: followUps.length,
    pending: followUps.filter(f => f.status === 'pending').length,
    sent: followUps.filter(f => f.status === 'sent').length,
    cancelled: followUps.filter(f => f.status === 'cancelled').length
  }), [followUps]);

  const loadFollowUps = async () => {
    try {
      const res = await fetch('/api/followups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUps(data);
      }
    } catch (e) {
      console.error('Error loading follow-ups:', e);
    }
  };

  useEffect(() => {
    loadFollowUps().then(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !message || !scheduledDate || !scheduledTime) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const scheduledFor = `${scheduledDate}T${scheduledTime}:00`;

    try {
      let res;
      if (editingFollowUp) {
        res = await fetch(`/api/followups/${editingFollowUp.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber, contactName, message, scheduledFor })
        });
      } else {
        res = await fetch('/api/followups', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber, contactName, message, scheduledFor })
        });
      }

      if (res.ok) {
        alert(editingFollowUp ? 'Follow-up atualizado com sucesso!' : 'Follow-up agendado com sucesso!');
        setShowModal(false);
        resetForm();
        loadFollowUps();
      } else {
        const data = await res.json();
        alert(data.error || 'Falha ao agendar');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCancel = async (followUp: FollowUp) => {
    if (!confirm(`Cancelar follow-up para ${followUp.contactName || followUp.phoneNumber}?`)) return;

    try {
      const res = await fetch(`/api/followups/${followUp.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        alert('Follow-up cancelado com sucesso!');
        loadFollowUps();
      } else {
        alert('Falha ao cancelar');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEdit = (followUp: FollowUp) => {
    setEditingFollowUp(followUp);
    setPhoneNumber(followUp.phoneNumber);
    setContactName(followUp.contactName || '');
    setMessage(followUp.message);
    const date = new Date(followUp.scheduledFor);
    setScheduledDate(date.toISOString().split('T')[0]);
    setScheduledTime(date.toTimeString().slice(0, 5));
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingFollowUp(null);
    setPhoneNumber('');
    setContactName('');
    setMessage('');
    setScheduledDate('');
    setScheduledTime('');
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40';
      case 'sent': return 'bg-green-500/30 text-green-300 border border-green-500/40';
      case 'cancelled': return 'bg-gray-500/30 text-gray-300 border border-gray-500/40';
      case 'failed': return 'bg-red-500/30 text-red-300 border border-red-500/40';
      default: return 'bg-gray-500/30 text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'sent': return 'Enviado';
      case 'cancelled': return 'Cancelado';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1>📋 Follow-ups</h1>
          <p>Gerencie seus follow-ups e agendamentos</p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          + Novo Follow-up
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pendentes</div>
        </div>
        <div className="stat-card sent">
          <div className="stat-value">{stats.sent}</div>
          <div className="stat-label">Enviados</div>
        </div>
        <div className="stat-card cancelled">
          <div className="stat-value">{stats.cancelled}</div>
          <div className="stat-label">Cancelados</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <label>Filtrar por status:</label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos</option>
          <option value="pending">Pendente</option>
          <option value="sent">Enviado</option>
          <option value="cancelled">Cancelado</option>
          <option value="failed">Falhou</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="loading">Carregando...</div>
      ) : filteredFollowUps.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum follow-up encontrado.</p>
          <button className="btn btn-secondary" onClick={openNewModal}>
            Criar primeiro follow-up
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Mensagem</th>
                <th>Agendado para</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredFollowUps.map(followUp => (
                <tr key={followUp.id}>
                  <td>
                    <div className="contact-info">
                      <span className="contact-name">{followUp.contactName || 'Sem nome'}</span>
                      <span className="contact-phone">{followUp.phoneNumber}</span>
                    </div>
                  </td>
                  <td className="message-cell">
                    {followUp.message.length > 50 
                      ? followUp.message.substring(0, 50) + '...' 
                      : followUp.message}
                  </td>
                  <td>{formatDateTime(followUp.scheduledFor)}</td>
                  <td>
                    <span className={`status-badge ${getStatusColor(followUp.status)}`}>
                      {getStatusLabel(followUp.status)}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button 
                        className="btn-icon" 
                        onClick={() => handleEdit(followUp)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-icon danger" 
                        onClick={() => handleCancel(followUp)}
                        title="Cancelar"
                      >
                        ❌
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingFollowUp ? 'Editar Follow-up' : 'Novo Follow-up'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Número de telefone *</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+55 (11) 99999-9999"
                  required
                />
              </div>
              <div className="form-group">
                <label>Nome do contato</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Nome opcional"
                />
              </div>
              <div className="form-group">
                <label>Mensagem *</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={4}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data *</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Hora *</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingFollowUp ? 'Salvar' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-container {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header-content h1 {
          font-size: 28px;
          color: #e0e0e0;
          margin-bottom: 4px;
        }

        .header-content p {
          color: #888;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid #0f3460;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }

        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #e0e0e0;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
        }

        .stat-card.pending .stat-value { color: #fbbf24; }
        .stat-card.sent .stat-value { color: #34d399; }
        .stat-card.cancelled .stat-value { color: #9ca3af; }

        .filters {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .filters label {
          color: #888;
          font-size: 14px;
        }

        .filters select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 8px;
          padding: 8px 12px;
          color: #e0e0e0;
          font-size: 14px;
        }

        .loading, .empty-state {
          text-align: center;
          padding: 60px;
          color: #888;
        }

        .table-container {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th, .data-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #0f3460;
        }

        .data-table th {
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .data-table td {
          color: #e0e0e0;
        }

        .contact-info {
          display: flex;
          flex-direction: column;
        }

        .contact-name {
          font-weight: 500;
        }

        .contact-phone {
          font-size: 12px;
          color: #888;
        }

        .message-cell {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-icon.danger:hover {
          background: rgba(248, 81, 73, 0.2);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #1a1a2e;
          border: 1px solid #0f3460;
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 500px;
        }

        .modal h2 {
          color: #e0e0e0;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          color: #888;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 8px;
          padding: 10px 12px;
          color: #e0e0e0;
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #e0e0e0;
        }
      `}</style>
    </div>
  );
}
