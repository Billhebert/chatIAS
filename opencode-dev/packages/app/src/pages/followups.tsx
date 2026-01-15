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

interface FollowUp {
  id: string
  phoneNumber: string
  contactName?: string
  message: string
  scheduledFor: string
  status: "pending" | "sent" | "cancelled" | "failed"
  instanceName?: string
  createdAt: string
  sentAt?: string
}

interface Contact {
  id: string
  phone: string
  name?: string
  lastMessage?: string
  lastMessageTime?: string
}

export default function FollowUpsPage() {
  const auth = useAuth()
  const server = useServer()
  const layout = useLayout()
  const navigate = useNavigate()

  const [followUps, setFollowUps] = createSignal<FollowUp[]>([])
  const [contacts, setContacts] = createSignal<Contact[]>([])
  const [loading, setLoading] = createSignal(true)
  const [showModal, setShowModal] = createSignal(false)
  const [editingFollowUp, setEditingFollowUp] = createSignal<FollowUp | null>(null)
  const [filterStatus, setFilterStatus] = createSignal<string>("all")

  const [phoneNumber, setPhoneNumber] = createSignal("")
  const [contactName, setContactName] = createSignal("")
  const [message, setMessage] = createSignal("")
  const [scheduledDate, setScheduledDate] = createSignal("")
  const [scheduledTime, setScheduledTime] = createSignal("")
  const [instanceName, setInstanceName] = createSignal("")

  const filteredFollowUps = createMemo(() => {
    const status = filterStatus()
    if (status === "all") return followUps()
    return followUps().filter(f => f.status === status)
  })

  const loadFollowUps = async () => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/followups`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setFollowUps(data)
      }
    } catch (e) {
      console.error("Error loading follow-ups:", e)
    }
  }

  const loadContacts = async () => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/whatsapp/instances`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const instances = await res.json()
        if (instances.length > 0 && !instanceName()) {
          setInstanceName(instances[0].instanceName || instances[0].name)
        }
        const allContacts: Contact[] = []
        for (const inst of instances.slice(0, 3)) {
          const convRes = await fetch(`${server.url}/whatsapp/${inst.instanceName || inst.name}/conversations/direct`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (convRes.ok) {
            const convs = await convRes.json()
            for (const conv of convs.slice(0, 10)) {
              allContacts.push({
                id: conv.remoteJid,
                phone: conv.remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", ""),
                name: conv.contactName || conv.remoteJid.split("@")[0],
                lastMessage: conv.lastMessage?.content,
                lastMessageTime: conv.lastMessage?.timestamp
              })
            }
          }
        }
        setContacts(allContacts)
      }
    } catch (e) {
      console.error("Error loading contacts:", e)
    }
  }

  onMount(async () => {
    await loadFollowUps()
    await loadContacts()
    setLoading(false)
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!phoneNumber() || !message() || !scheduledDate() || !scheduledTime()) {
      showToast({ title: "Erro", description: "Preencha todos os campos obrigatórios" })
      return
    }

    const scheduledFor = `${scheduledDate()}T${scheduledTime()}:00`
    const token = getStoredToken()

    try {
      let res
      if (editingFollowUp()) {
        res = await fetch(`${server.url}/followups/${editingFollowUp()!.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phoneNumber: phoneNumber(),
            contactName: contactName(),
            message: message(),
            scheduledFor,
            instanceName: instanceName()
          })
        })
      } else {
        res = await fetch(`${server.url}/followups`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phoneNumber: phoneNumber(),
            contactName: contactName(),
            message: message(),
            scheduledFor,
            instanceName: instanceName()
          })
        })
      }

      if (res.ok) {
        showToast({ 
          title: editingFollowUp() ? "Follow-up atualizado" : "Follow-up agendado",
          description: editingFollowUp() ? "Agendamento modificado com sucesso" : "Mensagem agendada para " + formatDateTime(scheduledFor)
        })
        setShowModal(false)
        resetForm()
        await loadFollowUps()
      } else {
        const data = await res.json()
        showToast({ title: "Erro", description: data.error || "Falha ao agendar" })
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const handleCancel = async (followUp: FollowUp) => {
    if (!confirm(`Cancelar follow-up para ${followUp.contactName || followUp.phoneNumber}?`)) return

    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/followups/${followUp.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        showToast({ title: "Cancelado", description: "Follow-up cancelado com sucesso" })
        await loadFollowUps()
      } else {
        showToast({ title: "Erro", description: "Falha ao cancelar" })
      }
    } catch (e: any) {
      showToast({ title: "Erro", description: e.message })
    }
  }

  const handleEdit = (followUp: FollowUp) => {
    setEditingFollowUp(followUp)
    setPhoneNumber(followUp.phoneNumber)
    setContactName(followUp.contactName || "")
    setMessage(followUp.message)
    const date = new Date(followUp.scheduledFor)
    setScheduledDate(date.toISOString().split("T")[0])
    setScheduledTime(date.toTimeString().slice(0, 5))
    setInstanceName(followUp.instanceName || "")
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingFollowUp(null)
    setPhoneNumber("")
    setContactName("")
    setMessage("")
    setScheduledDate("")
    setScheduledTime("")
    setInstanceName("")
  }

  const openNewModal = () => {
    resetForm()
    setShowModal(true)
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40"
      case "sent": return "bg-green-500/30 text-green-300 border border-green-500/40"
      case "cancelled": return "bg-gray-500/30 text-gray-300 border border-gray-500/40"
      case "failed": return "bg-red-500/30 text-red-300 border border-red-500/40"
      default: return "bg-gray-500/30 text-gray-300"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente"
      case "sent": return "Enviado"
      case "cancelled": return "Cancelado"
      case "failed": return "Falhou"
      default: return status
    }
  }

  const stats = createMemo(() => {
    const all = followUps()
    return {
      total: all.length,
      pending: all.filter(f => f.status === "pending").length,
      sent: all.filter(f => f.status === "sent").length,
      cancelled: all.filter(f => f.status === "cancelled").length
    }
  })

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
          <Icon name="task" size="small" class="mr-2 text-blue-400" />
          <span class="text-14-medium text-text-strong">Follow-ups</span>
        </div>
        <div class="w-12" />
      </header>

      <div class="flex-1 overflow-auto p-4 md:p-6">
        <div class="max-w-4xl mx-auto">
          {/* Stats */}
          <div class="grid grid-cols-4 gap-3 mb-6">
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-text-strong">{stats().total}</div>
              <div class="text-xs text-text-subtle">Total</div>
            </div>
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-yellow-400">{stats().pending}</div>
              <div class="text-xs text-text-subtle">Pendentes</div>
            </div>
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-green-400">{stats().sent}</div>
              <div class="text-xs text-text-subtle">Enviados</div>
            </div>
            <div class="p-3 rounded bg-surface-raised-base border border-border-weak-base text-center">
              <div class="text-2xl font-bold text-gray-400">{stats().cancelled}</div>
              <div class="text-xs text-text-subtle">Cancelados</div>
            </div>
          </div>

          {/* Actions */}
          <div class="flex justify-between items-center mb-4">
            <div class="flex gap-2">
              <select
                value={filterStatus()}
                onChange={(e) => setFilterStatus(e.currentTarget.value)}
                class="px-3 py-2 rounded bg-surface-raised-base border border-border-weak-base text-text-base text-sm"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="sent">Enviados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
            <Button icon="plus" onClick={openNewModal}>
              Novo Follow-up
            </Button>
          </div>

          {/* Lista */}
          <Show when={!loading()}>
            <Show when={filteredFollowUps().length > 0}>
              <div class="space-y-3">
                <For each={filteredFollowUps()}>
                  {(followUp) => (
                    <div class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-text-strong">
                              {followUp.contactName || followUp.phoneNumber}
                            </span>
                            <span class={`px-2 py-0.5 rounded text-xs ${getStatusColor(followUp.status)}`}>
                              {getStatusLabel(followUp.status)}
                            </span>
                          </div>
                          <p class="text-sm text-text-subtle mt-1 line-clamp-2">{followUp.message}</p>
                          <div class="flex items-center gap-2 mt-2 text-xs text-text-subtle">
                            <Icon name="calendar" size="small" />
                            <span>
                              {followUp.status === "sent" && followUp.sentAt
                                ? `Enviado em ${formatDateTime(followUp.sentAt)}`
                                : `Agendado para ${formatDateTime(followUp.scheduledFor)}`}
                            </span>
                            <Show when={followUp.instanceName}>
                              <span class="text-blue-400">• {followUp.instanceName}</span>
                            </Show>
                          </div>
                        </div>
                        <div class="flex items-center gap-1">
                          <Show when={followUp.status === "pending"}>
                            <IconButton
                              icon="edit-small-2"
                              variant="ghost"
                              onClick={() => handleEdit(followUp)}
                            />
                            <IconButton
                              icon="trash"
                              variant="ghost"
                              class="text-icon-critical-base"
                              onClick={() => handleCancel(followUp)}
                            />
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={filteredFollowUps().length === 0}>
              <div class="text-center py-12 text-text-subtle">
                <Icon name="task" size="large" class="mb-3 opacity-50" />
                <p>Nenhum follow-up encontrado</p>
                <Button variant="ghost" class="mt-4" onClick={openNewModal}>
                  Criar primeiro follow-up
                </Button>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Modal */}
      <Show when={showModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-medium text-text-strong mb-4 flex items-center gap-2">
              <Icon name="task" size="small" class="text-blue-400" />
              {editingFollowUp() ? "Editar Follow-up" : "Novo Follow-up"}
            </h3>

            <form onSubmit={handleSubmit} class="space-y-4">
              {/* Contato */}
              <div>
                <label class="block text-sm font-medium text-text-base mb-1">
                  Contato *
                </label>
                <div class="flex gap-2">
                  <div class="flex-1">
                    <TextField
                      value={phoneNumber()}
                      onInput={(e) => setPhoneNumber(e.currentTarget.value)}
                      placeholder="+55 (11) 99999-9999"
                      class="w-full"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    icon="address-book"
                    onClick={(e) => {
                      e.preventDefault()
                      dialog.show(
                        () => <ContactSelector contacts={contacts()} onSelect={(c) => {
                          setPhoneNumber(c.phone)
                          setContactName(c.name || "")
                          dialog.close()
                        }} />,
                        () => dialog.close()
                      )
                    }}
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-base mb-1">
                  Nome do contato (opcional)
                </label>
                <TextField
                  value={contactName()}
                  onInput={(e) => setContactName(e.currentTarget.value)}
                  placeholder="Nome do contato"
                  class="w-full"
                />
              </div>

              {/* Mensagem */}
              <div>
                <label class="block text-sm font-medium text-text-base mb-1">
                  Mensagem *
                </label>
                <textarea
                  value={message()}
                  onInput={(e) => setMessage(e.currentTarget.value)}
                  placeholder="Digite a mensagem a ser enviada..."
                  rows={4}
                  class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base resize-none"
                />
              </div>

              {/* Data e Hora */}
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-base mb-1">
                    Data *
                  </label>
                  <TextField
                    type="date"
                    value={scheduledDate()}
                    onInput={(e) => setScheduledDate(e.currentTarget.value)}
                    min={new Date().toISOString().split("T")[0]}
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-base mb-1">
                    Hora *
                  </label>
                  <TextField
                    type="time"
                    value={scheduledTime()}
                    onInput={(e) => setScheduledTime(e.currentTarget.value)}
                    class="w-full"
                  />
                </div>
              </div>

              {/* Instância */}
              <div>
                <label class="block text-sm font-medium text-text-base mb-1">
                  Instância WhatsApp
                </label>
                <TextField
                  value={instanceName()}
                  onInput={(e) => setInstanceName(e.currentTarget.value)}
                  placeholder="Nome da instância"
                  class="w-full"
                />
              </div>

              {/* Actions */}
              <div class="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingFollowUp() ? "Salvar" : "Agendar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  )
}

function ContactSelector(props: { contacts: Contact[]; onSelect: (c: Contact) => void }) {
  return (
    <div class="p-4 rounded bg-surface-raised-base border border-border-weak-base w-full max-w-md">
      <h4 class="font-medium text-text-strong mb-3">Selecionar Contato</h4>
      <Show when={props.contacts.length > 0}>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <For each={props.contacts}>
            {(contact) => (
              <button
                type="button"
                class="w-full p-3 text-left rounded hover:bg-surface-raised-base-hover transition-colors"
                onClick={() => props.onSelect(contact)}
              >
                <div class="font-medium text-text-strong">{contact.name || contact.phone}</div>
                <div class="text-sm text-text-subtle">{contact.phone}</div>
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.contacts.length === 0}>
        <p class="text-text-subtle text-sm">Nenhum contato encontrado. Cadastre um número manualmente.</p>
      </Show>
    </div>
  )
}
