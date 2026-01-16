import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import Users from './pages/Users';
import Companies from './pages/Companies';
import Departments from './pages/Departments';
import FollowUps from './pages/FollowUps';
import FollowUpsOpenCode from './pages/FollowUpsOpenCode';
import WhatsAppOpenCode from './pages/WhatsAppOpenCode';
import WorkflowsOpenCode from './pages/WorkflowsOpenCode';
import AdminOpenCode from './pages/AdminOpenCode';
import Automations from './pages/Automations';
import AutomationsAI from './pages/AutomationsAI';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import InitialSetup from './pages/InitialSetup';
import Chat from './pages/Chat';
import OpenCodeAgent from './pages/OpenCodeAgent';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p className="text-muted">Loading...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function CheckSetup() {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/status`)
      .then(res => res.json())
      .then(data => {
        setIsSetup(data.isSetup);
        setLoading(false);
      })
      .catch(() => {
        setIsSetup(false);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingScreen />;

  return isSetup ? <Login /> : <InitialSetup />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/opencode', label: 'OpenCode Agent', icon: '🧠' },
    { path: '/chat', label: 'Chat IA', icon: '🤖' },
    { path: '/companies', label: 'Empresas', icon: '🏭' },
    { path: '/departments', label: 'Departamentos', icon: '🏛️' },
    { path: '/users', label: 'Usuários', icon: '👥' },
    { path: '/followups', label: 'Follow-ups', icon: '✅' },
    { path: '/followups-opencode', label: 'Follow-ups Pro', icon: '📋' },
    { path: '/whatsapp', label: 'WhatsApp', icon: '💬' },
    { path: '/workflows', label: 'Workflows', icon: '🔄' },
    { path: '/automations', label: 'Automações', icon: '⚡' },
    { path: '/automations-ai', label: 'AI Automations', icon: '✨' },
    { path: '/integrations', label: 'Integrações', icon: '🔌' },
    { path: '/settings', label: 'Configurações', icon: '⚙️' },
    { path: '/admin-opencode', label: 'Administração', icon: '🔧' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarBrand}>
        <span style={styles.logo}>C</span>
        <span style={styles.brandName}>ChatIAS 3.0</span>
      </div>

      {tenant && (
        <div style={styles.currentTenant}>
          <span style={styles.currentTenantLabel}>Organização</span>
          <div style={styles.currentTenantName}>{tenant.name}</div>
        </div>
      )}

      <nav style={styles.nav}>
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              ...styles.navItem,
              ...(location.pathname === item.path ? styles.navItemActive : {})
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div style={styles.userSection}>
        {user && (
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div style={styles.userDetails}>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userRole}>{user.role}</div>
            </div>
          </div>
        )}
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Sair
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.headerTitle}>ChatIAS Platform</h1>
            <p style={styles.headerSubtitle}>Plataforma Multi-Tenant de Agentes AI</p>
          </div>
          <div style={styles.headerActions}>
            <button className="btn btn-secondary btn-sm">
              Documentação
            </button>
            <button className="btn btn-primary btn-sm">
              + Novo Agente
            </button>
          </div>
        </header>
        <div style={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<CheckSetup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenants"
            element={
              <ProtectedRoute>
                <Layout><Tenants /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <Layout><Companies /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <ProtectedRoute>
                <Layout><Departments /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Layout><Users /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/followups"
            element={
              <ProtectedRoute>
                <Layout><FollowUps /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/followups-opencode"
            element={
              <ProtectedRoute>
                <Layout><FollowUpsOpenCode /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <ProtectedRoute>
                <Layout><WhatsAppOpenCode /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute>
                <Layout><WorkflowsOpenCode /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations"
            element={
              <ProtectedRoute>
                <Layout><Automations /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations-ai"
            element={
              <ProtectedRoute>
                <Layout><AutomationsAI /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/opencode"
            element={
              <ProtectedRoute>
                <OpenCodeAgent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations"
            element={
              <ProtectedRoute>
                <Layout><Integrations /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-opencode"
            element={
              <ProtectedRoute>
                <Layout><AdminOpenCode /></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: '260px',
    background: 'var(--color-bg-secondary)',
    borderRight: '1px solid var(--color-border)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    overflowY: 'auto',
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logo: {
    width: '36px',
    height: '36px',
    background: 'var(--color-primary)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  brandName: {
    fontSize: '1.125rem',
    fontWeight: '600',
  },
  currentTenant: {
    padding: '1rem',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
  },
  currentTenantLabel: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  currentTenantName: {
    fontSize: '1rem',
    fontWeight: '600',
    marginTop: '0.25rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius)',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    fontSize: '0.875rem',
  },
  navItemActive: {
    background: 'var(--color-primary)',
    color: 'white',
  },
  userSection: {
    paddingTop: '1rem',
    borderTop: '1px solid var(--color-border)',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  userRole: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    textTransform: 'capitalize',
  },
  logoutBtn: {
    width: '100%',
    padding: '0.5rem',
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 2rem',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
  },
  headerTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    marginTop: '0.25rem',
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
  },
  content: {
    flex: 1,
    padding: '2rem',
    overflow: 'auto',
  },
};

export default App;
