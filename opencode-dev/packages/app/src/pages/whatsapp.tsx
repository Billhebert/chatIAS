import { createSignal, createMemo, For, Show, onMount, onCleanup, createEffect } from "solid-js"
import { useAuth } from "@/context/auth"
import { useServer } from "@/context/server"
import { useLayout } from "@/context/layout"
import { getStoredToken } from "@/api/user-api"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { useNavigate } from "@solidjs/router"

interface WhatsAppInstance {
  instanceName: string
  status: string
  profileName?: string
  profilePicUrl?: string
  owner?: string
}

interface WhatsAppConversation {
  id: string
  instanceName: string
  remoteJid: string
  contact: {
    id: string
    remoteJid: string
    pushName: string
    profilePicUrl?: string
    isGroup: boolean
  }
  lastMessage?: {
    id: string
    content: string
    timestamp: number
    fromMe: boolean
  }
  unreadCount: number
  updatedAt: number
}

interface WhatsAppMessage {
  id: string
  remoteJid: string
  fromMe: boolean
  timestamp: number
  content: string
  type: "text" | "image" | "audio" | "video" | "document" | "sticker"
  status?: "pending" | "sent" | "delivered" | "read" | "error"
}

export default function WhatsAppPage() {
  const auth = useAuth()
  const server = useServer()
  const layout = useLayout()
  const navigate = useNavigate()

  const [instances, setInstances] = createSignal<WhatsAppInstance[]>([])
  const [selectedInstance, setSelectedInstance] = createSignal<string | null>(null)
  const [conversations, setConversations] = createSignal<WhatsAppConversation[]>([])
  const [selectedConversation, setSelectedConversation] = createSignal<WhatsAppConversation | null>(null)
  const [messages, setMessages] = createSignal<WhatsAppMessage[]>([])
  const [loading, setLoading] = createSignal(true)
  const [loadingMessages, setLoadingMessages] = createSignal(false)
  const [messageInput, setMessageInput] = createSignal("")
  const [sendingMessage, setSendingMessage] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal("")
  const [showInstanceModal, setShowInstanceModal] = createSignal(false)

  let pollingInterval: ReturnType<typeof setInterval> | null = null

  const filteredConversations = createMemo(() => {
    const query = searchQuery().toLowerCase()
    if (!query) return conversations()
    return conversations().filter(c =>
      c.contact.pushName?.toLowerCase().includes(query) ||
      c.remoteJid.includes(query)
    )
  })

  const loadInstances = async () => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/evolution/instances`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        const normalized = (Array.isArray(data) ? data : []).map((inst: any) => ({
          instanceName: inst.name || inst.instanceName,
          status: inst.connectionStatus || inst.status,
          profileName: inst.profileName,
          profilePicUrl: inst.profilePicUrl,
          owner: inst.ownerJid || inst.number || inst.owner,
        }))
        setInstances(normalized)

        if (!selectedInstance() && normalized.length > 0) {
          const connected = normalized.find((i: WhatsAppInstance) =>
            i.status?.toLowerCase() === "open" || i.status?.toLowerCase() === "connected"
          )
          if (connected) {
            setSelectedInstance(connected.instanceName)
          } else {
            setSelectedInstance(normalized[0].instanceName)
          }
        }
      }
    } catch (e) {
      console.error("Error loading instances:", e)
    } finally {
      setLoading(false)
    }
  }

  const loadConversations = async () => {
    const instance = selectedInstance()
    if (!instance) return

    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/whatsapp/${instance}/conversations/direct`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        const transformed = (Array.isArray(data) ? data : []).map((conv: any) => ({
          id: conv.id,
          instanceName: instance,
          remoteJid: conv.remoteJid,
          contact: {
            id: conv.id,
            remoteJid: conv.remoteJid,
            pushName: conv.contactName || conv.remoteJid.split("@")[0],
            profilePicUrl: conv.profilePicUrl,
            isGroup: conv.remoteJid?.includes("@g.us") || false,
          },
          lastMessage: conv.lastMessage ? {
            id: `msg_${conv.updatedAt}`,
            content: conv.lastMessage.content || "",
            timestamp: conv.lastMessage.timestamp,
            fromMe: conv.lastMessage.sender === "me",
          } : undefined,
          unreadCount: conv.unreadCount || 0,
          updatedAt: conv.updatedAt || Date.now(),
        }))
        setConversations(transformed)
      }
    } catch (e) {
      console.error("Error loading conversations:", e)
    }
  }

  const loadMessages = async (conversationId: string, remoteJid: string) => {
    const instance = selectedInstance()
    if (!instance) return

    setLoadingMessages(true)
    try {
      const token = getStoredToken()
      const res = await fetch(
        `${server.url}/whatsapp/${instance}/messages/${encodeURIComponent(remoteJid)}?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (e) {
      console.error("Error loading messages:", e)
    } finally {
      setLoadingMessages(false)
    }
  }

  const sendMessage = async () => {
    const instance = selectedInstance()
    const conversation = selectedConversation()
    const text = messageInput().trim()

    if (!instance || !conversation || !text) return

    setSendingMessage(true)
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/whatsapp/${instance}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          remoteJid: conversation.remoteJid,
          message: text
        })
      })

      if (res.ok) {
        setMessageInput("")
        const newMsg: WhatsAppMessage = {
          id: `temp-${Date.now()}`,
          remoteJid: conversation.remoteJid,
          fromMe: true,
          timestamp: Date.now(),
          content: text,
          type: "text",
          status: "pending"
        }
        setMessages(prev => [...prev, newMsg])
        setTimeout(() => loadMessages(conversation.id, conversation.remoteJid), 1000)
      } else {
        const data = await res.json()
        showToast({ title: "Erro ao enviar", description: data.error })
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    } finally {
      setSendingMessage(false)
    }
  }

  const createInstance = async (name: string) => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/evolution/instances`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ instanceName: name })
      })

      if (res.ok) {
        showToast({ title: "Instância criada", description: `Instância ${name} criada com sucesso` })
        setShowInstanceModal(false)
        await loadInstances()
      } else {
        showToast({ title: "Erro", description: "Falha ao criar instância" })
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const disconnectInstance = async (instanceName: string) => {
    if (!confirm(`Desconectar instância ${instanceName}?`)) return

    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/evolution/instances/${instanceName}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        showToast({ title: "Desconectado", description: "Instância desconectada com sucesso" })
        await loadInstances()
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  onMount(() => {
    loadInstances()
  })

  createEffect(() => {
    const instance = selectedInstance()
    if (instance) {
      loadConversations()
      if (pollingInterval) clearInterval(pollingInterval)
      pollingInterval = setInterval(loadConversations, 10000)
    }
  })

  createEffect(() => {
    const conversation = selectedConversation()
    if (conversation) {
      loadMessages(conversation.id, conversation.remoteJid)
    }
  })

  onCleanup(() => {
    if (pollingInterval) clearInterval(pollingInterval)
  })

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  }

  const formatPhoneNumber = (jid: string) => {
    const number = jid.split("@")[0]
    if (number.length === 13 && number.startsWith("55")) {
      return `+${number.slice(0, 2)} (${number.slice(2, 4)}) ${number.slice(4, 9)}-${number.slice(9)}`
    }
    return number
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "pending": return "stop"
      case "sent": return "check"
      case "delivered": return "check-all"
      case "read": return "check-all"
      case "error": return "circle-ban-sign"
      default: return "check"
    }
  }

  return (
    <div class="flex flex-col w-full h-full bg-background-base">
      {/* Header mobile */}
      <header class="xl:hidden h-12 shrink-0 bg-background-base border-b border-border-weak-base flex items-center">
        <button
          type="button"
          class="w-12 shrink-0 flex items-center justify-center border-r border-border-weak-base hover:bg-surface-raised-base-hover"
          onClick={layout.mobileSidebar.toggle}
        >
          <Icon name="menu" size="small" />
        </button>
        <div class="flex-1 flex items-center justify-center">
          <Icon name="bubble-5" size="small" class="mr-2 text-green-400" />
          <span class="text-14-medium text-text-strong">WhatsApp</span>
        </div>
        <div class="w-12" />
      </header>

      <div class="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside class="w-80 border-r border-border-weak-base flex flex-col bg-surface-raised-base">
          {/* Instance Selector */}
          <div class="p-3 border-b border-border-weak-base">
            <div class="flex gap-2 items-center justify-between mb-2">
              <select
                value={selectedInstance() || ""}
                onChange={(e) => setSelectedInstance(e.currentTarget.value || null)}
                class="flex-1 px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base text-sm"
              >
                <option value="" disabled>Selecione...</option>
                <For each={instances()}>
                  {(inst) => (
                    <option value={inst.instanceName}>
                      {inst.instanceName} ({inst.status})
                    </option>
                  )}
                </For>
              </select>
              <IconButton
                icon="plus"
                variant="ghost"
                size="small"
                onClick={() => setShowInstanceModal(true)}
              />
            </div>
          </div>

          {/* Search */}
          <div class="p-3 border-b border-border-weak-base">
            <div class="relative">
              <Icon name="magnifying-glass" size="small" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Buscar..."
                class="w-full pl-9 pr-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base text-sm placeholder:text-text-subtle"
              />
            </div>
          </div>

          {/* Conversations */}
          <div class="flex-1 overflow-y-auto">
            <Show when={loading()}>
              <div class="flex items-center justify-center py-8 text-text-subtle">
                Carregando...
              </div>
            </Show>

            <Show when={!loading() && filteredConversations().length === 0}>
              <div class="flex flex-col items-center justify-center py-8 text-text-subtle">
                <Icon name="bubble-5" size="large" class="mb-2 opacity-50" />
                <p class="text-sm">Nenhuma conversa</p>
              </div>
            </Show>

            <For each={filteredConversations()}>
              {(conversation) => (
                <ConversationItem
                  conversation={conversation}
                  selectedId={selectedConversation()?.id}
                  onSelect={setSelectedConversation}
                />
              )}
            </For>
          </div>
        </aside>

        {/* Chat Area */}
        <main class="flex-1 flex flex-col">
          <Show when={!selectedConversation()}>
            <div class="flex-1 flex flex-col items-center justify-center text-text-subtle">
              <Icon name="bubble-5" size="large" class="mb-4 opacity-30" />
              <p class="text-lg">Selecione uma conversa</p>
            </div>
          </Show>

          <Show when={selectedConversation()}>
            {/* Chat Header */}
            <header class="h-16 px-4 flex items-center justify-between border-b border-border-weak-base bg-surface-raised-base">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-full bg-surface-raised-base-hover flex items-center justify-center">
                  <span class="text-lg font-medium text-text-strong">
                    {(selectedConversation()?.contact.pushName || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 class="font-medium text-text-strong">
                    {selectedConversation()?.contact.pushName || formatPhoneNumber(selectedConversation()!.remoteJid)}
                  </h2>
                  <p class="text-xs text-text-subtle">
                    {formatPhoneNumber(selectedConversation()!.remoteJid)}
                  </p>
                </div>
              </div>
            </header>

            {/* Messages */}
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              <Show when={loadingMessages()}>
                <div class="flex items-center justify-center py-8 text-text-subtle">
                  Carregando mensagens...
                </div>
              </Show>

              <Show when={!loadingMessages() && messages().length === 0}>
                <div class="flex flex-col items-center justify-center py-8 text-text-subtle">
                  <p>Nenhuma mensagem ainda</p>
                </div>
              </Show>

              <For each={messages()}>
                {(message) => (
                  <div class={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
                    <div class={`max-w-[70%] rounded-lg p-3 ${
                      message.fromMe
                        ? "bg-green-600/20 border border-green-500/30"
                        : "bg-surface-raised-base border border-border-weak-base"
                    }`}>
                      <p class="text-text-base text-sm whitespace-pre-wrap">{message.content}</p>
                      <div class="flex items-center justify-end gap-1 mt-1">
                        <span class="text-xs text-text-subtle">
                          {formatTimestamp(message.timestamp)}
                        </span>
                        <Show when={message.fromMe}>
                          <Icon name={getStatusIcon(message.status)} size="small" class="scale-75 text-text-subtle" />
                        </Show>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Input */}
            <div class="p-4 border-t border-border-weak-base bg-surface-raised-base">
              <form
                class="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
              >
                <input
                  type="text"
                  value={messageInput()}
                  onInput={(e) => setMessageInput(e.currentTarget.value)}
                  placeholder="Digite uma mensagem..."
                  class="flex-1 px-4 py-3 rounded-full bg-background-base border border-border-weak-base text-text-base placeholder:text-text-subtle focus:outline-none focus:border-green-500/50"
                  disabled={sendingMessage()}
                />
                <Button
                  type="submit"
                  disabled={!messageInput().trim() || sendingMessage()}
                  class="rounded-full"
                >
                  <Icon name="chevron-right" size="small" />
                </Button>
              </form>
            </div>
          </Show>
        </main>
      </div>

      {/* Instance Modal */}
      <Show when={showInstanceModal()}>
        <InstanceModal
          onClose={() => setShowInstanceModal(false)}
          onCreate={createInstance}
        />
      </Show>
    </div>
  )
}

function ConversationItem(props: {
  conversation: WhatsAppConversation
  selectedId?: string
  onSelect: (c: WhatsAppConversation) => void
}) {
  return (
    <button
      type="button"
      class={`w-full p-3 flex items-start gap-3 border-b border-border-weak-base hover:bg-surface-raised-base-hover transition-colors ${
        props.selectedId === props.conversation.id ? "bg-surface-raised-base-hover" : ""
      }`}
      onClick={() => props.onSelect(props.conversation)}
    >
      <div class="size-12 rounded-full bg-surface-raised-base-hover flex items-center justify-center shrink-0">
        <span class="text-lg font-medium text-text-strong">
          {(props.conversation.contact.pushName || "?")[0].toUpperCase()}
        </span>
      </div>
      <div class="flex-1 min-w-0 text-left">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-text-strong truncate">
            {props.conversation.contact.pushName || formatPhoneNumber(props.conversation.remoteJid)}
          </span>
          <span class="text-xs text-text-subtle shrink-0">
            {props.conversation.lastMessage && formatTimestamp(props.conversation.lastMessage.timestamp)}
          </span>
        </div>
        <div class="flex items-center justify-between gap-2 mt-1">
          <p class="text-sm text-text-subtle truncate">
            {props.conversation.lastMessage?.content || "Sem mensagens"}
          </p>
          <Show when={props.conversation.unreadCount > 0}>
            <span class="shrink-0 size-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
              {props.conversation.unreadCount}
            </span>
          </Show>
        </div>
      </div>
    </button>
  )
}

function InstanceModal(props: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = createSignal("")

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-md">
        <h3 class="text-lg font-medium text-text-strong mb-4 flex items-center gap-2">
          <Icon name="bubble-5" size="small" class="text-green-400" />
          Nova Instância WhatsApp
        </h3>

        <form onSubmit={(e) => {
          e.preventDefault()
          if (name()) props.onCreate(name())
        }}>
          <div class="mb-4">
            <label class="block text-sm font-medium text-text-base mb-1">
              Nome da Instância *
            </label>
            <TextField
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Ex: meu-whatsapp-1"
              class="w-full"
            />
          </div>

          <p class="text-sm text-text-subtle mb-4">
            Após criar a instância, escaneie o QR Code no painel da Evolution API para conectar.
          </p>

          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name()}>
              Criar Instância
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatPhoneNumber(jid: string) {
  const number = jid.split("@")[0]
  if (number.length === 13 && number.startsWith("55")) {
    return `+${number.slice(0, 2)} (${number.slice(2, 4)}) ${number.slice(4, 9)}-${number.slice(9)}`
  }
  return number
}
