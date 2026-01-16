import React, { Suspense, useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'

import {
  LoginPage,
  HomePage,
  AdminPage,
  SessionPage,
  FollowUpsPage,
  WhatsAppPage,
  WorkflowsPage,
  CompaniesPage,
  DepartmentsPage,
  UsersPage,
  IntegrationsPage,
  SettingsPage,
  ErrorPage,
  ChatPage,
  AnalyticsPage,
  TemplatesPage,
  AuditPage,
  AIModelsPage,
  KnowledgeBasePage,
  QueuesPage,
  APIKeysPage,
  WebhooksPage,
  BroadcastsPage,
  ContactsPage,
  DatabasePage,
  ReportsPage,
  HelpPage,
  RolesPage
} from './pages'

interface Platform {
  platform: string
  version: string
  fetch: typeof fetch
  openLink: (url: string) => void
  restart: () => void
  notify: (title: string, description?: string, href?: string) => Promise<void>
}

const PlatformContext = createContext<Platform | null>(null)

export const usePlatform = () => {
  const platform = useContext(PlatformContext)
  if (!platform) throw new Error('usePlatform must be used within PlatformProvider')
  return platform
}

interface User {
  id: string
  email: string
  name: string
  role: string
  isMaster?: boolean
  masterTenantId?: string | null
  tenantId?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<{
  auth: AuthState
  login: (email: string, password: string, tenantId?: string) => Promise<void>
  logout: () => void
  setAuth: React.Dispatch<React.SetStateAction<AuthState>>
} | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

interface Notification {
  id: string
  title: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info'
}

interface NotificationContextValue {
  notifications: Notification[]
  showNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotification must be used within NotificationProvider')
  return context
}

interface Dialog {
  id: string
  component: ReactNode
}

interface DialogContextValue {
  dialogs: Dialog[]
  showDialog: (component: ReactNode) => string
  hideDialog: (id: string) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

export const useDialog = () => {
  const context = useContext(DialogContext)
  if (!context) throw new Error('useDialog must be used within DialogProvider')
  return context
}

const API_URL = import.meta.env.VITE_API_URL || ''

const getStoredToken = () => localStorage.getItem('token')

const authenticatedFetch: typeof fetch = async (input, init) => {
  const token = getStoredToken()
  const headers = new Headers(init?.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  
  return fetch(input, {
    ...init,
    headers,
  })
}

const platform: Platform = {
  platform: 'web',
  version: '3.0.0',
  fetch: authenticatedFetch,
  openLink: (url) => window.open(url, '_blank'),
  restart: () => window.location.reload(),
  notify: async (title, description, href) => {
    if (!('Notification' in window)) return
    
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission().catch(() => 'denied')
      : Notification.permission
    
    if (permission !== 'granted') return
    
    const inView = document.visibilityState === 'visible' && document.hasFocus()
    if (inView) return
    
    const notification = new Notification(title, {
      body: description ?? '',
      icon: '/favicon-96x96.png',
    })
    notification.onclick = () => {
      window.focus()
      if (href) {
        window.history.pushState(null, '', href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
      notification.close()
    }
  },
}

function LoadingScreen() {
  return (
    <div className="size-full flex items-center justify-center text-text-weak">
      <div className="flex flex-col items-center gap-2">
        <div className="size-6 border-2 border-text-interactive-base border-t-transparent rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  )
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken()
      if (!token) {
        setAuth(prev => ({ ...prev, isLoading: false }))
        return
      }

      try {
        const res = await authenticatedFetch(`${API_URL}/api/auth/me`)
        if (res.ok) {
          const data = await res.json()
          setAuth({
            user: data.user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })
        } else {
          localStorage.removeItem('token')
          setAuth(prev => ({ ...prev, isLoading: false }))
        }
      } catch {
        localStorage.removeItem('token')
        setAuth(prev => ({ ...prev, isLoading: false }))
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string, tenantId?: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Login failed')
    }

    const data = await res.json()
    localStorage.setItem('token', data.token)
    setAuth({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
      isLoading: false,
    })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setAuth({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString()
    setNotifications(prev => [...prev, { ...notification, id }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, removeNotification }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg shadow-lg border max-w-sm ${
              notification.type === 'success' ? 'bg-surface-success-base border-border-success-base' :
              notification.type === 'error' ? 'bg-surface-error-base border-border-error-base' :
              notification.type === 'warning' ? 'bg-surface-caution-base border-border-caution-base' :
              'bg-surface-raised-base border-border-weak-base'
            }`}
          >
            <div className="font-medium text-text-strong">{notification.title}</div>
            {notification.description && (
              <div className="text-sm text-text-subtle mt-1">{notification.description}</div>
            )}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<Dialog[]>([])

  const showDialog = useCallback((component: ReactNode) => {
    const id = Date.now().toString()
    setDialogs(prev => [...prev, { id, component }])
    return id
  }, [])

  const hideDialog = useCallback((id: string) => {
    setDialogs(prev => prev.filter(d => d.id !== id))
  }, [])

  return (
    <DialogContext.Provider value={{ dialogs, showDialog, hideDialog }}>
      {children}
      {dialogs.map(dialog => (
        <div key={dialog.id} className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => hideDialog(dialog.id)} />
          <div className="relative z-10">
            {dialog.component}
          </div>
        </div>
      ))}
    </DialogContext.Provider>
  )
}

function Layout({ children }: { children: ReactNode }) {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/chat', label: 'Chat', icon: '💬' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/templates', label: 'Templates', icon: '📝' },
    { path: '/whatsapp', label: 'WhatsApp', icon: '📱' },
    { path: '/workflows', label: 'Workflows', icon: '🔄' },
    { path: '/followups', label: 'Follow-ups', icon: '✅' },
    { path: '/ai-models', label: 'AI Models', icon: '🤖' },
    { path: '/knowledge', label: 'Knowledge', icon: '📚' },
    { path: '/queues', label: 'Queues', icon: '📋' },
    { path: '/contacts', label: 'Contacts', icon: '👥' },
    { path: '/broadcasts', label: 'Broadcasts', icon: '📢' },
    { path: '/admin', label: 'Admin', icon: '⚙️' },
    { path: '/companies', label: 'Companies', icon: '🏭' },
    { path: '/departments', label: 'Departments', icon: '🏛️' },
    { path: '/users', label: 'Users', icon: '👥' },
    { path: '/roles', label: 'Roles', icon: '🔐' },
    { path: '/integrations', label: 'Integrations', icon: '🔌' },
    { path: '/api-keys', label: 'API Keys', icon: '🔑' },
    { path: '/webhooks', label: 'Webhooks', icon: '🪝' },
    { path: '/audit', label: 'Audit', icon: '📋' },
    { path: '/database', label: 'Database', icon: '💾' },
    { path: '/reports', label: 'Reports', icon: '📈' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/help', label: 'Help', icon: '❓' },
  ]

  return (
    <div className="flex h-dvh bg-background-base">
      <aside className="w-64 bg-surface-raised-base border-r border-border-weak-base flex flex-col">
        <div className="p-4 border-b border-border-weak-base">
          <h1 className="text-xl font-bold text-text-strong">OpenCode</h1>
          <p className="text-sm text-text-subtle">ChatIAS Edition</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                location.pathname === item.path
                  ? 'bg-text-interactive-base text-white'
                  : 'text-text-base hover:bg-surface-raised-hover'
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border-weak-base">
          {auth.user && (
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 rounded-full bg-text-interactive-base flex items-center justify-center text-white font-medium">
                {auth.user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-strong truncate">{auth.user.name}</div>
                <div className="text-xs text-text-subtle">{auth.user.role}</div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full btn-secondary text-sm"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { auth } = useAuth()

  if (auth.isLoading) {
    return <LoadingScreen />
  }

  if (!auth.isAuthenticated) {
    return <LoginPage />
  }

  return <>{children}</>
}

function App() {
  return (
    <PlatformContext.Provider value={platform}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <DialogProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  
                  <Route
                    path="/"
                    element={
                      <AuthGuard>
                        <Layout>
                          <HomePage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/admin"
                    element={
                      <AuthGuard>
                        <Layout>
                          <AdminPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/followups"
                    element={
                      <AuthGuard>
                        <Layout>
                          <FollowUpsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/whatsapp"
                    element={
                      <AuthGuard>
                        <Layout>
                          <WhatsAppPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/workflows"
                    element={
                      <AuthGuard>
                        <Layout>
                          <WorkflowsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/session"
                    element={
                      <AuthGuard>
                        <Layout>
                          <SessionPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/companies"
                    element={
                      <AuthGuard>
                        <Layout>
                          <CompaniesPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/departments"
                    element={
                      <AuthGuard>
                        <Layout>
                          <DepartmentsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/users"
                    element={
                      <AuthGuard>
                        <Layout>
                          <UsersPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/integrations"
                    element={
                      <AuthGuard>
                        <Layout>
                          <IntegrationsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/chat"
                    element={
                      <AuthGuard>
                        <Layout>
                          <ChatPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/analytics"
                    element={
                      <AuthGuard>
                        <Layout>
                          <AnalyticsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/templates"
                    element={
                      <AuthGuard>
                        <Layout>
                          <TemplatesPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/audit"
                    element={
                      <AuthGuard>
                        <Layout>
                          <AuditPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/settings"
                    element={
                      <AuthGuard>
                        <Layout>
                          <SettingsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/ai-models"
                    element={
                      <AuthGuard>
                        <Layout>
                          <AIModelsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/knowledge"
                    element={
                      <AuthGuard>
                        <Layout>
                          <KnowledgeBasePage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/queues"
                    element={
                      <AuthGuard>
                        <Layout>
                          <QueuesPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/contacts"
                    element={
                      <AuthGuard>
                        <Layout>
                          <ContactsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/broadcasts"
                    element={
                      <AuthGuard>
                        <Layout>
                          <BroadcastsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/api-keys"
                    element={
                      <AuthGuard>
                        <Layout>
                          <APIKeysPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/webhooks"
                    element={
                      <AuthGuard>
                        <Layout>
                          <WebhooksPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/database"
                    element={
                      <AuthGuard>
                        <Layout>
                          <DatabasePage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/reports"
                    element={
                      <AuthGuard>
                        <Layout>
                          <ReportsPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/roles"
                    element={
                      <AuthGuard>
                        <Layout>
                          <RolesPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route
                    path="/help"
                    element={
                      <AuthGuard>
                        <Layout>
                          <HelpPage />
                        </Layout>
                      </AuthGuard>
                    }
                  />
                  
                  <Route path="*" element={<ErrorPage />} />
                </Routes>
              </Suspense>
            </DialogProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </PlatformContext.Provider>
  )
}

export default App
