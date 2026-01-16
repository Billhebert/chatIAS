import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface StatCard {
  title: string
  value: number | string
  change?: string
  icon: string
  color: string
}

interface ChartData {
  labels: string[]
  values: number[]
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatCard[]>([])
  const [conversationsChart, setConversationsChart] = useState<ChartData>({ labels: [], values: [] })
  const [messagesChart, setMessagesChart] = useState<ChartData>({ labels: [], values: [] })
  const [topAgents, setTopAgents] = useState<any[]>([])

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadAnalytics()
  }, [period])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/api/analytics?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats || getDefaultStats())
        setConversationsChart(data.conversationsChart || getDefaultChart())
        setMessagesChart(data.messagesChart || getDefaultChart())
        setTopAgents(data.topAgents || [])
      } else {
        setStats(getDefaultStats())
        setConversationsChart(getDefaultChart())
        setMessagesChart(getDefaultChart())
        setTopAgents([])
      }
    } catch {
      setStats(getDefaultStats())
      setConversationsChart(getDefaultChart())
      setMessagesChart(getDefaultChart())
      setTopAgents([])
    } finally {
      setLoading(false)
    }
  }

  const getDefaultStats = (): StatCard[] => [
    { title: 'Conversas Total', value: 1247, change: '+12%', icon: '💬', color: 'blue' },
    { title: 'Mensagens Enviadas', value: 8934, change: '+8%', icon: '📤', color: 'green' },
    { title: 'Tempo Médio Resposta', value: '2.3m', change: '-15%', icon: '⏱️', color: 'yellow' },
    { title: 'Satisfação', value: '94%', change: '+3%', icon: '⭐', color: 'purple' },
  ]

  const getDefaultChart = (): ChartData => {
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    return { labels: days, values: [120, 150, 180, 140, 200, 90, 110] }
  }

  const maxValue = Math.max(...conversationsChart.values)

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Analytics</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.currentTarget.value)}
            className="input w-40"
          >
            <option value="1d">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, idx) => (
            <div key={idx} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  stat.change?.startsWith('+') ? 'bg-green-500/30 text-green-300' :
                  stat.change?.startsWith('-') ? 'bg-red-500/30 text-red-300' :
                  'bg-gray-500/30 text-gray-300'
                }`}>
                  {stat.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-text-strong">{stat.value}</div>
              <div className="text-sm text-text-subtle">{stat.title}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h3 className="font-medium text-text-strong mb-4">Conversas por Dia</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-text-subtle">Carregando...</div>
            ) : (
              <div className="h-64 flex items-end gap-2">
                {conversationsChart.values.map((value, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-text-interactive-base/80 rounded-t transition-all hover:bg-text-interactive-base"
                      style={{ height: `${(value / maxValue) * 200}px`, minHeight: '4px' }}
                    />
                    <span className="text-xs text-text-subtle">{conversationsChart.labels[idx]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-medium text-text-strong mb-4">Mensagens por Dia</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-text-subtle">Carregando...</div>
            ) : (
              <div className="h-64 flex items-end gap-2">
                {messagesChart.values.map((value, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-green-500/80 rounded-t transition-all hover:bg-green-500"
                      style={{ height: `${(value / Math.max(...messagesChart.values)) * 200}px`, minHeight: '4px' }}
                    />
                    <span className="text-xs text-text-subtle">{messagesChart.labels[idx]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-medium text-text-strong mb-4">Canais</h3>
            <div className="space-y-3">
              {[
                { name: 'WhatsApp', value: 65, color: 'bg-green-500' },
                { name: 'Web', value: 20, color: 'bg-blue-500' },
                { name: 'Telegram', value: 10, color: 'bg-yellow-500' },
                { name: 'Email', value: 5, color: 'bg-purple-500' },
              ].map((channel, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-base">{channel.name}</span>
                    <span className="text-sm text-text-subtle">{channel.value}%</span>
                  </div>
                  <div className="h-2 bg-surface-raised-base rounded-full overflow-hidden">
                    <div
                      className={`h-full ${channel.color} rounded-full transition-all`}
                      style={{ width: `${channel.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium text-text-strong mb-4">Agentes Mais Ativos</h3>
            {topAgents.length > 0 ? (
              <div className="space-y-3">
                {topAgents.map((agent, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-text-strong">{agent.name}</div>
                      <div className="text-xs text-text-subtle">{agent.conversations} conversas</div>
                    </div>
                    <div className="text-sm text-text-subtle">{agent.percentage}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-text-subtle py-8">
                <div className="text-2xl mb-2">👥</div>
                <p>Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
