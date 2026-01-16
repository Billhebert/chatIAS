import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Settings() {
  const { user, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  if (!user || !tenant) {
    return (
      <div className="text-center" style={{ padding: '3rem' }}>
        <h2>Carregando...</h2>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'Geral' },
    { id: 'security', label: 'Segurança' },
    { id: 'billing', label: 'Cobrança' },
    { id: 'api', label: 'API Keys' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Configurações</h2>
        <p className="text-muted">Gerencie as configurações da sua organização.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
          {tabs.map(tab => (
            <button key={tab.id} className="btn btn-sm" style={{
              background: activeTab === tab.id ? 'var(--color-bg)' : 'transparent',
              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: '0', padding: '0.75rem 1rem',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'general' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Configurações Gerais</h3>
            <div className="input-group">
              <label>Nome da Organização</label>
              <input type="text" className="input" defaultValue={tenant.name} />
            </div>
            <div className="grid grid-2">
              <div className="input-group">
                <label>Fuso Horário</label>
                <select className="input">
                  <option>America/Sao_Paulo</option>
                  <option>UTC</option>
                  <option>America/New_York</option>
                </select>
              </div>
              <div className="input-group">
                <label>Idioma</label>
                <select className="input">
                  <option>pt-BR</option>
                  <option>en-US</option>
                  <option>es-ES</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary mt-4">Salvar Alterações</button>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Configurações de Segurança</h3>
            <div className="card" style={{ background: 'var(--color-bg)', marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Política de Senha</h4>
              <div className="grid grid-2 gap-4">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Tamanho Mínimo</label>
                  <input type="number" className="input" defaultValue="8" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Expiração (dias)</label>
                  <input type="number" className="input" defaultValue="90" />
                </div>
              </div>
            </div>
            <button className="btn btn-primary mt-4">Salvar Alterações</button>
          </div>
        )}

        {activeTab === 'billing' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Cobrança e Assinatura</h3>
            <div className="card" style={{ background: 'var(--color-bg)', marginBottom: '1rem' }}>
              <div className="flex flex-between">
                <div>
                  <h4 style={{ marginBottom: '0.25rem' }}>Plano Atual</h4>
                  <p className="text-muted text-sm" style={{ textTransform: 'capitalize' }}>{tenant.plan?.toLowerCase() || 'professional'}</p>
                </div>
                <span className="badge badge-info" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>{tenant.plan}</span>
              </div>
            </div>
            <div className="input-group">
              <label>Email de Cobrança</label>
              <input type="email" className="input" placeholder="billing@empresa.com" />
            </div>
            <button className="btn btn-primary mt-4">Atualizar Cobrança</button>
          </div>
        )}

        {activeTab === 'api' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Chaves de API</h3>
            <p className="text-muted mb-4">Gerencie as chaves de API para acesso programático.</p>
            <div className="card" style={{ background: 'var(--color-bg)', marginBottom: '1rem' }}>
              <div className="flex flex-between">
                <div>
                  <h4 style={{ marginBottom: '0.25rem' }}>Chave Padrão</h4>
                  <code style={{ fontSize: '0.75rem' }}>sk_xxxxxxxxxxxxx</code>
                </div>
                <button className="btn btn-sm btn-secondary">Regenerar</button>
              </div>
            </div>
            <button className="btn btn-primary">+ Criar Nova Chave</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
