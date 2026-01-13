/**
 * Cliente API para autenticacao e gerenciamento de usuarios
 * Este cliente se comunica com as rotas /user do backend
 */

// ==================== TIPOS ====================

export type UserRole = "master" | "admin" | "user"

export interface UserPermissions {
  providers: string[]
  models: string[]
  agents: string[]
  tools: string[]
  canCreateSessions: boolean
  canArchiveSessions: boolean
  canShareSessions: boolean
  canAccessTerminal: boolean
  canAccessFiles: boolean
  canExecuteCommands: boolean
  maxSessionsPerDay: number
  maxMessagesPerSession: number
}

export interface UserSettings {
  interfaceMode: "developer" | "standard"
  showTerminalByDefault: boolean
  showTechnicalDetails: boolean
  showDebugLogs: boolean
}

export interface PublicUser {
  id: string
  username: string
  role: UserRole
  accessLevelId: string | null
  createdAt: number
  createdBy: string | null
  lastLoginAt: number | null
  isActive: boolean
  settings: UserSettings
}

export interface AccessLevel {
  id: string
  name: string
  description: string
  permissions: UserPermissions
  createdAt: number
  createdBy: string | null
}

export interface AuthStatus {
  hasUsers: boolean
  message: string
}

export interface LoginResponse {
  user: PublicUser
  token: string
}

export interface ApiError {
  error: string
}

// ==================== STORAGE ====================

const TOKEN_KEY = "suatec.auth.token"
const USER_KEY = "suatec.auth.user"

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): PublicUser | null {
  const data = localStorage.getItem(USER_KEY)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function setStoredAuth(token: string, user: PublicUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ==================== CLIENT ====================

export class UserApiClient {
  private baseUrl: string
  private fetchFn: typeof fetch

  constructor(baseUrl: string, fetchFn?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "")
    // Bind fetch to window to avoid "Illegal invocation" error in browsers
    this.fetchFn = fetchFn ?? (typeof window !== "undefined" ? fetch.bind(window) : fetch)
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = getStoredToken()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const response = await this.fetchFn(`${this.baseUrl}/user${path}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error((data as ApiError).error || "Erro desconhecido")
    }

    return data as T
  }

  // ==================== AUTH ====================

  async status(): Promise<AuthStatus> {
    return this.request<AuthStatus>("/status")
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
    setStoredAuth(result.token, result.user)
    return result
  }

  async register(username: string, password: string): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>("/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
    setStoredAuth(result.token, result.user)
    return result
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ success: boolean }>("/logout", { method: "POST" })
    } finally {
      clearStoredAuth()
    }
  }

  async getPublicUsers(): Promise<{ id: string; username: string; role: UserRole }[]> {
    return this.request("/users/public")
  }

  // ==================== CURRENT USER ====================

  async me(): Promise<PublicUser> {
    return this.request<PublicUser>("/me")
  }

  async myPermissions(): Promise<UserPermissions> {
    return this.request<UserPermissions>("/me/permissions")
  }

  async updateMySettings(settings: Partial<UserSettings>): Promise<PublicUser> {
    const user = await this.request<PublicUser>("/me/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    })
    // Atualizar usuario armazenado
    const token = getStoredToken()
    if (token) {
      setStoredAuth(token, user)
    }
    return user
  }

  // ==================== USERS CRUD ====================

  async listUsers(): Promise<PublicUser[]> {
    return this.request<PublicUser[]>("/users")
  }

  async getUser(userId: string): Promise<PublicUser> {
    return this.request<PublicUser>(`/users/${userId}`)
  }

  async createUser(data: {
    username: string
    password: string
    role?: UserRole
    accessLevelId?: string | null
  }): Promise<PublicUser> {
    return this.request<PublicUser>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateUser(
    userId: string,
    data: {
      username?: string
      role?: UserRole
      accessLevelId?: string | null
      isActive?: boolean
      settings?: Partial<UserSettings>
    }
  ): Promise<PublicUser> {
    return this.request<PublicUser>(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request<{ success: boolean }>(`/users/${userId}`, {
      method: "DELETE",
    })
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await this.request<{ success: boolean }>(`/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    })
  }

  // ==================== ACCESS LEVELS CRUD ====================

  async listAccessLevels(): Promise<AccessLevel[]> {
    return this.request<AccessLevel[]>("/access-levels")
  }

  async getAccessLevel(id: string): Promise<AccessLevel> {
    return this.request<AccessLevel>(`/access-levels/${id}`)
  }

  async createAccessLevel(data: {
    name: string
    description?: string
    permissions: UserPermissions
  }): Promise<AccessLevel> {
    return this.request<AccessLevel>("/access-levels", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateAccessLevel(
    id: string,
    data: {
      name?: string
      description?: string
      permissions?: Partial<UserPermissions>
    }
  ): Promise<AccessLevel> {
    return this.request<AccessLevel>(`/access-levels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteAccessLevel(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/access-levels/${id}`, {
      method: "DELETE",
    })
  }
}

// ==================== SINGLETON ====================

let _client: UserApiClient | null = null

export function getUserApiClient(baseUrl?: string): UserApiClient {
  if (!_client && baseUrl) {
    _client = new UserApiClient(baseUrl)
  }
  if (!_client) {
    throw new Error("UserApiClient not initialized. Call getUserApiClient(baseUrl) first.")
  }
  return _client
}

export function initUserApiClient(baseUrl: string, fetchFn?: typeof fetch): UserApiClient {
  _client = new UserApiClient(baseUrl, fetchFn)
  return _client
}
