import { useState, useCallback, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  createdAt: string
  metadata?: {
    modelId?: string
    tokens?: number
    responseTime?: number
  }
}

interface UseOpenCodeAIOptions {
  modelId?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  onResponse?: (content: string) => void
  onError?: (error: Error) => void
}

interface UseOpenCodeAIReturn {
  messages: Message[]
  sendMessage: (content: string) => Promise<void>
  isLoading: boolean
  streamingContent: string
  stopStreaming: () => void
  clearMessages: () => void
}

export function useOpenCodeAI(options: UseOpenCodeAIOptions = {}): UseOpenCodeAIReturn {
  const {
    modelId,
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
    onResponse,
    onError
  } = options

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const token = localStorage.getItem('token')

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }, [token])

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading || !content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setStreamingContent('')

    const controller = new AbortController()
    setAbortController(controller)

    try {
      const res = await fetchWithAuth(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          modelId,
          temperature,
          maxTokens,
          systemPrompt,
          history: messages
        }),
        signal: controller.signal
      })

      if (!res.ok) throw new Error('Failed to send message')

      if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          assistantContent += chunk
          setStreamingContent(assistantContent)
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: assistantContent,
          role: 'assistant',
          createdAt: new Date().toISOString()
        }

        setMessages(prev => [...prev, assistantMessage])
        onResponse?.(assistantContent)
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        onError?.(error)
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }, [isLoading, modelId, temperature, maxTokens, systemPrompt, messages, fetchWithAuth, onResponse, onError])

  const stopStreaming = useCallback(() => {
    abortController?.abort()
    setAbortController(null)
    setIsLoading(false)
  }, [abortController])

  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamingContent('')
  }, [])

  return {
    messages: [...messages, streamingContent ? {
      id: 'streaming',
      content: streamingContent,
      role: 'assistant' as const,
      createdAt: new Date().toISOString()
    } : null].filter(Boolean) as Message[],
    sendMessage,
    isLoading,
    streamingContent,
    stopStreaming,
    clearMessages
  }
}

export function useOpenCodeModels() {
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/ai/models`)
        if (res.ok) {
          const data = await res.json()
          setModels(data)
        } else {
          setModels(getDefaultModels())
        }
      } catch (e) {
        setModels(getDefaultModels())
      } finally {
        setLoading(false)
      }
    }

    loadModels()
  }, [])

  const getDefaultModels = () => [
    { id: '1', name: 'GPT-4o', provider: 'OpenAI', modelId: 'gpt-4o', status: 'active', capabilities: ['chat', 'function_call', 'vision'] },
    { id: '2', name: 'GPT-4o-mini', provider: 'OpenAI', modelId: 'gpt-4o-mini', status: 'active', capabilities: ['chat', 'function_call'] },
    { id: '3', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', modelId: 'claude-sonnet-4-20250514', status: 'active', capabilities: ['chat', 'vision', 'reasoning'] },
  ]

  return { models, loading }
}

export function useOpenCodeAgents() {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const token = localStorage.getItem('token')

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/users?role=agent`)
        if (res.ok) {
          setAgents(await res.json())
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [])

  return { agents, loading }
}
