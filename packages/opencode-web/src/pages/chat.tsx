import { useState, useEffect, useRef } from 'react'
import { Button, Input, Select, Avatar, Badge, Card, CardHeader, Loading } from '../components'
import type { Conversation, Message, AIModel, Agent } from '../types'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [models, setModels] = useState<AIModel[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadConversations()
    loadModels()
    loadAgents()
    const interval = setInterval(loadConversations, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
      setSelectedModel(selectedConversation.aiModelId || '')
      setSelectedAgent(selectedConversation.assignedAgentId || '')
      const interval = setInterval(() => loadMessages(selectedConversation.id), 5000)
      return () => clearInterval(interval)
    }
  }, [selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConversations = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations`)
      if (res.ok) setConversations(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadModels = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/ai/models`)
      if (res.ok) {
        const data = await res.json()
        setModels(data.filter((m: AIModel) => m.status === 'active'))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadAgents = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users?role=agent`)
      if (res.ok) setAgents(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations/${conversationId}/messages`)
      if (res.ok) setMessages(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return

    setSending(true)
    const content = newMessage
    setNewMessage('')

    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          modelId: selectedModel || undefined,
          agentId: selectedAgent || undefined,
          temperature
        })
      })

      if (res.ok) {
        loadMessages(selectedConversation.id)
        loadConversations()
      }
    } catch (e) {
      console.error(e)
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const createNewChat = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nova conversa',
          channel: 'web',
          aiModelId: selectedModel || undefined,
          assignedAgentId: selectedAgent || undefined
        })
      })
      if (res.ok) {
        const newChat = await res.json()
        loadConversations()
        setSelectedConversation(newChat)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, string> = {
      whatsapp: '💬',
      telegram: '✈️',
      instagram: '📷',
      email: '📧',
      web: '🌐'
    }
    return icons[channel] || '💬'
  }

  const getModelById = (id: string) => models.find(m => m.id === id)
  const getAgentById = (id: string) => agents.find(a => a.id === id)

  const modelOptions = [
    { value: '', label: 'Nenhum (humano)' },
    ...models.map(m => ({ value: m.id, label: `${m.provider} - ${m.name}` }))
  ]

  const agentOptions = [
    { value: '', label: 'Nenhum' },
    ...agents.map(a => ({ value: a.id, label: `${a.name} (${a.status})` }))
  ]

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-border-weak-base flex flex-col bg-surface-raised-base">
        <div className="p-4 border-b border-border-weak-base">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-strong">Conversas</h2>
            <Button size="sm" onClick={createNewChat} icon={<span>+</span>}>
              Nova
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-text-subtle">
              <Loading text="Carregando..." />
            </div>
          ) : conversations.length > 0 ? (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 text-left border-b border-border-weak-base/50 hover:bg-surface-raised-hover transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-surface-raised-hover' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={conv.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-strong truncate">{conv.name}</div>
                    <div className="flex items-center gap-2 text-xs text-text-subtle">
                      <span>{getChannelIcon(conv.channel)}</span>
                      {conv.aiModelId && (
                        <span className="text-text-interactive-base">
                          🤖 {getModelById(conv.aiModelId)?.name?.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge variant="info">{conv.unreadCount}</Badge>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-text-subtle">
              <p>Nenhuma conversa</p>
              <Button size="sm" variant="ghost" onClick={createNewChat} className="mt-2">
                Criar primeira conversa
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-border-weak-base bg-surface-raised-base">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedConversation.name} size="md" />
                  <div>
                    <div className="font-semibold text-text-strong">{selectedConversation.name}</div>
                    <div className="text-xs text-text-subtle capitalize">{selectedConversation.channel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showSettings ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    icon={<span>⚙️</span>}
                  >
                    Config
                  </Button>
                </div>
              </div>
            </div>

            {showSettings && (
              <Card className="m-4" padding="md">
                <CardHeader>Configurações da Conversa</CardHeader>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Select
                    label="Modelo de IA"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    options={modelOptions}
                    placeholder="Selecione um modelo"
                  />
                  <Select
                    label="Agente Responsável"
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    options={agentOptions}
                    placeholder="Selecione um agente"
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm text-text-subtle mb-2">
                    Temperature: {temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </Card>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-subtle">
                  <span className="text-4xl mb-4">💬</span>
                  <p>Inicie uma conversa</p>
                  {selectedModel && (
                    <p className="text-sm text-text-interactive-base mt-2">
                      Respondendo com {getModelById(selectedModel)?.name}
                    </p>
                  )}
                  {selectedAgent && (
                    <p className="text-sm text-green-400 mt-2">
                      Atribuído a {getAgentById(selectedAgent)?.name}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-lg px-4 py-3 rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-text-interactive-base text-white'
                          : msg.role === 'agent'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-purple-500/20 border border-purple-500/30'
                      }`}>
                        {msg.role !== 'user' && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.role === 'assistant' ? '🤖 IA' : '👨‍💼 Agente'}
                            </span>
                            {msg.metadata?.responseTime && (
                              <span className="text-xs text-text-subtle">
                                {msg.metadata.responseTime}ms
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-text-subtle'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-border-weak-base bg-surface-raised-base">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    selectedModel && !selectedAgent
                      ? "IA irá responder..."
                      : selectedAgent && !selectedModel
                      ? "Agente irá responder..."
                      : "Digite sua mensagem..."
                  }
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !newMessage.trim()}>
                  {sending ? '⏳' : '➤'}
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-text-subtle">
                {selectedModel && (
                  <span className="flex items-center gap-1">
                    🤖 {getModelById(selectedModel)?.name}
                  </span>
                )}
                {selectedAgent && (
                  <span className="flex items-center gap-1 text-green-400">
                    👨‍💼 {getAgentById(selectedAgent)?.name}
                  </span>
                )}
                <span className="ml-auto">Temperature: {temperature}</span>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-subtle">
            <div className="text-center">
              <span className="text-4xl">💬</span>
              <p className="mt-4">Selecione uma conversa ou crie uma nova</p>
              <Button onClick={createNewChat} className="mt-4">
                Nova Conversa
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
