/**
 * Confirm8 API Configuration
 * 
 * This module provides shared configuration for all Confirm8 tools.
 * Tokens must be set via environment variables - no hardcoded fallbacks.
 * 
 * IMPORTANT: Validation is done lazily (only when making API calls) to allow 
 * tools to load even if environment variables are not yet configured.
 */

// Validate required environment variables (called only when making API calls)
function validateEnv() {
  const missing: string[] = []
  
  if (!process.env.CONFIRM8_BEARER_TOKEN) {
    missing.push('CONFIRM8_BEARER_TOKEN')
  }
  if (!process.env.CONFIRM8_APIKEY_TOKEN) {
    missing.push('CONFIRM8_APIKEY_TOKEN')
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Confirm8 configuration error: Missing required environment variables: ${missing.join(', ')}. ` +
      `Please set them in your .env file. See .env.example for reference.`
    )
  }
}

// Config object - does NOT validate on access, only returns current values
// This allows tools to load even without env vars configured
export const confirm8Config = {
  // baseUrl has a default, so it's safe to access anytime
  get baseUrl() { 
    return process.env.CONFIRM8_BASE_URL || 'https://api.confirm8.com/v3' 
  },
  get apiDomain() { 
    return process.env.CONFIRM8_API_DOMAIN || 'suatec' 
  },
}

// This function validates AND returns headers - use this for API calls
export function getAuthHeaders() {
  // Validate only when actually making an API call
  validateEnv()
  
  return {
    'Authorization': `Bearer ${process.env.CONFIRM8_BEARER_TOKEN}`,
    'X-API-DOMAIN': process.env.CONFIRM8_API_DOMAIN || 'suatec',
    'X-APIKEY-TOKEN': process.env.CONFIRM8_APIKEY_TOKEN,
    'Content-Type': 'application/json'
  }
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
