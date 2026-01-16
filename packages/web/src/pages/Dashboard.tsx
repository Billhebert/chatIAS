import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DashboardStats {
  users: number;
  companies: number;
  departments: number;
  followUps: number;
  automations: number;
  integrations: number;
}

function Dashboard() {
  const { user, tenant } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('chatias_token');
        const response = await fetch(`${API_URL}/api/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '3rem' }}>
        <p>Carregando...</p>
      </div>
    );
  }

  const planLimits: Record<string, { users: number; storage: string }> = {
    free: { users: 5, storage: '1 GB' },
    starter: { users: 25, storage: '10 GB' },
    professional: { users: 100, storage: '100 GB' },
    enterprise: { users: -1, storage: 'Unlimited' }
  };

  const limits = tenant?.plan ? planLimits[tenant.plan.toLowerCase()] || planLimits.starter : planLimits.starter;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Bem-vindo, {user?.name}!</h2>
        <p className="text-muted">Aqui está uma visão geral da sua plataforma ChatIAS.</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Usuários</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats?.users || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {limits.users === -1 ? 'Ilimitado' : `até ${limits.users}`}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏭</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Empresas</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats?.companies || 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Follow-ups</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats?.followUps || 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Automações</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats?.automations || 0}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Informações da Organização</h3>
          <table className="table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--color-text-secondary)' }}>Nome</td>
                <td style={{ fontWeight: '500' }}>{tenant?.name}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--color-text-secondary)' }}>Slug</td>
                <td>
                  <code style={{ background: 'var(--color-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                    {tenant?.slug}
                  </code>
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--color-text-secondary)' }}>Plano</td>
                <td>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {tenant?.plan?.toLowerCase() || 'Professional'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Ações Rápidas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary">Criar Nova Empresa</button>
            <button className="btn btn-secondary">Adicionar Usuário</button>
            <button className="btn btn-secondary">Configurar Integração</button>
            <button className="btn btn-secondary">Criar Automação</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
