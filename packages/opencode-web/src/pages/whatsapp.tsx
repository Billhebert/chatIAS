import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Contact {
  id: string
  name: string
  phone: string
  avatar?: string
  lastSeen?: string
  status?: string
}

interface Instance {
  id: string
  name: string
  status: string
}

interface Message {
  key: { id: string; fromMe: boolean }
  message: { conversation?: string; extendedTextMessage?: { text: string } }
}

export default function WhatsAppPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', url: '', token: '' })

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadInstances()
  }, [])

  const loadInstances = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/integrations?type=EVOLUTION`)
      if (res.ok) {
        const data = await res.json()
        setInstances(data.map((i: any) => ({ id: i.id, name: i.name, status: i.status })))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadContacts = async (instanceId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/whatsapp/${instanceId}/contacts`)
      if (res.ok) setContacts(await res.json())
      else setContacts(getMockContacts())
    } catch {
      setContacts(getMockContacts())
    }
  }

  const getMockContacts = (): Contact[] => [
    { id: '1', name: 'João Silva', phone: '5511999999991', status: 'online' },
    { id: '2', name: 'Maria Santos', phone: '5511999999992' },
    { id: '3', name: 'Pedro Oliveira', phone: '5511999999993' },
    { id: '4', name: 'Ana Costa', phone: '5511999999994' },
    { id: '5', name: 'Carlos Souza', phone: '5511999999995' },
  ]

  const loadMessages = async (instanceId: string, contactPhone: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/whatsapp/${instanceId}/${contactPhone}/messages`)
      if (res.ok) setMessages(await res.json())
      else setMessages([])
    } catch {
      setMessages([])
    }
  }

  const handleSelectInstance = (instance: Instance) => {
    setSelectedInstance(instance)
    setSelectedContact(null)
    setMessages([])
    loadContacts(instance.id)
  }

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)
    if (selectedInstance) {
      loadMessages(selectedInstance.id, contact.phone)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInstance || !selectedContact || !newMessage.trim()) return

    try {
      await fetchWithAuth(`${API_URL}/api/whatsapp/${selectedInstance.id}/${selectedContact.phone}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage })
      })
      setNewMessage('')
      loadMessages(selectedInstance.id, selectedContact.phone)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth(`${API_URL}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, type: 'EVOLUTION' })
      })
      if (res.ok) {
        setShowInstanceModal(false)
        setFormData({ name: '', url: '', token: '' })
        loadInstances()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="size-full flex">
      <div className="w-80 border-r border-border-weak-base flex flex-col bg-surface-raised-base">
        <div className="p-4 border-b border-border-weak-base">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-text-strong">WhatsApp</h2>
            <button onClick={() => setShowInstanceModal(true)} className="text-text-interactive-base text-sm">
              ➕
            </button>
          </div>
          <select
            value={selectedInstance?.id || ''}
            onChange={(e) => {
              const inst = instances.find(i => i.id === e.currentTarget.value)
              if (inst) handleSelectInstance(inst)
            }}
            className="input text-sm"
          >
            <option value="">Selecionar instância</option>
            {instances.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-text-subtle">Carregando...</div>
          ) : contacts.length > 0 ? (
            contacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                className={`w-full p-4 text-left border-b border-border-weak-base/50 hover:bg-surface-raised-hover transition-colors ${
                  selectedContact?.id === contact.id ? 'bg-surface-raised-hover' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-strong truncate">{contact.name}</span>
                      {contact.lastSeen && (
                        <span className="text-xs text-text-subtle">{formatTime(contact.lastSeen)}</span>
                      )}
                    </div>
                    <div className="text-sm text-text-subtle truncate">{contact.phone}</div>
                  </div>
                  {contact.status === 'online' && (
                    <div className="size-2 rounded-full bg-green-500" />
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-text-subtle">
              {selectedInstance ? 'Nenhum contato' : 'Selecione uma instância'}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="p-4 border-b border-border-weak-base bg-surface-raised-base flex items-center gap-3">
              <div className="size-10 rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium">
                {selectedContact.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-text-strong">{selectedContact.name}</div>
                <div className="text-xs text-text-subtle">{selectedContact.phone}</div>
              </div>
              {selectedContact.status === 'online' && (
                <span className="ml-auto px-2 py-0.5 bg-green-500/30 text-green-300 text-xs rounded">
                  Online
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length > 0 ? messages.map((msg, idx) => (
                <div
                  key={msg.key?.id || idx}
                  className={`flex ${msg.key?.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-2 rounded-lg ${
                      msg.key?.fromMe
                        ? 'bg-text-interactive-base text-white'
                        : 'bg-surface-raised-base text-text-base'
                    }`}
                  >
                    <div className="text-sm">
                      {msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-text-subtle py-8">
                  <div className="text-2xl mb-2">💬</div>
                  <p>Nenhuma mensagem ainda</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-border-weak-base bg-surface-raised-base">
              <div className="flex gap-2">
                <button type="button" className="p-2 hover:bg-surface-raised-hover rounded text-text-subtle">
                  📎
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.currentTarget.value)}
                  placeholder="Digite sua mensagem..."
                  className="input flex-1"
                />
                <button type="submit" className="btn-primary">➤</button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-subtle">
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <p>Selecione um contato para iniciar</p>
            </div>
          </div>
        )}
      </div>

      {showInstanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-text-strong mb-4">Nova Instância Evolution</h3>
            <form onSubmit={handleCreateInstance} className="space-y-4">
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
                <label className="block text-sm font-medium text-text-base mb-1">URL da API</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.currentTarget.value })}
                  className="input"
                  placeholder="http://localhost:8080"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Token</label>
                <input
                  type="text"
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.currentTarget.value })}
                  className="input"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowInstanceModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
