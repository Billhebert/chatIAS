/**
 * Embedding Providers for RAG
 * 
 * Supports multiple embedding providers:
 * - OpenAI (text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002)
 * - Ollama (nomic-embed-text, mxbai-embed-large, all-minilm, etc.)
 */

import { Log } from "../util/log"

const log = Log.create({ service: "rag.embedding" })

// ==================== TYPES ====================

export interface EmbeddingResult {
  embedding: number[]
  model: string
  provider: string
  tokensUsed: number
  dimensions: number
}

export interface EmbeddingProvider {
  name: string
  generateEmbedding(text: string, model: string): Promise<EmbeddingResult>
  generateEmbeddings(texts: string[], model: string): Promise<EmbeddingResult[]>
  getDefaultModel(): string
  getDimensions(model: string): number
}

export type EmbeddingProviderType = "openai" | "ollama"

// ==================== CONFIGURATION ====================

export interface EmbeddingConfig {
  provider: EmbeddingProviderType
  model: string
  // OpenAI
  openaiApiKey?: string
  openaiBaseUrl?: string
  // Ollama
  ollamaHost?: string
  ollamaPort?: number
}

function getConfig(): EmbeddingConfig {
  const provider = (process.env.SUATEC_EMBEDDING_PROVIDER || "openai") as EmbeddingProviderType
  
  return {
    provider,
    model: process.env.SUATEC_EMBEDDING_MODEL || getDefaultModel(provider),
    // OpenAI
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    // Ollama
    ollamaHost: process.env.SUATEC_OLLAMA_HOST || process.env.OLLAMA_HOST || "localhost",
    ollamaPort: parseInt(process.env.SUATEC_OLLAMA_PORT || process.env.OLLAMA_PORT || "11434"),
  }
}

function getDefaultModel(provider: EmbeddingProviderType): string {
  switch (provider) {
    case "openai":
      return "text-embedding-3-small"
    case "ollama":
      return "nomic-embed-text"
    default:
      return "text-embedding-3-small"
  }
}

// ==================== OPENAI PROVIDER ====================

const OpenAIProvider: EmbeddingProvider = {
  name: "openai",
  
  getDefaultModel() {
    return "text-embedding-3-small"
  },
  
  getDimensions(model: string): number {
    // OpenAI embedding dimensions
    if (model.includes("3-large")) return 3072
    if (model.includes("3-small")) return 1536
    if (model.includes("ada-002")) return 1536
    return 1536 // default
  },
  
  async generateEmbedding(text: string, model: string): Promise<EmbeddingResult> {
    const config = getConfig()
    
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY not set")
    }
    
    // Truncate text if too long (8191 tokens max for embedding models)
    const maxChars = 30000
    const truncatedText = text.slice(0, maxChars)
    
    const response = await fetch(`${config.openaiBaseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: truncatedText,
        model,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json() as {
      data: Array<{ embedding: number[] }>
      usage: { total_tokens: number }
    }
    
    return {
      embedding: data.data[0].embedding,
      model,
      provider: "openai",
      tokensUsed: data.usage.total_tokens,
      dimensions: data.data[0].embedding.length,
    }
  },
  
  async generateEmbeddings(texts: string[], model: string): Promise<EmbeddingResult[]> {
    const config = getConfig()
    
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY not set")
    }
    
    const results: EmbeddingResult[] = []
    const batchSize = 100
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(t => t.slice(0, 30000))
      
      const response = await fetch(`${config.openaiBaseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: batch,
          model,
        }),
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }
      
      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>
        usage: { total_tokens: number }
      }
      
      data.data.sort((a, b) => a.index - b.index)
      const tokensPerText = Math.ceil(data.usage.total_tokens / batch.length)
      
      for (const item of data.data) {
        results.push({
          embedding: item.embedding,
          model,
          provider: "openai",
          tokensUsed: tokensPerText,
          dimensions: item.embedding.length,
        })
      }
    }
    
    return results
  },
}

// ==================== OLLAMA PROVIDER ====================

const OllamaProvider: EmbeddingProvider = {
  name: "ollama",
  
  getDefaultModel() {
    return "nomic-embed-text"
  },
  
  getDimensions(model: string): number {
    // Common Ollama embedding model dimensions
    const dimensions: Record<string, number> = {
      "nomic-embed-text": 768,
      "mxbai-embed-large": 1024,
      "all-minilm": 384,
      "all-minilm:l6-v2": 384,
      "all-minilm:l12-v2": 384,
      "snowflake-arctic-embed": 1024,
      "snowflake-arctic-embed:s": 384,
      "snowflake-arctic-embed:m": 768,
      "snowflake-arctic-embed:l": 1024,
      "bge-m3": 1024,
      "bge-large": 1024,
      "bge-base": 768,
      "bge-small": 384,
    }
    
    // Check for exact match or prefix match
    for (const [key, dim] of Object.entries(dimensions)) {
      if (model === key || model.startsWith(key + ":")) {
        return dim
      }
    }
    
    return 768 // default for most models
  },
  
  async generateEmbedding(text: string, model: string): Promise<EmbeddingResult> {
    const config = getConfig()
    const baseUrl = `http://${config.ollamaHost}:${config.ollamaPort}`
    
    // Truncate text if too long
    const maxChars = 8000 // Ollama models typically have smaller context
    const truncatedText = text.slice(0, maxChars)
    
    try {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: truncatedText,
        }),
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${response.status} - ${error}`)
      }
      
      const data = await response.json() as {
        embedding: number[]
      }
      
      return {
        embedding: data.embedding,
        model,
        provider: "ollama",
        tokensUsed: Math.ceil(truncatedText.length / 4), // Rough estimate
        dimensions: data.embedding.length,
      }
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        throw new Error(`Ollama not running at ${baseUrl}. Start Ollama with: ollama serve`)
      }
      throw err
    }
  },
  
  async generateEmbeddings(texts: string[], model: string): Promise<EmbeddingResult[]> {
    // Ollama doesn't support batch embeddings natively, so we process sequentially
    // with some parallelism
    const results: EmbeddingResult[] = []
    const concurrency = 5 // Process 5 at a time
    
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text, model))
      )
      results.push(...batchResults)
      
      // Small delay to avoid overwhelming Ollama
      if (i + concurrency < texts.length) {
        await new Promise(r => setTimeout(r, 100))
      }
    }
    
    return results
  },
}

// ==================== PROVIDER REGISTRY ====================

const providers: Record<EmbeddingProviderType, EmbeddingProvider> = {
  openai: OpenAIProvider,
  ollama: OllamaProvider,
}

/**
 * Get the configured embedding provider
 */
export function getProvider(providerType?: EmbeddingProviderType): EmbeddingProvider {
  const config = getConfig()
  const type = providerType || config.provider
  
  const provider = providers[type]
  if (!provider) {
    throw new Error(`Unknown embedding provider: ${type}`)
  }
  
  return provider
}

/**
 * Get current embedding configuration
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  return getConfig()
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Generate embedding using the configured provider
 */
export async function generateEmbedding(
  text: string,
  model?: string
): Promise<EmbeddingResult> {
  const config = getConfig()
  const provider = getProvider()
  const modelToUse = model || config.model
  
  log.debug("Generating embedding", { 
    provider: provider.name, 
    model: modelToUse,
    textLength: text.length 
  })
  
  const result = await provider.generateEmbedding(text, modelToUse)
  
  log.debug("Embedding generated", {
    provider: provider.name,
    model: modelToUse,
    dimensions: result.dimensions,
  })
  
  return result
}

/**
 * Generate embeddings for multiple texts using the configured provider
 */
export async function generateEmbeddings(
  texts: string[],
  model?: string
): Promise<EmbeddingResult[]> {
  const config = getConfig()
  const provider = getProvider()
  const modelToUse = model || config.model
  
  log.info("Generating batch embeddings", {
    provider: provider.name,
    model: modelToUse,
    count: texts.length,
  })
  
  const results = await provider.generateEmbeddings(texts, modelToUse)
  
  log.info("Batch embeddings generated", {
    provider: provider.name,
    model: modelToUse,
    count: results.length,
  })
  
  return results
}

/**
 * Get the vector dimensions for a model
 */
export function getDimensions(model?: string, providerType?: EmbeddingProviderType): number {
  const config = getConfig()
  const provider = getProvider(providerType)
  return provider.getDimensions(model || config.model)
}

/**
 * Check if the embedding provider is available
 */
export async function checkProviderHealth(): Promise<{
  available: boolean
  provider: string
  model: string
  error?: string
}> {
  const config = getConfig()
  const provider = getProvider()
  
  try {
    if (config.provider === "openai") {
      if (!config.openaiApiKey) {
        return {
          available: false,
          provider: "openai",
          model: config.model,
          error: "OPENAI_API_KEY not set",
        }
      }
      // Test with minimal request
      await provider.generateEmbedding("test", config.model)
    } else if (config.provider === "ollama") {
      // Check if Ollama is running
      const baseUrl = `http://${config.ollamaHost}:${config.ollamaPort}`
      const response = await fetch(`${baseUrl}/api/tags`)
      if (!response.ok) {
        throw new Error("Ollama not responding")
      }
    }
    
    return {
      available: true,
      provider: config.provider,
      model: config.model,
    }
  } catch (err: any) {
    return {
      available: false,
      provider: config.provider,
      model: config.model,
      error: err.message,
    }
  }
}

/**
 * List available Ollama models
 */
export async function listOllamaModels(): Promise<string[]> {
  const config = getConfig()
  const baseUrl = `http://${config.ollamaHost}:${config.ollamaPort}`
  
  try {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) {
      throw new Error("Failed to list Ollama models")
    }
    
    const data = await response.json() as {
      models: Array<{ name: string }>
    }
    
    // Filter to only show embedding-capable models
    const embeddingModels = [
      "nomic-embed-text",
      "mxbai-embed-large",
      "all-minilm",
      "snowflake-arctic-embed",
      "bge-m3",
      "bge-large",
      "bge-base",
      "bge-small",
    ]
    
    return data.models
      .map(m => m.name)
      .filter(name => embeddingModels.some(em => name.startsWith(em)))
  } catch (err: any) {
    log.warn("Failed to list Ollama models", { error: err.message })
    return []
  }
}
