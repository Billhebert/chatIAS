/**
 * Document Processing Module for RAG
 * 
 * Handles:
 * - Text extraction from various formats (PDF, DOCX, TXT, MD)
 * - Text chunking with overlap
 * - Embedding generation via OpenAI or Ollama
 * - Qdrant indexing
 */

import { Log } from "../util/log"
import { Global } from "../global"
import path from "path"
import fs from "fs/promises"
import * as Embedding from "./embedding"
import { randomUUID } from "crypto"

const log = Log.create({ service: "rag.processor" })

// ==================== TEXT EXTRACTION ====================

export interface ExtractedText {
  text: string
  metadata: Record<string, any>
}

/**
 * Extract text from various document formats
 */
export async function extractText(
  filePath: string,
  mimeType: string
): Promise<ExtractedText> {
  const content = await fs.readFile(filePath)
  
  // Determine extraction method based on MIME type
  if (mimeType === "application/pdf" || filePath.endsWith(".pdf")) {
    return extractFromPDF(content)
  }
  
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filePath.endsWith(".docx")
  ) {
    return extractFromDOCX(content)
  }
  
  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    filePath.endsWith(".txt") ||
    filePath.endsWith(".md")
  ) {
    return extractFromText(content)
  }
  
  // Fallback: try to read as text
  try {
    return extractFromText(content)
  } catch {
    throw new Error(`Unsupported file format: ${mimeType}`)
  }
}

async function extractFromPDF(content: Buffer): Promise<ExtractedText> {
  log.info("[PDF] Starting PDF extraction", { bufferSize: content.length })
  
  try {
    // pdf-parse v2.x uses PDFParse class and requires Uint8Array
    const pdfParseModule = await import("pdf-parse") as any
    const PDFParse = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse
    
    log.info("[PDF] PDFParse class found", { hasPDFParse: !!PDFParse })
    
    if (!PDFParse) {
      // Fallback for older pdf-parse versions
      const pdfParse = pdfParseModule.default ?? pdfParseModule
      if (typeof pdfParse === "function") {
        log.info("[PDF] Using legacy pdf-parse function")
        const data = await pdfParse(content)
        return {
          text: data.text,
          metadata: {
            numPages: data.numpages,
            info: data.info,
          },
        }
      }
      throw new Error("Could not find PDFParse class or function")
    }
    
    // Convert Buffer to Uint8Array for pdf-parse v2.x
    const uint8Array = new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
    log.info("[PDF] Converted to Uint8Array", { size: uint8Array.length })
    
    // pdf-parse v2.x API
    const parser = new PDFParse(uint8Array)
    log.info("[PDF] Loading PDF...")
    await parser.load()
    log.info("[PDF] PDF loaded successfully")
    
    // Get all text at once using getText()
    log.info("[PDF] Extracting text...")
    const result = await parser.getText()
    const text = result?.text || ""
    const numPages = result?.total || 0
    
    log.info("[PDF] Text extracted", { textLength: text.length, numPages })
    
    // Get document info
    const info = await parser.getInfo()
    log.info("[PDF] Got document info", { title: info?.info?.Title })
    
    parser.destroy()
    
    return {
      text: text.trim(),
      metadata: {
        numPages: numPages,
        info: info?.info || {},
      },
    }
  } catch (err: any) {
    log.error("[PDF] Failed to extract text from PDF", { error: err.message, stack: err.stack })
    throw new Error(`Failed to extract PDF text: ${err.message}`)
  }
}

async function extractFromDOCX(content: Buffer): Promise<ExtractedText> {
  try {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ buffer: content })
    
    return {
      text: result.value,
      metadata: {
        messages: result.messages,
      },
    }
  } catch (err: any) {
    log.error("Failed to extract text from DOCX", { error: err.message })
    throw new Error(`Failed to extract DOCX text: ${err.message}`)
  }
}

function extractFromText(content: Buffer): ExtractedText {
  return {
    text: content.toString("utf-8"),
    metadata: {},
  }
}

// ==================== TEXT CHUNKING ====================

export interface TextChunk {
  content: string
  index: number
  startOffset: number
  endOffset: number
  metadata: Record<string, any>
}

export interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
  separators?: string[]
}

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]

/**
 * Split text into chunks with overlap for better context preservation
 */
export function chunkText(
  text: string,
  options: ChunkingOptions
): TextChunk[] {
  const { chunkSize, chunkOverlap } = options
  const separators = options.separators || DEFAULT_SEPARATORS
  
  const chunks: TextChunk[] = []
  let currentOffset = 0
  
  // Recursive splitting function
  function splitText(text: string, separatorIndex: number): string[] {
    if (separatorIndex >= separators.length) {
      // No more separators, force split by characters
      const result: string[] = []
      for (let i = 0; i < text.length; i += chunkSize) {
        result.push(text.slice(i, i + chunkSize))
      }
      return result
    }
    
    const separator = separators[separatorIndex]
    const parts = separator ? text.split(separator) : [text]
    
    // If no splits or single part too large, try next separator
    if (parts.length === 1 && parts[0].length > chunkSize) {
      return splitText(text, separatorIndex + 1)
    }
    
    // Merge small parts and split large ones
    const result: string[] = []
    let current = ""
    
    for (const part of parts) {
      const partWithSep = current ? separator + part : part
      
      if ((current + partWithSep).length <= chunkSize) {
        current = current + partWithSep
      } else {
        if (current) {
          result.push(current)
        }
        
        // If part itself is too large, recursively split it
        if (part.length > chunkSize) {
          const subParts = splitText(part, separatorIndex + 1)
          result.push(...subParts.slice(0, -1))
          current = subParts[subParts.length - 1] || ""
        } else {
          current = part
        }
      }
    }
    
    if (current) {
      result.push(current)
    }
    
    return result
  }
  
  // Split the text
  const rawChunks = splitText(text, 0)
  
  // Apply overlap and create chunk objects
  for (let i = 0; i < rawChunks.length; i++) {
    let chunkContent = rawChunks[i]
    
    // Add overlap from previous chunk
    if (i > 0 && chunkOverlap > 0) {
      const prevChunk = rawChunks[i - 1]
      const overlapText = prevChunk.slice(-chunkOverlap)
      chunkContent = overlapText + chunkContent
    }
    
    const startOffset = currentOffset
    const endOffset = currentOffset + rawChunks[i].length
    
    chunks.push({
      content: chunkContent.trim(),
      index: i,
      startOffset,
      endOffset,
      metadata: {},
    })
    
    currentOffset = endOffset
  }
  
  // Filter out empty chunks
  return chunks.filter(c => c.content.length > 0)
}

// ==================== EMBEDDING GENERATION ====================

// Re-export from embedding module for backward compatibility
export { 
  generateEmbedding, 
  generateEmbeddings,
  getDimensions,
  getEmbeddingConfig,
  checkProviderHealth,
  listOllamaModels,
  type EmbeddingResult,
} from "./embedding"

// ==================== QDRANT INDEXING ====================

export interface IndexResult {
  chunksIndexed: number
  totalTokens: number
  errors: string[]
}

/**
 * Index chunks into Qdrant
 */
export async function indexChunks(
  chunks: TextChunk[],
  embeddings: number[][],
  collectionName: string,
  documentId: string,
  knowledgeBaseId: string,
  metadata: Record<string, any>
): Promise<IndexResult> {
  const { QdrantClient } = await import("@qdrant/js-client-rest")
  
  const client = new QdrantClient({
    host: process.env.SUATEC_QDRANT_HOST || "localhost",
    port: parseInt(process.env.SUATEC_QDRANT_PORT || "6333"),
    apiKey: process.env.SUATEC_QDRANT_API_KEY,
  })
  
  const points = chunks.map((chunk, i) => ({
    id: randomUUID(), // Qdrant expects UUID format
    vector: embeddings[i],
    payload: {
      documentId,
      knowledgeBaseId,
      content: chunk.content,
      chunkIndex: chunk.index,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      ...metadata,
      ...chunk.metadata,
    },
  }))
  
  const errors: string[] = []
  const batchSize = 100
  let indexed = 0
  
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize)
    
    try {
      await client.upsert(collectionName, {
        wait: true,
        points: batch,
      })
      indexed += batch.length
    } catch (err: any) {
      log.error("Failed to index batch", { error: err.message, batch: i })
      errors.push(`Batch ${i}: ${err.message}`)
    }
  }
  
  return {
    chunksIndexed: indexed,
    totalTokens: 0, // Will be set by caller
    errors,
  }
}

/**
 * Delete all chunks for a document from Qdrant
 */
export async function deleteDocumentChunks(
  documentId: string,
  collectionName: string
): Promise<boolean> {
  try {
    const { QdrantClient } = await import("@qdrant/js-client-rest")
    
    const client = new QdrantClient({
      host: process.env.SUATEC_QDRANT_HOST || "localhost",
      port: parseInt(process.env.SUATEC_QDRANT_PORT || "6333"),
      apiKey: process.env.SUATEC_QDRANT_API_KEY,
    })
    
    await client.delete(collectionName, {
      wait: true,
      filter: {
        must: [
          {
            key: "documentId",
            match: { value: documentId },
          },
        ],
      },
    })
    
    log.info("Deleted document chunks from Qdrant", { documentId, collectionName })
    return true
  } catch (err: any) {
    log.error("Failed to delete document chunks", { error: err.message })
    return false
  }
}

// ==================== VECTOR SEARCH ====================

export interface VectorSearchResult {
  id: string
  score: number
  payload: Record<string, any>
}

/**
 * Search for similar vectors in Qdrant
 */
export async function vectorSearch(
  query: string,
  collectionName: string,
  embeddingModel: string,
  limit: number = 10,
  scoreThreshold: number = 0.7,
  filter?: Record<string, any>,
  embeddingProvider?: Embedding.EmbeddingProviderType
): Promise<VectorSearchResult[]> {
  // Temporarily set provider if specified
  const originalProvider = process.env.SUATEC_EMBEDDING_PROVIDER
  if (embeddingProvider) {
    process.env.SUATEC_EMBEDDING_PROVIDER = embeddingProvider
  }
  
  try {
    // Generate embedding for query
    const { embedding } = await Embedding.generateEmbedding(query, embeddingModel)
    
    const { QdrantClient } = await import("@qdrant/js-client-rest")
    
    const client = new QdrantClient({
      host: process.env.SUATEC_QDRANT_HOST || "localhost",
      port: parseInt(process.env.SUATEC_QDRANT_PORT || "6333"),
      apiKey: process.env.SUATEC_QDRANT_API_KEY,
    })
    
    const results = await client.search(collectionName, {
      vector: embedding,
      limit,
      score_threshold: scoreThreshold,
      filter: filter ? { must: Object.entries(filter).map(([key, value]) => ({
        key,
        match: { value },
      })) } : undefined,
      with_payload: true,
    })
    
    return results.map(r => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as Record<string, any>,
    }))
  } catch (err: any) {
    log.error("Vector search failed", { error: err.message, collectionName })
    throw err
  } finally {
    // Restore original provider
    if (embeddingProvider) {
      if (originalProvider) {
        process.env.SUATEC_EMBEDDING_PROVIDER = originalProvider
      } else {
        delete process.env.SUATEC_EMBEDDING_PROVIDER
      }
    }
  }
}

// ==================== FULL PROCESSING PIPELINE ====================

export interface ProcessingResult {
  success: boolean
  chunksCreated: number
  tokensUsed: number
  error?: string
}

// Callback para reportar progresso
export type ProgressCallback = (
  stage: "extracting" | "chunking" | "embedding" | "indexing",
  progress: number,
  message?: string,
  chunksProcessed?: number,
  chunksTotal?: number
) => Promise<void>

/**
 * Full document processing pipeline:
 * 1. Extract text
 * 2. Chunk text
 * 3. Generate embeddings
 * 4. Index in Qdrant
 */
export async function processDocument(
  documentId: string,
  knowledgeBaseId: string,
  filePath: string,
  mimeType: string,
  collectionName: string,
  options: {
    chunkSize: number
    chunkOverlap: number
    embeddingModel: string
    embeddingProvider?: Embedding.EmbeddingProviderType
    metadata?: Record<string, any>
  },
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  log.info("Starting document processing", { 
    documentId, 
    filePath,
    embeddingProvider: options.embeddingProvider || "default",
    embeddingModel: options.embeddingModel,
  })
  
  // Set provider temporarily if specified
  const originalProvider = process.env.SUATEC_EMBEDDING_PROVIDER
  if (options.embeddingProvider) {
    process.env.SUATEC_EMBEDDING_PROVIDER = options.embeddingProvider
  }
  
  try {
    // Step 1: Extract text
    log.info("Extracting text from document", { documentId })
    await onProgress?.("extracting", 0.1, "Extraindo texto do documento...")
    const { text, metadata: extractedMeta } = await extractText(filePath, mimeType)
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text content extracted from document")
    }
    
    log.info("Text extracted", { documentId, length: text.length })
    await onProgress?.("extracting", 0.2, `Texto extraído: ${text.length} caracteres`)
    
    // Step 2: Chunk text
    log.info("Chunking text", { documentId })
    await onProgress?.("chunking", 0.25, "Dividindo texto em chunks...")
    const chunks = chunkText(text, {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
    })
    
    if (chunks.length === 0) {
      throw new Error("No chunks created from text")
    }
    
    log.info("Text chunked", { documentId, chunkCount: chunks.length })
    await onProgress?.("chunking", 0.3, `Criados ${chunks.length} chunks`, 0, chunks.length)
    
    // Step 3: Generate embeddings using configured provider
    log.info("Generating embeddings", { 
      documentId, 
      chunkCount: chunks.length,
      provider: options.embeddingProvider || process.env.SUATEC_EMBEDDING_PROVIDER || "openai",
    })
    await onProgress?.("embedding", 0.35, `Gerando embeddings para ${chunks.length} chunks...`, 0, chunks.length)
    
    const embedResults = await Embedding.generateEmbeddings(
      chunks.map(c => c.content),
      options.embeddingModel
    )
    
    const totalTokens = embedResults.reduce((sum, r) => sum + r.tokensUsed, 0)
    log.info("Embeddings generated", { documentId, totalTokens, dimensions: embedResults[0]?.dimensions })
    await onProgress?.("embedding", 0.7, `Embeddings gerados (${totalTokens} tokens)`, chunks.length, chunks.length)
    
    // Step 4: Index in Qdrant
    log.info("Indexing in Qdrant", { documentId, collectionName })
    await onProgress?.("indexing", 0.75, "Indexando no Qdrant...")
    const indexResult = await indexChunks(
      chunks,
      embedResults.map(r => r.embedding),
      collectionName,
      documentId,
      knowledgeBaseId,
      {
        ...extractedMeta,
        ...options.metadata,
      }
    )
    
    if (indexResult.errors.length > 0) {
      log.warn("Some chunks failed to index", { documentId, errors: indexResult.errors })
    }
    
    await onProgress?.("indexing", 0.95, `Indexados ${indexResult.chunksIndexed} chunks`, indexResult.chunksIndexed, chunks.length)
    
    log.info("Document processing complete", {
      documentId,
      chunksIndexed: indexResult.chunksIndexed,
      totalTokens,
    })
    
    return {
      success: true,
      chunksCreated: indexResult.chunksIndexed,
      tokensUsed: totalTokens,
    }
  } catch (err: any) {
    log.error("Document processing failed", { documentId, error: err.message })
    return {
      success: false,
      chunksCreated: 0,
      tokensUsed: 0,
      error: err.message,
    }
  } finally {
    // Restore original provider
    if (options.embeddingProvider) {
      if (originalProvider) {
        process.env.SUATEC_EMBEDDING_PROVIDER = originalProvider
      } else {
        delete process.env.SUATEC_EMBEDDING_PROVIDER
      }
    }
  }
}
