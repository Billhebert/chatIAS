import { useState, useEffect, useRef } from 'react'
import { useOpenCodeAI, useOpenCodeModels, useOpenCodeAgents } from '../hooks/useOpenCodeAI'
import { Button } from './Button'
import { Input } from './Input'
import { Select } from './Select'
import { Avatar, Badge } from './Avatar'
import { Card, CardHeader } from './Card'
import { Loading } from './State'
import type { Conversation, Message } from '../types'

interface OpenCodeChatProps {
  conversationId?: string
  initialModel?: string
  initialAgent?: string
  onMessage?: (message: Message) => void
}

export function OpenCodeChat({
  conversationId,
  initialModel,
  initialAgent,
  onMessage
}: OpenCodeChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedModel, setSelectedModel] = useState(initialModel || '')
  const [selectedAgent, setSelectedAgent] = useState(initialAgent || '')
  const [temperature, setTemperature] = useState(0.7)

  const { models } = useOpenCodeModels()
  const { agents } = useOpenCodeAgents()
  
  const {
    messages,
    sendMessage,
    isLoading,
    streamingContent,
    clearMessages
  } = useOpenCodeAI({
    modelId: selectedModel || undefined,
    temperature,
    systemPrompt: 'You are a helpful AI assistant. Respond in Portuguese.'
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const loadConversations = async () => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL || ''}/api/chat/conversations`)
      if (res.ok) setConversations(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newMessage.trim() || isLoading) return

    const content = newMessage
    setNewMessage('')

    if (selectedModel) {
      await sendMessage(content)
    } else {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL || ''}/api/chat/conversations${conversationId ? `/${conversationId}` : ''}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          agentId: selectedAgent || undefined,
          modelId: selectedModel || undefined
        })
      })
      
      if (res.ok) {
        onMessage?.(await res.json())
        loadConversations()
      }
    }
  }

  const createNewConversation = async () => {
    const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL || ''}/api/chat/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: 'Nova conversa',
        modelId: selectedModel || undefined,
        agentId: selectedAgent || undefined
      })
    })
    
    if (res.ok) {
      const newChat = await res.json()
      loadConversations()
      setSelectedConversation(newChat)
      clearMessages()
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
            <Button size="sm" onClick={createNewConversation} icon={<span>+</span>}>
              Nova
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-text-subtle">
              <p>Nenhuma conversa</p>
              <Button size="sm" variant="ghost" onClick={createNewConversation} className="mt-2">
                Criar primeira conversa
              </Button>
            </div>
          ) : (
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
                    <div className="text-xs text-text-subtle">{getChannelIcon(conv.channel)}</div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge variant="info">{conv.unreadCount}</Badge>
                  )}
                </div>
              </button>
            ))
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
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedModel(e.target.value)}
                    options={modelOptions}
                    placeholder="Selecione um modelo"
                  />
                  <Select
                    label="Agente Responsável"
                    value={selectedAgent}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAgent(e.target.value)}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </Card>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-text-subtle">
                  <span className="text-4xl mb-4">🤖</span>
                  <p>Inicie uma conversa</p>
                  {selectedModel && (
                    <p className="text-sm text-text-interactive-base mt-2">
                      Respondendo com {models.find(m => m.id === selectedModel)?.name}
                    </p>
                  )}
                  {selectedAgent && (
                    <p className="text-sm text-green-400 mt-2">
                      Atribuído a {agents.find(a => a.id === selectedAgent)?.name}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg: Message, idx: number) => (
                    <div
                      key={msg.id || idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-lg px-4 py-3 rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-text-interactive-base text-white'
                          : 'bg-surface-raised-base border border-border-weak-base'
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
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-surface-raised-base border border-border-weak-base px-4 py-3 rounded-xl">
                        <Loading size="sm" text="Pensando..." />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-border-weak-base bg-surface-raised-base">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                  placeholder={
                    selectedModel && !selectedAgent
                      ? "IA irá responder..."
                      : selectedAgent && !selectedModel
                      ? "Agente irá responder..."
                      : "Digite sua mensagem..."
                  }
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !newMessage.trim()}>
                  {isLoading ? '⏳' : '➤'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-subtle">
            <div className="text-center">
              <span className="text-4xl">💬</span>
              <p className="mt-4">Selecione uma conversa ou crie uma nova</p>
              <Button onClick={createNewConversation} className="mt-4">
                Nova Conversa
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
