import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  actions: Record<string, unknown>[];
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
}

function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [logs, setLogs] = useState<{ id: string; status: string; createdAt: string; duration?: number }[]>([
    { id: 'l1', status: 'SUCCESS', createdAt: '2024-01-15 10:30:15', duration: 2500 },
    { id: 'l2', status: 'SUCCESS', createdAt: '2024-01-15 09:30:10', duration: 2300 },
    { id: 'l3', status: 'FAILED', createdAt: '2024-01-15 08:15:05', duration: 500 }
  ]);
  const [newAutomation, setNewAutomation] = useState({
    name: '', description: '', trigger: 'EVENT', triggerConfig: '', actions: ''
  });

  const fetchAutomations = async () => {
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/automations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAutomations(data);
      }
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAutomations(); }, []);

  const handleCreateAutomation = async () => {
    if (!newAutomation.name.trim()) return;

    let triggerConfig = {};
    try { triggerConfig = newAutomation.triggerConfig ? JSON.parse(newAutomation.triggerConfig) : {}; } catch {}
    let actions = [];
    try { actions = newAutomation.actions ? JSON.parse(newAutomation.actions) : []; } catch {}

    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newAutomation.name, description: newAutomation.description, trigger: newAutomation.trigger, triggerConfig, actions })
      });
      if (response.ok) {
        const automation = await response.json();
        setAutomations([...automations, automation]);
        setShowModal(false);
        setNewAutomation({ name: '', description: '', trigger: 'EVENT', triggerConfig: '', actions: '' });
      }
    } catch (error) { console.error('Failed to create automation:', error); }
  };

  const handleToggleAutomation = async (id: string) => {
    const automation = automations.find(a => a.id === id);
    if (!automation) return;
    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !automation.enabled })
      });
      setAutomations(automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    } catch (error) { console.error('Failed to toggle automation:', error); }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Excluir esta automação?')) return;
    try {
      const token = localStorage.getItem('chatias_token');
      await fetch(`${API_URL}/api/automations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setAutomations(automations.filter(a => a.id !== id));
    } catch (error) { console.error('Failed to delete automation:', error); }
  };

  const getTriggerIcon = (trigger: string) => ({ EVENT: '⚡', SCHEDULE: '⏰', WEBHOOK: '🔗', MANUAL: '👆', CONDITION_MET: '✅' }[trigger] || '🔧');
  const formatDate = (date: string | undefined) => date ? new Date(date).toLocaleString('pt-BR') : '-';

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Automações e Workflows</h2>
          <p className="text-muted">Crie fluxos automatizados para otimizar processos.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nova Automação</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>{automations.length}</div>
          <div className="text-muted text-sm">Total</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-success)' }}>{automations.filter(a => a.enabled).length}</div>
          <div className="text-muted text-sm">Ativas</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-primary)' }}>{automations.reduce((acc, a) => acc + (a.executionCount || 0), 0)}</div>
          <div className="text-muted text-sm">Execuções Totais</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-warning)' }}>{logs.filter(l => l.status === 'FAILED').length}</div>
          <div className="text-muted text-sm">Falhas Recentes</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Automações</h3>
          {loading ? <div className="text-center" style={{ padding: '2rem' }}><p>Carregando...</p></div> :
            automations.length > 0 ? (
              <div>
                {automations.map(automation => (
                  <div key={automation.id} style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', opacity: automation.enabled ? 1 : 0.6 }}>
                    <div className="flex flex-between">
                      <div className="flex gap-2">
                        <span style={{ fontSize: '1.5rem' }}>{getTriggerIcon(automation.trigger)}</span>
                        <div>
                          <div className="font-bold">{automation.name}</div>
                          <div className="text-xs text-muted">{automation.trigger}</div>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs text-muted">{automation.executionCount || 0} execuções</span>
                            <span className="text-xs text-muted">Última: {formatDate(automation.lastExecutedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1" style={{ alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" checked={automation.enabled} onChange={() => handleToggleAutomation(automation.id)} />
                          <span className="text-sm">Ativo</span>
                        </label>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAutomation(automation.id)}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center" style={{ padding: '2rem' }}>
                <p className="text-muted">Nenhuma automação criada ainda.</p>
                <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>Criar Primeira Automação</button>
              </div>
            )}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Logs de Execução</h3>
          <div>
            {logs.map(log => (
              <div key={log.id} style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <span style={{ color: log.status === 'SUCCESS' ? 'var(--color-success)' : log.status === 'FAILED' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    {log.status === 'SUCCESS' ? '✓' : log.status === 'FAILED' ? '✗' : '⏳'}
                  </span>
                  <span className="text-sm">{log.createdAt}</span>
                </div>
                <span className="text-xs text-muted">{log.duration ? `${(log.duration / 1000).toFixed(2)}s` : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Nova Automação</h3>
            <div className="input-group">
              <label>Nome da Automação *</label>
              <input type="text" className="input" placeholder="Ex: Enviar boas-vindas" value={newAutomation.name} onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Descrição</label>
              <textarea className="input" rows={2} placeholder="O que esta automação faz?" value={newAutomation.description} onChange={e => setNewAutomation({ ...newAutomation, description: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Disparador (Trigger)</label>
              <select className="input" value={newAutomation.trigger} onChange={e => setNewAutomation({ ...newAutomation, trigger: e.target.value })}>
                <option value="EVENT">Evento - Dispara quando algo acontece</option>
                <option value="SCHEDULE">Agendamento - Dispara em horários específicos</option>
                <option value="WEBHOOK">Webhook - Dispara via HTTP POST</option>
                <option value="MANUAL">Manual - Dispara pelo usuário</option>
              </select>
            </div>
            <div className="input-group">
              <label>Configuração do Trigger (JSON)</label>
              <textarea className="input" rows={3} placeholder='{"eventName": "lead.created"}' value={newAutomation.triggerConfig} onChange={e => setNewAutomation({ ...newAutomation, triggerConfig: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Ações (JSON)</label>
              <textarea className="input" rows={4} placeholder='[{"type": "SEND_MESSAGE", "config": {"message": "Olá!"}}]' value={newAutomation.actions} onChange={e => setNewAutomation({ ...newAutomation, actions: e.target.value })} />
            </div>
            <div className="flex gap-1 mt-4" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateAutomation} disabled={!newAutomation.name.trim()}>Criar Automação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Automations;
