/**
 * RAG API Routes
 * Rotas para gerenciamento de bases de conhecimento e documentos
 */

import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import { RAG } from "../rag"
import { User } from "../user"
import z from "zod"
import { errors } from "./error"
import type { Context, Next } from "hono"

// Middleware para validar token de autenticacao
async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Token de autenticacao nao fornecido" }, 401)
  }

  const token = authHeader.substring(7)
  const user = await User.validateToken(token)
  
  if (!user) {
    return c.json({ error: "Token invalido ou expirado" }, 401)
  }

  c.set("user" as never, user as never)
  await next()
}

function getUser(c: Context): User.PublicInfo {
  return (c as any).get("user") as User.PublicInfo
}

// ==================== ROTAS ====================

const ragRoutes = new Hono()
  .use("/*", authMiddleware)

  // ==================== KNOWLEDGE BASES ====================
  .get(
    "/knowledge-bases",
    describeRoute({
      summary: "List knowledge bases",
      description: "List all knowledge bases accessible to the current user.",
      operationId: "rag.listKnowledgeBases",
      responses: {
        200: {
          description: "List of knowledge bases",
          content: {
            "application/json": {
              schema: resolver(RAG.KnowledgeBase.array()),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const user = getUser(c)
      const includeCompany = c.req.query("includeCompany") !== "false"
      const bases = await RAG.listKnowledgeBases(user.id, includeCompany)
      return c.json(bases)
    },
  )
  .get(
    "/knowledge-bases/company",
    describeRoute({
      summary: "List company knowledge bases",
      description: "List all company-wide knowledge bases.",
      operationId: "rag.listCompanyKnowledgeBases",
      responses: {
        200: {
          description: "List of company knowledge bases",
          content: {
            "application/json": {
              schema: resolver(RAG.KnowledgeBase.array()),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const bases = await RAG.listCompanyKnowledgeBases()
      return c.json(bases)
    },
  )
  .get(
    "/knowledge-bases/:id",
    describeRoute({
      summary: "Get knowledge base",
      description: "Get a specific knowledge base by ID.",
      operationId: "rag.getKnowledgeBase",
      responses: {
        200: {
          description: "Knowledge base",
          content: {
            "application/json": {
              schema: resolver(RAG.KnowledgeBase),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param")
      const kb = await RAG.getKnowledgeBase(id)
      
      if (!kb) {
        return c.json({ error: "Base de conhecimento nao encontrada" }, 404)
      }
      
      return c.json(kb)
    },
  )
  .post(
    "/knowledge-bases",
    describeRoute({
      summary: "Create knowledge base",
      description: "Create a new knowledge base. Company bases require admin privileges.",
      operationId: "rag.createKnowledgeBase",
      responses: {
        200: {
          description: "Created knowledge base",
          content: {
            "application/json": {
              schema: resolver(RAG.KnowledgeBase),
            },
          },
        },
        ...errors(400, 401, 403),
      },
    }),
    validator("json", RAG.CreateKnowledgeBaseInput),
    async (c) => {
      try {
        const user = getUser(c)
        const input = c.req.valid("json")
        
        // Apenas master pode criar bases da empresa
        if (input.type === "company" && user.role !== "master") {
          return c.json({ error: "Apenas o Master pode criar bases da empresa" }, 403)
        }
        
        const kb = await RAG.createKnowledgeBase(input, user.id)
        return c.json(kb)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .patch(
    "/knowledge-bases/:id",
    describeRoute({
      summary: "Update knowledge base",
      description: "Update a knowledge base.",
      operationId: "rag.updateKnowledgeBase",
      responses: {
        200: {
          description: "Updated knowledge base",
          content: {
            "application/json": {
              schema: resolver(RAG.KnowledgeBase),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    validator("json", RAG.UpdateKnowledgeBaseInput),
    async (c) => {
      try {
        const user = getUser(c)
        const { id } = c.req.valid("param")
        const input = c.req.valid("json")
        
        const kb = await RAG.getKnowledgeBase(id)
        if (!kb) {
          return c.json({ error: "Base de conhecimento nao encontrada" }, 404)
        }
        
        // Verificar permissão para bases da empresa
        if (kb.type === "company" && user.role !== "master") {
          return c.json({ error: "Apenas o Master pode editar bases da empresa" }, 403)
        }
        
        const updated = await RAG.updateKnowledgeBase(id, input, user.id)
        return c.json(updated)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .delete(
    "/knowledge-bases/:id",
    describeRoute({
      summary: "Delete knowledge base",
      description: "Delete a knowledge base and all its documents.",
      operationId: "rag.deleteKnowledgeBase",
      responses: {
        200: {
          description: "Knowledge base deleted",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = getUser(c)
        const { id } = c.req.valid("param")
        
        const kb = await RAG.getKnowledgeBase(id)
        if (!kb) {
          return c.json({ error: "Base de conhecimento nao encontrada" }, 404)
        }
        
        // Verificar permissão para bases da empresa
        if (kb.type === "company" && user.role !== "master") {
          return c.json({ error: "Apenas o Master pode excluir bases da empresa" }, 403)
        }
        
        await RAG.deleteKnowledgeBase(id, user.id)
        return c.json({ success: true })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )

  // ==================== DOCUMENTS ====================
  .get(
    "/knowledge-bases/:kbId/documents",
    describeRoute({
      summary: "List documents",
      description: "List all documents in a knowledge base.",
      operationId: "rag.listDocuments",
      responses: {
        200: {
          description: "List of documents",
          content: {
            "application/json": {
              schema: resolver(RAG.Document.array()),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ kbId: z.string() })),
    async (c) => {
      const { kbId } = c.req.valid("param")
      
      const kb = await RAG.getKnowledgeBase(kbId)
      if (!kb) {
        return c.json({ error: "Base de conhecimento nao encontrada" }, 404)
      }
      
      const docs = await RAG.listDocuments(kbId)
      return c.json(docs)
    },
  )
  .get(
    "/documents/:id",
    describeRoute({
      summary: "Get document",
      description: "Get a specific document by ID.",
      operationId: "rag.getDocument",
      responses: {
        200: {
          description: "Document",
          content: {
            "application/json": {
              schema: resolver(RAG.Document),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param")
      const doc = await RAG.getDocument(id)
      
      if (!doc) {
        return c.json({ error: "Documento nao encontrado" }, 404)
      }
      
      return c.json(doc)
    },
  )
  .post(
    "/knowledge-bases/:kbId/documents",
    describeRoute({
      summary: "Upload document",
      description: "Upload a document to a knowledge base for indexing.",
      operationId: "rag.uploadDocument",
      responses: {
        200: {
          description: "Uploaded document",
          content: {
            "application/json": {
              schema: resolver(RAG.Document),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ kbId: z.string() })),
    async (c) => {
      try {
        const user = getUser(c)
        const { kbId } = c.req.valid("param")
        
        const kb = await RAG.getKnowledgeBase(kbId)
        if (!kb) {
          return c.json({ error: "Base de conhecimento nao encontrada" }, 404)
        }
        
        // Verificar permissão
        if (kb.ownerId !== user.id && kb.type === "company" && user.role !== "master" && user.role !== "admin") {
          return c.json({ error: "Sem permissao para adicionar documentos" }, 403)
        }
        
        // Parse multipart form data
        const formData = await c.req.formData()
        const file = formData.get("file") as File | null
        
        if (!file) {
          return c.json({ error: "Arquivo nao fornecido" }, 400)
        }
        
        const content = await file.arrayBuffer()
        
        const doc = await RAG.addDocument(kbId, {
          filename: file.name,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          content: Buffer.from(content),
        }, user.id)
        
        return c.json(doc)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .delete(
    "/documents/:id",
    describeRoute({
      summary: "Delete document",
      description: "Delete a document from a knowledge base.",
      operationId: "rag.deleteDocument",
      responses: {
        200: {
          description: "Document deleted",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = getUser(c)
        const { id } = c.req.valid("param")
        
        const doc = await RAG.getDocument(id)
        if (!doc) {
          return c.json({ error: "Documento nao encontrado" }, 404)
        }
        
        await RAG.deleteDocument(id, user.id)
        return c.json({ success: true })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .post(
    "/documents/:id/reprocess",
    describeRoute({
      summary: "Reprocess document",
      description: "Reprocess a document (re-extract, re-chunk, re-embed, re-index).",
      operationId: "rag.reprocessDocument",
      responses: {
        200: {
          description: "Document queued for reprocessing",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean(), message: z.string() })),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const user = getUser(c)
        const { id } = c.req.valid("param")
        
        const doc = await RAG.getDocument(id)
        if (!doc) {
          return c.json({ error: "Documento nao encontrado" }, 404)
        }
        
        await RAG.reprocessDocument(id, user.id)
        return c.json({ success: true, message: "Documento adicionado a fila de processamento" })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )

  // ==================== SEARCH ====================
  .post(
    "/search",
    describeRoute({
      summary: "Search knowledge bases",
      description: "Search across knowledge bases using semantic search.",
      operationId: "rag.search",
      responses: {
        200: {
          description: "Search results",
          content: {
            "application/json": {
              schema: resolver(RAG.SearchResult.array()),
            },
          },
        },
        ...errors(400, 401),
      },
    }),
    validator("json", RAG.SearchInput),
    async (c) => {
      try {
        const user = getUser(c)
        const input = c.req.valid("json")
        const isAdmin = user.role === "master" || user.role === "admin"
        
        const results = await RAG.search(input, user.id, isAdmin)
        return c.json(results)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .post(
    "/context",
    describeRoute({
      summary: "Get context for LLM",
      description: "Get relevant context from knowledge bases formatted for LLM prompts.",
      operationId: "rag.getContext",
      responses: {
        200: {
          description: "Context string",
          content: {
            "application/json": {
              schema: resolver(z.object({ context: z.string() })),
            },
          },
        },
        ...errors(400, 401),
      },
    }),
    validator("json", z.object({
      query: z.string().min(1),
      maxTokens: z.number().optional(),
      knowledgeBaseIds: z.array(z.string()).optional(),
      includeCompanyKB: z.boolean().optional(),
    })),
    async (c) => {
      try {
        const user = getUser(c)
        const input = c.req.valid("json")
        
        const context = await RAG.getContextForPrompt(input.query, user.id, {
          maxTokens: input.maxTokens,
          knowledgeBaseIds: input.knowledgeBaseIds,
          includeCompanyKB: input.includeCompanyKB,
        })
        
        return c.json({ context })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  // ==================== EMBEDDING PROVIDERS ====================
  .get(
    "/embedding/status",
    describeRoute({
      summary: "Get embedding provider status",
      description: "Check if the configured embedding provider is available.",
      operationId: "rag.embeddingStatus",
      responses: {
        200: {
          description: "Embedding provider status",
          content: {
            "application/json": {
              schema: resolver(z.object({
                available: z.boolean(),
                provider: z.string(),
                model: z.string(),
                error: z.string().optional(),
              })),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const { checkProviderHealth } = await import("../rag/embedding")
      const status = await checkProviderHealth()
      return c.json(status)
    },
  )
  .get(
    "/embedding/ollama-models",
    describeRoute({
      summary: "List Ollama embedding models",
      description: "List available Ollama models that can be used for embeddings.",
      operationId: "rag.listOllamaModels",
      responses: {
        200: {
          description: "List of Ollama embedding models",
          content: {
            "application/json": {
              schema: resolver(z.object({
                models: z.array(z.string()),
                recommended: z.array(z.string()),
              })),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const { listOllamaModels } = await import("../rag/embedding")
      const models = await listOllamaModels()
      
      // Modelos recomendados para embeddings
      const recommended = [
        "nomic-embed-text",
        "mxbai-embed-large", 
        "snowflake-arctic-embed",
        "bge-m3",
      ]
      
      return c.json({ 
        models,
        recommended,
      })
    },
  )

export const RAGRoute = ragRoutes
