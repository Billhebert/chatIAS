import { createSignal, createMemo, For, Show, Switch, Match, onMount, createEffect, onCleanup } from "solid-js"
import { useAuth, type UserRole, type UserPermissions, type AccessLevel, type User, DEFAULT_USER_PERMISSIONS } from "@/context/auth"
import { getStoredToken } from "@/api/user-api"
import { useLayout } from "@/context/layout"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { useNavigate } from "@solidjs/router"
import { useServer } from "@/context/server"
import { useGlobalSDK } from "@/context/global-sdk"

type Tab = "users" | "access-levels" | "permissions" | "rag" | "integrations"

export default function AdminPage() {
  const auth = useAuth()
  const layout = useLayout()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = createSignal<Tab>("users")
  const [showCreateUser, setShowCreateUser] = createSignal(false)
  const [showCreateAccessLevel, setShowCreateAccessLevel] = createSignal(false)
  const [editingUser, setEditingUser] = createSignal<User | null>(null)
  const [editingAccessLevel, setEditingAccessLevel] = createSignal<AccessLevel | null>(null)

  // Verificar se o usuário tem permissão
  const canAccess = createMemo(() => auth.isMaster() || auth.isAdmin())

  if (!canAccess()) {
    return (
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <Icon name="lock" size="large" class="text-icon-critical-base" />
        <h1 class="text-xl font-bold text-text-strong">Acesso Negado</h1>
        <p class="text-text-subtle">Você não tem permissão para acessar esta página.</p>
        <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
      </div>
    )
  }

  return (
    <div class="flex flex-col w-full h-full">
      {/* Header */}
      <header class="xl:hidden h-12 shrink-0 bg-background-base border-b border-border-weak-base flex items-center">
        <button
          type="button"
          class="w-12 shrink-0 flex items-center justify-center border-r border-border-weak-base hover:bg-surface-raised-base-hover"
          onClick={layout.mobileSidebar.toggle}
        >
          <Icon name="menu" size="small" />
        </button>
        <div class="flex-1 flex items-center justify-center">
          <span class="text-14-medium text-text-strong">Administração</span>
        </div>
        <div class="w-12" />
      </header>

      <div class="flex-1 overflow-auto p-4 md:p-6">
        <div class="max-w-4xl mx-auto">
          {/* Título */}
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-text-strong">Painel de Administração</h1>
            <p class="text-text-subtle mt-1">
              Gerencie usuários, níveis de acesso e permissões do sistema.
            </p>
          </div>

          {/* Tabs */}
          <div class="flex gap-2 mb-6 border-b border-border-weak-base">
            <button
              class={`px-4 py-2 text-14-medium transition-colors ${
                activeTab() === "users"
                  ? "text-text-interactive-base border-b-2 border-text-interactive-base"
                  : "text-text-subtle hover:text-text-base"
              }`}
              onClick={() => setActiveTab("users")}
            >
              Usuários
            </button>
            <Show when={auth.isMaster()}>
              <button
                class={`px-4 py-2 text-14-medium transition-colors ${
                  activeTab() === "access-levels"
                    ? "text-text-interactive-base border-b-2 border-text-interactive-base"
                    : "text-text-subtle hover:text-text-base"
                }`}
                onClick={() => setActiveTab("access-levels")}
              >
                Níveis de Acesso
              </button>
            </Show>
            <Show when={auth.isMaster() || auth.isAdmin()}>
              <button
                class={`px-4 py-2 text-14-medium transition-colors ${
                  activeTab() === "rag"
                    ? "text-text-interactive-base border-b-2 border-text-interactive-base"
                    : "text-text-subtle hover:text-text-base"
                }`}
                onClick={() => setActiveTab("rag")}
              >
                Base de Conhecimento
              </button>
            </Show>
            <Show when={auth.isMaster()}>
              <button
                class={`px-4 py-2 text-14-medium transition-colors ${
                  activeTab() === "integrations"
                    ? "text-text-interactive-base border-b-2 border-text-interactive-base"
                    : "text-text-subtle hover:text-text-base"
                }`}
                onClick={() => setActiveTab("integrations")}
              >
                Integrações
              </button>
            </Show>
          </div>

          {/* Conteúdo */}
          <Switch>
            <Match when={activeTab() === "users"}>
              <UsersTab
                showCreate={showCreateUser()}
                setShowCreate={setShowCreateUser}
                editingUser={editingUser()}
                setEditingUser={setEditingUser}
              />
            </Match>
            <Match when={activeTab() === "access-levels"}>
              <AccessLevelsTab
                showCreate={showCreateAccessLevel()}
                setShowCreate={setShowCreateAccessLevel}
                editingLevel={editingAccessLevel()}
                setEditingLevel={setEditingAccessLevel}
              />
            </Match>
            <Match when={activeTab() === "rag"}>
              <RAGTab />
            </Match>
            <Match when={activeTab() === "integrations"}>
              <IntegrationsTab />
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}

// ==================== USERS TAB ====================

function UsersTab(props: {
  showCreate: boolean
  setShowCreate: (v: boolean) => void
  editingUser: User | null
  setEditingUser: (u: User | null) => void
}) {
  const auth = useAuth()

  const roleLabel: Record<UserRole, string> = {
    master: "Master",
    admin: "Administrador",
    user: "Usuário",
  }

  const roleColor: Record<UserRole, string> = {
    master: "bg-purple-500/30 text-purple-300 border border-purple-500/40",
    admin: "bg-blue-500/30 text-blue-300 border border-blue-500/40",
    user: "bg-gray-500/30 text-gray-300 border border-gray-500/40",
  }

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-medium text-text-strong">
          Usuários ({auth.users().length})
        </h2>
        <Button icon="plus" onClick={() => props.setShowCreate(true)}>
          Novo Usuário
        </Button>
      </div>

      {/* Formulário de criação */}
      <Show when={props.showCreate}>
        <CreateUserForm onClose={() => props.setShowCreate(false)} />
      </Show>

      {/* Formulário de edição */}
      <Show when={props.editingUser}>
        <EditUserForm user={props.editingUser!} onClose={() => props.setEditingUser(null)} />
      </Show>

      {/* Lista de usuários */}
      <div class="space-y-2">
        <For each={auth.users()}>
          {(user) => (
            <div class="flex items-center justify-between p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
              <div class="flex items-center gap-4">
                <div class="size-10 rounded-full bg-surface-raised-base-hover flex items-center justify-center">
                  <span class="text-lg font-medium text-text-strong">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-text-strong">{user.username}</span>
                    <span class={`px-2 py-0.5 rounded text-xs ${roleColor[user.role]}`}>
                      {roleLabel[user.role]}
                    </span>
                    <Show when={!user.isActive}>
                      <span class="px-2 py-0.5 rounded text-xs bg-red-500/30 text-red-300 border border-red-500/40">
                        Inativo
                      </span>
                    </Show>
                  </div>
                  <div class="text-12-regular text-text-subtle">
                    <Show when={user.accessLevelId}>
                      {() => {
                        const level = auth.accessLevels().find(a => a.id === user.accessLevelId)
                        return level ? `Nível: ${level.name}` : ""
                      }}
                    </Show>
                    <Show when={!user.accessLevelId && user.role === "user"}>
                      Nível: Padrão
                    </Show>
                    <Show when={user.role !== "user"}>
                      Acesso completo
                    </Show>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Show when={user.id !== auth.currentUser()?.id}>
                  <IconButton
                    icon="edit-small-2"
                    variant="ghost"
                    onClick={() => props.setEditingUser(user)}
                  />
                  <Show when={auth.isMaster() || (auth.isAdmin() && user.role === "user")}>
                    <IconButton
                      icon="trash"
                      variant="ghost"
                      class="text-icon-critical-base"
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja excluir o usuário "${user.username}"?`)) {
                          const result = await auth.deleteUser(user.id)
                          if (result.success) {
                            showToast({ title: "Usuário excluído", description: user.username })
                          } else {
                            showToast({ title: "Erro", description: result.error })
                          }
                        }
                      }}
                    />
                  </Show>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

// ==================== CREATE USER FORM ====================

function CreateUserForm(props: { onClose: () => void }) {
  const auth = useAuth()
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [role, setRole] = createSignal<UserRole>("user")
  const [accessLevelId, setAccessLevelId] = createSignal<string | null>(null)
  const [error, setError] = createSignal("")

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")

    const result = await auth.createUser(username(), password(), role(), accessLevelId())
    if (result.success) {
      showToast({ title: "Usuário criado", description: username() })
      props.onClose()
    } else {
      setError(result.error || "Erro ao criar usuário")
    }
  }

  return (
    <form onSubmit={handleSubmit} class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 class="font-medium text-text-strong">Novo Usuário</h3>
      
      <Show when={error()}>
        <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
      </Show>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Nome de usuário</label>
          <TextField
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            placeholder="usuario"
          />
        </div>
        <div>
          <label class="block text-sm text-text-subtle mb-1">Senha</label>
          <TextField
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            placeholder="••••••"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Função</label>
          <select
            value={role()}
            onChange={(e) => setRole(e.currentTarget.value as UserRole)}
            class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="user">Usuário</option>
            <Show when={auth.isMaster()}>
              <option value="admin">Administrador</option>
              <option value="master">Master</option>
            </Show>
          </select>
        </div>
        <Show when={role() === "user"}>
          <div>
            <label class="block text-sm text-text-subtle mb-1">Nível de Acesso</label>
            <select
              value={accessLevelId() || ""}
              onChange={(e) => setAccessLevelId(e.currentTarget.value || null)}
              class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            >
              <option value="">Padrão (Restrito)</option>
              <For each={auth.accessLevels()}>
                {(level) => <option value={level.id}>{level.name}</option>}
              </For>
            </select>
          </div>
        </Show>
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={props.onClose}>
          Cancelar
        </Button>
        <Button type="submit">Criar Usuário</Button>
      </div>
    </form>
  )
}

// ==================== EDIT USER FORM ====================

function EditUserForm(props: { user: User; onClose: () => void }) {
  const auth = useAuth()
  const [username, setUsername] = createSignal(props.user.username)
  const [role, setRole] = createSignal<UserRole>(props.user.role)
  const [accessLevelId, setAccessLevelId] = createSignal<string | null>(props.user.accessLevelId)
  const [isActive, setIsActive] = createSignal(props.user.isActive)
  const [newPassword, setNewPassword] = createSignal("")
  const [error, setError] = createSignal("")

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")

    // Atualizar usuário
    const updateResult = await auth.updateUser(props.user.id, {
      username: username(),
      role: role(),
      accessLevelId: role() === "user" ? accessLevelId() : null,
      isActive: isActive(),
    })

    if (!updateResult.success) {
      setError(updateResult.error || "Erro ao atualizar usuário")
      return
    }

    // Redefinir senha se fornecida
    if (newPassword()) {
      const passwordResult = await auth.resetUserPassword(props.user.id, newPassword())
      if (!passwordResult.success) {
        setError(passwordResult.error || "Erro ao redefinir senha")
        return
      }
    }

    showToast({ title: "Usuário atualizado", description: username() })
    props.onClose()
  }

  return (
    <form onSubmit={handleSubmit} class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 class="font-medium text-text-strong">Editar Usuário: {props.user.username}</h3>
      
      <Show when={error()}>
        <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
      </Show>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Nome de usuário</label>
          <TextField
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </div>
        <div>
          <label class="block text-sm text-text-subtle mb-1">Nova senha (deixe em branco para manter)</label>
          <TextField
            type="password"
            value={newPassword()}
            onInput={(e) => setNewPassword(e.currentTarget.value)}
            placeholder="••••••"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Função</label>
          <select
            value={role()}
            onChange={(e) => setRole(e.currentTarget.value as UserRole)}
            class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            disabled={!auth.isMaster()}
          >
            <option value="user">Usuário</option>
            <Show when={auth.isMaster()}>
              <option value="admin">Administrador</option>
              <option value="master">Master</option>
            </Show>
          </select>
        </div>
        <Show when={role() === "user"}>
          <div>
            <label class="block text-sm text-text-subtle mb-1">Nível de Acesso</label>
            <select
              value={accessLevelId() || ""}
              onChange={(e) => setAccessLevelId(e.currentTarget.value || null)}
              class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            >
              <option value="">Padrão (Restrito)</option>
              <For each={auth.accessLevels()}>
                {(level) => <option value={level.id}>{level.name}</option>}
              </For>
            </select>
          </div>
        </Show>
        <div>
          <label class="block text-sm text-text-subtle mb-1">Status</label>
          <select
            value={isActive() ? "active" : "inactive"}
            onChange={(e) => setIsActive(e.currentTarget.value === "active")}
            class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={props.onClose}>
          Cancelar
        </Button>
        <Button type="submit">Salvar Alterações</Button>
      </div>
    </form>
  )
}

// ==================== ACCESS LEVELS TAB ====================

function AccessLevelsTab(props: {
  showCreate: boolean
  setShowCreate: (v: boolean) => void
  editingLevel: AccessLevel | null
  setEditingLevel: (l: AccessLevel | null) => void
}) {
  const auth = useAuth()

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-medium text-text-strong">
          Níveis de Acesso ({auth.accessLevels().length})
        </h2>
        <Button icon="plus" onClick={() => props.setShowCreate(true)}>
          Novo Nível
        </Button>
      </div>

      {/* Formulário de criação */}
      <Show when={props.showCreate}>
        <AccessLevelForm onClose={() => props.setShowCreate(false)} />
      </Show>

      {/* Formulário de edição */}
      <Show when={props.editingLevel}>
        <AccessLevelForm level={props.editingLevel!} onClose={() => props.setEditingLevel(null)} />
      </Show>

      {/* Info sobre nível padrão */}
      <div class="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div class="flex items-start gap-3">
          <Icon name="info-circle" size="small" class="text-blue-400 mt-0.5" />
          <div>
            <h4 class="font-medium text-blue-400">Nível Padrão</h4>
            <p class="text-sm text-blue-300/80 mt-1">
              Usuários sem nível de acesso atribuído terão permissões restritas: 
              sem acesso a provedores, modelos, agentes ou ferramentas específicas.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de níveis */}
      <Show when={auth.accessLevels().length === 0}>
        <div class="text-center py-8 text-text-subtle">
          Nenhum nível de acesso criado ainda.
        </div>
      </Show>

      <div class="space-y-2">
        <For each={auth.accessLevels()}>
          {(level) => {
            const usersCount = auth.users().filter(u => u.accessLevelId === level.id).length
            return (
              <div class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-text-strong">{level.name}</span>
                      <span class="px-2 py-0.5 rounded text-xs bg-gray-500/30 text-gray-300 border border-gray-500/40">
                        {usersCount} usuário(s)
                      </span>
                    </div>
                    <p class="text-sm text-text-subtle mt-1">{level.description}</p>
                    <div class="flex flex-wrap gap-2 mt-3">
                      <PermissionBadge 
                        label="Provedores" 
                        value={level.permissions.providers} 
                      />
                      <PermissionBadge 
                        label="Modelos" 
                        value={level.permissions.models} 
                      />
                      <PermissionBadge 
                        label="Terminal" 
                        value={level.permissions.canAccessTerminal} 
                      />
                      <PermissionBadge 
                        label="Arquivos" 
                        value={level.permissions.canAccessFiles} 
                      />
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <IconButton
                      icon="edit-small-2"
                      variant="ghost"
                      onClick={() => props.setEditingLevel(level)}
                    />
                    <IconButton
                      icon="trash"
                      variant="ghost"
                      class="text-icon-critical-base"
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja excluir o nível "${level.name}"?`)) {
                          const result = await auth.deleteAccessLevel(level.id)
                          if (result.success) {
                            showToast({ title: "Nível excluído", description: level.name })
                          } else {
                            showToast({ title: "Erro", description: result.error })
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

function PermissionBadge(props: { label: string; value: string[] | boolean }) {
  const isEnabled = () => {
    if (typeof props.value === "boolean") return props.value
    if (Array.isArray(props.value)) {
      if (props.value.includes("*")) return true
      return props.value.length > 0
    }
    return false
  }

  const displayValue = () => {
    if (typeof props.value === "boolean") return props.value ? "Sim" : "Não"
    if (Array.isArray(props.value)) {
      if (props.value.includes("*")) return "Todos"
      if (props.value.length === 0) return "Nenhum"
      return props.value.length.toString()
    }
    return "-"
  }

  return (
    <span
      class={`px-2 py-1 rounded text-xs font-medium ${
        isEnabled() 
          ? "bg-green-500/30 text-green-300 border border-green-500/40" 
          : "bg-gray-500/30 text-gray-300 border border-gray-500/40"
      }`}
    >
      {props.label}: {displayValue()}
    </span>
  )
}

// ==================== ACCESS LEVEL FORM ====================

function AccessLevelForm(props: { level?: AccessLevel; onClose: () => void }) {
  const auth = useAuth()
  const isEditing = () => !!props.level

  const [name, setName] = createSignal(props.level?.name || "")
  const [description, setDescription] = createSignal(props.level?.description || "")
  const [error, setError] = createSignal("")

  // Permissões
  const [permissions, setPermissions] = createSignal<UserPermissions>(
    props.level?.permissions || { ...DEFAULT_USER_PERMISSIONS }
  )

  const updatePermission = <K extends keyof UserPermissions>(key: K, value: UserPermissions[K]) => {
    setPermissions((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")

    if (isEditing()) {
      const result = await auth.updateAccessLevel(props.level!.id, {
        name: name(),
        description: description(),
        permissions: permissions(),
      })
      if (result.success) {
        showToast({ title: "Nível atualizado", description: name() })
        props.onClose()
      } else {
        setError(result.error || "Erro ao atualizar nível")
      }
    } else {
      const result = await auth.createAccessLevel(name(), description(), permissions())
      if (result.success) {
        showToast({ title: "Nível criado", description: name() })
        props.onClose()
      } else {
        setError(result.error || "Erro ao criar nível")
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 class="font-medium text-text-strong">
        {isEditing() ? `Editar Nível: ${props.level!.name}` : "Novo Nível de Acesso"}
      </h3>
      
      <Show when={error()}>
        <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
      </Show>

      {/* Info básica */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Nome</label>
          <TextField
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Ex: Operador"
          />
        </div>
        <div>
          <label class="block text-sm text-text-subtle mb-1">Descrição</label>
          <TextField
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Ex: Acesso limitado para operadores"
          />
        </div>
      </div>

      {/* Permissões de recursos */}
      <div class="space-y-3">
        <h4 class="text-sm font-medium text-text-strong">Recursos</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-text-subtle mb-1">
              Provedores (IDs separados por vírgula, ou * para todos)
            </label>
            <TextField
              value={permissions().providers.join(", ")}
              onInput={(e) => {
                const value = e.currentTarget.value
                const items = value.split(",").map(s => s.trim()).filter(Boolean)
                updatePermission("providers", items)
              }}
              placeholder="* ou provider1, provider2"
            />
          </div>
          <div>
            <label class="block text-sm text-text-subtle mb-1">
              Modelos (IDs separados por vírgula, ou * para todos)
            </label>
            <TextField
              value={permissions().models.join(", ")}
              onInput={(e) => {
                const value = e.currentTarget.value
                const items = value.split(",").map(s => s.trim()).filter(Boolean)
                updatePermission("models", items)
              }}
              placeholder="* ou gpt-4, claude-3"
            />
          </div>
          <div>
            <label class="block text-sm text-text-subtle mb-1">
              Agentes (IDs separados por vírgula, ou * para todos)
            </label>
            <TextField
              value={permissions().agents.join(", ")}
              onInput={(e) => {
                const value = e.currentTarget.value
                const items = value.split(",").map(s => s.trim()).filter(Boolean)
                updatePermission("agents", items)
              }}
              placeholder="* ou agent1, agent2"
            />
          </div>
          <div>
            <label class="block text-sm text-text-subtle mb-1">
              Ferramentas (IDs separados por vírgula, ou * para todos)
            </label>
            <TextField
              value={permissions().tools.join(", ")}
              onInput={(e) => {
                const value = e.currentTarget.value
                const items = value.split(",").map(s => s.trim()).filter(Boolean)
                updatePermission("tools", items)
              }}
              placeholder="* ou tool1, tool2"
            />
          </div>
        </div>
      </div>

      {/* Permissões booleanas */}
      <div class="space-y-3">
        <h4 class="text-sm font-medium text-text-strong">Funcionalidades</h4>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <PermissionCheckbox
            label="Criar sessões"
            checked={permissions().canCreateSessions}
            onChange={(v) => updatePermission("canCreateSessions", v)}
          />
          <PermissionCheckbox
            label="Arquivar sessões"
            checked={permissions().canArchiveSessions}
            onChange={(v) => updatePermission("canArchiveSessions", v)}
          />
          <PermissionCheckbox
            label="Compartilhar sessões"
            checked={permissions().canShareSessions}
            onChange={(v) => updatePermission("canShareSessions", v)}
          />
          <PermissionCheckbox
            label="Acessar terminal"
            checked={permissions().canAccessTerminal}
            onChange={(v) => updatePermission("canAccessTerminal", v)}
          />
          <PermissionCheckbox
            label="Acessar arquivos"
            checked={permissions().canAccessFiles}
            onChange={(v) => updatePermission("canAccessFiles", v)}
          />
          <PermissionCheckbox
            label="Executar comandos"
            checked={permissions().canExecuteCommands}
            onChange={(v) => updatePermission("canExecuteCommands", v)}
          />
        </div>
      </div>

      {/* Limites */}
      <div class="space-y-3">
        <h4 class="text-sm font-medium text-text-strong">Limites (0 = ilimitado)</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-text-subtle mb-1">Sessões por dia</label>
            <TextField
              type="number"
              value={permissions().maxSessionsPerDay.toString()}
              onInput={(e) => updatePermission("maxSessionsPerDay", parseInt(e.currentTarget.value) || 0)}
            />
          </div>
          <div>
            <label class="block text-sm text-text-subtle mb-1">Mensagens por sessão</label>
            <TextField
              type="number"
              value={permissions().maxMessagesPerSession.toString()}
              onInput={(e) => updatePermission("maxMessagesPerSession", parseInt(e.currentTarget.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={props.onClose}>
          Cancelar
        </Button>
        <Button type="submit">
          {isEditing() ? "Salvar Alterações" : "Criar Nível"}
        </Button>
      </div>
    </form>
  )
}

function PermissionCheckbox(props: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
        class="rounded border-border-weak-base bg-background-base"
      />
      <span class="text-sm text-text-base">{props.label}</span>
    </label>
  )
}

// ==================== RAG TAB ====================

interface KnowledgeBase {
  id: string
  name: string
  description?: string
  embeddingProvider: string
  embeddingModel: string
  documentCount: number
  createdAt: string
  updatedAt: string
}

interface RAGDocument {
  id: string
  knowledgeBaseId: string
  filename: string
  mimeType: string
  size: number
  status: "pending" | "processing" | "indexed" | "error"
  errorMessage?: string
  chunkCount: number
  createdAt: string
  updatedAt: string
}

// Tipo para estado de progresso de processamento
interface ProcessingProgress {
  stage: "extracting" | "chunking" | "embedding" | "indexing"
  progress: number
  message?: string
  chunksProcessed?: number
  chunksTotal?: number
}

interface EmbeddingStatus {
  provider: string
  model: string
  available: boolean
  error?: string
}

function RAGTab() {
  const server = useServer()
  const auth = useAuth()
  const globalSDK = useGlobalSDK()
  
  const [knowledgeBases, setKnowledgeBases] = createSignal<KnowledgeBase[]>([])
  const [selectedKB, setSelectedKB] = createSignal<KnowledgeBase | null>(null)
  const [documents, setDocuments] = createSignal<RAGDocument[]>([])
  const [embeddingStatus, setEmbeddingStatus] = createSignal<EmbeddingStatus | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")
  
  // Estado de progresso de processamento por documento
  const [processingProgress, setProcessingProgress] = createSignal<Map<string, ProcessingProgress>>(new Map())
  
  // Modals
  const [showCreateKB, setShowCreateKB] = createSignal(false)
  const [showUpload, setShowUpload] = createSignal(false)
  const [showSearchTest, setShowSearchTest] = createSignal(false)
  
  // Escutar eventos SSE para progresso de RAG
  onMount(() => {
    const unsub = globalSDK.event.listen((e) => {
      const event = e.details
      if (!event) return
      
      // Eventos de progresso RAG
      if (event.type === "rag.processing.started") {
        const { documentId, stage } = event.properties as { documentId: string; stage: string }
        setProcessingProgress(prev => {
          const newMap = new Map(prev)
          newMap.set(documentId, { stage: stage as ProcessingProgress["stage"], progress: 0.05, message: "Iniciando..." })
          return newMap
        })
      }
      
      if (event.type === "rag.processing.progress") {
        const props = event.properties as ProcessingProgress & { documentId: string }
        setProcessingProgress(prev => {
          const newMap = new Map(prev)
          newMap.set(props.documentId, {
            stage: props.stage,
            progress: props.progress,
            message: props.message,
            chunksProcessed: props.chunksProcessed,
            chunksTotal: props.chunksTotal,
          })
          return newMap
        })
      }
      
      if (event.type === "rag.processing.complete") {
        const { documentId, knowledgeBaseId, chunksCreated, processingTime } = event.properties as {
          documentId: string
          knowledgeBaseId: string
          chunksCreated: number
          processingTime: number
        }
        setProcessingProgress(prev => {
          const newMap = new Map(prev)
          newMap.delete(documentId)
          return newMap
        })
        // Atualizar lista de documentos se estiver visualizando esta base
        if (selectedKB()?.id === knowledgeBaseId) {
          fetchDocuments(knowledgeBaseId)
        }
        fetchKnowledgeBases()
        showToast({ 
          title: "Documento indexado", 
          description: `${chunksCreated} chunks em ${(processingTime / 1000).toFixed(1)}s` 
        })
      }
      
      if (event.type === "rag.processing.error") {
        const { documentId, knowledgeBaseId, error } = event.properties as {
          documentId: string
          knowledgeBaseId: string
          error: string
        }
        setProcessingProgress(prev => {
          const newMap = new Map(prev)
          newMap.delete(documentId)
          return newMap
        })
        // Atualizar lista de documentos se estiver visualizando esta base
        if (selectedKB()?.id === knowledgeBaseId) {
          fetchDocuments(knowledgeBaseId)
        }
        showToast({ 
          title: "Erro no processamento", 
          description: error 
        })
      }
    })
    
    onCleanup(() => unsub())
  })
  
  // Fetch data
  const fetchKnowledgeBases = async () => {
    try {
      const token = getStoredToken()
      if (!token) return
      
      const res = await fetch(`${server.url}/rag/knowledge-bases`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setKnowledgeBases(data)
      } else {
        setError("Erro ao carregar bases de conhecimento")
      }
    } catch (e) {
      setError("Erro de conexão")
    }
  }
  
  const fetchDocuments = async (kbId: string) => {
    try {
      const token = getStoredToken()
      if (!token) return
      
      const res = await fetch(`${server.url}/rag/knowledge-bases/${kbId}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (e) {
      console.error("Error fetching documents:", e)
    }
  }
  
  const fetchEmbeddingStatus = async () => {
    try {
      const token = getStoredToken()
      if (!token) return
      
      const res = await fetch(`${server.url}/rag/embedding/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setEmbeddingStatus(data)
      }
    } catch (e) {
      console.error("Error fetching embedding status:", e)
    }
  }
  
  onMount(async () => {
    setLoading(true)
    await Promise.all([fetchKnowledgeBases(), fetchEmbeddingStatus()])
    setLoading(false)
  })
  
  createEffect(() => {
    const kb = selectedKB()
    if (kb) {
      fetchDocuments(kb.id)
    } else {
      setDocuments([])
    }
  })
  
  const handleDeleteKB = async (kb: KnowledgeBase) => {
    if (!confirm(`Excluir base de conhecimento "${kb.name}"? Todos os documentos serão removidos.`)) return
    
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/rag/knowledge-bases/${kb.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        showToast({ title: "Base excluída", description: kb.name })
        if (selectedKB()?.id === kb.id) setSelectedKB(null)
        await fetchKnowledgeBases()
      } else {
        showToast({ title: "Erro", description: "Falha ao excluir" })
      }
    } catch (e) {
      showToast({ title: "Erro", description: "Erro de conexão" })
    }
  }
  
  const handleDeleteDocument = async (doc: RAGDocument) => {
    if (!confirm(`Excluir documento "${doc.filename}"?`)) return
    
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/rag/documents/${doc.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        showToast({ title: "Documento excluído", description: doc.filename })
        await fetchDocuments(selectedKB()!.id)
        await fetchKnowledgeBases() // Refresh count
      } else {
        showToast({ title: "Erro", description: "Falha ao excluir" })
      }
    } catch (e) {
      showToast({ title: "Erro", description: "Erro de conexão" })
    }
  }
  
  const handleReprocessDocument = async (doc: RAGDocument) => {
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/rag/documents/${doc.id}/reprocess`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        showToast({ title: "Reprocessando", description: doc.filename })
        await fetchDocuments(selectedKB()!.id)
      } else {
        showToast({ title: "Erro", description: "Falha ao reprocessar" })
      }
    } catch (e) {
      showToast({ title: "Erro", description: "Erro de conexão" })
    }
  }
  
  const statusLabel: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    indexed: "Indexado",
    error: "Erro"
  }
  
  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40",
    processing: "bg-blue-500/30 text-blue-300 border border-blue-500/40",
    indexed: "bg-green-500/30 text-green-300 border border-green-500/40",
    error: "bg-red-500/30 text-red-300 border border-red-500/40"
  }
  
  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-medium text-text-strong">Base de Conhecimento (RAG)</h2>
        <div class="flex gap-2">
          <Button variant="outline" icon="search" onClick={() => setShowSearchTest(true)}>
            Testar Busca
          </Button>
          <Button icon="plus" onClick={() => setShowCreateKB(true)}>
            Nova Base
          </Button>
        </div>
      </div>
      
      {/* Embedding Status */}
      <Show when={embeddingStatus()}>
        <div class={`p-3 rounded-lg border ${
          embeddingStatus()!.available 
            ? "bg-green-500/10 border-green-500/20" 
            : "bg-red-500/10 border-red-500/20"
        }`}>
          <div class="flex items-center gap-2">
            <Icon 
              name={embeddingStatus()!.available ? "check-circle" : "x-circle"} 
              size="small" 
              class={embeddingStatus()!.available ? "text-green-400" : "text-red-400"} 
            />
            <span class={embeddingStatus()!.available ? "text-green-400" : "text-red-400"}>
              Provider: {embeddingStatus()!.provider} | Modelo: {embeddingStatus()!.model}
              {embeddingStatus()!.available ? " - Conectado" : ` - ${embeddingStatus()!.error || "Indisponível"}`}
            </span>
          </div>
        </div>
      </Show>
      
      {/* Error */}
      <Show when={error()}>
        <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
      </Show>
      
      {/* Loading */}
      <Show when={loading()}>
        <div class="text-center py-8 text-text-subtle">Carregando...</div>
      </Show>
      
      {/* Create KB Modal */}
      <Show when={showCreateKB()}>
        <CreateKnowledgeBaseForm 
          onClose={() => setShowCreateKB(false)} 
          onCreated={() => {
            setShowCreateKB(false)
            fetchKnowledgeBases()
          }}
        />
      </Show>
      
      {/* Upload Modal */}
      <Show when={showUpload() && selectedKB()}>
        <DocumentUploadForm
          knowledgeBase={selectedKB()!}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false)
            fetchDocuments(selectedKB()!.id)
            fetchKnowledgeBases()
          }}
        />
      </Show>
      
      {/* Search Test Modal */}
      <Show when={showSearchTest()}>
        <SearchTestModal 
          knowledgeBases={knowledgeBases()} 
          onClose={() => setShowSearchTest(false)} 
        />
      </Show>
      
      {/* Content Grid */}
      <Show when={!loading()}>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Knowledge Bases List */}
          <div class="space-y-2">
            <h3 class="text-sm font-medium text-text-subtle">Bases de Conhecimento ({knowledgeBases().length})</h3>
            <Show when={knowledgeBases().length === 0}>
              <div class="p-8 text-center text-text-subtle rounded-lg border border-dashed border-border-weak-base">
                Nenhuma base criada ainda.
              </div>
            </Show>
            <For each={knowledgeBases()}>
              {(kb) => (
                <div 
                  class={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedKB()?.id === kb.id 
                      ? "bg-surface-raised-base-hover border-text-interactive-base" 
                      : "bg-surface-raised-base border-border-weak-base hover:border-border-strong-base"
                  }`}
                  onClick={() => setSelectedKB(kb)}
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="font-medium text-text-strong">{kb.name}</div>
                      <div class="text-xs text-text-subtle mt-1">
                        {kb.embeddingProvider}/{kb.embeddingModel} | {kb.documentCount} docs
                      </div>
                      <Show when={kb.description}>
                        <div class="text-sm text-text-subtle mt-1">{kb.description}</div>
                      </Show>
                    </div>
                    <IconButton
                      icon="trash"
                      variant="ghost"
                      size="small"
                      class="text-icon-critical-base"
                      onClick={(e: Event) => {
                        e.stopPropagation()
                        handleDeleteKB(kb)
                      }}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
          
          {/* Documents List */}
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-text-subtle">
                Documentos {selectedKB() ? `(${documents().length})` : ""}
              </h3>
              <Show when={selectedKB()}>
                <Button size="small" icon="upload" onClick={() => setShowUpload(true)}>
                  Upload
                </Button>
              </Show>
            </div>
            
            <Show when={!selectedKB()}>
              <div class="p-8 text-center text-text-subtle rounded-lg border border-dashed border-border-weak-base">
                Selecione uma base para ver os documentos.
              </div>
            </Show>
            
            <Show when={selectedKB() && documents().length === 0}>
              <div class="p-8 text-center text-text-subtle rounded-lg border border-dashed border-border-weak-base">
                Nenhum documento nesta base.
              </div>
            </Show>
            
            <For each={documents()}>
              {(doc) => {
                const progress = () => processingProgress().get(doc.id)
                const stageLabels: Record<string, string> = {
                  extracting: "Extraindo texto",
                  chunking: "Dividindo em chunks",
                  embedding: "Gerando embeddings",
                  indexing: "Indexando no Qdrant"
                }
                
                return (
                  <div class="p-3 rounded-lg bg-surface-raised-base border border-border-weak-base">
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <Icon name="file-text" size="small" class="text-icon-subtle-base shrink-0" />
                          <span class="font-medium text-text-strong truncate">{doc.filename}</span>
                          <span class={`px-2 py-0.5 rounded text-xs ${statusColor[doc.status]}`}>
                            {statusLabel[doc.status]}
                          </span>
                        </div>
                        <div class="text-xs text-text-subtle mt-1 ml-6">
                          {formatFileSize(doc.size)} | {doc.chunkCount} chunks
                        </div>
                        <Show when={doc.status === "error" && doc.errorMessage}>
                          <div class="text-xs text-red-400 mt-1 ml-6">{doc.errorMessage}</div>
                        </Show>
                        {/* Barra de progresso em tempo real */}
                        <Show when={progress()}>
                          <div class="mt-2 ml-6 space-y-1">
                            <div class="flex items-center gap-2 text-xs">
                              <span class="text-blue-400 animate-pulse">
                                {stageLabels[progress()!.stage] || progress()!.stage}
                              </span>
                              <Show when={progress()!.message}>
                                <span class="text-text-subtle">- {progress()!.message}</span>
                              </Show>
                            </div>
                            <div class="h-1.5 bg-background-base rounded-full overflow-hidden">
                              <div 
                                class="h-full bg-blue-500 transition-all duration-300" 
                                style={{ width: `${Math.round(progress()!.progress * 100)}%` }}
                              />
                            </div>
                            <div class="flex justify-between text-xs text-text-subtle">
                              <span>{Math.round(progress()!.progress * 100)}%</span>
                              <Show when={progress()!.chunksTotal}>
                                <span>{progress()!.chunksProcessed || 0}/{progress()!.chunksTotal} chunks</span>
                              </Show>
                            </div>
                          </div>
                        </Show>
                      </div>
                      <div class="flex items-center gap-1">
                        <Show when={doc.status === "error"}>
                          <IconButton
                            icon="refresh-cw"
                            variant="ghost"
                            size="small"
                            title="Reprocessar"
                            onClick={() => handleReprocessDocument(doc)}
                          />
                        </Show>
                        <IconButton
                          icon="trash"
                          variant="ghost"
                          size="small"
                          class="text-icon-critical-base"
                          onClick={() => handleDeleteDocument(doc)}
                        />
                      </div>
                    </div>
                  </div>
                )
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

// ==================== CREATE KNOWLEDGE BASE FORM ====================

function CreateKnowledgeBaseForm(props: { onClose: () => void; onCreated: () => void }) {
  const server = useServer()
  const auth = useAuth()
  
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [provider, setProvider] = createSignal("ollama")
  const [model, setModel] = createSignal("nomic-embed-text")
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    
    try {
      const token = getStoredToken()
      const res = await fetch(`${server.url}/rag/knowledge-bases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name(),
          description: description() || undefined,
          embeddingProvider: provider(),
          embeddingModel: model()
        })
      })
      
      if (res.ok) {
        showToast({ title: "Base criada", description: name() })
        props.onCreated()
      } else {
        const data = await res.json()
        setError(data.error || "Erro ao criar base")
      }
    } catch (e) {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 class="font-medium text-text-strong">Nova Base de Conhecimento</h3>
      
      <Show when={error()}>
        <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
      </Show>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Nome</label>
          <TextField
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Ex: Documentação SUATEC"
            required
          />
        </div>
        <div>
          <label class="block text-sm text-text-subtle mb-1">Descrição (opcional)</label>
          <TextField
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Ex: Manuais e guias de uso"
          />
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-text-subtle mb-1">Provider de Embeddings</label>
          <select
            value={provider()}
            onChange={(e) => {
              setProvider(e.currentTarget.value)
              // Set default model based on provider
              if (e.currentTarget.value === "ollama") {
                setModel("nomic-embed-text")
              } else if (e.currentTarget.value === "openai") {
                setModel("text-embedding-3-small")
              }
            }}
            class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-text-subtle mb-1">Modelo</label>
          <select
            value={model()}
            onChange={(e) => setModel(e.currentTarget.value)}
            class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
          >
            <Show when={provider() === "ollama"}>
              <option value="nomic-embed-text">nomic-embed-text</option>
              <option value="mxbai-embed-large">mxbai-embed-large</option>
              <option value="all-minilm">all-minilm</option>
            </Show>
            <Show when={provider() === "openai"}>
              <option value="text-embedding-3-small">text-embedding-3-small</option>
              <option value="text-embedding-3-large">text-embedding-3-large</option>
              <option value="text-embedding-ada-002">text-embedding-ada-002</option>
            </Show>
          </select>
        </div>
      </div>
      
      <div class="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={props.onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading()}>{loading() ? "Criando..." : "Criar Base"}</Button>
      </div>
    </form>
  )
}

// ==================== DOCUMENT UPLOAD FORM ====================

function DocumentUploadForm(props: { knowledgeBase: KnowledgeBase; onClose: () => void; onUploaded: () => void }) {
  const server = useServer()
  const auth = useAuth()
  
  const [files, setFiles] = createSignal<FileList | null>(null)
  const [uploading, setUploading] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [error, setError] = createSignal("")
  
  const handleUpload = async () => {
    const fileList = files()
    if (!fileList || fileList.length === 0) return
    
    setUploading(true)
    setError("")
    setProgress(0)
    
    const total = fileList.length
    let uploaded = 0
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const formData = new FormData()
      formData.append("file", file)
      
      try {
        const token = getStoredToken()
        const res = await fetch(`${server.url}/rag/knowledge-bases/${props.knowledgeBase.id}/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        })
        
        if (!res.ok) {
          const data = await res.json()
          setError(`Erro em ${file.name}: ${data.error || "Falha no upload"}`)
        }
        
        uploaded++
        setProgress(Math.round((uploaded / total) * 100))
      } catch (e) {
        setError(`Erro em ${file.name}: Falha de conexão`)
      }
    }
    
    setUploading(false)
    if (!error()) {
      showToast({ title: "Upload concluído", description: `${uploaded} arquivo(s) enviado(s)` })
      props.onUploaded()
    }
  }
  
  return (
    <div class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base space-y-4">
      <h3 class="font-medium text-text-strong">Upload de Documentos - {props.knowledgeBase.name}</h3>
      
      <Show when={error()}>
        <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
      </Show>
      
      <div>
        <label class="block text-sm text-text-subtle mb-2">Selecionar arquivos</label>
        <input
          type="file"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx,.json"
          onChange={(e) => setFiles(e.currentTarget.files)}
          class="w-full text-text-base file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-surface-raised-base-hover file:text-text-strong file:cursor-pointer"
        />
        <p class="text-xs text-text-subtle mt-1">Formatos: TXT, MD, PDF, DOC, DOCX, JSON</p>
      </div>
      
      <Show when={uploading()}>
        <div class="space-y-2">
          <div class="h-2 bg-background-base rounded-full overflow-hidden">
            <div 
              class="h-full bg-text-interactive-base transition-all" 
              style={{ width: `${progress()}%` }}
            />
          </div>
          <p class="text-sm text-text-subtle text-center">{progress()}%</p>
        </div>
      </Show>
      
      <div class="flex justify-end gap-2">
        <Button variant="ghost" onClick={props.onClose} disabled={uploading()}>Cancelar</Button>
        <Button onClick={handleUpload} disabled={uploading() || !files() || files()!.length === 0}>
          {uploading() ? "Enviando..." : "Enviar Arquivos"}
        </Button>
      </div>
    </div>
  )
}

// ==================== SEARCH TEST MODAL ====================

interface SearchResult {
  content: string
  score: number
  metadata: {
    documentId: string
    filename: string
    chunkIndex: number
  }
}

function SearchTestModal(props: { knowledgeBases: KnowledgeBase[]; onClose: () => void }) {
  const server = useServer()
  const auth = useAuth()
  
  const [query, setQuery] = createSignal("")
  const [selectedKBId, setSelectedKBId] = createSignal<string>("")
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [searching, setSearching] = createSignal(false)
  const [error, setError] = createSignal("")
  
  const handleSearch = async () => {
    if (!query().trim()) return
    
    setSearching(true)
    setError("")
    setResults([])
    
    try {
      const token = getStoredToken()
      const body: any = {
        query: query(),
        limit: 5,
        scoreThreshold: 0.3
      }
      
      if (selectedKBId()) {
        body.knowledgeBaseId = selectedKBId()
      }
      
      const res = await fetch(`${server.url}/rag/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      
      if (res.ok) {
        const data = await res.json()
        // API returns array directly, not { results: [...] }
        setResults(Array.isArray(data) ? data : (data.results || []))
      } else {
        const data = await res.json()
        setError(data.error || "Erro na busca")
      }
    } catch (e) {
      setError("Erro de conexão")
    } finally {
      setSearching(false)
    }
  }
  
  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-surface-raised-base rounded-lg border border-border-weak-base w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div class="p-4 border-b border-border-weak-base flex items-center justify-between">
          <h3 class="font-medium text-text-strong">Testar Busca Semântica</h3>
          <IconButton icon="x" variant="ghost" onClick={props.onClose} />
        </div>
        
        <div class="p-4 space-y-4 flex-1 overflow-auto">
          <Show when={error()}>
            <div class="p-3 rounded bg-red-500/10 text-red-400 text-sm">{error()}</div>
          </Show>
          
          <div class="flex gap-2">
            <div class="flex-1">
              <TextField
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                placeholder="Digite sua pergunta..."
                onKeyPress={(e: KeyboardEvent) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <select
              value={selectedKBId()}
              onChange={(e) => setSelectedKBId(e.currentTarget.value)}
              class="px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
            >
              <option value="">Todas as bases</option>
              <For each={props.knowledgeBases}>
                {(kb) => <option value={kb.id}>{kb.name}</option>}
              </For>
            </select>
            <Button onClick={handleSearch} disabled={searching() || !query().trim()}>
              {searching() ? "..." : "Buscar"}
            </Button>
          </div>
          
          <Show when={results().length > 0}>
            <div class="space-y-2">
              <h4 class="text-sm font-medium text-text-subtle">Resultados ({results().length})</h4>
              <For each={results()}>
                {(result) => (
                  <div class="p-3 rounded-lg bg-background-base border border-border-weak-base">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs text-text-subtle">
                        {result.metadata.filename} (chunk {result.metadata.chunkIndex})
                      </span>
                      <span class="text-xs px-2 py-0.5 rounded bg-blue-500/30 text-blue-300">
                        Score: {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p class="text-sm text-text-base whitespace-pre-wrap line-clamp-4">{result.content}</p>
                  </div>
                )}
              </For>
            </div>
          </Show>
          
          <Show when={!searching() && results().length === 0 && query()}>
            <div class="text-center py-8 text-text-subtle">
              Nenhum resultado encontrado.
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

// ==================== INTEGRATIONS TAB ====================

interface IntegrationCredential {
  id: string
  type: string
  name: string
  description: string
  isActive: boolean
  createdAt: number
  updatedAt: number
  credentials: Array<{ key: string; hasValue?: boolean; value?: string }>
}

interface IntegrationTemplate {
  name: string
  fields: string[]
}

function IntegrationsTab() {
  const server = useServer()
  const [integrations, setIntegrations] = createSignal<IntegrationCredential[]>([])
  const [templates, setTemplates] = createSignal<Record<string, IntegrationTemplate>>({})
  const [loading, setLoading] = createSignal(true)
  const [showCreate, setShowCreate] = createSignal(false)
  const [editing, setEditing] = createSignal<IntegrationCredential | null>(null)

  // Load integrations and templates
  const loadData = async () => {
    setLoading(true)
    try {
      const token = getStoredToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const [integrationsRes, templatesRes] = await Promise.all([
        fetch(`${server.url}/integration`, { headers }),
        fetch(`${server.url}/integration/templates`, { headers }),
      ])

      if (integrationsRes.ok) {
        setIntegrations(await integrationsRes.json())
      }
      if (templatesRes.ok) {
        setTemplates(await templatesRes.json())
      }
    } catch (err: any) {
      showToast({ title: "Erro ao carregar integrações", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  onMount(loadData)

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta integração?")) return
    
    try {
      const token = getStoredToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`${server.url}/integration/${id}`, {
        method: "DELETE",
        headers,
      })

      if (res.ok) {
        showToast({ title: "Integração removida com sucesso" })
        loadData()
      } else {
        throw new Error("Falha ao remover")
      }
    } catch (err: any) {
      showToast({ title: "Erro ao remover integração", description: err.message })
    }
  }

  const toggleActive = async (integration: IntegrationCredential) => {
    try {
      const token = getStoredToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`${server.url}/integration/${integration.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isActive: !integration.isActive }),
      })

      if (res.ok) {
        showToast({ title: integration.isActive ? "Integração desativada" : "Integração ativada" })
        loadData()
      }
    } catch (err: any) {
      showToast({ title: "Erro", description: err.message })
    }
  }

  const typeLabels: Record<string, string> = {
    confirm8: "Confirm8",
    rdstation: "RD Station",
    openai: "OpenAI",
    anthropic: "Anthropic",
    custom: "Personalizado",
  }

  const typeColors: Record<string, string> = {
    confirm8: "bg-green-500/30 text-green-300 border border-green-500/40",
    rdstation: "bg-orange-500/30 text-orange-300 border border-orange-500/40",
    openai: "bg-purple-500/30 text-purple-300 border border-purple-500/40",
    anthropic: "bg-amber-500/30 text-amber-300 border border-amber-500/40",
    custom: "bg-gray-500/30 text-gray-300 border border-gray-500/40",
  }

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-lg font-medium text-text-strong">Integrações</h2>
          <p class="text-sm text-text-subtle">
            Gerencie credenciais de APIs externas (Confirm8, RD Station, etc.)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Icon name="plus" size="small" class="mr-1" />
          Nova Integração
        </Button>
      </div>

      {/* Loading */}
      <Show when={loading()}>
        <div class="text-center py-8 text-text-subtle">Carregando...</div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && integrations().length === 0}>
        <div class="text-center py-8 text-text-subtle">
          <Icon name="plug" size="large" class="mx-auto mb-4 opacity-50" />
          <p>Nenhuma integração configurada.</p>
          <p class="text-xs mt-1">Adicione credenciais para usar as ferramentas de integração.</p>
        </div>
      </Show>

      {/* List */}
      <Show when={!loading() && integrations().length > 0}>
        <div class="space-y-3">
          <For each={integrations()}>
            {(integration) => (
              <div class="p-4 rounded-lg bg-surface-raised-base border border-border-weak-base">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium text-text-strong">{integration.name}</span>
                      <span class={`text-xs px-2 py-0.5 rounded ${typeColors[integration.type] || typeColors.custom}`}>
                        {typeLabels[integration.type] || integration.type}
                      </span>
                      <Show when={!integration.isActive}>
                        <span class="text-xs px-2 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40">
                          Inativo
                        </span>
                      </Show>
                    </div>
                    <Show when={integration.description}>
                      <p class="text-sm text-text-subtle mb-2">{integration.description}</p>
                    </Show>
                    <div class="flex flex-wrap gap-2">
                      <For each={integration.credentials}>
                        {(cred) => (
                          <span class="text-xs px-2 py-1 rounded bg-background-base border border-border-weak-base">
                            {cred.key}: {cred.hasValue ? "••••••••" : "(não configurado)"}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 ml-4">
                    <IconButton
                      name={integration.isActive ? "pause" : "play"}
                      size="small"
                      title={integration.isActive ? "Desativar" : "Ativar"}
                      onClick={() => toggleActive(integration)}
                    />
                    <IconButton
                      name="edit"
                      size="small"
                      title="Editar"
                      onClick={() => setEditing(integration)}
                    />
                    <IconButton
                      name="trash"
                      size="small"
                      title="Remover"
                      class="text-icon-critical-base hover:text-icon-critical-base-hover"
                      onClick={() => handleDelete(integration.id)}
                    />
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Create/Edit Modal */}
      <Show when={showCreate() || editing()}>
        <IntegrationForm
          templates={templates()}
          integration={editing()}
          onClose={() => {
            setShowCreate(false)
            setEditing(null)
          }}
          onSave={() => {
            setShowCreate(false)
            setEditing(null)
            loadData()
          }}
        />
      </Show>
    </div>
  )
}

function IntegrationForm(props: {
  templates: Record<string, IntegrationTemplate>
  integration: IntegrationCredential | null
  onClose: () => void
  onSave: () => void
}) {
  const server = useServer()
  const isEdit = () => !!props.integration
  
  const [type, setType] = createSignal(props.integration?.type || "confirm8")
  const [name, setName] = createSignal(props.integration?.name || "")
  const [description, setDescription] = createSignal(props.integration?.description || "")
  const [credentials, setCredentials] = createSignal<Array<{ key: string; value: string }>>([])
  const [saving, setSaving] = createSignal(false)

  // Initialize credentials based on template or existing
  createEffect(() => {
    const template = props.templates[type()]
    if (template && !isEdit()) {
      setCredentials(template.fields.map(f => ({ key: f, value: "" })))
    } else if (props.integration) {
      setCredentials(props.integration.credentials.map(c => ({ key: c.key, value: "" })))
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!name().trim()) {
      showToast({ title: "Nome é obrigatório" })
      return
    }

    // For new integrations, all credentials must have values
    if (!isEdit()) {
      const emptyCredentials = credentials().filter(c => !c.value.trim())
      if (emptyCredentials.length > 0) {
        showToast({ title: `Preencha: ${emptyCredentials.map(c => c.key).join(", ")}` })
        return
      }
    }

    setSaving(true)
    try {
      const token = getStoredToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const body: any = {
        name: name(),
        description: description(),
      }

      // Only include credentials that have values (for edit, empty means keep existing)
      const filledCredentials = credentials().filter(c => c.value.trim())
      if (filledCredentials.length > 0 || !isEdit()) {
        body.credentials = isEdit() ? filledCredentials : credentials()
      }

      if (!isEdit()) {
        body.type = type()
      }

      const url = isEdit()
        ? `${server.url}/integration/${props.integration!.id}`
        : `${server.url}/integration`
      
      const method = isEdit() ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      })

      if (res.ok) {
        showToast({ title: isEdit() ? "Integração atualizada" : "Integração criada" })
        props.onSave()
      } else {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.message || "Falha ao salvar")
      }
    } catch (err: any) {
      showToast({ title: "Erro", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const updateCredential = (index: number, value: string) => {
    setCredentials(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], value }
      return updated
    })
  }

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-surface-raised-base rounded-lg border border-border-weak-base p-6 w-full max-w-lg">
        <h3 class="text-lg font-medium text-text-strong mb-4">
          {isEdit() ? "Editar Integração" : "Nova Integração"}
        </h3>
        
        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Type */}
          <Show when={!isEdit()}>
            <div>
              <label class="block text-sm font-medium text-text-base mb-1">Tipo</label>
              <select
                value={type()}
                onChange={(e) => setType(e.currentTarget.value)}
                class="w-full px-3 py-2 rounded bg-background-base border border-border-weak-base text-text-base"
              >
                <For each={Object.entries(props.templates)}>
                  {([key, template]) => (
                    <option value={key}>{template.name}</option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          {/* Name */}
          <div>
            <label class="block text-sm font-medium text-text-base mb-1">Nome</label>
            <TextField
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Ex: Confirm8 Produção"
            />
          </div>

          {/* Description */}
          <div>
            <label class="block text-sm font-medium text-text-base mb-1">Descrição (opcional)</label>
            <TextField
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Descrição da integração"
            />
          </div>

          {/* Credentials */}
          <div>
            <label class="block text-sm font-medium text-text-base mb-2">Credenciais</label>
            <div class="space-y-2">
              <For each={credentials()}>
                {(cred, index) => (
                  <div>
                    <label class="block text-xs text-text-subtle mb-1">{cred.key}</label>
                    <TextField
                      type="password"
                      value={cred.value}
                      onInput={(e) => updateCredential(index(), e.currentTarget.value)}
                      placeholder={isEdit() ? "(deixe vazio para manter)" : "Digite o valor"}
                    />
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Actions */}
          <div class="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving()}>
              {saving() ? "Salvando..." : isEdit() ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
