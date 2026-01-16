import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

type IntegrationType = 'EVOLUTION' | 'RDSTATION' | 'CONFIRM8' | 'WEBHOOK';

interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  enabled: boolean;
  config: Record<string, unknown>;
  lastConnectedAt?: string;
  createdAt: string;
}

const INTEGRATION_DEFINITIONS = [
  { id: 'evolution', type: 'EVOLUTION' as IntegrationType, name: 'Evolution API', icon: '📱', description: 'Integração com WhatsApp Business.', fields: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.evolution.com' },
    { key: 'instanceName', label: 'Nome da Instância', type: 'text', placeholder: 'minha-instancia' },
    { key: 'token', label: 'Token', type: 'password', placeholder: 'Seu token' }
  ]},
  { id: 'rdstation', type: 'RDSTATION' as IntegrationType, name: 'RD Station', icon: '🎯', description: 'Integração com CRM.', fields: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Seu client ID' },
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Seu access token' }
  ]},
  { id: 'confirm8', type: 'CONFIRM8' as IntegrationType, name: 'Confirm8', icon: '✅', description: 'Plataforma de gestão empresarial.', fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Sua API key' },
    { key: 'companyId', label: 'Company ID', type: 'text', placeholder: 'ID da empresa' }
  ]}
];

function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/integrations`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setIntegrations(await response.json());
    } catch (error) { console.error('Failed to fetch integrations:', error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const handleConnect = (def: typeof INTEGRATION_DEFINITIONS[0]) => {
    const existing = integrations.find(i => i.type === def.type);
    if (existing) { setSelectedIntegration(existing); setConfig(existing.config as Record<string, string> || {}); }
    else { setSelectedIntegration(null); setConfig({}); }
  };

  const handleSaveConfig = async () => {
    const def = INTEGRATION_DEFINITIONS.find(d => d.type === selectedIntegration?.type || config.type);
    if (!def) return;

    try {
      const token = localStorage.getItem('chatias_token');
      if (selectedIntegration) {
        await fetch(`${API_URL}/api/integrations/${selectedIntegration.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enabled: true, config: Object.fromEntries(Object.entries(config).filter(([k]) => def.fields.some(f => f.key === k))) })
        });
      } else {
        const response = await fetch(`${API_URL}/api/integrations`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: def.name, type: def.type, enabled: true, config: Object.fromEntries(Object.entries(config).filter(([k]) => def.fields.some(f => f.key === k))) })
        });
        if (response.ok) { const newInt = await response.json(); setIntegrations([...integrations, newInt]); }
      }
      setSelectedIntegration(null); setConfig({}); fetchIntegrations();
    } catch (error) { console.error('Failed to save integration:', error); }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const token = localStorage.getItem('chatias_token');
      const response = await fetch(`${API_URL}/api/integrations/${id}/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json(); alert(result.message);
    } catch { alert('Test failed'); }
    setTesting(null);
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Integrações</h2>
        <p className="text-muted">Conecte seus agentes AI a serviços externos e APIs.</p>
      </div>

      <div className="grid grid-3">
        {INTEGRATION_DEFINITIONS.map(def => {
          const integration = integrations.find(i => i.type === def.type);
          return (
            <div key={def.id} className="card">
              <div className="flex flex-between mb-4">
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>{def.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>{def.name}</h3>
                    <span className={`badge badge-${integration?.enabled ? 'success' : 'warning'}`}>{integration?.enabled ? 'Conectado' : 'Não Conectado'}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted mb-4" style={{ minHeight: '60px' }}>{def.description}</p>
              <div className="flex gap-1">
                <button className={`btn ${integration ? 'btn-secondary' : 'btn-primary'}`} onClick={() => handleConnect(def)}>{integration ? 'Configurar' : 'Conectar'}</button>
                {integration && <button className="btn btn-secondary" onClick={() => handleTest(integration.id)} disabled={testing === integration.id}>{testing === integration.id ? 'Testando...' : 'Testar'}</button>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedIntegration && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedIntegration(null)}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="flex flex-between mb-4">
              <h3>Configurar {selectedIntegration.name}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedIntegration(null)}>✕</button>
            </div>
            {INTEGRATION_DEFINITIONS.find(d => d.type === selectedIntegration.type)?.fields.map(field => (
              <div key={field.key} className="input-group">
                <label>{field.label}</label>
                <input type={field.type} className="input" placeholder={field.placeholder} value={config[field.key] || ''} onChange={e => setConfig({ ...config, [field.key]: e.target.value })} />
              </div>
            ))}
            <div className="flex gap-1 mt-4" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedIntegration(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveConfig}>Salvar Configuração</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Integrations;
