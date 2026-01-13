/**
 * Integration Credentials Management
 * 
 * Gerencia credenciais de integrações externas (Confirm8, RDStation, etc.)
 * Apenas usuários master podem gerenciar credenciais.
 */

import { z } from "zod"
import { Log } from "../util/log"
import { Global } from "../global"
import path from "path"
import fs from "fs/promises"
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

const log = Log.create({ service: "integration" })

// Encryption key derivation from a secret
const ENCRYPTION_SECRET = process.env.SUATEC_ENCRYPTION_SECRET || "suatec-default-secret-change-in-production"
const ENCRYPTION_KEY = scryptSync(ENCRYPTION_SECRET, "salt", 32)
const ALGORITHM = "aes-256-gcm"

export namespace Integration {
  // ==================== TIPOS ====================

  export const IntegrationType = z.enum([
    "confirm8",
    "rdstation", 
    "openai",
    "anthropic",
    "custom"
  ])
  export type IntegrationType = z.infer<typeof IntegrationType>

  export const CredentialField = z.object({
    key: z.string(),
    value: z.string(),
    encrypted: z.boolean().default(true),
  })
  export type CredentialField = z.infer<typeof CredentialField>

  export const IntegrationCredential = z.object({
    id: z.string(),
    type: IntegrationType,
    name: z.string(),
    description: z.string().default(""),
    credentials: z.array(CredentialField),
    isActive: z.boolean().default(true),
    createdAt: z.number(),
    updatedAt: z.number(),
    createdBy: z.string(),
  })
  export type IntegrationCredential = z.infer<typeof IntegrationCredential>

  // Storage structure
  interface IntegrationStorage {
    integrations: IntegrationCredential[]
  }

  // ==================== ENCRYPTION ====================

  function encrypt(text: string): string {
    const iv = randomBytes(16)
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")
    const authTag = cipher.getAuthTag()
    return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted
  }

  function decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(":")
      if (parts.length !== 3) return encryptedText // Not encrypted
      
      const iv = Buffer.from(parts[0], "hex")
      const authTag = Buffer.from(parts[1], "hex")
      const encrypted = parts[2]
      
      const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")
      return decrypted
    } catch {
      return encryptedText // Return as-is if decryption fails
    }
  }

  // ==================== STORAGE ====================

  async function getStoragePath(): Promise<string> {
    const dir = path.join(Global.Path.data, "integrations")
    await fs.mkdir(dir, { recursive: true })
    return path.join(dir, "credentials.json")
  }

  async function loadStorage(): Promise<IntegrationStorage> {
    try {
      const filePath = await getStoragePath()
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data)
    } catch {
      return { integrations: [] }
    }
  }

  async function saveStorage(storage: IntegrationStorage): Promise<void> {
    const filePath = await getStoragePath()
    await fs.writeFile(filePath, JSON.stringify(storage, null, 2))
  }

  // ==================== API ====================

  /**
   * Lista todas as integrações (sem valores de credenciais)
   */
  export async function list(): Promise<Array<Omit<IntegrationCredential, "credentials"> & { credentials: Array<{ key: string; hasValue: boolean }> }>> {
    const storage = await loadStorage()
    return storage.integrations.map(int => ({
      ...int,
      credentials: int.credentials.map(c => ({
        key: c.key,
        hasValue: !!c.value,
      })),
    }))
  }

  /**
   * Obtém uma integração específica (sem valores de credenciais para segurança)
   */
  export async function get(id: string): Promise<IntegrationCredential | undefined> {
    const storage = await loadStorage()
    const integration = storage.integrations.find(i => i.id === id)
    if (!integration) return undefined
    
    // Return with masked credentials
    return {
      ...integration,
      credentials: integration.credentials.map(c => ({
        ...c,
        value: c.value ? "********" : "",
      })),
    }
  }

  /**
   * Cria uma nova integração
   */
  export async function create(input: {
    type: IntegrationType
    name: string
    description?: string
    credentials: Array<{ key: string; value: string }>
    createdBy: string
  }): Promise<IntegrationCredential> {
    const storage = await loadStorage()
    
    const id = `int_${Date.now().toString(36)}${randomBytes(4).toString("hex")}`
    const now = Date.now()
    
    const integration: IntegrationCredential = {
      id,
      type: input.type,
      name: input.name,
      description: input.description || "",
      credentials: input.credentials.map(c => ({
        key: c.key,
        value: encrypt(c.value),
        encrypted: true,
      })),
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    }
    
    storage.integrations.push(integration)
    await saveStorage(storage)
    
    log.info("Integration created", { id, type: input.type, name: input.name })
    
    return {
      ...integration,
      credentials: integration.credentials.map(c => ({
        ...c,
        value: "********",
      })),
    }
  }

  /**
   * Atualiza uma integração existente
   */
  export async function update(
    id: string,
    input: {
      name?: string
      description?: string
      credentials?: Array<{ key: string; value: string }>
      isActive?: boolean
    }
  ): Promise<IntegrationCredential | undefined> {
    const storage = await loadStorage()
    const index = storage.integrations.findIndex(i => i.id === id)
    if (index === -1) return undefined
    
    const integration = storage.integrations[index]
    
    if (input.name !== undefined) integration.name = input.name
    if (input.description !== undefined) integration.description = input.description
    if (input.isActive !== undefined) integration.isActive = input.isActive
    if (input.credentials) {
      integration.credentials = input.credentials.map(c => ({
        key: c.key,
        value: encrypt(c.value),
        encrypted: true,
      }))
    }
    integration.updatedAt = Date.now()
    
    storage.integrations[index] = integration
    await saveStorage(storage)
    
    log.info("Integration updated", { id })
    
    return {
      ...integration,
      credentials: integration.credentials.map(c => ({
        ...c,
        value: "********",
      })),
    }
  }

  /**
   * Remove uma integração
   */
  export async function remove(id: string): Promise<boolean> {
    const storage = await loadStorage()
    const index = storage.integrations.findIndex(i => i.id === id)
    if (index === -1) return false
    
    storage.integrations.splice(index, 1)
    await saveStorage(storage)
    
    log.info("Integration removed", { id })
    return true
  }

  /**
   * Obtém credenciais decriptografadas para uso interno (tools)
   * NUNCA expor via API!
   */
  export async function getCredentials(type: IntegrationType): Promise<Record<string, string> | undefined> {
    const storage = await loadStorage()
    const integration = storage.integrations.find(i => i.type === type && i.isActive)
    
    if (!integration) {
      log.debug("No active integration found", { type })
      return undefined
    }
    
    const result: Record<string, string> = {}
    for (const cred of integration.credentials) {
      result[cred.key] = cred.encrypted ? decrypt(cred.value) : cred.value
    }
    
    return result
  }

  /**
   * Obtém credenciais do Confirm8
   */
  export async function getConfirm8Credentials(): Promise<{ bearerToken: string; apiKey: string; apiDomain: string } | undefined> {
    // First check environment variables (backward compatibility)
    const envBearer = process.env.CONFIRM8_BEARER_TOKEN
    const envApiKey = process.env.CONFIRM8_APIKEY_TOKEN
    const envDomain = process.env.CONFIRM8_API_DOMAIN
    
    if (envBearer && envApiKey) {
      return { bearerToken: envBearer, apiKey: envApiKey, apiDomain: envDomain || "suatec" }
    }
    
    // Then check stored credentials
    const creds = await getCredentials("confirm8")
    if (!creds) return undefined
    
    const bearerToken = creds["CONFIRM8_BEARER_TOKEN"] || creds["bearerToken"]
    const apiKey = creds["CONFIRM8_APIKEY_TOKEN"] || creds["apiKey"]
    const apiDomain = creds["CONFIRM8_API_DOMAIN"] || creds["apiDomain"] || "suatec"
    
    if (!bearerToken || !apiKey) return undefined
    
    return { bearerToken, apiKey, apiDomain }
  }

  /**
   * Obtém credenciais do RDStation
   */
  export async function getRDStationCredentials(): Promise<{ accessToken: string } | undefined> {
    // First check environment variables
    const envToken = process.env.RDSTATION_ACCESS_TOKEN
    
    if (envToken) {
      return { accessToken: envToken }
    }
    
    // Then check stored credentials
    const creds = await getCredentials("rdstation")
    if (!creds) return undefined
    
    const accessToken = creds["RDSTATION_ACCESS_TOKEN"] || creds["accessToken"]
    
    if (!accessToken) return undefined
    
    return { accessToken }
  }

  // ==================== PREDEFINED TEMPLATES ====================

  export const Templates: Record<IntegrationType, { name: string; fields: string[] }> = {
    confirm8: {
      name: "Confirm8",
      fields: ["CONFIRM8_BEARER_TOKEN", "CONFIRM8_APIKEY_TOKEN", "CONFIRM8_API_DOMAIN"],
    },
    rdstation: {
      name: "RD Station",
      fields: ["RDSTATION_ACCESS_TOKEN"],
    },
    openai: {
      name: "OpenAI",
      fields: ["OPENAI_API_KEY"],
    },
    anthropic: {
      name: "Anthropic",
      fields: ["ANTHROPIC_API_KEY"],
    },
    custom: {
      name: "Custom",
      fields: [],
    },
  }

  export function getTemplate(type: IntegrationType) {
    return Templates[type]
  }
}
