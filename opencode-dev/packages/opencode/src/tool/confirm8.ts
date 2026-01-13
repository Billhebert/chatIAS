import z from "zod"
import { Tool } from "./tool"
import { Integration } from "../integration"

/**
 * Confirm8 API Native Tool
 * 
 * Consolidated tool for all Confirm8 API operations.
 * Supports: clients, users, tickets, tasks, services, items, 
 * wos (work orders), products, modalities, properties, auth
 */

const CONFIRM8_DEFAULT_URL = "https://api.confirm8.com/v3"

// Cache for credentials to avoid repeated lookups
let credentialsCache: { bearerToken: string; apiKey: string; apiDomain: string } | null = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1 minute

// Lazy validation - only when making API calls
async function getConfig(): Promise<{ baseUrl: string; bearerToken: string; apiDomain: string; apiKeyToken: string }> {
  // Check cache first
  if (credentialsCache && Date.now() - cacheTime < CACHE_TTL) {
    return {
      baseUrl: process.env.CONFIRM8_BASE_URL || CONFIRM8_DEFAULT_URL,
      bearerToken: credentialsCache.bearerToken,
      apiDomain: credentialsCache.apiDomain,
      apiKeyToken: credentialsCache.apiKey,
    }
  }

  // Try to get credentials from Integration storage
  const storedCreds = await Integration.getConfirm8Credentials()
  
  if (storedCreds) {
    credentialsCache = storedCreds
    cacheTime = Date.now()
    return {
      baseUrl: process.env.CONFIRM8_BASE_URL || CONFIRM8_DEFAULT_URL,
      bearerToken: storedCreds.bearerToken,
      apiDomain: storedCreds.apiDomain,
      apiKeyToken: storedCreds.apiKey,
    }
  }

  // Fallback to environment variables
  const bearerToken = process.env.CONFIRM8_BEARER_TOKEN
  const apiKeyToken = process.env.CONFIRM8_APIKEY_TOKEN
  const apiDomain = process.env.CONFIRM8_API_DOMAIN || "suatec"
  
  const missing: string[] = []
  if (!bearerToken) missing.push("CONFIRM8_BEARER_TOKEN")
  if (!apiKeyToken) missing.push("CONFIRM8_APIKEY_TOKEN")
  
  if (missing.length > 0) {
    throw new Error(
      `Faltam as credenciais do Confirm8. Configure no painel de administração (Integrações) ou defina as variáveis de ambiente: ${missing.join(", ")}`
    )
  }
  
  return {
    baseUrl: process.env.CONFIRM8_BASE_URL || CONFIRM8_DEFAULT_URL,
    bearerToken: bearerToken!,
    apiDomain: apiDomain,
    apiKeyToken: apiKeyToken!,
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const config = await getConfig()
  return {
    "Authorization": `Bearer ${config.bearerToken}`,
    "X-API-DOMAIN": config.apiDomain,
    "X-APIKEY-TOKEN": config.apiKeyToken,
    "Content-Type": "application/json",
  }
}

function handleError(error: any, action: string): string {
  if (error.response) {
    return JSON.stringify({
      success: false,
      status: error.response.status,
      action,
      message: error.response.data?.message || `Failed to ${action}`,
      error: error.response.data
    })
  }
  return JSON.stringify({
    success: false,
    action,
    message: `Connection error: ${error.message}`
  })
}

const DESCRIPTION = `Confirm8 API tool for managing field service operations (HVAC).

Resources available:
- clients: Customer companies (create, list, get, update, activate, deactivate)
- users: Technicians and admins (create, list, get, update, activate, deactivate, getTasks, getTickets, linkTasks, unlinkTasks, unlinkAllTasks, getPermissions, uploadPhoto, uploadSignature)
- tickets: Service calls/incidents (create, list, get, update, activateBatch, deactivateBatch)
- tasks: Maintenance checklists (create, list, get, update, activate, deactivate)
- services: Service types (create, list, get, update, activate, deactivate)
- items: Equipment/AC units (createItem, listItems, getItem, updateItem, activateItem, deactivateItem, createItemType, listItemTypes, getItemType, updateItemType, activateItemType, deactivateItemType)
- wos: Work orders (create, list, get, update, activate, deactivate)
- products: Parts and supplies (create, list, get, update, activate, deactivate)
- modalities: Service types (create, list, get, update, activate, deactivate)
- properties: Custom fields (create, list, get, update, activate, deactivate)
- auth: Authentication check (check)

Common patterns:
- All list operations return arrays
- activate/deactivate for soft delete
- Batch operations available for tickets`

export const Confirm8Tool = Tool.define("confirm8", {
  description: DESCRIPTION,
  parameters: z.object({
    resource: z.enum([
      "clients", "users", "tickets", "tasks", "services", 
      "items", "wos", "products", "modalities", "properties", "auth"
    ]).describe("The Confirm8 resource to operate on"),
    action: z.string().default("list").describe("The action to perform (varies by resource)"),
    id: z.string().optional().describe("Resource ID (for get/update/activate/deactivate)"),
    secondary_id: z.string().optional().describe("Secondary ID (e.g., task_id, item_type_id)"),
    username: z.string().optional().describe("Username (for user create/get)"),
    password: z.string().optional().describe("Password (for user create)"),
    name: z.string().optional().describe("Name field"),
    email: z.string().optional().describe("Email field"),
    phone: z.string().optional().describe("Phone field"),
    content: z.string().optional().describe("Content/description (for tickets)"),
    ids: z.string().optional().describe("JSON array of IDs (for batch operations)"),
    tasks_json: z.string().optional().describe("JSON array of tasks for linkTasks"),
    image_url: z.string().optional().describe("Image URL for photo/signature upload"),
    filters: z.string().optional().describe("JSON string with filter parameters"),
    data: z.string().optional().describe("JSON string with entity data for create/update"),
  }),
  async execute(params, ctx) {
    const { 
      resource, 
      action, 
      id, 
      secondary_id,
      username,
      password,
      name,
      email,
      phone,
      content,
      ids,
      tasks_json,
      image_url,
      filters: filtersStr,
      data: dataStr 
    } = params

    try {
      let filters: Record<string, any> = {}
      let data: Record<string, any> = {}
      
      if (filtersStr) {
        try { filters = JSON.parse(filtersStr) } catch { /* ignore */ }
      }
      if (dataStr) {
        try { data = JSON.parse(dataStr) } catch { /* ignore */ }
      }

      // Merge common fields into data
      if (name) data.name = name
      if (email) data.email = email
      if (phone) data.phone = phone
      if (content) data.content = content

      let result: any

      switch (resource) {
        case "clients":
          result = await handleClients(action, id, data, filters)
          break
        case "users":
          result = await handleUsers(action, id, username, password, secondary_id, tasks_json, image_url, data, filters)
          break
        case "tickets":
          result = await handleTickets(action, id, ids, data, filters)
          break
        case "tasks":
          result = await handleTasks(action, id, data, filters)
          break
        case "services":
          result = await handleServices(action, id, data, filters)
          break
        case "items":
          result = await handleItems(action, id, secondary_id, data, filters)
          break
        case "wos":
          result = await handleWos(action, id, data, filters)
          break
        case "products":
          result = await handleProducts(action, id, data, filters)
          break
        case "modalities":
          result = await handleModalities(action, id, data, filters)
          break
        case "properties":
          result = await handleProperties(action, id, data, filters)
          break
        case "auth":
          result = await handleAuth(action)
          break
        default:
          result = { success: false, message: `Unknown resource: ${resource}` }
      }

      return {
        output: JSON.stringify(result, null, 2),
        title: `Confirm8 ${resource} ${action}`,
        metadata: { resource, action },
      }
    } catch (error: any) {
      return {
        output: handleError(error, `${resource}.${action}`),
        title: `Confirm8 ${resource} ${action} (error)`,
        metadata: { resource, action, error: true },
      }
    }
  },
})

// Helper for API requests
async function apiRequest(method: string, endpoint: string, body?: any, params?: any): Promise<any> {
  const config = await getConfig()
  const url = new URL(`${config.baseUrl}${endpoint}`)
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const options: RequestInit = {
    method,
    headers: await getAuthHeaders(),
  }
  if (body && method !== "GET") {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url.toString(), options)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw { response: { status: response.status, data: error } }
  }
  
  const text = await response.text()
  return text ? JSON.parse(text) : { success: true }
}

// Resource Handlers

async function handleClients(action: string, id: string | undefined, data: any, filters: any) {
  const config = await getConfig()
  
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Client name is required" }
      return { success: true, data: await apiRequest("POST", "/clients", data) }
    case "list":
      const listParams = { offset: 0, limit: 0, order: "asc", relations: "wos,items,headquarter,userGroup,properties", ...filters }
      return { success: true, data: await apiRequest("GET", "/clients", null, listParams) }
    case "get":
      if (!id) return { success: false, message: "client_id is required" }
      return { success: true, data: await apiRequest("GET", `/clients/${id}`, null, { relations: "wos,items,headquarter,userGroup,properties" }) }
    case "update":
      if (!id) return { success: false, message: "client_id is required" }
      return { success: true, data: await apiRequest("PUT", `/clients/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "client_id is required" }
      return { success: true, data: await apiRequest("PUT", `/clients/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "client_id is required" }
      return { success: true, data: await apiRequest("PUT", `/clients/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for clients: ${action}` }
  }
}

async function handleUsers(
  action: string, 
  id: string | undefined, 
  username: string | undefined,
  password: string | undefined,
  secondaryId: string | undefined,
  tasksJson: string | undefined,
  imageUrl: string | undefined,
  data: any, 
  filters: any
) {
  switch (action) {
    case "create":
      if (!username || !password) return { success: false, message: "username and password are required" }
      data.username = username
      data.password = password
      return { success: true, data: await apiRequest("POST", "/users", data) }
    case "list":
      const list = await apiRequest("GET", "/users", null, filters)
      return { success: true, count: Array.isArray(list) ? list.length : 0, data: list }
    case "get":
      const identifier = id || username
      if (!identifier) return { success: false, message: "user_id or username is required" }
      const isNumeric = !isNaN(parseInt(identifier))
      const endpoint = isNumeric ? `/users/${identifier}` : `/users/${identifier}/user`
      return { success: true, data: await apiRequest("GET", endpoint) }
    case "update":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("PUT", `/users/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("PUT", `/users/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("PUT", `/users/${id}/inactive`, { deleted: "Y" }) }
    case "getTasks":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("GET", `/users/${id}/tasks`) }
    case "getTickets":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("GET", `/users/${id}/tickets`) }
    case "linkTasks":
      if (!tasksJson) return { success: false, message: "tasks_json is required" }
      let tasks: any[]
      try { tasks = JSON.parse(tasksJson) } catch { return { success: false, message: "tasks_json must be valid JSON" } }
      return { success: true, data: await apiRequest("POST", "/users/link-tasks", { tasks }) }
    case "unlinkTasks":
      if (!id || !secondaryId) return { success: false, message: "user_id (id) and task_id (secondary_id) are required" }
      const employeeId = data.employee_id
      if (!employeeId) return { success: false, message: "employee_id is required in data" }
      return { success: true, data: await apiRequest("PUT", `/users/${id}/tasks/${secondaryId}`, { employee_id: employeeId }) }
    case "unlinkAllTasks":
      const empId = data.employee_id || id
      if (!empId) return { success: false, message: "employee_id is required" }
      return { success: true, data: await apiRequest("DELETE", `/users/${empId}/tasks`) }
    case "getPermissions":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("GET", `/users/${id}/permissions`) }
    case "uploadPhoto":
      if (!id || !imageUrl) return { success: false, message: "user_id and image_url are required" }
      return { success: true, data: await apiRequest("POST", `/users/${id}/photo`, { image_url: imageUrl }) }
    case "uploadSignature":
      if (!id || !imageUrl) return { success: false, message: "user_id and image_url are required" }
      return { success: true, data: await apiRequest("POST", `/users/${id}/signature`, { image_url: imageUrl }) }
    default:
      return { success: false, message: `Unknown action for users: ${action}` }
  }
}

async function handleTickets(action: string, id: string | undefined, ids: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      if (!data.content) return { success: false, message: "Ticket content is required" }
      return { success: true, data: await apiRequest("POST", "/tickets", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/tickets", null, filters) }
    case "get":
      if (!id) return { success: false, message: "ticket_id is required" }
      return { success: true, data: await apiRequest("GET", `/tickets/${id}`) }
    case "update":
      if (!id) return { success: false, message: "ticket_id is required" }
      return { success: true, data: await apiRequest("PUT", `/tickets/${id}`, data) }
    case "activateBatch":
      if (!ids) return { success: false, message: "ids (JSON array) is required" }
      let activateIds: string[]
      try { activateIds = JSON.parse(ids) } catch { activateIds = [ids] }
      return { success: true, data: await apiRequest("PUT", "/tickets/batch/active", { ids: activateIds, deleted: "N" }) }
    case "deactivateBatch":
      if (!ids) return { success: false, message: "ids (JSON array) is required" }
      let deactivateIds: string[]
      try { deactivateIds = JSON.parse(ids) } catch { deactivateIds = [ids] }
      return { success: true, data: await apiRequest("PUT", "/tickets/batch/inactive", { ids: deactivateIds, deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for tickets: ${action}` }
  }
}

async function handleTasks(action: string, id: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Task name is required" }
      return { success: true, data: await apiRequest("POST", "/tasks", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/tasks", null, filters) }
    case "get":
      if (!id) return { success: false, message: "task_id is required" }
      return { success: true, data: await apiRequest("GET", `/tasks/${id}`) }
    case "update":
      if (!id) return { success: false, message: "task_id is required" }
      return { success: true, data: await apiRequest("PUT", `/tasks/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "task_id is required" }
      return { success: true, data: await apiRequest("PUT", `/tasks/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "task_id is required" }
      return { success: true, data: await apiRequest("PUT", `/tasks/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for tasks: ${action}` }
  }
}

async function handleServices(action: string, id: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Service name is required" }
      return { success: true, data: await apiRequest("POST", "/services", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/services", null, filters) }
    case "get":
      if (!id) return { success: false, message: "service_id is required" }
      return { success: true, data: await apiRequest("GET", `/services/${id}`) }
    case "update":
      if (!id) return { success: false, message: "service_id is required" }
      return { success: true, data: await apiRequest("PUT", `/services/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "service_id is required" }
      return { success: true, data: await apiRequest("PUT", `/services/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "service_id is required" }
      return { success: true, data: await apiRequest("PUT", `/services/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for services: ${action}` }
  }
}

async function handleItems(action: string, id: string | undefined, typeId: string | undefined, data: any, filters: any) {
  switch (action) {
    // Items
    case "createItem":
      if (!data.name) return { success: false, message: "Item name is required" }
      return { success: true, data: await apiRequest("POST", "/items", data) }
    case "listItems":
      return { success: true, data: await apiRequest("GET", "/items", null, filters) }
    case "getItem":
      if (!id) return { success: false, message: "item_id is required" }
      return { success: true, data: await apiRequest("GET", `/items/${id}`) }
    case "updateItem":
      if (!id) return { success: false, message: "item_id is required" }
      return { success: true, data: await apiRequest("PUT", `/items/${id}`, data) }
    case "activateItem":
      if (!id) return { success: false, message: "item_id is required" }
      return { success: true, data: await apiRequest("PUT", `/items/${id}/active`, { deleted: "N" }) }
    case "deactivateItem":
      if (!id) return { success: false, message: "item_id is required" }
      return { success: true, data: await apiRequest("PUT", `/items/${id}/inactive`, { deleted: "Y" }) }
    // Item Types
    case "createItemType":
      if (!data.name) return { success: false, message: "Item type name is required" }
      return { success: true, data: await apiRequest("POST", "/item-types", data) }
    case "listItemTypes":
      return { success: true, data: await apiRequest("GET", "/item-types", null, filters) }
    case "getItemType":
      const itemTypeId = typeId || id
      if (!itemTypeId) return { success: false, message: "item_type_id is required" }
      return { success: true, data: await apiRequest("GET", `/item-types/${itemTypeId}`) }
    case "updateItemType":
      const updateTypeId = typeId || id
      if (!updateTypeId) return { success: false, message: "item_type_id is required" }
      return { success: true, data: await apiRequest("PUT", `/item-types/${updateTypeId}`, data) }
    case "activateItemType":
      const activateTypeId = typeId || id
      if (!activateTypeId) return { success: false, message: "item_type_id is required" }
      return { success: true, data: await apiRequest("PUT", `/item-types/${activateTypeId}/active`, { deleted: "N" }) }
    case "deactivateItemType":
      const deactivateTypeId = typeId || id
      if (!deactivateTypeId) return { success: false, message: "item_type_id is required" }
      return { success: true, data: await apiRequest("PUT", `/item-types/${deactivateTypeId}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for items: ${action}` }
  }
}

async function handleWos(action: string, id: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      return { success: true, data: await apiRequest("POST", "/wos", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/wos", null, filters) }
    case "get":
      if (!id) return { success: false, message: "wos_id is required" }
      return { success: true, data: await apiRequest("GET", `/wos/${id}`) }
    case "update":
      if (!id) return { success: false, message: "wos_id is required" }
      return { success: true, data: await apiRequest("PUT", `/wos/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "wos_id is required" }
      return { success: true, data: await apiRequest("PUT", `/wos/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "wos_id is required" }
      return { success: true, data: await apiRequest("PUT", `/wos/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for wos: ${action}` }
  }
}

async function handleProducts(action: string, id: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Product name is required" }
      return { success: true, data: await apiRequest("POST", "/products", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/products", null, filters) }
    case "get":
      if (!id) return { success: false, message: "product_id is required" }
      return { success: true, data: await apiRequest("GET", `/products/${id}`) }
    case "update":
      if (!id) return { success: false, message: "product_id is required" }
      return { success: true, data: await apiRequest("PUT", `/products/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "product_id is required" }
      return { success: true, data: await apiRequest("PUT", `/products/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "product_id is required" }
      return { success: true, data: await apiRequest("PUT", `/products/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for products: ${action}` }
  }
}

async function handleModalities(action: string, id: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      if (!data.modality) return { success: false, message: "Modality name is required" }
      return { success: true, data: await apiRequest("POST", "/modalities", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/modalities", null, filters) }
    case "get":
      if (!id) return { success: false, message: "modality_id is required" }
      return { success: true, data: await apiRequest("GET", `/modalities/${id}`) }
    case "update":
      if (!id) return { success: false, message: "modality_id is required" }
      return { success: true, data: await apiRequest("PUT", `/modalities/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "modality_id is required" }
      return { success: true, data: await apiRequest("PUT", `/modalities/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "modality_id is required" }
      return { success: true, data: await apiRequest("PUT", `/modalities/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for modalities: ${action}` }
  }
}

async function handleProperties(action: string, id: string | undefined, data: any, filters: any) {
  switch (action) {
    case "create":
      if (!data.property || !data.type) return { success: false, message: "Property name and type are required" }
      return { success: true, data: await apiRequest("POST", "/properties", data) }
    case "list":
      return { success: true, data: await apiRequest("GET", "/properties", null, filters) }
    case "get":
      if (!id) return { success: false, message: "property_id is required" }
      return { success: true, data: await apiRequest("GET", `/properties/${id}`) }
    case "update":
      if (!id) return { success: false, message: "property_id is required" }
      return { success: true, data: await apiRequest("PUT", `/properties/${id}`, data) }
    case "activate":
      if (!id) return { success: false, message: "property_id is required" }
      return { success: true, data: await apiRequest("PUT", `/properties/${id}/active`, { deleted: "N" }) }
    case "deactivate":
      if (!id) return { success: false, message: "property_id is required" }
      return { success: true, data: await apiRequest("PUT", `/properties/${id}/inactive`, { deleted: "Y" }) }
    default:
      return { success: false, message: `Unknown action for properties: ${action}` }
  }
}

async function handleAuth(action: string) {
  switch (action) {
    case "check":
      // Just try to get users list to verify auth works
      await apiRequest("GET", "/users", null, { limit: 1 })
      return { success: true, message: "Authentication successful" }
    default:
      return { success: false, message: `Unknown action for auth: ${action}. Use 'check' to verify authentication.` }
  }
}
