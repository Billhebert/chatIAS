/**
 * RAG (Retrieval-Augmented Generation) Module
 * 
 * Gerencia bases de conhecimento por usuário e da empresa,
 * integradas com Qdrant para busca vetorial.
 */

import { z } from "zod"
import { Log } from "../util/log"
import { Database } from "../database"
import { Global } from "../global"
import path from "path"
import fs from "fs/promises"
import { createHash, randomBytes } from "crypto"
import * as Processor from "./processor"
import * as Embedding from "./embedding"
import { BusEvent } from "../bus/bus-event"
import { Bus } from "../bus"

const log = Log.create({ service: "rag" })

// ==================== TIPOS E SCHEMAS ====================

export namespace RAG {
  // Tipo de base de conhecimento
  export const KnowledgeBaseType = z.enum(["user", "company", "project"])
  export type KnowledgeBaseType = z.infer<typeof KnowledgeBaseType>

  // Provider de embedding
  export const EmbeddingProvider = z.enum(["openai", "ollama"])
  export type EmbeddingProvider = z.infer<typeof EmbeddingProvider>

  // Status do documento
  export const DocumentStatus = z.enum(["pending", "processing", "indexed", "error"])
  export type DocumentStatus = z.infer<typeof DocumentStatus>

  // Base de Conhecimento
  export const KnowledgeBase = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(""),
    type: KnowledgeBaseType,
    ownerId: z.string().nullable(), // userId para "user", null para "company"
    collectionName: z.string(), // Nome da coleção no Qdrant
    embeddingProvider: EmbeddingProvider.default("openai"), // Provider de embedding
    embeddingModel: z.string().default("text-embedding-3-small"),
    chunkSize: z.number().default(1000),
    chunkOverlap: z.number().default(200),
    isActive: z.boolean().default(true),
    documentCount: z.number().default(0),
    totalChunks: z.number().default(0),
    createdAt: z.number(),
    updatedAt: z.number(),
    createdBy: z.string().nullable(),
  }).describe("KnowledgeBase")
  export type KnowledgeBase = z.infer<typeof KnowledgeBase>

  // Documento na base de conhecimento
  export const Document = z.object({
    id: z.string(),
    knowledgeBaseId: z.string(),
    filename: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number(), // bytes
    status: DocumentStatus,
    chunkCount: z.number().default(0),
    error: z.string().nullable().default(null),
    metadata: z.record(z.string(), z.any()).default({}),
    createdAt: z.number(),
    updatedAt: z.number(),
    indexedAt: z.number().nullable().default(null),
  }).describe("RAGDocument")
  export type Document = z.infer<typeof Document>

  // Chunk de documento (para referência, armazenado no Qdrant)
  export const Chunk = z.object({
    id: z.string(),
    documentId: z.string(),
    knowledgeBaseId: z.string(),
    content: z.string(),
    embedding: z.array(z.number()).optional(),
    metadata: z.record(z.string(), z.any()).default({}),
    chunkIndex: z.number(),
    startOffset: z.number(),
    endOffset: z.number(),
  }).describe("RAGChunk")
  export type Chunk = z.infer<typeof Chunk>

  // Resultado de busca
  export const SearchResult = z.object({
    chunkId: z.string(),
    documentId: z.string(),
    knowledgeBaseId: z.string(),
    content: z.string(),
    score: z.number(),
    metadata: z.record(z.string(), z.any()),
  }).describe("RAGSearchResult")
  export type SearchResult = z.infer<typeof SearchResult>

  // Inputs
  export const CreateKnowledgeBaseInput = z.object({
    name: z.string().min(2),
    description: z.string().default(""),
    type: KnowledgeBaseType.default("user"),
    embeddingProvider: EmbeddingProvider.default("openai"),
    embeddingModel: z.string().optional(), // Se não fornecido, usa o default do provider
    chunkSize: z.number().min(100).max(4000).default(1000),
    chunkOverlap: z.number().min(0).max(500).default(200),
  })

  export const UpdateKnowledgeBaseInput = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    // Permite alterar provider/model (documentos precisarão ser reprocessados)
    embeddingProvider: z.enum(["openai", "ollama"]).optional(),
    embeddingModel: z.string().optional(),
    chunkSize: z.number().min(100).max(4000).optional(),
    chunkOverlap: z.number().min(0).max(500).optional(),
    isActive: z.boolean().optional(),
  })

  export const SearchInput = z.object({
    query: z.string().min(1),
    knowledgeBaseIds: z.array(z.string()).optional(), // Se vazio, busca em todas acessíveis
    limit: z.number().min(1).max(50).default(10),
    scoreThreshold: z.number().min(0).max(1).default(0.7),
  })

  // ==================== EVENTOS DE PROGRESSO ====================

  export const Event = {
    // Documento foi enviado e aguarda processamento
    DocumentUploaded: BusEvent.define("rag.document.uploaded", z.object({
      documentId: z.string(),
      knowledgeBaseId: z.string(),
      filename: z.string(),
    })),
    // Processamento iniciou
    ProcessingStarted: BusEvent.define("rag.processing.started", z.object({
      documentId: z.string(),
      stage: z.literal("extracting"),
    })),
    // Progresso do processamento
    ProcessingProgress: BusEvent.define("rag.processing.progress", z.object({
      documentId: z.string(),
      stage: z.enum(["extracting", "chunking", "embedding", "indexing"]),
      progress: z.number(), // 0-1
      message: z.string().optional(),
      chunksProcessed: z.number().optional(),
      chunksTotal: z.number().optional(),
    })),
    // Processamento concluído com sucesso
    ProcessingComplete: BusEvent.define("rag.processing.complete", z.object({
      documentId: z.string(),
      knowledgeBaseId: z.string(),
      chunksCreated: z.number(),
      processingTime: z.number(), // ms
    })),
    // Erro no processamento
    ProcessingError: BusEvent.define("rag.processing.error", z.object({
      documentId: z.string(),
      knowledgeBaseId: z.string(),
      error: z.string(),
    })),
    // Contexto RAG foi injetado em uma resposta
    ContextInjected: BusEvent.define("rag.context.injected", z.object({
      sessionID: z.string(),
      userId: z.string(),
      contextLength: z.number(),
      sourcesCount: z.number(),
      sources: z.array(z.object({
        filename: z.string(),
        score: z.number(),
      })),
    })),
  }

  // ==================== CONFIGURAÇÃO DO QDRANT ====================

  interface QdrantConfig {
    host: string
    port: number
    apiKey?: string
  }

  const qdrantConfig: QdrantConfig = {
    host: process.env.SUATEC_QDRANT_HOST || "localhost",
    port: parseInt(process.env.SUATEC_QDRANT_PORT || "6333"),
    apiKey: process.env.SUATEC_QDRANT_API_KEY,
  }

  let qdrantClient: any = null

  // ==================== STORAGE (JSON FILE) ====================

  interface RAGData {
    knowledgeBases: KnowledgeBase[]
    documents: Document[]
  }

  const defaultData: RAGData = {
    knowledgeBases: [],
    documents: [],
  }

  async function getDataPath(): Promise<string> {
    const dir = path.join(Global.Path.data, "rag")
    await fs.mkdir(dir, { recursive: true })
    return path.join(dir, "data.json")
  }

  async function loadData(): Promise<RAGData> {
    try {
      const filePath = await getDataPath()
      const content = await fs.readFile(filePath, "utf-8")
      return JSON.parse(content) as RAGData
    } catch {
      return { ...defaultData }
    }
  }

  async function saveData(data: RAGData): Promise<void> {
    const filePath = await getDataPath()
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  }

  // ==================== HELPERS ====================

  function generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = randomBytes(8).toString("hex")
    return `${timestamp}${random}`
  }

  function generateCollectionName(type: KnowledgeBaseType, ownerId: string | null): string {
    const prefix = type === "company" ? "company" : type === "project" ? "project" : "user"
    const suffix = ownerId || "shared"
    return `suatec_${prefix}_${suffix}_${generateId().slice(0, 8)}`
  }

  // ==================== QDRANT CLIENT ====================

  async function getQdrantClient() {
    if (qdrantClient) return qdrantClient

    try {
      // Dynamic import do cliente Qdrant
      const { QdrantClient } = await import("@qdrant/js-client-rest")
      
      qdrantClient = new QdrantClient({
        host: qdrantConfig.host,
        port: qdrantConfig.port,
        apiKey: qdrantConfig.apiKey,
      })

      // Testar conexão
      await qdrantClient.getCollections()
      log.info("Connected to Qdrant", { host: qdrantConfig.host, port: qdrantConfig.port })
      
      return qdrantClient
    } catch (err: any) {
      log.warn("Qdrant not available, RAG features will be limited", { error: err.message })
      return null
    }
  }

  async function createQdrantCollection(collectionName: string, vectorSize: number = 1536): Promise<boolean> {
    const client = await getQdrantClient()
    if (!client) return false

    try {
      await client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      })
      log.info("Created Qdrant collection", { collectionName })
      return true
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        log.info("Qdrant collection already exists", { collectionName })
        return true
      }
      log.error("Failed to create Qdrant collection", { collectionName, error: err.message })
      return false
    }
  }

  async function deleteQdrantCollection(collectionName: string): Promise<boolean> {
    const client = await getQdrantClient()
    if (!client) return false

    try {
      await client.deleteCollection(collectionName)
      log.info("Deleted Qdrant collection", { collectionName })
      return true
    } catch (err: any) {
      log.error("Failed to delete Qdrant collection", { collectionName, error: err.message })
      return false
    }
  }

  // ==================== KNOWLEDGE BASE CRUD ====================

  export async function createKnowledgeBase(
    input: z.infer<typeof CreateKnowledgeBaseInput>,
    userId: string
  ): Promise<KnowledgeBase> {
    const data = await loadData()
    
    // Para tipo "company", apenas master pode criar
    const isCompany = input.type === "company"
    const ownerId = isCompany ? null : userId

    const collectionName = generateCollectionName(input.type, ownerId)
    
    // Determinar provider e modelo
    const embeddingProvider = input.embeddingProvider || "openai"
    const defaultModel = embeddingProvider === "ollama" ? "nomic-embed-text" : "text-embedding-3-small"
    const embeddingModel = input.embeddingModel || defaultModel
    
    const kb: KnowledgeBase = {
      id: generateId(),
      name: input.name,
      description: input.description || "",
      type: input.type,
      ownerId,
      collectionName,
      embeddingProvider,
      embeddingModel,
      chunkSize: input.chunkSize || 1000,
      chunkOverlap: input.chunkOverlap || 200,
      isActive: true,
      documentCount: 0,
      totalChunks: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userId,
    }

    // Criar coleção no Qdrant com dimensões do modelo de embedding
    const vectorSize = Embedding.getDimensions(kb.embeddingModel, embeddingProvider)
    await createQdrantCollection(collectionName, vectorSize)

    data.knowledgeBases.push(kb)
    await saveData(data)

    log.info("Created knowledge base", { 
      id: kb.id, 
      name: kb.name, 
      type: kb.type,
      embeddingProvider,
      embeddingModel,
      vectorSize,
    })
    return kb
  }

  export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
    const data = await loadData()
    return data.knowledgeBases.find(kb => kb.id === id) || null
  }

  export async function listKnowledgeBases(userId: string, includeCompany: boolean = true): Promise<KnowledgeBase[]> {
    const data = await loadData()
    
    return data.knowledgeBases.filter(kb => {
      // Bases do usuário
      if (kb.ownerId === userId) return true
      // Bases da empresa (se permitido)
      if (includeCompany && kb.type === "company") return true
      return false
    })
  }

  export async function listCompanyKnowledgeBases(): Promise<KnowledgeBase[]> {
    const data = await loadData()
    return data.knowledgeBases.filter(kb => kb.type === "company")
  }

  export async function updateKnowledgeBase(
    id: string,
    input: z.infer<typeof UpdateKnowledgeBaseInput>,
    userId: string
  ): Promise<KnowledgeBase> {
    const data = await loadData()
    const index = data.knowledgeBases.findIndex(kb => kb.id === id)
    
    if (index === -1) {
      throw new Error("Base de conhecimento não encontrada")
    }

    const kb = data.knowledgeBases[index]
    
    // Verificar permissão (dono ou company + master)
    if (kb.ownerId !== userId && kb.type !== "company") {
      throw new Error("Sem permissão para editar esta base")
    }

    const updated: KnowledgeBase = {
      ...kb,
      ...input,
      updatedAt: Date.now(),
    }

    data.knowledgeBases[index] = updated
    await saveData(data)

    log.info("Updated knowledge base", { id, changes: Object.keys(input) })
    return updated
  }

  export async function deleteKnowledgeBase(id: string, userId: string): Promise<void> {
    const data = await loadData()
    const kb = data.knowledgeBases.find(k => k.id === id)
    
    if (!kb) {
      throw new Error("Base de conhecimento não encontrada")
    }

    // Verificar permissão
    if (kb.ownerId !== userId && kb.type !== "company") {
      throw new Error("Sem permissão para excluir esta base")
    }

    // Deletar coleção do Qdrant
    await deleteQdrantCollection(kb.collectionName)

    // Remover documentos associados
    data.documents = data.documents.filter(doc => doc.knowledgeBaseId !== id)
    
    // Remover base
    data.knowledgeBases = data.knowledgeBases.filter(k => k.id !== id)
    
    await saveData(data)
    log.info("Deleted knowledge base", { id, name: kb.name })
  }

  // ==================== DOCUMENT PROCESSING ====================

  /**
   * Process a document asynchronously: extract text, chunk, embed, and index
   */
  async function processDocumentAsync(docId: string, kb: KnowledgeBase): Promise<void> {
    log.info("[RAG] Starting async document processing", { docId, kbId: kb.id, kbName: kb.name })
    const startTime = Date.now()
    
    const data = await loadData()
    const docIndex = data.documents.findIndex(d => d.id === docId)
    
    if (docIndex === -1) {
      log.error("[RAG] Document not found for processing", { docId })
      return
    }

    // Update status to processing
    log.info("[RAG] Updating document status to 'processing'", { docId })
    data.documents[docIndex].status = "processing"
    data.documents[docIndex].updatedAt = Date.now()
    await saveData(data)

    const doc = data.documents[docIndex]
    const filePath = path.join(Global.Path.data, "rag", "documents", doc.knowledgeBaseId, doc.id)
    
    // Publicar evento de início do processamento
    await Bus.publish(RAG.Event.ProcessingStarted, {
      documentId: docId,
      stage: "extracting",
    })
    
    log.info("[RAG] Document file path", { docId, filePath, mimeType: doc.mimeType, filename: doc.originalName })

    try {
      log.info("[RAG] Calling Processor.processDocument", { 
        docId, 
        chunkSize: kb.chunkSize, 
        chunkOverlap: kb.chunkOverlap,
        embeddingProvider: kb.embeddingProvider,
        embeddingModel: kb.embeddingModel,
        collection: kb.collectionName
      })
      
      const result = await Processor.processDocument(
        doc.id,
        doc.knowledgeBaseId,
        filePath,
        doc.mimeType,
        kb.collectionName,
        {
          chunkSize: kb.chunkSize,
          chunkOverlap: kb.chunkOverlap,
          embeddingModel: kb.embeddingModel,
          embeddingProvider: kb.embeddingProvider,
          metadata: {
            filename: doc.originalName,
            mimeType: doc.mimeType,
          },
        },
        // Callback de progresso - publica eventos no Bus
        async (stage, progress, message, chunksProcessed, chunksTotal) => {
          await Bus.publish(RAG.Event.ProcessingProgress, {
            documentId: docId,
            stage,
            progress,
            message,
            chunksProcessed,
            chunksTotal,
          })
        }
      )
      
      log.info("[RAG] Processor.processDocument returned", { docId, result })

      // Reload data (may have changed)
      const freshData = await loadData()
      const freshDocIndex = freshData.documents.findIndex(d => d.id === docId)
      
      if (freshDocIndex !== -1) {
        if (result.success) {
          freshData.documents[freshDocIndex].status = "indexed"
          freshData.documents[freshDocIndex].chunkCount = result.chunksCreated
          freshData.documents[freshDocIndex].indexedAt = Date.now()
          freshData.documents[freshDocIndex].error = null
          
          // Update KB stats
          const kbIndex = freshData.knowledgeBases.findIndex(k => k.id === doc.knowledgeBaseId)
          if (kbIndex !== -1) {
            freshData.knowledgeBases[kbIndex].totalChunks += result.chunksCreated
            freshData.knowledgeBases[kbIndex].updatedAt = Date.now()
          }
          
          log.info("[RAG] Document indexed successfully", { docId, chunks: result.chunksCreated })
          
          // Publicar evento de sucesso
          await Bus.publish(RAG.Event.ProcessingComplete, {
            documentId: docId,
            knowledgeBaseId: doc.knowledgeBaseId,
            chunksCreated: result.chunksCreated,
            processingTime: Date.now() - startTime,
          })
        } else {
          freshData.documents[freshDocIndex].status = "error"
          freshData.documents[freshDocIndex].error = result.error || "Unknown error"
          log.error("[RAG] Document indexing failed", { docId, error: result.error })
          
          // Publicar evento de erro
          await Bus.publish(RAG.Event.ProcessingError, {
            documentId: docId,
            knowledgeBaseId: doc.knowledgeBaseId,
            error: result.error || "Unknown error",
          })
        }
        
        freshData.documents[freshDocIndex].updatedAt = Date.now()
        await saveData(freshData)
      }
    } catch (err: any) {
      log.error("[RAG] Document processing exception", { docId, error: err.message, stack: err.stack })
      
      // Publicar evento de erro
      await Bus.publish(RAG.Event.ProcessingError, {
        documentId: docId,
        knowledgeBaseId: kb.id,
        error: err.message,
      })
      
      // Update document with error
      const freshData = await loadData()
      const freshDocIndex = freshData.documents.findIndex(d => d.id === docId)
      
      if (freshDocIndex !== -1) {
        freshData.documents[freshDocIndex].status = "error"
        freshData.documents[freshDocIndex].error = err.message
        freshData.documents[freshDocIndex].updatedAt = Date.now()
        await saveData(freshData)
      }
      
      log.error("[RAG] Document processing error saved", { docId, error: err.message })
    }
  }

  /**
   * Reprocess a document (e.g., after error or settings change)
   */
  export async function reprocessDocument(docId: string, userId: string): Promise<void> {
    const data = await loadData()
    const doc = data.documents.find(d => d.id === docId)
    
    if (!doc) {
      throw new Error("Documento não encontrado")
    }

    const kb = data.knowledgeBases.find(k => k.id === doc.knowledgeBaseId)
    if (!kb) {
      throw new Error("Base de conhecimento não encontrada")
    }

    // Verify permission
    if (kb.ownerId !== userId && kb.type !== "company") {
      throw new Error("Sem permissão para reprocessar documento")
    }

    // Delete existing chunks from Qdrant
    await Processor.deleteDocumentChunks(docId, kb.collectionName)

    // Reset document stats
    const docIndex = data.documents.findIndex(d => d.id === docId)
    data.documents[docIndex].status = "pending"
    data.documents[docIndex].chunkCount = 0
    data.documents[docIndex].error = null
    data.documents[docIndex].indexedAt = null
    data.documents[docIndex].updatedAt = Date.now()
    await saveData(data)

    // Trigger reprocessing
    processDocumentAsync(docId, kb).catch(err =>
      log.error("Failed to reprocess document", { id: docId, error: err.message })
    )
  }

  // ==================== DOCUMENT CRUD ====================

  export async function addDocument(
    knowledgeBaseId: string,
    file: {
      filename: string
      originalName: string
      mimeType: string
      size: number
      content: Buffer | string
    },
    userId: string
  ): Promise<Document> {
    const data = await loadData()
    const kb = data.knowledgeBases.find(k => k.id === knowledgeBaseId)
    
    if (!kb) {
      throw new Error("Base de conhecimento não encontrada")
    }

    // Verificar permissão
    if (kb.ownerId !== userId && kb.type !== "company") {
      throw new Error("Sem permissão para adicionar documentos")
    }

    const doc: Document = {
      id: generateId(),
      knowledgeBaseId,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      status: "pending",
      chunkCount: 0,
      error: null,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      indexedAt: null,
    }

    data.documents.push(doc)
    
    // Atualizar contagem na base
    const kbIndex = data.knowledgeBases.findIndex(k => k.id === knowledgeBaseId)
    data.knowledgeBases[kbIndex].documentCount += 1
    data.knowledgeBases[kbIndex].updatedAt = Date.now()
    
    await saveData(data)

    // Salvar conteúdo do arquivo
    const docDir = path.join(Global.Path.data, "rag", "documents", knowledgeBaseId)
    await fs.mkdir(docDir, { recursive: true })
    await fs.writeFile(
      path.join(docDir, doc.id),
      typeof file.content === "string" ? file.content : file.content
    )

    log.info("Added document", { id: doc.id, knowledgeBaseId, filename: file.originalName })
    
    // Trigger async processing (extract -> chunk -> embed -> index)
    processDocumentAsync(doc.id, kb).catch(err => 
      log.error("Failed to process document", { id: doc.id, error: err.message })
    )

    return doc
  }

  export async function getDocument(id: string): Promise<Document | null> {
    const data = await loadData()
    return data.documents.find(doc => doc.id === id) || null
  }

  export async function listDocuments(knowledgeBaseId: string): Promise<Document[]> {
    const data = await loadData()
    return data.documents.filter(doc => doc.knowledgeBaseId === knowledgeBaseId)
  }

  export async function deleteDocument(id: string, userId: string): Promise<void> {
    const data = await loadData()
    const doc = data.documents.find(d => d.id === id)
    
    if (!doc) {
      throw new Error("Documento não encontrado")
    }

    const kb = data.knowledgeBases.find(k => k.id === doc.knowledgeBaseId)
    if (!kb) {
      throw new Error("Base de conhecimento não encontrada")
    }

    // Verificar permissão
    if (kb.ownerId !== userId && kb.type !== "company") {
      throw new Error("Sem permissão para excluir documentos")
    }

    // Remove chunks from Qdrant
    await Processor.deleteDocumentChunks(doc.id, kb.collectionName)

    // Remover arquivo
    const docPath = path.join(Global.Path.data, "rag", "documents", doc.knowledgeBaseId, doc.id)
    await fs.unlink(docPath).catch(() => {})

    // Atualizar contagem na base
    const kbIndex = data.knowledgeBases.findIndex(k => k.id === doc.knowledgeBaseId)
    if (kbIndex !== -1) {
      data.knowledgeBases[kbIndex].documentCount -= 1
      data.knowledgeBases[kbIndex].totalChunks -= doc.chunkCount
      data.knowledgeBases[kbIndex].updatedAt = Date.now()
    }

    // Remover documento
    data.documents = data.documents.filter(d => d.id !== id)
    await saveData(data)

    log.info("Deleted document", { id, filename: doc.originalName })
  }

  // ==================== SEARCH ====================

  export async function search(
    input: z.infer<typeof SearchInput>,
    userId: string,
    isAdmin: boolean = false
  ): Promise<SearchResult[]> {
    log.info("RAG search started", {
      query: input.query.substring(0, 50),
      userId,
      isAdmin,
      knowledgeBaseIds: input.knowledgeBaseIds,
    })
    
    const data = await loadData()
    
    log.info("RAG data loaded", {
      totalKnowledgeBases: data.knowledgeBases.length,
      totalDocuments: data.documents.length,
    })
    
    // Determinar quais bases de conhecimento podem ser pesquisadas
    let knowledgeBaseIds = input.knowledgeBaseIds || []
    
    if (knowledgeBaseIds.length === 0) {
      // Buscar em todas as bases acessíveis
      const accessibleBases = data.knowledgeBases.filter(kb => {
        if (!kb.isActive) return false
        if (kb.ownerId === userId) return true
        if (kb.type === "company") return true
        if (isAdmin) return true
        return false
      })
      knowledgeBaseIds = accessibleBases.map(kb => kb.id)
      
      log.info("RAG accessible bases", {
        accessibleCount: accessibleBases.length,
        bases: accessibleBases.map(kb => ({ id: kb.id, name: kb.name, ownerId: kb.ownerId, type: kb.type })),
      })
    } else {
      // Verificar permissão para cada base solicitada
      knowledgeBaseIds = knowledgeBaseIds.filter(id => {
        const kb = data.knowledgeBases.find(k => k.id === id)
        if (!kb || !kb.isActive) return false
        if (kb.ownerId === userId) return true
        if (kb.type === "company") return true
        if (isAdmin) return true
        return false
      })
    }

    if (knowledgeBaseIds.length === 0) {
      log.info("No accessible knowledge bases for user", { userId })
      return []
    }

    const client = await getQdrantClient()
    if (!client) {
      log.warn("Qdrant not available, returning empty results")
      return []
    }

    const results: SearchResult[] = []

    // For each knowledge base, search in Qdrant
    for (const kbId of knowledgeBaseIds) {
      const kb = data.knowledgeBases.find(k => k.id === kbId)
      if (!kb) continue

      try {
        log.info("Searching in knowledge base", {
          kbId,
          kbName: kb.name,
          collectionName: kb.collectionName,
          embeddingModel: kb.embeddingModel,
        })
        
        // Perform vector search using the processor with the KB's embedding provider
        const searchResults = await Processor.vectorSearch(
          input.query,
          kb.collectionName,
          kb.embeddingModel,
          input.limit,
          input.scoreThreshold,
          undefined, // filter
          kb.embeddingProvider
        )
        
        log.info("Search results from KB", {
          kbId,
          resultsCount: searchResults.length,
        })
        
        results.push(...searchResults.map(r => ({
          chunkId: r.id,
          documentId: r.payload.documentId as string,
          knowledgeBaseId: kbId,
          content: r.payload.content as string,
          score: r.score,
          metadata: {
            filename: r.payload.filename,
            chunkIndex: r.payload.chunkIndex,
            ...r.payload,
          },
        })))
      } catch (err: any) {
        log.error("Search failed for knowledge base", { kbId, error: err.message })
      }
    }

    // Ordenar por score e limitar
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, input.limit)
  }

  // ==================== CONTEXTO PARA LLM ====================

  export interface RAGContextResult {
    context: string
    sources: Array<{
      filename: string
      score: number
      documentId?: string
    }>
  }

  /**
   * Busca contexto relevante para uma query e formata para inclusão no prompt da LLM
   * Retorna também metadados sobre as fontes usadas
   */
  export async function getContextForPromptWithMeta(
    query: string,
    userId: string,
    options?: {
      maxTokens?: number
      knowledgeBaseIds?: string[]
      includeCompanyKB?: boolean
    }
  ): Promise<RAGContextResult> {
    const maxTokens = options?.maxTokens || 2000
    const includeCompany = options?.includeCompanyKB ?? true

    log.info("getContextForPromptWithMeta called", {
      query: query.substring(0, 100),
      userId,
      maxTokens,
      includeCompany,
    })

    // Buscar resultados relevantes
    const results = await search({
      query,
      knowledgeBaseIds: options?.knowledgeBaseIds,
      limit: 10,
      scoreThreshold: 0.4, // Threshold mais baixo para capturar mais resultados
    }, userId, false)

    log.info("RAG search completed", {
      resultsCount: results.length,
      userId,
    })

    if (results.length === 0) {
      log.info("No RAG results found")
      return { context: "", sources: [] }
    }

    // Formatar contexto
    let context = "## Contexto da Base de Conhecimento\n\n"
    let tokenEstimate = 0
    const sources: RAGContextResult["sources"] = []

    for (const result of results) {
      const chunk = `### Fonte: ${result.metadata.filename || "Documento"} (Relevância: ${(result.score * 100).toFixed(1)}%)\n${result.content}\n\n`
      const chunkTokens = Math.ceil(chunk.length / 4) // Estimativa grosseira

      if (tokenEstimate + chunkTokens > maxTokens) break

      context += chunk
      tokenEstimate += chunkTokens
      sources.push({
        filename: result.metadata.filename || "Documento",
        score: result.score,
        documentId: result.metadata.documentId,
      })
    }

    log.info("RAG context formatted", {
      contextLength: context.length,
      sourcesCount: sources.length,
    })

    return { context, sources }
  }

  /**
   * Busca contexto relevante para uma query e formata para inclusão no prompt da LLM
   */
  export async function getContextForPrompt(
    query: string,
    userId: string,
    options?: {
      maxTokens?: number
      knowledgeBaseIds?: string[]
      includeCompanyKB?: boolean
    }
  ): Promise<string> {
    const result = await getContextForPromptWithMeta(query, userId, options)
    return result.context
  }

  // ==================== INICIALIZAÇÃO ====================

  export async function initialize(): Promise<void> {
    // Tentar conectar ao Qdrant
    await getQdrantClient()
    
    // Garantir que diretórios existem
    const ragDir = path.join(Global.Path.data, "rag")
    await fs.mkdir(ragDir, { recursive: true })
    await fs.mkdir(path.join(ragDir, "documents"), { recursive: true })

    log.info("RAG module initialized")
  }
}

export default RAG
