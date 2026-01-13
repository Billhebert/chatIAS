/**
 * RAG Integration for Chat Sessions
 * 
 * Provides automatic RAG context injection into LLM prompts
 */

import { RAG } from "../rag"
import { Log } from "../util/log"
import { Bus } from "../bus"

const log = Log.create({ service: "rag.integration" })

export interface RAGIntegrationConfig {
  enabled: boolean
  maxTokens: number
  scoreThreshold: number
  includeCompanyKB: boolean
}

const defaultConfig: RAGIntegrationConfig = {
  enabled: true,
  maxTokens: 2000,
  scoreThreshold: 0.7,
  includeCompanyKB: true,
}

// Get RAG config from environment or defaults
function getConfig(): RAGIntegrationConfig {
  return {
    enabled: process.env.SUATEC_RAG_ENABLED !== "false",
    maxTokens: parseInt(process.env.SUATEC_RAG_MAX_TOKENS || "2000"),
    scoreThreshold: parseFloat(process.env.SUATEC_RAG_SCORE_THRESHOLD || "0.7"),
    includeCompanyKB: process.env.SUATEC_RAG_INCLUDE_COMPANY !== "false",
  }
}

/**
 * Get RAG context for a session based on the last user message
 */
export async function getRAGContextForSession(
  sessionID: string,
  userId: string | undefined,
  lastUserMessage?: string
): Promise<{ context: string; sources: Array<{ filename: string; score: number }> }> {
  const config = getConfig()
  
  log.info("RAG context request", {
    sessionID,
    userId: userId || "undefined",
    hasMessage: !!lastUserMessage,
    messagePreview: lastUserMessage?.substring(0, 50),
    enabled: config.enabled,
  })
  
  if (!config.enabled) {
    log.info("RAG disabled by config")
    return { context: "", sources: [] }
  }

  if (!userId) {
    log.info("No userId available, skipping RAG context")
    return { context: "", sources: [] }
  }

  if (!lastUserMessage) {
    log.info("No user message provided, skipping RAG context")
    return { context: "", sources: [] }
  }

  try {
    log.info("Calling RAG.getContextForPromptWithMeta", { userId, query: lastUserMessage.substring(0, 100) })
    const result = await RAG.getContextForPromptWithMeta(lastUserMessage, userId, {
      maxTokens: config.maxTokens,
      includeCompanyKB: config.includeCompanyKB,
    })

    log.info("RAG search result", {
      contextLength: result.context.length,
      sourcesCount: result.sources.length,
      hasContext: result.context.length > 0,
    })

    if (result.context) {
      log.info("RAG context retrieved", {
        sessionID,
        userId,
        contextLength: result.context.length,
        sourcesCount: result.sources.length,
      })

      // Emit event for frontend
      await Bus.publish(RAG.Event.ContextInjected, {
        sessionID,
        userId,
        contextLength: result.context.length,
        sourcesCount: result.sources.length,
        sources: result.sources.map(s => ({
          filename: s.filename,
          score: s.score,
        })),
      })
    }

    return result
  } catch (err: any) {
    log.error("Failed to get RAG context", {
      sessionID,
      userId,
      error: err.message,
      stack: err.stack,
    })
    return { context: "", sources: [] }
  }
}

/**
 * Transform system prompt to include RAG context
 * This function is meant to be called from the experimental.chat.system.transform hook
 * or directly from the LLM stream function
 */
export async function transformSystemWithRAG(
  sessionID: string,
  userId: string | undefined,
  system: string[],
  lastUserMessage?: string
): Promise<void> {
  const result = await getRAGContextForSession(sessionID, userId, lastUserMessage)
  
  if (result.context) {
    // Insert RAG context after the main system prompt but before custom instructions
    system.push(result.context)
    
    // Add instruction about using the context
    system.push(`
When answering questions, consider the information provided in the "Contexto da Base de Conhecimento" section above if it's relevant to the user's query. Cite sources when appropriate.
`)
  }
}

/**
 * Create a plugin hook handler for RAG integration
 * This is a factory function that creates a hook handler with access to Session
 * 
 * Usage in llm.ts:
 *   import { createRAGHook } from "../rag/integration"
 *   const ragHook = createRAGHook(Session)
 *   await ragHook({ sessionID }, { system })
 */
export function createRAGHook(SessionModule: {
  get: (id: string) => Promise<{ userId?: string } | undefined>
  messages: (input: { sessionID: string }) => Promise<Array<{ role: string; id: string }>>
  parts: (input: { messageID: string }) => Promise<Array<{ type: string; text?: string }>>
}) {
  return async (
    input: { sessionID: string },
    output: { system: string[] }
  ): Promise<void> => {
    try {
      const session = await SessionModule.get(input.sessionID)
      const userId = session?.userId
      
      if (!userId) {
        log.debug("Session has no userId, skipping RAG")
        return
      }

      // Get the last user message from the session
      const messages = await SessionModule.messages({ sessionID: input.sessionID })
      const userMessages = messages.filter(m => m.role === "user")
      const lastUserMsg = userMessages[userMessages.length - 1]
      
      // Extract text from the last user message
      let lastUserText = ""
      if (lastUserMsg) {
        const parts = await SessionModule.parts({ messageID: lastUserMsg.id })
        const textParts = parts.filter(p => p.type === "text")
        lastUserText = textParts.map(p => p.text || "").join("\n")
      }

      await transformSystemWithRAG(
        input.sessionID,
        userId,
        output.system,
        lastUserText
      )
    } catch (err: any) {
      log.error("RAG hook error", { sessionID: input.sessionID, error: err.message })
    }
  }
}
