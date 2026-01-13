/**
 * RD Station CRM API Configuration
 * 
 * This module provides shared configuration for all RDStation tools.
 * Token must be set via environment variable - no hardcoded fallbacks.
 * 
 * IMPORTANT: Validation is done lazily (on first use) to allow tools to load
 * even if environment variables are not yet configured.
 */

let validated = false

// Validate required environment variables (lazy - called on first use)
function validateEnv() {
  if (validated) return
  
  if (!process.env.RDSTATION_API_TOKEN) {
    throw new Error(
      `RDStation configuration error: Missing required environment variable: RDSTATION_API_TOKEN. ` +
      `Please set it in your .env file. See .env.example for reference.`
    )
  }
  
  validated = true
}

// Config getter with lazy validation
export function getConfig() {
  validateEnv()
  return {
    baseUrl: 'https://crm.rdstation.com/api/v1',
    apiToken: process.env.RDSTATION_API_TOKEN!,
  }
}

// Legacy export for backwards compatibility (validates on access)
export const rdstationConfig = {
  get baseUrl() { return getConfig().baseUrl },
  get apiToken() { return getConfig().apiToken },
}

export function getUrl(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${rdstationConfig.baseUrl}${endpoint}`)
  url.searchParams.set('token', rdstationConfig.apiToken)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

export function handleError(error: any, action: string) {
  if (error.response) {
    return {
      success: false,
      status: error.response.status,
      action,
      message: error.response.data?.message || `Falha ao ${action}`,
      error: error.response.data
    }
  }
  return {
    success: false,
    action,
    message: `Erro de conexão: ${error.message}`
  }
}
