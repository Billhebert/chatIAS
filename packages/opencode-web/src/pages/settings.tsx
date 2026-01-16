import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Settings {
  companyName?: string
  timezone?: string
  language?: string
  theme?: string
  notifications?: {
    email?: boolean
    push?: boolean
    slack?: boolean
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/settings`)
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetchWithAuth(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      alert('Configurações salvas!')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Settings</h1>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-border-weak-base">
          {['general', 'notifications', 'security', 'billing'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm capitalize ${
                activeTab === tab
                  ? 'text-text-interactive-base border-b-2 border-text-interactive-base'
                  : 'text-text-subtle hover:text-text-base'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'general' && (
              <>
                <div className="card">
                  <h3 className="font-medium text-text-strong mb-4">Geral</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-base mb-1">Nome da Empresa</label>
                      <input
                        type="text"
                        value={settings.companyName || ''}
                        onChange={(e) => setSettings({ ...settings, companyName: e.currentTarget.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-base mb-1">Fuso Horário</label>
                      <select
                        value={settings.timezone || 'America/Sao_Paulo'}
                        onChange={(e) => setSettings({ ...settings, timezone: e.currentTarget.value })}
                        className="input"
                      >
                        <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                        <option value="America/New_York">New York (GMT-5)</option>
                        <option value="Europe/London">London (GMT+0)</option>
                        <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-base mb-1">Idioma</label>
                      <select
                        value={settings.language || 'pt-BR'}
                        onChange={(e) => setSettings({ ...settings, language: e.currentTarget.value })}
                        className="input"
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en-US">English (US)</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'notifications' && (
              <div className="card">
                <h3 className="font-medium text-text-strong mb-4">Notificações</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.email ?? true}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, email: e.currentTarget.checked }
                      })}
                      className="size-4 rounded"
                    />
                    <span className="text-text-base">Notificações por email</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.push ?? true}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, push: e.currentTarget.checked }
                      })}
                      className="size-4 rounded"
                    />
                    <span className="text-text-base">Notificações push</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.slack ?? false}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, slack: e.currentTarget.checked }
                      })}
                      className="size-4 rounded"
                    />
                    <span className="text-text-base">Notificações Slack</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="card">
                <h3 className="font-medium text-text-strong mb-4">Segurança</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-1">Senha Atual</label>
                    <input type="password" className="input" placeholder="••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-1">Nova Senha</label>
                    <input type="password" className="input" placeholder="••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-1">Confirmar Senha</label>
                    <input type="password" className="input" placeholder="••••••" />
                  </div>
                  <button className="btn-secondary">Alterar Senha</button>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="card">
                <h3 className="font-medium text-text-strong mb-4">Cobrança</h3>
                <div className="text-text-subtle">
                  <p>Plano atual: <span className="text-text-interactive-base font-medium">Trial</span></p>
                  <p className="mt-2">Gerencie suas informações de pagamento e histórico de faturas.</p>
                  <button className="btn-primary mt-4">Gerenciar Assinatura</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
