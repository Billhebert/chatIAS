import { createContext, useContext, createSignal, createEffect, type ParentProps, Show, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import {
  type UserRole,
  type UserPermissions,
  type UserSettings,
  type PublicUser,
  type AccessLevel,
  UserApiClient,
  getStoredToken,
  getStoredUser,
  clearStoredAuth,
} from "@/api/user-api"

// ==================== RE-EXPORTS PARA COMPATIBILIDADE ====================

export type { UserRole, UserPermissions, UserSettings, AccessLevel }

// Tipo User para compatibilidade (agora sem passwordHash)
export type User = PublicUser

export const DEFAULT_USER_SETTINGS: UserSettings = {
  interfaceMode: "standard",
  showTerminalByDefault: false,
  showTechnicalDetails: false,
  showDebugLogs: false,
}

export const DEVELOPER_SETTINGS: UserSettings = {
  interfaceMode: "developer",
  showTerminalByDefault: true,
  showTechnicalDetails: true,
  showDebugLogs: true,
}

// ==================== PERMISSÕES PADRÃO ====================

const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  providers: [],
  models: [],
  agents: [],
  tools: [],
  canCreateSessions: true,
  canArchiveSessions: false,
  canShareSessions: false,
  canAccessTerminal: false,
  canAccessFiles: false,
  canExecuteCommands: false,
  maxSessionsPerDay: 10,
  maxMessagesPerSession: 100,
}

const FULL_PERMISSIONS: UserPermissions = {
  providers: ["*"],
  models: ["*"],
  agents: ["*"],
  tools: ["*"],
  canCreateSessions: true,
  canArchiveSessions: true,
  canShareSessions: true,
  canAccessTerminal: true,
  canAccessFiles: true,
  canExecuteCommands: true,
  maxSessionsPerDay: 0,
  maxMessagesPerSession: 0,
}

// ==================== TIPOS DO CONTEXTO ====================

interface AuthState {
  currentUser: PublicUser | null
  users: PublicUser[]
  accessLevels: AccessLevel[]
  permissions: UserPermissions | null
  loading: boolean
  error: string | null
}

interface AuthContextValue {
  // Estado
  loading: () => boolean
  error: () => string | null
  
  // Autenticação
  isAuthenticated: () => boolean
  currentUser: () => User | null
  users: () => User[]
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshCurrentUser: () => Promise<void>
  
  // Gerenciamento de usuários (apenas master/admin)
  createUser: (username: string, password: string, role: UserRole, accessLevelId: string | null) => Promise<{ success: boolean; error?: string; user?: User }>
  updateUser: (userId: string, updates: Partial<Pick<User, "username" | "role" | "accessLevelId" | "isActive">>) => Promise<{ success: boolean; error?: string }>
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  
  // Níveis de acesso
  accessLevels: () => AccessLevel[]
  createAccessLevel: (name: string, description: string, permissions: UserPermissions) => Promise<{ success: boolean; error?: string; accessLevel?: AccessLevel }>
  updateAccessLevel: (id: string, updates: Partial<Pick<AccessLevel, "name" | "description" | "permissions">>) => Promise<{ success: boolean; error?: string }>
  deleteAccessLevel: (id: string) => Promise<{ success: boolean; error?: string }>
  refreshAccessLevels: () => Promise<void>
  
  // Verificação de permissões
  hasPermission: (permission: keyof UserPermissions) => boolean
  canUseProvider: (providerId: string) => boolean
  canUseModel: (modelId: string) => boolean
  canUseAgent: (agentId: string) => boolean
  canUseTool: (toolId: string) => boolean
  getUserPermissions: () => UserPermissions | null
  
  // Configurações do usuário
  getUserSettings: () => UserSettings
  updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>
  isDeveloperMode: () => boolean
  toggleDeveloperMode: () => Promise<void>
  
  // Helpers
  isMaster: () => boolean
  isAdmin: () => boolean
  canManageUsers: () => boolean
  
  // API Client
  getApiClient: () => UserApiClient
}

const AuthContext = createContext<AuthContextValue>()

// ==================== PROVIDER ====================

export function AuthProvider(props: ParentProps & { serverUrl: string }) {
  const [state, setState] = createStore<AuthState>({
    currentUser: null,
    users: [],
    accessLevels: [],
    permissions: null,
    loading: true,
    error: null,
  })

  // Criar cliente API
  const apiClient = new UserApiClient(props.serverUrl)

  // ==================== INICIALIZAÇÃO ====================

  onMount(async () => {
    // Tentar restaurar sessão do localStorage
    const storedUser = getStoredUser()
    const storedToken = getStoredToken()

    if (storedUser && storedToken) {
      try {
        // Validar token com o servidor
        const user = await apiClient.me()
        const permissions = await apiClient.myPermissions()
        setState({
          currentUser: user,
          permissions,
          loading: false,
        })
        
        // Carregar dados adicionais se admin
        if (user.role === "master" || user.role === "admin") {
          await refreshUsers()
          await refreshAccessLevels()
        }
      } catch (err) {
        // Token inválido, limpar
        clearStoredAuth()
        setState({ currentUser: null, permissions: null, loading: false })
      }
    } else {
      setState({ loading: false })
    }
  })

  // ==================== HELPERS INTERNOS ====================

  const refreshUsers = async () => {
    try {
      const users = await apiClient.listUsers()
      setState("users", users)
    } catch (err) {
      console.error("Failed to refresh users:", err)
    }
  }

  const refreshAccessLevels = async () => {
    try {
      const levels = await apiClient.listAccessLevels()
      setState("accessLevels", levels)
    } catch (err) {
      console.error("Failed to refresh access levels:", err)
    }
  }

  const refreshCurrentUser = async () => {
    try {
      const user = await apiClient.me()
      const permissions = await apiClient.myPermissions()
      setState({ currentUser: user, permissions })
    } catch (err) {
      console.error("Failed to refresh current user:", err)
    }
  }

  // ==================== GETTERS ====================

  const currentUser = () => state.currentUser
  const isAuthenticated = () => !!state.currentUser
  const isMaster = () => state.currentUser?.role === "master"
  const isAdmin = () => {
    const user = state.currentUser
    return user?.role === "master" || user?.role === "admin"
  }
  const canManageUsers = () => isMaster() || isAdmin()
  const getUserPermissions = () => state.permissions

  // ==================== VERIFICAÇÃO DE PERMISSÕES ====================

  const hasPermission = (permission: keyof UserPermissions): boolean => {
    const permissions = state.permissions
    if (!permissions) return false
    
    const value = permissions[permission]
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 0 || value > 0
    if (Array.isArray(value)) return value.length > 0
    return false
  }

  const canUseProvider = (providerId: string): boolean => {
    const permissions = state.permissions
    if (!permissions) return false
    return permissions.providers.includes("*") || permissions.providers.includes(providerId)
  }

  const canUseModel = (modelId: string): boolean => {
    const permissions = state.permissions
    if (!permissions) return false
    return permissions.models.includes("*") || permissions.models.includes(modelId)
  }

  const canUseAgent = (agentId: string): boolean => {
    const permissions = state.permissions
    if (!permissions) return false
    return permissions.agents.includes("*") || permissions.agents.includes(agentId)
  }

  const canUseTool = (toolId: string): boolean => {
    const permissions = state.permissions
    if (!permissions) return false
    return permissions.tools.includes("*") || permissions.tools.includes(toolId)
  }

  // ==================== AUTENTICAÇÃO ====================

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setState("error", null)
    try {
      const result = await apiClient.login(username, password)
      const permissions = await apiClient.myPermissions()
      
      setState({
        currentUser: result.user,
        permissions,
        error: null,
      })

      // Carregar dados adicionais se admin
      if (result.user.role === "master" || result.user.role === "admin") {
        await refreshUsers()
        await refreshAccessLevels()
      }

      return { success: true }
    } catch (err: any) {
      const error = err.message || "Erro ao fazer login"
      setState("error", error)
      return { success: false, error }
    }
  }

  const register = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setState("error", null)
    try {
      const result = await apiClient.register(username, password)
      const permissions = await apiClient.myPermissions()
      
      setState({
        currentUser: result.user,
        permissions,
        error: null,
      })

      return { success: true }
    } catch (err: any) {
      const error = err.message || "Erro ao registrar"
      setState("error", error)
      return { success: false, error }
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout()
    } catch (err) {
      // Ignorar erro, limpar de qualquer forma
    }
    setState({
      currentUser: null,
      users: [],
      accessLevels: [],
      permissions: null,
      error: null,
    })
  }

  // ==================== GERENCIAMENTO DE USUÁRIOS ====================

  const createUser = async (
    username: string,
    password: string,
    role: UserRole,
    accessLevelId: string | null
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const user = await apiClient.createUser({ username, password, role, accessLevelId })
      await refreshUsers()
      return { success: true, user }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const updateUser = async (
    userId: string,
    updates: Partial<Pick<User, "username" | "role" | "accessLevelId" | "isActive">>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.updateUser(userId, updates)
      await refreshUsers()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.deleteUser(userId)
      await refreshUsers()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const resetUserPassword = async (
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.resetUserPassword(userId, newPassword)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // ==================== NÍVEIS DE ACESSO ====================

  const createAccessLevel = async (
    name: string,
    description: string,
    permissions: UserPermissions
  ): Promise<{ success: boolean; error?: string; accessLevel?: AccessLevel }> => {
    try {
      const accessLevel = await apiClient.createAccessLevel({ name, description, permissions })
      await refreshAccessLevels()
      return { success: true, accessLevel }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const updateAccessLevel = async (
    id: string,
    updates: Partial<Pick<AccessLevel, "name" | "description" | "permissions">>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.updateAccessLevel(id, updates)
      await refreshAccessLevels()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const deleteAccessLevel = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiClient.deleteAccessLevel(id)
      await refreshAccessLevels()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // ==================== CONFIGURAÇÕES DO USUÁRIO ====================

  const getUserSettings = (): UserSettings => {
    const user = state.currentUser
    if (!user) return DEFAULT_USER_SETTINGS
    return user.settings ?? DEFAULT_USER_SETTINGS
  }

  const updateUserSettings = async (updates: Partial<UserSettings>): Promise<void> => {
    try {
      const updatedUser = await apiClient.updateMySettings(updates)
      setState("currentUser", updatedUser)
    } catch (err) {
      console.error("Failed to update settings:", err)
    }
  }

  const isDeveloperMode = (): boolean => {
    return getUserSettings().interfaceMode === "developer"
  }

  const toggleDeveloperMode = async (): Promise<void> => {
    const current = isDeveloperMode()
    if (current) {
      await updateUserSettings({
        interfaceMode: "standard",
        showTerminalByDefault: false,
        showTechnicalDetails: false,
        showDebugLogs: false,
      })
    } else {
      await updateUserSettings({
        interfaceMode: "developer",
        showTerminalByDefault: true,
        showTechnicalDetails: true,
        showDebugLogs: true,
      })
    }
  }

  // ==================== CONTEXT VALUE ====================

  const value: AuthContextValue = {
    // Estado
    loading: () => state.loading,
    error: () => state.error,
    
    // Autenticação
    isAuthenticated,
    currentUser,
    users: () => state.users,
    login,
    register,
    logout,
    refreshCurrentUser,
    
    // Gerenciamento de usuários
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword,
    
    // Níveis de acesso
    accessLevels: () => state.accessLevels,
    createAccessLevel,
    updateAccessLevel,
    deleteAccessLevel,
    refreshAccessLevels,
    
    // Verificação de permissões
    hasPermission,
    canUseProvider,
    canUseModel,
    canUseAgent,
    canUseTool,
    getUserPermissions,
    
    // Configurações do usuário
    getUserSettings,
    updateUserSettings,
    isDeveloperMode,
    toggleDeveloperMode,
    
    // Helpers
    isMaster,
    isAdmin,
    canManageUsers,
    
    // API Client
    getApiClient: () => apiClient,
  }

  return (
    <Show when={!state.loading} fallback={<div class="size-full flex items-center justify-center">Carregando...</div>}>
      <AuthContext.Provider value={value}>
        {props.children}
      </AuthContext.Provider>
    </Show>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// ==================== EXPORTS PARA USO EXTERNO ====================

export { DEFAULT_USER_PERMISSIONS, FULL_PERMISSIONS }
