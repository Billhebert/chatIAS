import { For, Show, createSignal, createEffect, onMount, onCleanup, createMemo } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { Card } from "@opencode-ai/ui/card"
import { Select } from "@opencode-ai/ui/select"
import { TextField } from "@opencode-ai/ui/text-field"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Avatar } from "@opencode-ai/ui/avatar"
import { Icon } from "@opencode-ai/ui/icon"
import styles from "./chat.module.css"

interface Conversation {
  id: string
  name: string
  status: "OPEN" | "PENDING" | "CLOSED"
  channel: string
  aiModelId?: string
  assignedAgentId?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
  createdAt: string
}

interface Message {
  id: string
  content: string
  role: "user" | "assistant" | "agent" | "system"
  createdAt: string
  metadata?: {
    modelId?: string
    agentId?: string
    tokens?: number
    responseTime?: number
  }
}

interface AIModel {
  id: string
  name: string
  provider: string
  modelId: string
  status: "active" | "inactive"
  capabilities?: string[]
}

interface Agent {
  id: string
  name: string
  email: string
  avatar?: string
  status: "online" | "offline" | "busy"
  role: string
}

const API_URL = import.meta.env.VITE_API_URL || ""

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers || {})
  const token = localStorage.getItem("token")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return fetch(url, { ...options, headers })
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function Badge(props: { count: number }) {
  return (
    <span
      style={{
        background: "var(--color-text-interactive-base)",
        color: "white",
        "font-size": "11px",
        "font-weight": "600",
        padding: "2px 6px",
        "border-radius": "10px",
        "flex-shrink": 0,
      }}
    >
      {props.count}
    </span>
  )
}

export default function ChatPage() {
  const [conversations, setConversations] = createStore<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = createSignal<Conversation | null>(null)
  const [messages, setMessages] = createStore<Message[]>([])
  const [newMessage, setNewMessage] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [sending, setSending] = createSignal(false)
  const [showSettings, setShowSettings] = createSignal(false)
  const [models, setModels] = createSignal<AIModel[]>([])
  const [agents, setAgents] = createSignal<Agent[]>([])
  const [selectedModel, setSelectedModel] = createSignal("")
  const [selectedAgent, setSelectedAgent] = createSignal("")
  const [temperature, setTemperature] = createSignal(0.7)

  let messagesEndRef: HTMLDivElement | undefined
  let refreshInterval: number | undefined

  const modelOptions = createMemo(() => [
    { value: "", label: "Nenhum (humano)" },
    ...models().map((m) => ({ value: m.id, label: `${m.provider} - ${m.name}` })),
  ])

  const agentOptions = createMemo(() => [
    { value: "", label: "Nenhum" },
    ...agents().map((a) => ({ value: a.id, label: `${a.name} (${a.status})` })),
  ])

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, string> = {
      whatsapp: "💬",
      telegram: "✈️",
      instagram: "📷",
      email: "📧",
      web: "🌐",
    }
    return icons[channel] || "💬"
  }

  const getModelById = (id: string) => models().find((m) => m.id === id)
  const getAgentById = (id: string) => agents().find((a) => a.id === id)

  const loadConversations = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations`)
      if (res.ok) {
        const data = await res.json()
        setConversations(reconcile(data))
      }
    } catch (e) {
      console.error("Error loading conversations:", e)
    } finally {
      setLoading(false)
    }
  }

  const loadModels = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/ai/models`)
      if (res.ok) {
        const data = await res.json()
        setModels(data.filter((m: AIModel) => m.status === "active"))
      }
    } catch (e) {
      console.error("Error loading models:", e)
    }
  }

  const loadAgents = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users?role=agent`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
      }
    } catch (e) {
      console.error("Error loading agents:", e)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations/${conversationId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(reconcile(data))
      }
    } catch (e) {
      console.error("Error loading messages:", e)
    }
  }

  const handleSendMessage = async (e: Event) => {
    e.preventDefault()
    const conv = selectedConversation()
    if (!conv || !newMessage().trim()) return

    setSending(true)
    const content = newMessage()
    setNewMessage("")

    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          modelId: selectedModel() || undefined,
          agentId: selectedAgent() || undefined,
          temperature: temperature(),
        }),
      })

      if (res.ok) {
        loadMessages(conv.id)
        loadConversations()
      }
    } catch (e) {
      console.error("Error sending message:", e)
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const createNewChat = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nova conversa",
          channel: "web",
          aiModelId: selectedModel() || undefined,
          assignedAgentId: selectedAgent() || undefined,
        }),
      })
      if (res.ok) {
        const newChat = await res.json()
        await loadConversations()
        setSelectedConversation(newChat)
        setMessages([])
      }
    } catch (e) {
      console.error("Error creating chat:", e)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef?.scrollIntoView({ behavior: "smooth" })
  }

  createEffect(() => {
    messages()
    scrollToBottom()
  })

  onMount(() => {
    loadConversations()
    loadModels()
    loadAgents()
    refreshInterval = window.setInterval(loadConversations, 10000) as unknown as number
  })

  onCleanup(() => {
    if (refreshInterval) clearInterval(refreshInterval)
  })

  createEffect(() => {
    const conv = selectedConversation()
    if (conv) {
      loadMessages(conv.id)
      setSelectedModel(conv.aiModelId || "")
      setSelectedAgent(conv.assignedAgentId || "")
      const interval = window.setInterval(() => loadMessages(conv.id), 5000) as unknown as number
      onCleanup(() => clearInterval(interval))
    }
  })

  return (
    <div class={styles.container}>
      <div class={styles.sidebar}>
        <div class={styles.sidebarHeader}>
          <h2 class={styles.sidebarTitle}>Conversas</h2>
          <Button onClick={createNewChat} variant="secondary" size="small" icon="plus">
            Nova
          </Button>
        </div>

        <div class={styles.sidebarContent}>
          <Show when={loading()}>
            <div class={styles.loading}>
              <Spinner />
              <span>Carregando...</span>
            </div>
          </Show>

          <Show when={!loading() && conversations.length === 0}>
            <div class={styles.emptyState}>
              <p>Nenhuma conversa</p>
              <Button onClick={createNewChat} variant="ghost" size="small">
                Criar primeira conversa
              </Button>
            </div>
          </Show>

          <Show when={!loading() && conversations.length > 0}>
            <div class={styles.convList}>
              <For each={conversations}>
                {(conv) => (
                  <button
                    class={`${styles.convItem} ${selectedConversation()?.id === conv.id ? styles.selected : ""}`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <Avatar
                      fallback={getInitials(conv.name)}
                      size="small"
                      background="var(--color-text-interactive-base)"
                      foreground="white"
                    />
                    <div class={styles.convInfo}>
                      <div class={styles.convName}>{conv.name}</div>
                      <div class={styles.convMeta}>
                        <span>{getChannelIcon(conv.channel)}</span>
                        {conv.aiModelId && (
                          <span class={styles.modelBadge}>
                            🤖 {getModelById(conv.aiModelId)?.name?.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <Show when={conv.unreadCount > 0}>
                      <Badge count={conv.unreadCount} />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      <div class={styles.main}>
        <Show
          when={selectedConversation()}
          fallback={
            <div class={styles.emptyChat}>
              <div class={styles.emptyChatIcon}>
                <Icon name="bubble-5" size="large" />
              </div>
              <p>Selecione uma conversa ou crie uma nova</p>
              <Button onClick={createNewChat}>Nova Conversa</Button>
            </div>
          }
        >
          <div class={styles.chatHeader}>
            <div class={styles.chatHeaderInfo}>
              <Avatar
                fallback={getInitials(selectedConversation()?.name || "")}
                size="normal"
                background="var(--color-text-interactive-base)"
                foreground="white"
              />
              <div>
                <div class={styles.chatTitle}>{selectedConversation()?.name}</div>
                <div class={styles.chatChannel}>
                  {getChannelIcon(selectedConversation()?.channel || "")} {selectedConversation()?.channel}
                </div>
              </div>
            </div>
            <div class={styles.chatHeaderActions}>
              <Button
                variant={showSettings() ? "primary" : "ghost"}
                size="small"
                icon="settings-gear"
                onClick={() => setShowSettings(!showSettings())}
              >
                Config
              </Button>
            </div>
          </div>

          <Show when={showSettings()}>
            <Card variant="normal" class={styles.settingsCard}>
              <div class={styles.settingsGrid}>
                <div class={styles.settingsField}>
                  <label class={styles.settingsLabel}>Modelo de IA</label>
                  <Select
                    value={selectedModel()}
                    onChange={(e) => setSelectedModel(e.currentTarget.value)}
                    options={modelOptions()}
                    placeholder="Selecione um modelo"
                  />
                </div>
                <div class={styles.settingsField}>
                  <label class={styles.settingsLabel}>Agente Responsável</label>
                  <Select
                    value={selectedAgent()}
                    onChange={(e) => setSelectedAgent(e.currentTarget.value)}
                    options={agentOptions()}
                    placeholder="Selecione um agente"
                  />
                </div>
              </div>
              <div class={styles.settingsField}>
                <label class={styles.settingsLabel}>Temperature: {temperature()}</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature()}
                  onInput={(e) => setTemperature(parseFloat(e.currentTarget.value))}
                  class={styles.temperatureSlider}
                />
              </div>
            </Card>
          </Show>

          <div class={styles.messages}>
            <Show when={messages.length === 0}>
              <div class={styles.emptyMessages}>
                <div class={styles.emptyMsgIcon}>
                  <Icon name="bubble-5" size="large" />
                </div>
                <p>Inicie uma conversa</p>
                <Show when={selectedModel()}>
                  <p class={styles.modelInfo}>Respondendo com {getModelById(selectedModel())?.name}</p>
                </Show>
                <Show when={selectedAgent()}>
                  <p class={styles.agentInfo}>Atribuído a {getAgentById(selectedAgent())?.name}</p>
                </Show>
              </div>
            </Show>

            <For each={messages}>
              {(msg) => (
                <div
                  class={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageOther}`}
                >
                  <div
                    class={styles.messageContent}
                    data-role={msg.role !== "user" ? msg.role : undefined}
                  >
                    <Show when={msg.role !== "user"}>
                      <div class={styles.messageHeader}>
                        <span class={styles.messageRole}>
                          {msg.role === "assistant" ? "🤖 IA" : "👨‍💼 Agente"}
                        </span>
                        <Show when={msg.metadata?.responseTime}>
                          <span class={styles.messageTime}>{msg.metadata?.responseTime}ms</span>
                        </Show>
                      </div>
                    </Show>
                    <p class={styles.messageText}>{msg.content}</p>
                    <span class={styles.messageTimestamp}>
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              )}
            </For>
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} class={styles.inputForm}>
            <div class={styles.inputRow}>
              <TextField
                value={newMessage()}
                onChange={(e) => setNewMessage(e.currentTarget.value)}
                placeholder={
                  selectedModel() && !selectedAgent()
                    ? "IA irá responder..."
                    : selectedAgent() && !selectedModel()
                    ? "Agente irá responder..."
                    : "Digite sua mensagem..."
                }
                class={styles.inputField}
                disabled={sending()}
              />
              <Button type="submit" disabled={sending() || !newMessage().trim()}>
                {sending() ? <Spinner /> : <Icon name="arrow-right" />}
              </Button>
            </div>
            <div class={styles.inputMeta}>
              <Show when={selectedModel()}>
                <span class={styles.metaItem}>
                  <Icon name="brain" size="small" /> {getModelById(selectedModel())?.name}
                </span>
              </Show>
              <Show when={selectedAgent()}>
                <span class={styles.metaItemAgent}>
                  <Icon name="glasses" size="small" /> {getAgentById(selectedAgent())?.name}
                </span>
              </Show>
              <span class={styles.metaTemp}>Temperature: {temperature()}</span>
            </div>
          </form>
        </Show>
      </div>
    </div>
  )
}
