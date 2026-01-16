import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface Session {
  id: string
  title?: string
  updatedAt: string
}

export default function SessionPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createSession = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nova conversa' })
      })
      if (res.ok) {
        const session = await res.json()
        setSelectedSession(session.id)
        setMessages([])
        loadSessions()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadMessages = async (sessionId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations/${sessionId}/messages`)
      if (res.ok) setMessages(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSession || !newMessage.trim()) return

    setSending(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations/${selectedSession}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage })
      })
      if (res.ok) {
        setNewMessage('')
        loadMessages(selectedSession)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="size-full flex">
      <div className="w-64 border-r border-border-weak-base flex flex-col bg-surface-raised-base">
        <div className="p-4 border-b border-border-weak-base">
          <button onClick={createSession} className="btn-primary w-full">
            ➕ Nova Sessão
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-text-subtle">Carregando...</div>
          ) : sessions.length > 0 ? (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => { setSelectedSession(session.id); loadMessages(session.id); }}
                className={`w-full p-3 text-left hover:bg-surface-raised-hover border-b border-border-weak-base ${
                  selectedSession === session.id ? 'bg-surface-raised-active' : ''
                }`}
              >
                <div className="font-medium text-text-strong truncate">
                  {session.title || 'Sem título'}
                </div>
                <div className="text-xs text-text-subtle">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-text-subtle">Nenhuma sessão.</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-md px-4 py-2 rounded-lg ${
                    msg.role === 'USER'
                      ? 'bg-text-interactive-base text-white'
                      : 'bg-surface-raised-base text-text-base'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-border-weak-base bg-surface-raised-base">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.currentTarget.value)}
                  placeholder="Digite sua mensagem..."
                  className="input flex-1"
                  disabled={sending}
                />
                <button type="submit" className="btn-primary" disabled={sending}>
                  {sending ? '...' : 'Enviar'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex- justify-center text-text1 flex items-center-subtle">
            Selecione ou crie uma sessão
          </div>
        )}
      </div>
    </div>
  )
}
