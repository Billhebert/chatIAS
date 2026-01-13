/**
 * QdrantRAG - Sistema de Retrieval-Augmented Generation
 * 
 * Integra com Qdrant para buscar conhecimento relevante
 * e aumentar a qualidade das respostas do LLM
 */

import { logger } from './logger.js';

export class QdrantRAG {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:6333';
    this.collectionName = options.collectionName || 'knowledge_base';
    this.topK = options.topK || 5;
    this.scoreThreshold = options.scoreThreshold || 0.7;
    this.maxContextLength = options.maxContextLength || 2000;
    this.enabled = options.enabled !== false;
    
    // Embedding provider (será injetado) - ATUALIZADO
    this.embedder = options.embedder || null;
    
    // Verifica dimensões do embedder
    if (this.embedder && this.embedder.dimensions) {
      this.dimensions = this.embedder.dimensions;
      logger.info('rag', `Using embedder dimensions: ${this.dimensions}`);
    } else {
      this.dimensions = options.dimensions || 768;
      logger.info('rag', `Using default dimensions: ${this.dimensions}`);
    }
    
    // Cache de embeddings (não é mais necessário se o embedder já tem cache)
    this.embeddingCache = new Map();
    this.cacheMaxSize = 100;
  }

  /**
   * Inicializa conexão com Qdrant
   */
  async initialize() {
    if (!this.enabled) {
      logger.info('rag', 'RAG system disabled');
      return false;
    }

    try {
      logger.info('rag', `Connecting to Qdrant at ${this.baseUrl}...`);
      
      // Verifica se Qdrant está rodando
      const healthResponse = await fetch(`${this.baseUrl}/healthz`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Qdrant health check failed: ${healthResponse.status}`);
      }
      
      logger.success('rag', 'Connected to Qdrant');
      
      // Verifica se a collection existe
      const collectionExists = await this._checkCollection();
      if (!collectionExists) {
        logger.warn('rag', `Collection "${this.collectionName}" not found - RAG will be disabled`);
        this.enabled = false;
        return false;
      }
      
      logger.success('rag', `Collection "${this.collectionName}" ready`, {
        topK: this.topK,
        scoreThreshold: this.scoreThreshold
      });
      
      return true;
      
    } catch (error) {
      logger.error('rag', `Failed to initialize RAG: ${error.message}`);
      this.enabled = false;
      return false;
    }
  }

  /**
   * Verifica se a collection existe
   */
  async _checkCollection() {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.status === 404) {
        return false;
      }
      
      if (!response.ok) {
        throw new Error(`Collection check failed: ${response.status}`);
      }
      
      const data = await response.json();
      logger.debug('rag', `Collection info:`, { 
        points: data.result?.points_count,
        vectors: data.result?.vectors_count 
      });
      
      return true;
    } catch (error) {
      logger.warn('rag', `Collection check error: ${error.message}`);
      return false;
    }
  }

  /**
   * Busca contexto relevante para uma query
   */
  async search(query, options = {}) {
    const requestId = options.requestId || 'unknown';
    
    if (!this.enabled) {
      logger.warn('rag', 'RAG is disabled, skipping search', null, requestId);
      return {
        success: false,
        results: [],
        context: '',
        reason: 'RAG disabled'
      };
    }

    try {
      const startTime = Date.now();
      logger.info('rag', `Searching for: "${query.substring(0, 50)}..."`, null, requestId);
      
      // 1. Gera embedding da query
      const embedding = await this._getEmbedding(query, requestId);
      if (!embedding) {
        throw new Error('Failed to generate embedding');
      }
      
      // 2. Busca no Qdrant
      const searchResponse = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: embedding,
          limit: options.topK || this.topK,
          score_threshold: options.scoreThreshold || this.scoreThreshold,
          with_payload: true
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!searchResponse.ok) {
        throw new Error(`Qdrant search failed: ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();
      const results = searchData.result || [];
      
      const duration = Date.now() - startTime;
      logger.success('rag', `Found ${results.length} relevant documents`, { duration: `${duration}ms` }, requestId);
      
      // 3. Formata contexto
      const context = this._formatContext(results, requestId);
      
      return {
        success: true,
        results: results.map(r => ({
          id: r.id,
          score: r.score,
          text: r.payload?.text || '',
          metadata: r.payload?.metadata || {}
        })),
        context,
        duration
      };
      
    } catch (error) {
      logger.error('rag', `Search error: ${error.message}`, null, requestId);
      return {
        success: false,
        results: [],
        context: '',
        error: error.message
      };
    }
  }

  /**
   * Gera embedding para um texto
   * (usa cache quando possível)
   */
  async _getEmbedding(text, requestId) {
    if (!this.embedder) {
      logger.warn('rag', 'No embedder configured, using mock embedding', null, requestId);
      // Mock embedding para testes (usa dimensions configurado)
      const mockEmbedding = Array(this.dimensions).fill(0).map(() => Math.random() - 0.5);
      return mockEmbedding;
    }

    try {
      logger.debug('rag', 'Generating embedding with Ollama...', null, requestId);
      const embedding = await this.embedder.embed(text, { requestId });
      
      // Verifica se as dimensões batem
      if (embedding.length !== this.dimensions) {
        logger.warn('rag', `Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`, null, requestId);
        // Atualiza dimensions se necessário
        this.dimensions = embedding.length;
      }
      
      return embedding;
    } catch (error) {
      logger.error('rag', `Embedding generation failed: ${error.message}`, null, requestId);
      logger.warn('rag', 'Falling back to mock embedding', null, requestId);
      // Fallback para mock
      return Array(this.dimensions).fill(0).map(() => Math.random() - 0.5);
    }
  }

  /**
   * Formata resultados em contexto para o LLM
   */
  _formatContext(results, requestId) {
    if (results.length === 0) {
      logger.debug('rag', 'No results to format', null, requestId);
      return '';
    }

    let context = '--- Contexto Relevante ---\n\n';
    let currentLength = context.length;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const text = result.payload?.text || '';
      const score = result.score || 0;
      
      // Adiciona documento ao contexto
      const docText = `[Documento ${i + 1}] (relevância: ${Math.round(score * 100)}%)\n${text}\n\n`;
      
      // Verifica se não excede o limite
      if (currentLength + docText.length > this.maxContextLength) {
        logger.debug('rag', `Context limit reached at ${i} documents`, null, requestId);
        break;
      }
      
      context += docText;
      currentLength += docText.length;
    }
    
    context += '--- Fim do Contexto ---\n';
    
    logger.debug('rag', `Context formatted`, { 
      documents: results.length, 
      length: currentLength 
    }, requestId);
    
    return context;
  }

  /**
   * Armazena embedding em cache
   */
  _cacheEmbedding(key, embedding) {
    // Se o cache está cheio, remove o mais antigo
    if (this.embeddingCache.size >= this.cacheMaxSize) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    this.embeddingCache.set(key, embedding);
  }

  /**
   * Adiciona documentos à collection
   * (útil para popular o knowledge base)
   */
  async addDocuments(documents, requestId = 'batch') {
    if (!this.enabled) {
      logger.warn('rag', 'RAG is disabled, cannot add documents', null, requestId);
      return { success: false, reason: 'RAG disabled' };
    }

    try {
      logger.info('rag', `Adding ${documents.length} documents...`, null, requestId);
      
      const points = [];
      
      for (const doc of documents) {
        const embedding = await this._getEmbedding(doc.text, requestId);
        if (!embedding) {
          logger.warn('rag', `Skipping document: failed to generate embedding`, null, requestId);
          continue;
        }
        
        points.push({
          id: doc.id || Date.now() + Math.random(),
          vector: embedding,
          payload: {
            text: doc.text,
            metadata: doc.metadata || {}
          }
        });
      }
      
      // Upload em batch
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add documents: ${response.status}`);
      }
      
      logger.success('rag', `Added ${points.length} documents to collection`, null, requestId);
      
      return {
        success: true,
        added: points.length,
        skipped: documents.length - points.length
      };
      
    } catch (error) {
      logger.error('rag', `Add documents error: ${error.message}`, null, requestId);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cria collection (se não existir)
   */
  async createCollection(vectorSize = null) {
    // Usa vectorSize do embedder se disponível
    const size = vectorSize || this.dimensions;
    
    try {
      logger.info('rag', `Creating collection "${this.collectionName}" with ${size} dimensions...`);
      
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectors: {
            size: size,
            distance: 'Cosine'
          }
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create collection: ${response.status}`);
      }
      
      logger.success('rag', `Collection "${this.collectionName}" created`, { dimensions: size });
      this.enabled = true;
      return true;
      
    } catch (error) {
      logger.error('rag', `Create collection error: ${error.message}`);
      return false;
    }
  }

  /**
   * Informações do RAG
   */
  getInfo() {
    return {
      enabled: this.enabled,
      baseUrl: this.baseUrl,
      collectionName: this.collectionName,
      dimensions: this.dimensions,
      topK: this.topK,
      scoreThreshold: this.scoreThreshold,
      hasEmbedder: !!this.embedder,
      embedderInfo: this.embedder ? this.embedder.getInfo() : null
    };
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.embeddingCache.clear();
    logger.info('rag', 'Embedding cache cleared');
  }
}
