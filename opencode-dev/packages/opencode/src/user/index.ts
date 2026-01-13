/**
 * User Storage Abstraction
 * Supports both JSON file storage (development) and PostgreSQL (production)
 */

import { z } from "zod"
import { Global } from "../global"
import { Log } from "../util/log"
import { Database } from "../database"
import path from "path"
import fs from "fs/promises"
import { createHash, randomBytes } from "crypto"

const log = Log.create({ service: "user" })

// ==================== TIPOS E SCHEMAS ====================

export namespace User {
  // Roles do sistema
  export const Role = z.enum(["master", "admin", "user"])
  export type Role = z.infer<typeof Role>

  // Permissoes de usuario
  export const Permissions = z.object({
    providers: z.array(z.string()).default([]),
    models: z.array(z.string()).default([]),
    agents: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    canCreateSessions: z.boolean().default(true),
    canArchiveSessions: z.boolean().default(false),
    canShareSessions: z.boolean().default(false),
    canAccessTerminal: z.boolean().default(false),
    canAccessFiles: z.boolean().default(false),
    canExecuteCommands: z.boolean().default(false),
    maxSessionsPerDay: z.number().default(10),
    maxMessagesPerSession: z.number().default(100),
  }).meta({ ref: "UserPermissions" })
  export type Permissions = z.infer<typeof Permissions>

  // Configuracoes de interface do usuario
  export const Settings = z.object({
    interfaceMode: z.enum(["developer", "standard"]).default("standard"),
    showTerminalByDefault: z.boolean().default(false),
    showTechnicalDetails: z.boolean().default(false),
    showDebugLogs: z.boolean().default(false),
  }).meta({ ref: "UserSettings" })
  export type Settings = z.infer<typeof Settings>

  // Nivel de acesso
  export const AccessLevel = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(""),
    permissions: Permissions,
    createdAt: z.number(),
    createdBy: z.string().nullable(),
  }).meta({ ref: "AccessLevel" })
  export type AccessLevel = z.infer<typeof AccessLevel>

  // Usuario
  export const Info = z.object({
    id: z.string(),
    username: z.string(),
    passwordHash: z.string(),
    role: Role,
    accessLevelId: z.string().nullable(),
    createdAt: z.number(),
    createdBy: z.string().nullable(),
    lastLoginAt: z.number().nullable(),
    isActive: z.boolean().default(true),
    settings: Settings,
  }).meta({ ref: "User" })
  export type Info = z.infer<typeof Info>

  // Usuario publico (sem senha)
  export const PublicInfo = Info.omit({ passwordHash: true }).meta({ ref: "PublicUser" })
  export type PublicInfo = z.infer<typeof PublicInfo>

  // Sessao de autenticacao
  export const Session = z.object({
    token: z.string(),
    userId: z.string(),
    createdAt: z.number(),
    expiresAt: z.number(),
  }).meta({ ref: "UserSession" })
  export type Session = z.infer<typeof Session>

  // Schemas de input
  export const LoginInput = z.object({
    username: z.string().min(3),
    password: z.string().min(4),
  })

  export const RegisterInput = z.object({
    username: z.string().min(3),
    password: z.string().min(4),
  })

  export const CreateUserInput = z.object({
    username: z.string().min(3),
    password: z.string().min(4),
    role: Role.default("user"),
    accessLevelId: z.string().nullable().default(null),
  })

  export const UpdateUserInput = z.object({
    username: z.string().min(3).optional(),
    role: Role.optional(),
    accessLevelId: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    settings: Settings.partial().optional(),
  })

  export const CreateAccessLevelInput = z.object({
    name: z.string().min(2),
    description: z.string().default(""),
    permissions: Permissions,
  })

  export const UpdateAccessLevelInput = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    permissions: Permissions.partial().optional(),
  })

  // ==================== CONSTANTES ====================

  export const DEFAULT_PERMISSIONS: Permissions = {
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

  export const FULL_PERMISSIONS: Permissions = {
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

  export const DEFAULT_SETTINGS: Settings = {
    interfaceMode: "standard",
    showTerminalByDefault: false,
    showTechnicalDetails: false,
    showDebugLogs: false,
  }

  export const DEVELOPER_SETTINGS: Settings = {
    interfaceMode: "developer",
    showTerminalByDefault: true,
    showTechnicalDetails: true,
    showDebugLogs: true,
  }

  // ==================== STORAGE ABSTRACTION ====================

  interface StorageData {
    users: Info[]
    accessLevels: AccessLevel[]
    sessions: Session[]
  }

  // JSON File Storage
  const filepath = path.join(Global.Path.data, "suatec-users.json")

  async function readJsonStorage(): Promise<StorageData> {
    try {
      const file = Bun.file(filepath)
      const exists = await file.exists()
      if (!exists) {
        return { users: [], accessLevels: [], sessions: [] }
      }
      const data = await file.json()
      return {
        users: data.users || [],
        accessLevels: data.accessLevels || [],
        sessions: data.sessions || [],
      }
    } catch (err) {
      log.warn("Failed to read JSON storage", { error: err })
      return { users: [], accessLevels: [], sessions: [] }
    }
  }

  async function writeJsonStorage(data: StorageData): Promise<void> {
    const file = Bun.file(filepath)
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(filepath, 0o600)
  }

  // ==================== HELPERS ====================

  function generateId(): string {
    return Date.now().toString(36) + randomBytes(8).toString("hex")
  }

  function hashPassword(password: string): string {
    return createHash("sha256").update(password).digest("hex")
  }

  function generateToken(): string {
    return randomBytes(32).toString("hex")
  }

  function toPublic(user: Info): PublicInfo {
    const { passwordHash, ...publicUser } = user
    return publicUser
  }

  // Convert PostgreSQL row to User.Info
  function rowToUser(row: any): Info {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role,
      accessLevelId: row.access_level_id,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: row.created_by,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : null,
      isActive: row.is_active,
      settings: row.settings || DEFAULT_SETTINGS,
    }
  }

  // Convert PostgreSQL row to AccessLevel
  function rowToAccessLevel(row: any): AccessLevel {
    return {
      id: row.id,
      name: row.name,
      description: row.description || "",
      permissions: row.permissions || DEFAULT_PERMISSIONS,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: row.created_by,
    }
  }

  // ==================== AUTENTICACAO ====================

  export async function login(input: z.infer<typeof LoginInput>): Promise<{ user: PublicInfo; token: string }> {
    const passwordHash = hashPassword(input.password)

    if (Database.isPostgresEnabled() && Database.connected()) {
      // PostgreSQL login
      const userRow = await Database.queryOne<any>(
        `SELECT u.*, us.settings 
         FROM users u 
         LEFT JOIN user_settings us ON u.id = us.user_id 
         WHERE LOWER(u.username) = LOWER($1)`,
        [input.username]
      )

      if (!userRow) {
        throw new Error("Usuario nao encontrado")
      }

      if (!userRow.is_active) {
        throw new Error("Usuario desativado. Contate o administrador.")
      }

      if (userRow.password_hash !== passwordHash) {
        throw new Error("Senha incorreta")
      }

      // Update last login
      await Database.query(
        `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
        [userRow.id]
      )

      // Create token (store in memory for now, could use Redis)
      const token = generateToken()
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days

      // Store session in memory cache (could use Redis in production)
      await storeSession({ token, userId: userRow.id, createdAt: Date.now(), expiresAt })

      const user = rowToUser(userRow)
      log.info("User logged in (PostgreSQL)", { userId: user.id, username: user.username })

      return { user: toPublic(user), token }
    } else {
      // JSON file login
      const storage = await readJsonStorage()
      const user = storage.users.find(
        (u) => u.username.toLowerCase() === input.username.toLowerCase()
      )

      if (!user) {
        throw new Error("Usuario nao encontrado")
      }

      if (!user.isActive) {
        throw new Error("Usuario desativado. Contate o administrador.")
      }

      if (user.passwordHash !== passwordHash) {
        throw new Error("Senha incorreta")
      }

      // Update last login
      user.lastLoginAt = Date.now()

      // Create session
      const token = generateToken()
      const session: Session = {
        token,
        userId: user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }

      // Clean expired sessions
      storage.sessions = storage.sessions.filter((s) => s.expiresAt > Date.now())
      storage.sessions.push(session)

      await writeJsonStorage(storage)

      log.info("User logged in (JSON)", { userId: user.id, username: user.username })

      return { user: toPublic(user), token }
    }
  }

  export async function register(input: z.infer<typeof RegisterInput>): Promise<{ user: PublicInfo; token: string }> {
    const passwordHash = hashPassword(input.password)

    if (Database.isPostgresEnabled() && Database.connected()) {
      // PostgreSQL register
      const existingUser = await Database.queryOne<any>(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
        [input.username]
      )

      if (existingUser) {
        throw new Error("Usuario ja existe")
      }

      // Check if first user
      const userCount = await Database.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      )
      const isFirstUser = parseInt(userCount?.count || "0") === 0

      const userId = generateId()
      const role = isFirstUser ? "master" : "user"
      const settings = isFirstUser ? DEVELOPER_SETTINGS : DEFAULT_SETTINGS

      await Database.query(
        `INSERT INTO users (id, username, password_hash, role, is_active, created_at, last_login_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())`,
        [userId, input.username, passwordHash, role]
      )

      // Insert settings
      await Database.query(
        `INSERT INTO user_settings (id, user_id, settings) VALUES ($1, $2, $3)`,
        [generateId(), userId, JSON.stringify(settings)]
      )

      // Create session
      const token = generateToken()
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000
      await storeSession({ token, userId, createdAt: Date.now(), expiresAt })

      const newUser: Info = {
        id: userId,
        username: input.username,
        passwordHash,
        role,
        accessLevelId: null,
        createdAt: Date.now(),
        createdBy: null,
        lastLoginAt: Date.now(),
        isActive: true,
        settings,
      }

      log.info("User registered (PostgreSQL)", { userId, username: input.username, role })

      return { user: toPublic(newUser), token }
    } else {
      // JSON file register
      const storage = await readJsonStorage()

      const existingUser = storage.users.find(
        (u) => u.username.toLowerCase() === input.username.toLowerCase()
      )
      if (existingUser) {
        throw new Error("Usuario ja existe")
      }

      const isFirstUser = storage.users.length === 0

      const newUser: Info = {
        id: generateId(),
        username: input.username,
        passwordHash,
        role: isFirstUser ? "master" : "user",
        accessLevelId: null,
        createdAt: Date.now(),
        createdBy: null,
        lastLoginAt: Date.now(),
        isActive: true,
        settings: isFirstUser ? DEVELOPER_SETTINGS : DEFAULT_SETTINGS,
      }

      storage.users.push(newUser)

      // Create session
      const token = generateToken()
      const session: Session = {
        token,
        userId: newUser.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }
      storage.sessions.push(session)

      await writeJsonStorage(storage)

      log.info("User registered (JSON)", { userId: newUser.id, username: newUser.username, role: newUser.role })

      return { user: toPublic(newUser), token }
    }
  }

  // In-memory session storage (for both JSON and PostgreSQL modes)
  // In production with PostgreSQL, you might want to use Redis
  const sessionCache = new Map<string, Session>()

  async function storeSession(session: Session): Promise<void> {
    sessionCache.set(session.token, session)
  }

  async function getSession(token: string): Promise<Session | null> {
    // First check memory cache
    const cached = sessionCache.get(token)
    if (cached && cached.expiresAt > Date.now()) {
      return cached
    }

    // If not in cache and using JSON, check JSON storage
    if (!Database.isPostgresEnabled() || !Database.connected()) {
      const storage = await readJsonStorage()
      const session = storage.sessions.find((s) => s.token === token && s.expiresAt > Date.now())
      if (session) {
        sessionCache.set(token, session)
        return session
      }
    }

    return null
  }

  async function removeSession(token: string): Promise<void> {
    sessionCache.delete(token)
  }

  export async function logout(token: string): Promise<void> {
    await removeSession(token)

    if (!Database.isPostgresEnabled() || !Database.connected()) {
      const storage = await readJsonStorage()
      storage.sessions = storage.sessions.filter((s) => s.token !== token)
      await writeJsonStorage(storage)
    }

    log.info("User logged out")
  }

  export async function validateToken(token: string): Promise<PublicInfo | null> {
    const session = await getSession(token)
    if (!session) return null

    if (Database.isPostgresEnabled() && Database.connected()) {
      const userRow = await Database.queryOne<any>(
        `SELECT u.*, us.settings 
         FROM users u 
         LEFT JOIN user_settings us ON u.id = us.user_id 
         WHERE u.id = $1 AND u.is_active = TRUE`,
        [session.userId]
      )

      if (!userRow) return null
      return toPublic(rowToUser(userRow))
    } else {
      const storage = await readJsonStorage()
      const user = storage.users.find((u) => u.id === session.userId)
      if (!user || !user.isActive) return null
      return toPublic(user)
    }
  }

  // ==================== CRUD DE USUARIOS ====================

  export async function list(): Promise<PublicInfo[]> {
    if (Database.isPostgresEnabled() && Database.connected()) {
      const result = await Database.query<any>(
        `SELECT u.*, us.settings 
         FROM users u 
         LEFT JOIN user_settings us ON u.id = us.user_id 
         ORDER BY u.created_at DESC`
      )
      return result.rows.map((row) => toPublic(rowToUser(row)))
    } else {
      const storage = await readJsonStorage()
      return storage.users.map(toPublic)
    }
  }

  export async function get(userId: string): Promise<PublicInfo | null> {
    if (Database.isPostgresEnabled() && Database.connected()) {
      const row = await Database.queryOne<any>(
        `SELECT u.*, us.settings 
         FROM users u 
         LEFT JOIN user_settings us ON u.id = us.user_id 
         WHERE u.id = $1`,
        [userId]
      )
      return row ? toPublic(rowToUser(row)) : null
    } else {
      const storage = await readJsonStorage()
      const user = storage.users.find((u) => u.id === userId)
      return user ? toPublic(user) : null
    }
  }

  export async function create(
    input: z.infer<typeof CreateUserInput>,
    actorId: string
  ): Promise<PublicInfo> {
    // Validate actor permissions (same for both storage types)
    const actor = await get(actorId)
    if (!actor) {
      throw new Error("Usuario ator nao encontrado")
    }

    if (actor.role !== "master" && actor.role !== "admin") {
      throw new Error("Sem permissao para criar usuarios")
    }

    if ((input.role === "master" || input.role === "admin") && actor.role !== "master") {
      throw new Error("Apenas o usuario master pode criar administradores")
    }

    const passwordHash = hashPassword(input.password)

    if (Database.isPostgresEnabled() && Database.connected()) {
      // Check existing user
      const existingUser = await Database.queryOne<any>(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
        [input.username]
      )
      if (existingUser) {
        throw new Error("Usuario ja existe")
      }

      // Validate access level
      if (input.role === "user" && input.accessLevelId) {
        const accessLevel = await Database.queryOne<any>(
          `SELECT id FROM access_levels WHERE id = $1`,
          [input.accessLevelId]
        )
        if (!accessLevel) {
          throw new Error("Nivel de acesso nao encontrado")
        }
      }

      const userId = generateId()
      const settings = input.role === "master" || input.role === "admin" ? DEVELOPER_SETTINGS : DEFAULT_SETTINGS

      await Database.query(
        `INSERT INTO users (id, username, password_hash, role, access_level_id, is_active, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), $6)`,
        [userId, input.username, passwordHash, input.role, input.role === "user" ? input.accessLevelId : null, actorId]
      )

      await Database.query(
        `INSERT INTO user_settings (id, user_id, settings) VALUES ($1, $2, $3)`,
        [generateId(), userId, JSON.stringify(settings)]
      )

      log.info("User created (PostgreSQL)", { userId, username: input.username, createdBy: actorId })

      return (await get(userId))!
    } else {
      const storage = await readJsonStorage()

      const existingUser = storage.users.find(
        (u) => u.username.toLowerCase() === input.username.toLowerCase()
      )
      if (existingUser) {
        throw new Error("Usuario ja existe")
      }

      if (input.role === "user" && input.accessLevelId) {
        const accessLevel = storage.accessLevels.find((a) => a.id === input.accessLevelId)
        if (!accessLevel) {
          throw new Error("Nivel de acesso nao encontrado")
        }
      }

      const newUser: Info = {
        id: generateId(),
        username: input.username,
        passwordHash,
        role: input.role,
        accessLevelId: input.role === "user" ? input.accessLevelId : null,
        createdAt: Date.now(),
        createdBy: actorId,
        lastLoginAt: null,
        isActive: true,
        settings: input.role === "master" || input.role === "admin" ? DEVELOPER_SETTINGS : DEFAULT_SETTINGS,
      }

      storage.users.push(newUser)
      await writeJsonStorage(storage)

      log.info("User created (JSON)", { userId: newUser.id, username: newUser.username, createdBy: actorId })

      return toPublic(newUser)
    }
  }

  export async function update(
    userId: string,
    input: z.infer<typeof UpdateUserInput>,
    actorId: string
  ): Promise<PublicInfo> {
    const actor = await get(actorId)
    if (!actor) {
      throw new Error("Usuario ator nao encontrado")
    }

    // Allow users to update their own settings
    const isSelfUpdate = userId === actorId && input.settings && !input.role && !input.username && input.isActive === undefined && input.accessLevelId === undefined

    if (!isSelfUpdate && actor.role !== "master" && actor.role !== "admin") {
      throw new Error("Sem permissao para editar usuarios")
    }

    if (Database.isPostgresEnabled() && Database.connected()) {
      const userRow = await Database.queryOne<any>(
        `SELECT * FROM users WHERE id = $1`,
        [userId]
      )
      if (!userRow) {
        throw new Error("Usuario nao encontrado")
      }

      // Permission checks
      if (userId === actorId && (input.role !== undefined || input.isActive === false)) {
        throw new Error("Nao e possivel alterar seu proprio nivel ou desativar sua conta")
      }

      if ((userRow.role === "master" || userRow.role === "admin") && actor.role !== "master") {
        throw new Error("Apenas o usuario master pode editar administradores")
      }

      if (input.role && (input.role === "master" || input.role === "admin") && actor.role !== "master") {
        throw new Error("Apenas o usuario master pode promover para administrador")
      }

      // Username uniqueness check
      if (input.username) {
        const existingUser = await Database.queryOne<any>(
          `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2`,
          [input.username, userId]
        )
        if (existingUser) {
          throw new Error("Nome de usuario ja existe")
        }
      }

      // Build update query
      const updates: string[] = []
      const params: any[] = []
      let paramIndex = 1

      if (input.username !== undefined) {
        updates.push(`username = $${paramIndex++}`)
        params.push(input.username)
      }
      if (input.role !== undefined) {
        updates.push(`role = $${paramIndex++}`)
        params.push(input.role)
      }
      if (input.accessLevelId !== undefined) {
        updates.push(`access_level_id = $${paramIndex++}`)
        params.push(input.accessLevelId)
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        params.push(input.isActive)
      }

      if (updates.length > 0) {
        params.push(userId)
        await Database.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
          params
        )
      }

      // Update settings separately
      if (input.settings) {
        const currentSettings = await Database.queryOne<any>(
          `SELECT settings FROM user_settings WHERE user_id = $1`,
          [userId]
        )
        const newSettings = { ...(currentSettings?.settings || DEFAULT_SETTINGS), ...input.settings }
        
        if (currentSettings) {
          await Database.query(
            `UPDATE user_settings SET settings = $1 WHERE user_id = $2`,
            [JSON.stringify(newSettings), userId]
          )
        } else {
          await Database.query(
            `INSERT INTO user_settings (id, user_id, settings) VALUES ($1, $2, $3)`,
            [generateId(), userId, JSON.stringify(newSettings)]
          )
        }
      }

      log.info("User updated (PostgreSQL)", { userId, updatedBy: actorId })

      return (await get(userId))!
    } else {
      const storage = await readJsonStorage()

      const userIndex = storage.users.findIndex((u) => u.id === userId)
      if (userIndex === -1) {
        throw new Error("Usuario nao encontrado")
      }

      const targetUser = storage.users[userIndex]

      if (userId === actorId && (input.role !== undefined || input.isActive === false)) {
        throw new Error("Nao e possivel alterar seu proprio nivel ou desativar sua conta")
      }

      if ((targetUser.role === "master" || targetUser.role === "admin") && actor.role !== "master") {
        throw new Error("Apenas o usuario master pode editar administradores")
      }

      if (input.role && (input.role === "master" || input.role === "admin") && actor.role !== "master") {
        throw new Error("Apenas o usuario master pode promover para administrador")
      }

      if (input.username) {
        const existingUser = storage.users.find(
          (u) => u.username.toLowerCase() === input.username!.toLowerCase() && u.id !== userId
        )
        if (existingUser) {
          throw new Error("Nome de usuario ja existe")
        }
      }

      if (input.username !== undefined) targetUser.username = input.username
      if (input.role !== undefined) targetUser.role = input.role
      if (input.accessLevelId !== undefined) targetUser.accessLevelId = input.accessLevelId
      if (input.isActive !== undefined) targetUser.isActive = input.isActive
      if (input.settings !== undefined) {
        targetUser.settings = { ...targetUser.settings, ...input.settings }
      }

      storage.users[userIndex] = targetUser
      await writeJsonStorage(storage)

      log.info("User updated (JSON)", { userId, updatedBy: actorId })

      return toPublic(targetUser)
    }
  }

  export async function remove(userId: string, actorId: string): Promise<void> {
    const actor = await get(actorId)
    if (!actor) {
      throw new Error("Usuario ator nao encontrado")
    }

    if (actor.role !== "master" && actor.role !== "admin") {
      throw new Error("Sem permissao para excluir usuarios")
    }

    if (userId === actorId) {
      throw new Error("Nao e possivel excluir sua propria conta")
    }

    const targetUser = await get(userId)
    if (!targetUser) {
      throw new Error("Usuario nao encontrado")
    }

    if ((targetUser.role === "master" || targetUser.role === "admin") && actor.role !== "master") {
      throw new Error("Apenas o usuario master pode excluir administradores")
    }

    if (Database.isPostgresEnabled() && Database.connected()) {
      // Check if last master
      if (targetUser.role === "master") {
        const masterCount = await Database.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM users WHERE role = 'master'`
        )
        if (parseInt(masterCount?.count || "0") <= 1) {
          throw new Error("Nao e possivel excluir o unico usuario master")
        }
      }

      await Database.query(`DELETE FROM user_settings WHERE user_id = $1`, [userId])
      await Database.query(`DELETE FROM users WHERE id = $1`, [userId])

      log.info("User deleted (PostgreSQL)", { userId, deletedBy: actorId })
    } else {
      const storage = await readJsonStorage()

      if (targetUser.role === "master") {
        const masterCount = storage.users.filter((u) => u.role === "master").length
        if (masterCount <= 1) {
          throw new Error("Nao e possivel excluir o unico usuario master")
        }
      }

      storage.users = storage.users.filter((u) => u.id !== userId)
      storage.sessions = storage.sessions.filter((s) => s.userId !== userId)
      await writeJsonStorage(storage)

      log.info("User deleted (JSON)", { userId, deletedBy: actorId })
    }
  }

  export async function resetPassword(
    userId: string,
    newPassword: string,
    actorId: string
  ): Promise<void> {
    const actor = await get(actorId)
    if (!actor) {
      throw new Error("Usuario ator nao encontrado")
    }

    if (actor.role !== "master" && actor.role !== "admin") {
      throw new Error("Sem permissao para redefinir senhas")
    }

    if (newPassword.length < 4) {
      throw new Error("Senha deve ter pelo menos 4 caracteres")
    }

    const targetUser = await get(userId)
    if (!targetUser) {
      throw new Error("Usuario nao encontrado")
    }

    if ((targetUser.role === "master" || targetUser.role === "admin") && actor.role !== "master") {
      throw new Error("Apenas o usuario master pode redefinir senha de administradores")
    }

    const passwordHash = hashPassword(newPassword)

    if (Database.isPostgresEnabled() && Database.connected()) {
      await Database.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, userId]
      )
      log.info("Password reset (PostgreSQL)", { userId, resetBy: actorId })
    } else {
      const storage = await readJsonStorage()
      const userIndex = storage.users.findIndex((u) => u.id === userId)
      if (userIndex !== -1) {
        storage.users[userIndex].passwordHash = passwordHash
        await writeJsonStorage(storage)
      }
      log.info("Password reset (JSON)", { userId, resetBy: actorId })
    }
  }

  // ==================== CRUD DE NIVEIS DE ACESSO ====================

  export async function listAccessLevels(): Promise<AccessLevel[]> {
    if (Database.isPostgresEnabled() && Database.connected()) {
      const result = await Database.query<any>(
        `SELECT * FROM access_levels ORDER BY created_at DESC`
      )
      return result.rows.map(rowToAccessLevel)
    } else {
      const storage = await readJsonStorage()
      return storage.accessLevels
    }
  }

  export async function getAccessLevel(id: string): Promise<AccessLevel | null> {
    if (Database.isPostgresEnabled() && Database.connected()) {
      const row = await Database.queryOne<any>(
        `SELECT * FROM access_levels WHERE id = $1`,
        [id]
      )
      return row ? rowToAccessLevel(row) : null
    } else {
      const storage = await readJsonStorage()
      return storage.accessLevels.find((a) => a.id === id) || null
    }
  }

  export async function createAccessLevel(
    input: z.infer<typeof CreateAccessLevelInput>,
    actorId: string
  ): Promise<AccessLevel> {
    const actor = await get(actorId)
    if (!actor || actor.role !== "master") {
      throw new Error("Apenas o usuario master pode criar niveis de acesso")
    }

    if (Database.isPostgresEnabled() && Database.connected()) {
      const existingLevel = await Database.queryOne<any>(
        `SELECT id FROM access_levels WHERE LOWER(name) = LOWER($1)`,
        [input.name]
      )
      if (existingLevel) {
        throw new Error("Ja existe um nivel de acesso com este nome")
      }

      const levelId = generateId()

      await Database.query(
        `INSERT INTO access_levels (id, name, description, permissions, created_at, created_by)
         VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [levelId, input.name, input.description, JSON.stringify(input.permissions), actorId]
      )

      log.info("Access level created (PostgreSQL)", { id: levelId, name: input.name })

      return (await getAccessLevel(levelId))!
    } else {
      const storage = await readJsonStorage()

      const existingLevel = storage.accessLevels.find(
        (a) => a.name.toLowerCase() === input.name.toLowerCase()
      )
      if (existingLevel) {
        throw new Error("Ja existe um nivel de acesso com este nome")
      }

      const newAccessLevel: AccessLevel = {
        id: generateId(),
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        createdAt: Date.now(),
        createdBy: actorId,
      }

      storage.accessLevels.push(newAccessLevel)
      await writeJsonStorage(storage)

      log.info("Access level created (JSON)", { id: newAccessLevel.id, name: newAccessLevel.name })

      return newAccessLevel
    }
  }

  export async function updateAccessLevel(
    id: string,
    input: z.infer<typeof UpdateAccessLevelInput>,
    actorId: string
  ): Promise<AccessLevel> {
    const actor = await get(actorId)
    if (!actor || actor.role !== "master") {
      throw new Error("Apenas o usuario master pode editar niveis de acesso")
    }

    if (Database.isPostgresEnabled() && Database.connected()) {
      const level = await getAccessLevel(id)
      if (!level) {
        throw new Error("Nivel de acesso nao encontrado")
      }

      if (input.name) {
        const existingLevel = await Database.queryOne<any>(
          `SELECT id FROM access_levels WHERE LOWER(name) = LOWER($1) AND id != $2`,
          [input.name, id]
        )
        if (existingLevel) {
          throw new Error("Ja existe um nivel de acesso com este nome")
        }
      }

      const updates: string[] = []
      const params: any[] = []
      let paramIndex = 1

      if (input.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        params.push(input.name)
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        params.push(input.description)
      }
      if (input.permissions !== undefined) {
        const newPermissions = { ...level.permissions, ...input.permissions }
        updates.push(`permissions = $${paramIndex++}`)
        params.push(JSON.stringify(newPermissions))
      }

      if (updates.length > 0) {
        params.push(id)
        await Database.query(
          `UPDATE access_levels SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
          params
        )
      }

      log.info("Access level updated (PostgreSQL)", { id, updatedBy: actorId })

      return (await getAccessLevel(id))!
    } else {
      const storage = await readJsonStorage()

      const levelIndex = storage.accessLevels.findIndex((a) => a.id === id)
      if (levelIndex === -1) {
        throw new Error("Nivel de acesso nao encontrado")
      }

      if (input.name) {
        const existingLevel = storage.accessLevels.find(
          (a) => a.name.toLowerCase() === input.name!.toLowerCase() && a.id !== id
        )
        if (existingLevel) {
          throw new Error("Ja existe um nivel de acesso com este nome")
        }
      }

      const level = storage.accessLevels[levelIndex]
      if (input.name !== undefined) level.name = input.name
      if (input.description !== undefined) level.description = input.description
      if (input.permissions !== undefined) {
        level.permissions = { ...level.permissions, ...input.permissions }
      }

      storage.accessLevels[levelIndex] = level
      await writeJsonStorage(storage)

      log.info("Access level updated (JSON)", { id, updatedBy: actorId })

      return level
    }
  }

  export async function removeAccessLevel(id: string, actorId: string): Promise<void> {
    const actor = await get(actorId)
    if (!actor || actor.role !== "master") {
      throw new Error("Apenas o usuario master pode excluir niveis de acesso")
    }

    if (Database.isPostgresEnabled() && Database.connected()) {
      const level = await getAccessLevel(id)
      if (!level) {
        throw new Error("Nivel de acesso nao encontrado")
      }

      const usersUsingLevel = await Database.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE access_level_id = $1`,
        [id]
      )
      if (parseInt(usersUsingLevel?.count || "0") > 0) {
        throw new Error(`Nao e possivel excluir: ${usersUsingLevel!.count} usuario(s) estao usando este nivel`)
      }

      await Database.query(`DELETE FROM access_levels WHERE id = $1`, [id])

      log.info("Access level deleted (PostgreSQL)", { id, deletedBy: actorId })
    } else {
      const storage = await readJsonStorage()

      const level = storage.accessLevels.find((a) => a.id === id)
      if (!level) {
        throw new Error("Nivel de acesso nao encontrado")
      }

      const usersUsingLevel = storage.users.filter((u) => u.accessLevelId === id)
      if (usersUsingLevel.length > 0) {
        throw new Error(`Nao e possivel excluir: ${usersUsingLevel.length} usuario(s) estao usando este nivel`)
      }

      storage.accessLevels = storage.accessLevels.filter((a) => a.id !== id)
      await writeJsonStorage(storage)

      log.info("Access level deleted (JSON)", { id, deletedBy: actorId })
    }
  }

  // ==================== HELPERS DE PERMISSAO ====================

  export async function getUserPermissions(userId: string): Promise<Permissions> {
    const user = await get(userId)
    
    if (!user) return DEFAULT_PERMISSIONS
    
    // Master e Admin tem todas as permissoes
    if (user.role === "master" || user.role === "admin") {
      return FULL_PERMISSIONS
    }
    
    // Usuario normal: buscar nivel de acesso
    if (user.accessLevelId) {
      const accessLevel = await getAccessLevel(user.accessLevelId)
      if (accessLevel) return accessLevel.permissions
    }
    
    return DEFAULT_PERMISSIONS
  }

  export async function hasUsers(): Promise<boolean> {
    if (Database.isPostgresEnabled() && Database.connected()) {
      const result = await Database.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      )
      return parseInt(result?.count || "0") > 0
    } else {
      const storage = await readJsonStorage()
      return storage.users.length > 0
    }
  }

  // ==================== INICIALIZACAO ====================

  export async function initialize(): Promise<void> {
    // Try to connect to PostgreSQL if enabled
    if (Database.isPostgresEnabled()) {
      const connected = await Database.connect()
      if (connected) {
        log.info("User module initialized with PostgreSQL")
      } else {
        log.warn("PostgreSQL connection failed, falling back to JSON storage")
      }
    } else {
      log.info("User module initialized with JSON storage")
    }
  }
}
