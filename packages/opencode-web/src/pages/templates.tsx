import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Template {
  id: string
  name: string
  description?: string
  category: string
  content: string
  variables?: string[]
  status: string
  usageCount: number
  createdAt: string
}

const CATEGORIES = ['Greeting', 'Follow-up', 'Support', 'Sales', 'Closing', 'Custom']

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Custom',
    content: '',
    variables: ''
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/templates`)
      if (res.ok) setTemplates(await res.json())
      else setTemplates(getDefaultTemplates())
    } catch {
      setTemplates(getDefaultTemplates())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultTemplates = (): Template[] => [
    {
      id: '1',
      name: 'Boas-vindas',
      description: 'Mensagem inicial de boas-vindas',
      category: 'Greeting',
      content: 'Olá {{name}}! 👋\n\nSeja bem-vindo(a) ao nosso atendimento! Como posso ajudá-lo(a) hoje?',
      variables: ['name'],
      status: 'ACTIVE',
      usageCount: 156,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Follow-up 24h',
      description: 'Follow-up após 24 horas',
      category: 'Follow-up',
      content: 'Olá {{name}}! Tudo bem?\n\nGostaria de saber se a solução anterior foi útil ou se ainda precisa de ajuda.',
      variables: ['name'],
      status: 'ACTIVE',
      usageCount: 89,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Encerramento',
      description: 'Mensagem de encerramento positivo',
      category: 'Closing',
      content: 'Foi um prazer ajudá-lo(a), {{name}}! 😊\n\nEstamos sempre à disposição. Tenha um excelente dia!',
      variables: ['name'],
      status: 'ACTIVE',
      usageCount: 234,
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Suporte Técnico',
      description: 'Template para suporte técnico',
      category: 'Support',
      content: 'Olá {{name}}!\n\nObrigado por entrar em contato com nosso suporte técnico.\n\nPara melhor atendê-lo, por favor informe:\n1. Qual problema está enfrentando?\n2. Quando começou?\n3. Já tentou alguma solução?\n\n📞 Urgente: {{phone}}',
      variables: ['name', 'phone'],
      status: 'ACTIVE',
      usageCount: 67,
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      name: 'Proposta Comercial',
      description: 'Template para envio de proposta',
      category: 'Sales',
      content: 'Olá {{name}}! 👋\n\nConforme solicitado, seguem os detalhes da nossa proposta:\n\n📋 **Plano:** {{plan}}\n💰 **Valor:** {{price}}\n✅ **Inclui:** {{features}}\n\nFicamos à disposição para esclarecer qualquer dúvida!\n\nAtt,\n{{agent_name}}',
      variables: ['name', 'plan', 'price', 'features', 'agent_name'],
      status: 'ACTIVE',
      usageCount: 45,
      createdAt: new Date().toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean)
        })
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', description: '', category: 'Custom', content: '', variables: '' })
        loadTemplates()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCopyTemplate = (template: Template) => {
    navigator.clipboard.writeText(template.content)
    alert('Template copiado!')
  }

  const filteredTemplates = filterCategory === 'all'
    ? templates
    : templates.filter(t => t.category === filterCategory)

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Greeting': return 'bg-green-500/30 text-green-300'
      case 'Follow-up': return 'bg-blue-500/30 text-blue-300'
      case 'Support': return 'bg-yellow-500/30 text-yellow-300'
      case 'Sales': return 'bg-purple-500/30 text-purple-300'
      case 'Closing': return 'bg-pink-500/30 text-pink-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-strong">Templates</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo Template
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
              filterCategory === 'all'
                ? 'bg-text-interactive-base text-white'
                : 'bg-surface-raised-base text-text-base hover:bg-surface-raised-hover'
            }`}
          >
            Todos
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                filterCategory === cat
                  ? 'bg-text-interactive-base text-white'
                  : 'bg-surface-raised-base text-text-base hover:bg-surface-raised-hover'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : filteredTemplates.length > 0 ? (
          <div className="space-y-3">
            {filteredTemplates.map(template => (
              <div key={template.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-strong">{template.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(template.category)}`}>
                        {template.category}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-text-subtle">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyTemplate(template)}
                      className="p-2 hover:bg-surface-raised-hover rounded text-text-subtle"
                      title="Copiar"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div className="bg-surface-raised-base rounded p-3 text-sm text-text-base whitespace-pre-wrap font-mono">
                  {template.content}
                </div>
                {template.variables && template.variables.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {template.variables.map(v => (
                      <span key={v} className="px-2 py-0.5 bg-text-interactive-base/20 text-text-interactive-base text-xs rounded">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum template encontrado.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Template</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.currentTarget.value })}
                  className="input"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Conteúdo</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.currentTarget.value })}
                  className="input font-mono text-sm"
                  rows={6}
                  required
                />
                <p className="text-xs text-text-subtle mt-1">Use {'{{variável}}'} para criar variáveis</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Variáveis (separadas por vírgula)</label>
                <input
                  type="text"
                  value={formData.variables}
                  onChange={(e) => setFormData({ ...formData, variables: e.currentTarget.value })}
                  className="input"
                  placeholder="name, email, phone"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
