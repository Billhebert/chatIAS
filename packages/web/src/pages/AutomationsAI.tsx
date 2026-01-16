import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

interface AISuggestion {
  name: string;
  description: string;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  conditions: unknown[];
  actions: Array<{ type: string; config: Record<string, unknown> }>;
}

export default function AutomationsAI() {
  const { token, user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'manual',
    triggerConfig: '{}',
    conditions: '[]',
    actions: '[]',
    enabled: true
  });

  useEffect(() => {
    loadAutomations();
  }, [token]);

  const loadAutomations = async () => {
    try {
      const res = await fetch('/api/automations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAutomations(data);
      }
    } catch (error) {
      console.error('Error loading automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/ai/automation-suggest?prompt=${encodeURIComponent(aiPrompt)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          alert(data.error);
        } else {
          setAiSuggestion(data);
          setFormData({
            name: data.name || '',
            description: data.description || '',
            trigger: data.trigger || 'manual',
            triggerConfig: JSON.stringify(data.triggerConfig || {}, null, 2),
            conditions: JSON.stringify(data.conditions || [], null, 2),
            actions: JSON.stringify(data.actions || [], null, 2),
            enabled: true
          });
          setShowCreator(true);
        }
      }
    } catch (error) {
      console.error('Error generating automation:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const saveAutomation = async () => {
    try {
      const data = {
        name: formData.name,
        description: formData.description,
        trigger: formData.trigger,
        triggerConfig: JSON.parse(formData.triggerConfig),
        conditions: JSON.parse(formData.conditions),
        actions: JSON.parse(formData.actions),
        enabled: formData.enabled
      };

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        loadAutomations();
        setShowCreator(false);
        setAiSuggestion(null);
        setAiPrompt('');
        setFormData({
          name: '',
          description: '',
          trigger: 'manual',
          triggerConfig: '{}',
          conditions: '[]',
          actions: '[]',
          enabled: true
        });
      }
    } catch (error) {
      console.error('Error saving automation:', error);
    }
  };

  const toggleAutomation = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/automations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !enabled })
      });
      loadAutomations();
    } catch (error) {
      console.error('Error toggling automation:', error);
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;
    try {
      await fetch(`/api/automations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      loadAutomations();
    } catch (error) {
      console.error('Error deleting automation:', error);
    }
  };

  const executeAutomation = async (id: string) => {
    try {
      await fetch(`/api/automations/${id}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Automação executada!');
    } catch (error) {
      console.error('Error executing automation:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🤖 Automações Inteligentes</h1>
        <p>Crie automações poderosas descrevendo o que você precisa em linguagem natural</p>
      </div>

      <div className="ai-section">
        <div className="ai-prompt-box">
          <h2>✨ Crie automações com IA</h2>
          <p>Descreva o que você quer automatizar e a IA vai criar a automação para você</p>
          <div className="prompt-input-group">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Ex: 'Quando uma nova empresa for cadastrada, envie um email de boas-vindas e crie um follow-up para contatos em 7 dias'"
              rows={3}
            />
            <button onClick={generateWithAI} disabled={!aiPrompt.trim() || aiLoading}>
              {aiLoading ? '⏳ Gerando...' : '🚀 Gerar Automação'}
            </button>
          </div>
          <div className="ai-suggestions">
            <span>Sugestões:</span>
            <button onClick={() => setAiPrompt('Quando uma nova empresa for criada, enviar email de boas-vindas')}>
              Email de boas-vindas
            </button>
            <button onClick={() => setAiPrompt('Lembrar follow-ups que estão atrasados há mais de 3 dias')}>
              Follow-ups atrasados
            </button>
            <button onClick={() => setAiPrompt('Sincronizar empresas com RD Station quando houver mudança')}>
              RD Station sync
            </button>
            <button onClick={() => setAiPrompt('Criar tarefa quando um lead for marcado como prioritário')}>
              Lead prioritário
            </button>
          </div>
        </div>

        {aiSuggestion && (
          <div className="ai-result-box">
            <h3>🤖 Automação Gerada pela IA</h3>
            <div className="suggestion-preview">
              <p><strong>Nome:</strong> {aiSuggestion.name}</p>
              <p><strong>Descrição:</strong> {aiSuggestion.description}</p>
              <p><strong>Gatilho:</strong> {aiSuggestion.trigger}</p>
              <p><strong>Ações:</strong> {aiSuggestion.actions.length} ação(s)</p>
            </div>
            <div className="suggestion-actions">
              <button className="btn-secondary" onClick={() => setShowCreator(true)}>
                ✏️ Editar e Salvar
              </button>
              <button className="btn-ghost" onClick={() => {
                setAiSuggestion(null);
                setAiPrompt('');
              }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="automations-list">
        <h2>📋 Automações Cadastradas ({automations.length})</h2>
        {loading ? (
          <div className="loading">Carregando...</div>
        ) : automations.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma automação cadastrada ainda.</p>
            <p>Crie sua primeira automação usando o assistente de IA acima!</p>
          </div>
        ) : (
          <div className="automation-grid">
            {automations.map(automation => (
              <div key={automation.id} className={`automation-card ${!automation.enabled ? 'disabled' : ''}`}>
                <div className="automation-header">
                  <h3>{automation.name}</h3>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={automation.enabled}
                      onChange={() => toggleAutomation(automation.id, automation.enabled)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                <p className="automation-description">{automation.description}</p>
                <div className="automation-meta">
                  <span>📌 Gatilho: {automation.trigger}</span>
                  <span>⚡ Execuções: {automation.executionCount}</span>
                </div>
                <div className="automation-actions">
                  <button onClick={() => executeAutomation(automation.id)} title="Executar">
                    ▶️
                  </button>
                  <button onClick={() => deleteAutomation(automation.id)} title="Excluir">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreator && (
        <div className="modal-overlay" onClick={() => setShowCreator(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📝 Configurar Automação</h2>
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="form-group">
              <label>Gatilho</label>
              <select
                value={formData.trigger}
                onChange={e => setFormData({ ...formData, trigger: e.target.value })}
              >
                <option value="manual">Manual</option>
                <option value="company.created">Empresa criada</option>
                <option value="company.updated">Empresa atualizada</option>
                <option value="followup.created">Follow-up criado</option>
                <option value="followup.completed">Follow-up concluído</option>
                <option value="user.created">Usuário criado</option>
              </select>
            </div>
            <div className="form-group">
              <label>Trigger Config (JSON)</label>
              <textarea
                value={formData.triggerConfig}
                onChange={e => setFormData({ ...formData, triggerConfig: e.target.value })}
                rows={3}
                className="code-input"
              />
            </div>
            <div className="form-group">
              <label>Condições (JSON)</label>
              <textarea
                value={formData.conditions}
                onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                rows={3}
                className="code-input"
              />
            </div>
            <div className="form-group">
              <label>Ações (JSON)</label>
              <textarea
                value={formData.actions}
                onChange={e => setFormData({ ...formData, actions: e.target.value })}
                rows={4}
                className="code-input"
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                />
                Ativada
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={saveAutomation}>Salvar</button>
              <button className="btn-secondary" onClick={() => setShowCreator(false)}>Cancelar</button>
            </div>
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
          margin-bottom: 24px;
        }

        .page-header h1 {
          font-size: 28px;
          margin-bottom: 8px;
          color: #e0e0e0;
        }

        .page-header p {
          color: #888;
        }

        .ai-section {
          margin-bottom: 32px;
        }

        .ai-prompt-box {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          border: 1px solid rgba(102, 126, 234, 0.3);
          border-radius: 16px;
          padding: 24px;
        }

        .ai-prompt-box h2 {
          color: #e0e0e0;
          margin-bottom: 8px;
        }

        .ai-prompt-box > p {
          color: #888;
          margin-bottom: 16px;
        }

        .prompt-input-group {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .prompt-input-group textarea {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 12px;
          padding: 16px;
          color: #e0e0e0;
          font-size: 14px;
          resize: none;
          outline: none;
        }

        .prompt-input-group textarea:focus {
          border-color: #667eea;
        }

        .prompt-input-group button {
          padding: 0 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
          white-space: nowrap;
        }

        .prompt-input-group button:hover:not(:disabled) {
          transform: scale(1.02);
        }

        .prompt-input-group button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .ai-suggestions span {
          color: #888;
          font-size: 13px;
        }

        .ai-suggestions button {
          padding: 8px 12px;
          background: rgba(102, 126, 234, 0.15);
          border: 1px solid rgba(102, 126, 234, 0.3);
          border-radius: 8px;
          color: #a0a0a0;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ai-suggestions button:hover {
          background: rgba(102, 126, 234, 0.25);
          color: #e0e0e0;
        }

        .ai-result-box {
          margin-top: 16px;
          background: rgba(118, 75, 162, 0.1);
          border: 1px solid rgba(118, 75, 162, 0.3);
          border-radius: 12px;
          padding: 20px;
        }

        .ai-result-box h3 {
          color: #e0e0e0;
          margin-bottom: 12px;
        }

        .suggestion-preview {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .suggestion-preview p {
          color: #c0c0c0;
          margin: 4px 0;
          font-size: 14px;
        }

        .suggestion-actions {
          display: flex;
          gap: 12px;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #e0e0e0;
          cursor: pointer;
        }

        .btn-ghost {
          padding: 10px 20px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
        }

        .btn-primary {
          padding: 10px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
        }

        .automations-list h2 {
          color: #e0e0e0;
          font-size: 20px;
          margin-bottom: 16px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #888;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .automation-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .automation-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid #0f3460;
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
        }

        .automation-card:hover {
          border-color: rgba(102, 126, 234, 0.5);
        }

        .automation-card.disabled {
          opacity: 0.5;
        }

        .automation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .automation-header h3 {
          color: #e0e0e0;
          font-size: 16px;
          margin: 0;
        }

        .toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #0f3460;
          transition: 0.3s;
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }

        .automation-description {
          color: #888;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .automation-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 12px;
          color: #666;
          margin-bottom: 12px;
        }

        .automation-actions {
          display: flex;
          gap: 8px;
        }

        .automation-actions button {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .automation-actions button:hover {
          background: rgba(102, 126, 234, 0.2);
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
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
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

        .form-group input[type="text"],
        .form-group textarea,
        .form-group select {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #0f3460;
          border-radius: 8px;
          padding: 10px 12px;
          color: #e0e0e0;
          font-size: 14px;
          outline: none;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          border-color: #667eea;
        }

        .code-input {
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 12px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
}
