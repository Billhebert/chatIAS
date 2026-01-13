import z from "zod"
import { Tool } from "./tool"
import { Integration } from "../integration"

/**
 * RD Station CRM Native Tool
 * 
 * Consolidated tool for all RD Station CRM API operations.
 * Supports: contacts, deals, organizations, activities, tasks, 
 * pipelines, products, campaigns, custom-fields, deal-sources, 
 * deal-reasons, teams, users
 */

const RDSTATION_BASE_URL = "https://crm.rdstation.com/api/v1"

// Cache for token
let tokenCache: string | null = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1 minute

// Lazy validation - only when making API calls
async function getApiToken(): Promise<string> {
  // Check cache first
  if (tokenCache && Date.now() - cacheTime < CACHE_TTL) {
    return tokenCache
  }

  // Try to get from Integration storage
  const storedCreds = await Integration.getRDStationCredentials()
  if (storedCreds) {
    tokenCache = storedCreds.accessToken
    cacheTime = Date.now()
    return storedCreds.accessToken
  }

  // Fallback to environment variable
  const token = process.env.RDSTATION_API_TOKEN
  if (!token) {
    throw new Error(
      "Faltam as credenciais do RD Station. Configure no painel de administração (Integrações) ou defina a variável de ambiente RDSTATION_API_TOKEN."
    )
  }
  return token
}

async function buildUrl(endpoint: string, params: Record<string, any> = {}): Promise<string> {
  const url = new URL(`${RDSTATION_BASE_URL}${endpoint}`)
  url.searchParams.set("token", await getApiToken())
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
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

const DESCRIPTION = `RD Station CRM API tool for managing sales pipeline data.

Resources available:
- contacts: People/leads (create, list, get, update)
- deals: Sales opportunities (create, list, get, update, listProducts, addProduct, updateProduct, removeProduct)
- organizations: Companies (create, list, get, update, listContacts)
- activities: Notes on deals (create, list)
- tasks: Follow-up tasks (create, list, get, update)
- pipelines: Sales funnels (list, create, get, update, listStages, createStage, getStage, updateStage)
- products: Product catalog (create, list, get, update)
- campaigns: Marketing campaigns (create, list, get, update)
- custom-fields: Custom fields for entities (create, list, get, update, delete)
- deal-sources: Lead sources (create, list, get, update)
- deal-reasons: Loss reasons (create, list, get, update)
- teams: Team list (list, get) - read only
- users: User list (list, get) - read only

Common parameters:
- page: Page number (default: 1)
- limit: Items per page (max: 200)
- order: Sort field
- direction: asc or desc
- q: Text search`

export const RDStationTool = Tool.define("rdstation", {
  description: DESCRIPTION,
  parameters: z.object({
    resource: z.enum([
      "contacts", "deals", "organizations", "activities", "tasks",
      "pipelines", "products", "campaigns", "custom-fields",
      "deal-sources", "deal-reasons", "teams", "users"
    ]).describe("The CRM resource to operate on"),
    action: z.enum([
      "create", "list", "get", "update", "delete",
      "listContacts", "listProducts", "addProduct", "updateProduct", "removeProduct",
      "listStages", "createStage", "getStage", "updateStage"
    ]).default("list").describe("The action to perform"),
    id: z.string().optional().describe("Resource ID (for get/update/delete)"),
    secondary_id: z.string().optional().describe("Secondary ID (e.g., deal_product_id, stage_id)"),
    parent_id: z.string().optional().describe("Parent ID (e.g., deal_id for products, pipeline_id for stages)"),
    page: z.number().optional().describe("Page number for pagination"),
    limit: z.number().optional().describe("Items per page (max 200)"),
    order: z.string().optional().describe("Field to sort by"),
    direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    q: z.string().optional().describe("Text search query"),
    data: z.string().optional().describe("JSON string with entity data for create/update"),
  }),
  async execute(params, ctx) {
    const { 
      resource, 
      action, 
      id, 
      secondary_id,
      parent_id,
      page = 1, 
      limit = 20, 
      order, 
      direction, 
      q, 
      data: dataStr 
    } = params

    try {
      let data: Record<string, any> = {}
      if (dataStr) {
        try {
          data = JSON.parse(dataStr)
        } catch {
          // Use as-is if not valid JSON
        }
      }

      const paginationParams: Record<string, any> = { page, limit }
      if (order) paginationParams.order = order
      if (direction) paginationParams.direction = direction
      if (q) paginationParams.q = q

      let result: any
      let endpoint: string
      let response: Response

      // Route to appropriate handler based on resource
      switch (resource) {
        case "contacts":
          result = await handleContacts(action, id, data, paginationParams)
          break
        case "deals":
          result = await handleDeals(action, id, secondary_id, parent_id, data, paginationParams)
          break
        case "organizations":
          result = await handleOrganizations(action, id, data, paginationParams)
          break
        case "activities":
          result = await handleActivities(action, parent_id, data, paginationParams)
          break
        case "tasks":
          result = await handleTasks(action, id, data, paginationParams)
          break
        case "pipelines":
          result = await handlePipelines(action, id, secondary_id, data, paginationParams)
          break
        case "products":
          result = await handleProducts(action, id, data, paginationParams)
          break
        case "campaigns":
          result = await handleCampaigns(action, id, data, paginationParams)
          break
        case "custom-fields":
          result = await handleCustomFields(action, id, data, paginationParams)
          break
        case "deal-sources":
          result = await handleDealSources(action, id, data, paginationParams)
          break
        case "deal-reasons":
          result = await handleDealReasons(action, id, data, paginationParams)
          break
        case "teams":
          result = await handleTeams(action, id, paginationParams)
          break
        case "users":
          result = await handleUsers(action, id, paginationParams)
          break
        default:
          result = { success: false, message: `Unknown resource: ${resource}` }
      }

      return {
        output: JSON.stringify(result, null, 2),
        title: `RDStation ${resource} ${action}`,
        metadata: { resource, action },
      }
    } catch (error: any) {
      return {
        output: handleError(error, `${resource}.${action}`),
        title: `RDStation ${resource} ${action} (error)`,
        metadata: { resource, action, error: true },
      }
    }
  },
})

// Helper function for fetch requests
async function apiRequest(method: string, url: string, body?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  const response = await fetch(url, options)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw { response: { status: response.status, data: error } }
  }
  return response.json()
}

// Resource Handlers

async function handleContacts(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Contact name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/contacts"), { contact: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/contacts", params))
      return { success: true, total: list.total || list.contacts?.length || 0, data: list.contacts || list }
    case "get":
      if (!id) return { success: false, message: "contact_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/contacts/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "contact_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/contacts/${id}`), { contact: data }) }
    default:
      return { success: false, message: `Unknown action for contacts: ${action}` }
  }
}

async function handleDeals(action: string, id: string | undefined, secondaryId: string | undefined, parentId: string | undefined, data: any, params: any) {
  const dealId = parentId || id
  
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Deal name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/deals"), { deal: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/deals", params))
      return { success: true, total: list.total || list.deals?.length || 0, data: list.deals || list }
    case "get":
      if (!id) return { success: false, message: "deal_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/deals/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "deal_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/deals/${id}`), { deal: data }) }
    case "listProducts":
      if (!dealId) return { success: false, message: "deal_id (as parent_id or id) is required" }
      const products = await apiRequest("GET", await buildUrl(`/deals/${dealId}/deal_products`))
      return { success: true, deal_id: dealId, data: products.deal_products || products }
    case "addProduct":
      if (!dealId) return { success: false, message: "deal_id (as parent_id) is required" }
      if (!data.product_id) return { success: false, message: "product_id is required in data" }
      return { success: true, data: await apiRequest("POST", await buildUrl(`/deals/${dealId}/deal_products`), { deal_product: data }) }
    case "updateProduct":
      if (!dealId || !secondaryId) return { success: false, message: "deal_id (parent_id) and deal_product_id (secondary_id) are required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/deals/${dealId}/deal_products/${secondaryId}`), { deal_product: data }) }
    case "removeProduct":
      if (!dealId || !secondaryId) return { success: false, message: "deal_id (parent_id) and deal_product_id (secondary_id) are required" }
      await apiRequest("DELETE", await buildUrl(`/deals/${dealId}/deal_products/${secondaryId}`))
      return { success: true, message: "Product removed from deal" }
    default:
      return { success: false, message: `Unknown action for deals: ${action}` }
  }
}

async function handleOrganizations(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Organization name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/organizations"), { organization: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/organizations", params))
      return { success: true, total: list.total || list.organizations?.length || 0, data: list.organizations || list }
    case "get":
      if (!id) return { success: false, message: "organization_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/organizations/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "organization_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/organizations/${id}`), { organization: data }) }
    case "listContacts":
      if (!id) return { success: false, message: "organization_id is required" }
      const contacts = await apiRequest("GET", await buildUrl(`/organizations/${id}/contacts`, params))
      return { success: true, organization_id: id, data: contacts.contacts || contacts }
    default:
      return { success: false, message: `Unknown action for organizations: ${action}` }
  }
}

async function handleActivities(action: string, dealId: string | undefined, data: any, params: any) {
  if (!dealId) return { success: false, message: "deal_id (as parent_id) is required for activities" }
  
  switch (action) {
    case "create":
      if (!data.text) return { success: false, message: "Activity text is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl(`/deals/${dealId}/activities`), { activity: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl(`/deals/${dealId}/activities`, params))
      return { success: true, deal_id: dealId, data: list.activities || list }
    default:
      return { success: false, message: `Unknown action for activities: ${action}` }
  }
}

async function handleTasks(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.subject) return { success: false, message: "Task subject is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/tasks"), { task: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/tasks", params))
      return { success: true, total: list.total || list.tasks?.length || 0, data: list.tasks || list }
    case "get":
      if (!id) return { success: false, message: "task_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/tasks/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "task_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/tasks/${id}`), { task: data }) }
    default:
      return { success: false, message: `Unknown action for tasks: ${action}` }
  }
}

async function handlePipelines(action: string, id: string | undefined, stageId: string | undefined, data: any, params: any) {
  switch (action) {
    case "list":
      const list = await apiRequest("GET", await buildUrl("/deal_pipelines", params))
      return { success: true, data: list.deal_pipelines || list }
    case "create":
      if (!data.name) return { success: false, message: "Pipeline name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/deal_pipelines"), { deal_pipeline: data }) }
    case "get":
      if (!id) return { success: false, message: "pipeline_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/deal_pipelines/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "pipeline_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/deal_pipelines/${id}`), { deal_pipeline: data }) }
    case "listStages":
      if (!id) return { success: false, message: "pipeline_id is required" }
      const stages = await apiRequest("GET", await buildUrl(`/deal_pipelines/${id}/deal_stages`))
      return { success: true, pipeline_id: id, data: stages.deal_stages || stages }
    case "createStage":
      if (!id) return { success: false, message: "pipeline_id is required" }
      if (!data.name) return { success: false, message: "Stage name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl(`/deal_pipelines/${id}/deal_stages`), { deal_stage: data }) }
    case "getStage":
      if (!stageId) return { success: false, message: "stage_id (as secondary_id) is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/deal_stages/${stageId}`)) }
    case "updateStage":
      if (!stageId) return { success: false, message: "stage_id (as secondary_id) is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/deal_stages/${stageId}`), { deal_stage: data }) }
    default:
      return { success: false, message: `Unknown action for pipelines: ${action}` }
  }
}

async function handleProducts(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Product name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/products"), { product: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/products", params))
      return { success: true, total: list.total || list.products?.length || 0, data: list.products || list }
    case "get":
      if (!id) return { success: false, message: "product_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/products/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "product_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/products/${id}`), { product: data }) }
    default:
      return { success: false, message: `Unknown action for products: ${action}` }
  }
}

async function handleCampaigns(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Campaign name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/campaigns"), { campaign: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/campaigns", params))
      return { success: true, data: list.campaigns || list }
    case "get":
      if (!id) return { success: false, message: "campaign_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/campaigns/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "campaign_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/campaigns/${id}`), { campaign: data }) }
    default:
      return { success: false, message: `Unknown action for campaigns: ${action}` }
  }
}

async function handleCustomFields(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.label) return { success: false, message: "Custom field label is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/custom_fields"), { custom_field: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/custom_fields", params))
      return { success: true, data: list.custom_fields || list }
    case "get":
      if (!id) return { success: false, message: "custom_field_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/custom_fields/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "custom_field_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/custom_fields/${id}`), { custom_field: data }) }
    case "delete":
      if (!id) return { success: false, message: "custom_field_id is required" }
      await apiRequest("DELETE", await buildUrl(`/custom_fields/${id}`))
      return { success: true, message: "Custom field deleted" }
    default:
      return { success: false, message: `Unknown action for custom-fields: ${action}` }
  }
}

async function handleDealSources(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Source name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/deal_sources"), { deal_source: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/deal_sources", params))
      return { success: true, data: list.deal_sources || list }
    case "get":
      if (!id) return { success: false, message: "source_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/deal_sources/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "source_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/deal_sources/${id}`), { deal_source: data }) }
    default:
      return { success: false, message: `Unknown action for deal-sources: ${action}` }
  }
}

async function handleDealReasons(action: string, id: string | undefined, data: any, params: any) {
  switch (action) {
    case "create":
      if (!data.name) return { success: false, message: "Reason name is required" }
      return { success: true, data: await apiRequest("POST", await buildUrl("/deal_lost_reasons"), { deal_lost_reason: data }) }
    case "list":
      const list = await apiRequest("GET", await buildUrl("/deal_lost_reasons", params))
      return { success: true, data: list.deal_lost_reasons || list }
    case "get":
      if (!id) return { success: false, message: "reason_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/deal_lost_reasons/${id}`)) }
    case "update":
      if (!id) return { success: false, message: "reason_id is required" }
      return { success: true, data: await apiRequest("PUT", await buildUrl(`/deal_lost_reasons/${id}`), { deal_lost_reason: data }) }
    default:
      return { success: false, message: `Unknown action for deal-reasons: ${action}` }
  }
}

async function handleTeams(action: string, id: string | undefined, params: any) {
  switch (action) {
    case "list":
      const list = await apiRequest("GET", await buildUrl("/teams", params))
      return { success: true, data: list.teams || list }
    case "get":
      if (!id) return { success: false, message: "team_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/teams/${id}`)) }
    default:
      return { success: false, message: `Unknown action for teams: ${action}. Teams are read-only.` }
  }
}

async function handleUsers(action: string, id: string | undefined, params: any) {
  switch (action) {
    case "list":
      const list = await apiRequest("GET", await buildUrl("/users", params))
      return { success: true, data: list.users || list }
    case "get":
      if (!id) return { success: false, message: "user_id is required" }
      return { success: true, data: await apiRequest("GET", await buildUrl(`/users/${id}`)) }
    default:
      return { success: false, message: `Unknown action for users: ${action}. Users are read-only.` }
  }
}
