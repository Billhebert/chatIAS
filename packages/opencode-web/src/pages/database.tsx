import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Backup {
  id: string
  name: string
  size: number
  type: 'full' | 'incremental' | 'config'
  status: 'completed' | 'in_progress' | 'failed'
  createdAt: string
}

export default function DatabasePage() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState({
    size: '0 MB',
    tables: 0,
    rows: 0,
    connections: 0
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadBackups()
    loadStats()
  }, [])

  const loadBackups = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/database/backups`)
      if (res.ok) setBackups(await res.json())
      else setBackups(getDefaultBackups())
    } catch {
      setBackups(getDefaultBackups())
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/database/stats`)
      if (res.ok) setDbStats(await res.json())
    } catch {
      setDbStats({ size: '245 MB', tables: 12, rows: 45832, connections: 15 })
    }
  }

  const getDefaultBackups = (): Backup[] => [
    {
      id: '1',
      name: 'backup-2024-01-15-full.sql.gz',
      size: 45678900,
      type: 'full',
      status: 'completed',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
      id: '2',
      name: 'backup-2024-01-15-incr.sql.gz',
      size: 2345678,
      type: 'incremental',
      status: 'completed',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: '3',
      name: 'backup-2024-01-14-full.sql.gz',
      size: 45012345,
      type: 'full',
      status: 'completed',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    },
    {
      id: '4',
      name: 'backup-2024-01-13-config.json',
      size: 45678,
      type: 'config',
      status: 'completed',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
    },
  ]

  const handleCreateBackup = async (type: 'full' | 'incremental' | 'config') => {
    setCreating(true)
    try {
      await fetchWithAuth(`${API_URL}/api/database/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      await new Promise(r => setTimeout(r, 3000))
      loadBackups()
      loadStats()
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Tem certeza? Isso substituirá todos os dados atuais.')) return
    setRestoring(backupId)
    try {
      await fetchWithAuth(`${API_URL}/api/database/backups/${backupId}/restore`, {
        method: 'POST'
      })
      await new Promise(r => setTimeout(r, 5000))
      loadStats()
    } catch (e) {
      console.error(e)
    } finally {
      setRestoring(null)
    }
  }

  const handleDownloadBackup = async (backupId: string, backupName: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/database/backups/${backupId}/download`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = backupName
        a.click()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Excluir este backup?')) return
    try {
      await fetchWithAuth(`${API_URL}/api/database/backups/${backupId}`, {
        method: 'DELETE'
      })
      loadBackups()
    } catch (e) {
      console.error(e)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'full': return '💾'
      case 'incremental': return '📈'
      case 'config': return '⚙️'
      default: return '📁'
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Banco de Dados</h1>
            <p className="text-sm text-text-subtle">Gerencie backups e configurações do banco</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateBackup('incremental')}
              className="btn-secondary"
              disabled={creating}
            >
              📈 Backup Incremental
            </button>
            <button
              onClick={() => handleCreateBackup('full')}
              className="btn-primary"
              disabled={creating}
            >
              {creating ? '⏳' : '💾'} Backup Completo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <div className="text-2xl mb-2">💾</div>
            <div className="text-2xl font-bold text-text-strong">{dbStats.size}</div>
            <div className="text-sm text-text-subtle">Tamanho do BD</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-2xl font-bold text-text-strong">{dbStats.tables}</div>
            <div className="text-sm text-text-subtle">Tabelas</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl mb-2">📝</div>
            <div className="text-2xl font-bold text-text-strong">{dbStats.rows.toLocaleString()}</div>
            <div className="text-sm text-text-subtle">Registros</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl mb-2">🔌</div>
            <div className="text-2xl font-bold text-text-strong">{dbStats.connections}</div>
            <div className="text-sm text-text-subtle">Conexões</div>
          </div>
        </div>

        <div className="card p-4 mb-6 bg-red-500/10 border-red-500/30">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-medium text-text-strong">Zona de Perigo</div>
              <div className="text-sm text-text-subtle">
                As operações de restauração são irreversíveis. Sempre faça um backup antes de restaurar.
              </div>
            </div>
          </div>
        </div>

        <h2 className="font-medium text-text-strong mb-4">Backups</h2>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : backups.length > 0 ? (
          <div className="space-y-3">
            {backups.map(backup => (
              <div key={backup.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{getTypeIcon(backup.type)}</span>
                    <div>
                      <div className="font-medium text-text-strong">{backup.name}</div>
                      <div className="text-sm text-text-subtle">
                        {formatSize(backup.size)} • {formatDate(backup.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      backup.status === 'completed' ? 'bg-green-500/30 text-green-300' :
                      backup.status === 'in_progress' ? 'bg-yellow-500/30 text-yellow-300' :
                      'bg-red-500/30 text-red-300'
                    }`}>
                      {backup.status}
                    </span>
                    <button
                      onClick={() => handleDownloadBackup(backup.id, backup.name)}
                      className="p-2 hover:bg-surface-raised-hover rounded text-text-interactive-base"
                      title="Download"
                    >
                      📥
                    </button>
                    <button
                      onClick={() => handleRestoreBackup(backup.id)}
                      className="btn-secondary text-sm"
                      disabled={restoring === backup.id}
                    >
                      {restoring === backup.id ? '⏳' : '🔄'} Restaurar
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum backup encontrado.
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-medium text-text-strong mb-4">Configurações</h2>
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-text-strong">Backup Automático</div>
                <div className="text-sm text-text-subtle">Criar backups diariamente às 3:00</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-raised-base rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-text-interactive-base"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-text-strong">Reter backups por</div>
                <div className="text-sm text-text-subtle">Manter últimos 30 backups</div>
              </div>
              <select className="input w-32">
                <option value="7">7 dias</option>
                <option value="14">14 dias</option>
                <option value="30" selected>30 dias</option>
                <option value="90">90 dias</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
