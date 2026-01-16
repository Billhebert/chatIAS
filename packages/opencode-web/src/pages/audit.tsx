import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface LogEntry {
  id: string
  action: string
  resource: string
  resourceId?: string
  userId: string
  userName: string
  details?: string
  ip: string
  status: 'success' | 'failure' | 'warning'
  createdAt: string
}

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'EXPORT', 'OTHER']
const RESOURCES = ['User', 'Company', 'Department', 'Conversation', 'Template', 'Integration', 'Settings']

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadLogs()
  }, [filters])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.action) params.append('action', filters.action)
      if (filters.resource) params.append('resource', filters.resource)
      if (filters.status) params.append('status', filters.status)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)

      const res = await fetchWithAuth(`${API_URL}/api/audit-logs?${params}`)
      if (res.ok) setLogs(await res.json())
      else setLogs(getMockLogs())
    } catch {
      setLogs(getMockLogs())
    } finally {
      setLoading(false)
    }
  }

  const getMockLogs = (): LogEntry[] => [
    {
      id: '1',
      action: 'LOGIN',
      resource: 'User',
      userId: '1',
      userName: 'Admin',
      details: 'Login realizado com sucesso',
      ip: '192.168.1.100',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
    },
    {
      id: '2',
      action: 'CREATE',
      resource: 'Company',
      resourceId: 'comp-1',
      userId: '1',
      userName: 'Admin',
      details: 'Empresa "Test Company" criada',
      ip: '192.168.1.100',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      id: '3',
      action: 'UPDATE',
      resource: 'Settings',
      userId: '1',
      userName: 'Admin',
      details: 'Configurações de notificação atualizadas',
      ip: '192.168.1.100',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: '4',
      action: 'DELETE',
      resource: 'User',
      resourceId: 'user-2',
      userId: '1',
      userName: 'Admin',
      details: 'Usuário "John Doe" excluído',
      ip: '192.168.1.100',
      status: 'warning',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    {
      id: '5',
      action: 'LOGIN',
      resource: 'User',
      userId: '2',
      userName: 'John Doe',
      details: 'Falha no login - credenciais inválidas',
      ip: '192.168.1.101',
      status: 'failure',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    {
      id: '6',
      action: 'CREATE',
      resource: 'Template',
      resourceId: 'tmpl-1',
      userId: '1',
      userName: 'Admin',
      details: 'Template "Boas-vindas" criado',
      ip: '192.168.1.100',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString()
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/30 text-green-300'
      case 'failure': return 'bg-red-500/30 text-red-300'
      case 'warning': return 'bg-yellow-500/30 text-yellow-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return '➕'
      case 'UPDATE': return '✏️'
      case 'DELETE': return '🗑️'
      case 'LOGIN': return '🔑'
      case 'LOGOUT': return '🚪'
      case 'VIEW': return '👁️'
      case 'EXPORT': return '📤'
      default: return '📋'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredLogs = filters.action || filters.resource || filters.status
    ? logs
    : logs

  const exportLogs = () => {
    const csv = [
      ['Data', 'Ação', 'Recurso', 'Usuário', 'IP', 'Status', 'Detalhes'].join(','),
      ...logs.map(log => [
        log.createdAt,
        log.action,
        log.resource,
        log.userName,
        log.ip,
        log.status,
        `"${log.details || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Audit Logs</h1>
          <button onClick={exportLogs} className="btn-secondary">
            📤 Exportar CSV
          </button>
        </div>

        <div className="card mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-text-subtle mb-1">Ação</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.currentTarget.value })}
                className="input text-sm"
              >
                <option value="">Todas</option>
                {ACTIONS.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-subtle mb-1">Recurso</label>
              <select
                value={filters.resource}
                onChange={(e) => setFilters({ ...filters, resource: e.currentTarget.value })}
                className="input text-sm"
              >
                <option value="">Todos</option>
                {RESOURCES.map(resource => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-subtle mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.currentTarget.value })}
                className="input text-sm"
              >
                <option value="">Todos</option>
                <option value="success">Sucesso</option>
                <option value="failure">Falha</option>
                <option value="warning">Aviso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-subtle mb-1">De</label>
              <input
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.currentTarget.value })}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-subtle mb-1">Até</label>
              <input
                type="datetime-local"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.currentTarget.value })}
                className="input text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ action: '', resource: '', status: '', dateFrom: '', dateTo: '' })}
                className="btn-secondary text-sm"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-raised-base border-b border-border-weak-base">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Ação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Recurso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-subtle uppercase">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-weak-base/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-subtle">Carregando...</td>
                  </tr>
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-surface-raised-base/50">
                      <td className="px-4 py-3 text-sm text-text-base whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span>{getActionIcon(log.action)}</span>
                          <span className="text-text-strong">{log.action}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-base">{log.resource}</td>
                      <td className="px-4 py-3 text-sm text-text-base">{log.userName}</td>
                      <td className="px-4 py-3 text-sm text-text-subtle font-mono">{log.ip}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-subtle max-w-xs truncate">
                        {log.details}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-subtle">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-text-subtle text-center">
          Total de registros: {filteredLogs.length}
        </div>
      </div>
    </div>
  )
}
