import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface User {
  name?: string
  email?: string
  role?: string
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User>({})

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/admin', label: 'Admin', icon: '⚙️' },
    { path: '/followups', label: 'Follow-ups', icon: '✅' },
    { path: '/whatsapp', label: 'WhatsApp', icon: '💬' },
    { path: '/workflows', label: 'Workflows', icon: '🔄' },
    { path: '/session', label: 'Sessions', icon: '💻' },
    { path: '/companies', label: 'Companies', icon: '🏭' },
    { path: '/departments', label: 'Departments', icon: '🏛️' },
    { path: '/users', label: 'Users', icon: '👥' },
    { path: '/integrations', label: 'Integrations', icon: '🔌' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
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
          {user.name && (
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 rounded-full bg-text-interactive-base flex items-center justify-center text-white font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-strong truncate">{user.name}</div>
                <div className="text-xs text-text-subtle capitalize">{user.role}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full btn-secondary text-sm">
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
