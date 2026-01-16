import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Report {
  id: string
  name: string
  type: 'conversations' | 'messages' | 'satisfaction' | 'agents' | 'channels'
  schedule: 'daily' | 'weekly' | 'monthly' | 'manual'
  lastGenerated?: string
  format: 'pdf' | 'csv' | 'xlsx'
  status: 'active' | 'paused'
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/reports`)
      if (res.ok) setReports(await res.json())
      else setReports(getDefaultReports())
    } catch {
      setReports(getDefaultReports())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultReports = (): Report[] => [
    {
      id: '1',
      name: 'Relatório Semanal de Conversas',
      type: 'conversations',
      schedule: 'weekly',
      lastGenerated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      format: 'pdf',
      status: 'active'
    },
    {
      id: '2',
      name: 'Satisfação do Cliente',
      type: 'satisfaction',
      schedule: 'daily',
      lastGenerated: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      format: 'xlsx',
      status: 'active'
    },
    {
      id: '3',
      name: 'Desempenho de Agentes',
      type: 'agents',
      schedule: 'weekly',
      format: 'pdf',
      status: 'active'
    },
    {
      id: '4',
      name: 'Volume por Canal',
      type: 'channels',
      schedule: 'monthly',
      lastGenerated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      format: 'csv',
      status: 'paused'
    },
  ]

  const handleGenerateReport = async (reportId: string) => {
    setGenerating(reportId)
    try {
      await fetchWithAuth(`${API_URL}/api/reports/${reportId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: dateRange.start, endDate: dateRange.end })
      })
      await new Promise(r => setTimeout(r, 3000))
      loadReports()
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(null)
    }
  }

  const handleDownloadReport = async (reportId: string, format: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/reports/${reportId}/download?format=${format}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${reportId}.${format}`
        a.click()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleScheduleReport = async (reportId: string, schedule: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule })
      })
      loadReports()
    } catch (e) {
      console.error(e)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'conversations': return '💬'
      case 'messages': return '📤'
      case 'satisfaction': return '⭐'
      case 'agents': return '👥'
      case 'channels': return '📊'
      default: return '📄'
    }
  }

  const getScheduleIcon = (schedule: string) => {
    switch (schedule) {
      case 'daily': return '📅'
      case 'weekly': return '📆'
      case 'monthly': return '🗓️'
      default: return '⏰'
    }
  }

  const summaryCards = [
    { title: 'Total Conversas', value: '1,247', change: '+12%', icon: '💬', color: 'blue' },
    { title: 'Mensagens Enviadas', value: '8,934', change: '+8%', icon: '📤', color: 'green' },
    { title: 'Tempo Médio', value: '2.3m', change: '-15%', icon: '⏱️', color: 'yellow' },
    { title: 'Satisfação', value: '94%', change: '+3%', icon: '⭐', color: 'purple' },
  ]

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Relatórios</h1>
            <p className="text-sm text-text-subtle">Gere e baixe relatórios detalhados</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summaryCards.map((card, idx) => (
            <div key={idx} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{card.icon}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  card.change.startsWith('+') ? 'bg-green-500/30 text-green-300' :
                  card.change.startsWith('-') ? 'bg-red-500/30 text-red-300' :
                  'bg-gray-500/30 text-gray-300'
                }`}>
                  {card.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-text-strong">{card.value}</div>
              <div className="text-sm text-text-subtle">{card.title}</div>
            </div>
          ))}
        </div>

        <div className="card p-4 mb-6">
          <h3 className="font-medium text-text-strong mb-4">Gerar Relatório Rápido</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-text-subtle mb-1">Data Inicial</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.currentTarget.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-text-subtle mb-1">Data Final</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.currentTarget.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-text-subtle mb-1">Formato</label>
              <select className="input">
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
              </select>
            </div>
            <button className="btn-primary">📊 Gerar</button>
          </div>
        </div>

        <h2 className="font-medium text-text-strong mb-4">Relatórios Agendados</h2>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : reports.length > 0 ? (
          <div className="space-y-4">
            {reports.map(report => (
              <div key={report.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getTypeIcon(report.type)}</span>
                      <span className="font-medium text-text-strong">{report.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        report.status === 'active' ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30 text-gray-300'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-text-subtle">
                      <span>{getScheduleIcon(report.schedule)} Agendamento: {report.schedule}</span>
                      <span>📄 Formato: {report.format.toUpperCase()}</span>
                      <span>🕐 Último: {formatDate(report.lastGenerated)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateReport(report.id)}
                      className="btn-primary text-sm"
                      disabled={generating === report.id}
                    >
                      {generating === report.id ? '⏳' : '📊'} Gerar
                    </button>
                    <button
                      onClick={() => handleDownloadReport(report.id, report.format)}
                      className="btn-secondary text-sm"
                    >
                      📥 Download
                    </button>
                    <select
                      value={report.schedule}
                      onChange={(e) => handleScheduleReport(report.id, e.currentTarget.value)}
                      className="input text-sm w-32"
                    >
                      <option value="manual">Manual</option>
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum relatório agendado.
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-medium text-text-strong mb-4">Histórico de Relatórios</h2>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-raised-base border-b border-border-weak-base">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Gerado em</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Formato</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-weak-base/50">
                {[
                  { name: 'Relatório Semanal - 08 Jan', date: '2024-01-08 14:30', format: 'PDF' },
                  { name: 'Satisfação - 07 Jan', date: '2024-01-07 09:00', format: 'XLSX' },
                  { name: 'Desempenho Agentes - 01 Jan', date: '2024-01-01 08:00', format: 'PDF' },
                ].map((report, idx) => (
                  <tr key={idx} className="hover:bg-surface-raised-base/50">
                    <td className="px-4 py-3 text-sm text-text-strong">{report.name}</td>
                    <td className="px-4 py-3 text-sm text-text-subtle">{report.date}</td>
                    <td className="px-4 py-3 text-sm text-text-subtle">{report.format}</td>
                    <td className="px-4 py-3">
                      <button className="text-text-interactive-base text-sm">📥</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
