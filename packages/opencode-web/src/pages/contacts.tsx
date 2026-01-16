import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  avatar?: string
  channel: string
  channelId: string
  tags: string[]
  status: 'active' | 'inactive' | 'blocked'
  lastContact?: string
  totalConversations: number
  notes?: string
  customFields?: Record<string, string>
  createdAt: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    channel: 'whatsapp',
    channelId: '',
    tags: [] as string[],
    status: 'active' as const,
    notes: ''
  })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/contacts`)
      if (res.ok) setContacts(await res.json())
      else setContacts(getDefaultContacts())
    } catch {
      setContacts(getDefaultContacts())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultContacts = (): Contact[] => [
    {
      id: '1',
      name: 'João Silva',
      email: 'joao@email.com',
      phone: '5511999999991',
      channel: 'whatsapp',
      channelId: '5511999999991',
      tags: ['cliente', 'vip'],
      status: 'active',
      lastContact: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      totalConversations: 15,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
    },
    {
      id: '2',
      name: 'Maria Santos',
      email: 'maria@email.com',
      phone: '5511999999992',
      channel: 'whatsapp',
      channelId: '5511999999992',
      tags: ['cliente'],
      status: 'active',
      lastContact: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      totalConversations: 8,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString()
    },
    {
      id: '3',
      name: 'Pedro Costa',
      email: 'pedro@email.com',
      channel: 'telegram',
      channelId: '@pedrocosta',
      tags: ['lead', 'novo'],
      status: 'active',
      totalConversations: 2,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
    },
    {
      id: '4',
      name: 'Ana Oliveira',
      email: 'ana@email.com',
      phone: '5511999999994',
      channel: 'whatsapp',
      channelId: '5511999999994',
      tags: ['cliente', 'suporte'],
      status: 'blocked',
      totalConversations: 25,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString()
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', email: '', phone: '', channel: 'whatsapp', channelId: '', tags: [], status: 'active', notes: '' })
        loadContacts()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Excluir este contato?')) return
    try {
      await fetchWithAuth(`${API_URL}/api/contacts/${contactId}`, {
        method: 'DELETE'
      })
      loadContacts()
    } catch (e) {
      console.error(e)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return '💬'
      case 'telegram': return '✈️'
      case 'email': return '📧'
      case 'instagram': return '📷'
      default: return '👤'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/30 text-green-300'
      case 'inactive': return 'bg-gray-500/30 text-gray-300'
      case 'blocked': return 'bg-red-500/30 text-red-300'
      default: return 'bg-gray-500/30 text-gray-300'
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery)
    const matchesTag = !filterTag || contact.tags.includes(filterTag)
    return matchesSearch && matchesTag
  })

  const allTags = [...new Set(contacts.flatMap(c => c.tags))]

  return (
    <div className="size-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Contatos</h1>
            <p className="text-sm text-text-subtle">Gerencie seus contatos</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            ➕ Novo Contato
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="input flex-1"
          />
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.currentTarget.value)}
            className="input w-40"
          >
            <option value="">Todas tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="card text-center text-text-subtle">Carregando...</div>
        ) : filteredContacts.length > 0 ? (
          <div className="space-y-3">
            {filteredContacts.map(contact => (
              <div key={contact.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium text-lg">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-strong">{contact.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(contact.status)}`}>
                          {contact.status}
                        </span>
                        <span className="text-xs text-text-subtle flex items-center gap-1">
                          {getChannelIcon(contact.channel)} {contact.channel}
                        </span>
                      </div>
                      <div className="text-sm text-text-subtle">
                        {contact.email && <span>{contact.email}</span>}
                        {contact.email && contact.phone && <span> • </span>}
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {contact.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-surface-raised-base text-text-subtle text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                    <div className="flex items-center gap-4 text-sm text-text-subtle">
                      <span>💬 {contact.totalConversations}</span>
                      <span>📅 {formatDate(contact.lastContact || contact.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-text-subtle">
            Nenhum contato encontrado.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-text-strong mb-4">Novo Contato</h3>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.currentTarget.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Canal</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.currentTarget.value })}
                  className="input"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
                  className="input"
                  rows={2}
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
