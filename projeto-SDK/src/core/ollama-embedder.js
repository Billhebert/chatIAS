/**
 * OllamaEmbedder - Gerador de embeddings usando Ollama
 * 
 * Modelos recomendados para embeddings:
 * - nomic-embed-text (768 dims) - Melhor qualidade, uso geral
 * - mxbai-embed-large (1024 dims) - Alta performance
 * - all-minilm (384 dims) - Mais rápido, menor
 * 
 * Pull: ollama pull nomic-embed-text
 */

import { logger } from './logger.js';

export class OllamaEmbedder {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'nomic-embed-text';
    this.dimensions = options.dimensions || 768;
    this.batchSize = options.batchSize || 10;
    
    // Cache
    this.embeddingCache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 500;
    
    // Stats
    this.stats = {
      totalEmbeddings: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalDuration: 0
    };
  }

  /**
   * Inicializa e verifica se o modelo está disponível
   */
  async initialize() {
    try {
      logger.info('embedder', `Initializing Ollama embedder with model: ${this.model}`);
      
      // Verifica se Ollama está rodando
      const healthResponse = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Ollama not accessible: ${healthResponse.status}`);
      }
      
      const models = await healthResponse.json();
      const hasModel = models.models?.some(m => m.name.includes(this.model));
      
      if (!hasModel) {
        logger.warn('embedder', `Model "${this.model}" not found locally`);
        logger.info('embedder', `Pulling model "${this.model}"... (this may take a few minutes)`);
        
        // Tenta fazer pull do modelo
        await this._pullModel();
      }
      
      // Testa embedding
      logger.info('embedder', 'Testing embedding generation...');
      const testEmbedding = await this.embed('test', { skipCache: true });
      
      if (!testEmbedding || testEmbedding.length !== this.dimensions) {
        throw new Error(`Embedding test failed: expected ${this.dimensions} dims, got ${testEmbedding?.length || 0}`);
      }
      
      logger.success('embedder', `Ollama embedder ready`, {
        model: this.model,
        dimensions: this.dimensions,
        baseUrl: this.baseUrl
      });
      
      return true;
      
    } catch (error) {
      logger.error('embedder', `Failed to initialize: ${error.message}`);
      return false;
    }
  }

  /**
   * Faz pull do modelo
   */
  async _pullModel() {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.model })
      });
      
      if (!response.ok) {
        throw new Error(`Pull failed: ${response.status}`);
      }
      
      // Stream response (pode demorar)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              logger.info('embedder', `Pull: ${data.status}`);
            }
          } catch (e) {
            // Ignora linhas inválidas
          }
        }
      }
      
      logger.success('embedder', `Model "${this.model}" pulled successfully`);
      
    } catch (error) {
      logger.error('embedder', `Pull error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gera embedding para um texto
   */
  async embed(text, options = {}) {
    const requestId = options.requestId || 'embed';
    const startTime = Date.now();
    
    // Normaliza texto
    const normalizedText = text.trim().toLowerCase();
    
    // Verifica cache (a menos que skipCache seja true)
    if (!options.skipCache) {
      const cached = this._getCachedEmbedding(normalizedText);
      if (cached) {
        this.stats.cacheHits++;
        logger.debug('embedder', 'Using cached embedding', null, requestId);
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    
    try {
      logger.debug('embedder', `Generating embedding for text (${text.length} chars)...`, null, requestId);
      
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text
        }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`Ollama embeddings API failed: ${response.status}`);
      }
      
      const data = await response.json();
      const embedding = data.embedding;
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response');
      }
      
      if (embedding.length !== this.dimensions) {
        logger.warn('embedder', `Unexpected embedding dimensions: ${embedding.length} (expected ${this.dimensions})`);
        // Atualiza dimensions se necessário
        this.dimensions = embedding.length;
      }
      
      const duration = Date.now() - startTime;
      this.stats.totalEmbeddings++;
      this.stats.totalDuration += duration;
      
      logger.debug('embedder', `Embedding generated`, { 
        dimensions: embedding.length,
        duration: `${duration}ms` 
      }, requestId);
      
      // Armazena em cache
      this._cacheEmbedding(normalizedText, embedding);
      
      return embedding;
      
    } catch (error) {
      logger.error('embedder', `Embedding generation failed: ${error.message}`, null, requestId);
      throw error;
    }
  }

  /**
   * Gera embeddings para múltiplos textos (batch)
   */
  async embedBatch(texts, options = {}) {
    const requestId = options.requestId || 'batch';
    logger.info('embedder', `Generating ${texts.length} embeddings in batch...`, null, requestId);
    
    const embeddings = [];
    const batchSize = options.batchSize || this.batchSize;
    
    // Processa em batches para não sobrecarregar
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      logger.debug('embedder', `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`, null, requestId);
      
      // Gera embeddings em paralelo dentro do batch
      const batchPromises = batch.map(text => this.embed(text, { requestId }));
      const batchEmbeddings = await Promise.all(batchPromises);
      
      embeddings.push(...batchEmbeddings);
    }
    
    logger.success('embedder', `Batch complete: ${embeddings.length} embeddings generated`, null, requestId);
    return embeddings;
  }

  /**
   * Busca embedding no cache
   */
  _getCachedEmbedding(text) {
    return this.embeddingCache.get(text);
  }

  /**
   * Armazena embedding em cache
   */
  _cacheEmbedding(text, embedding) {
    // Se o cache está cheio, remove o mais antigo
    if (this.embeddingCache.size >= this.cacheMaxSize) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    this.embeddingCache.set(text, embedding);
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.embeddingCache.clear();
    logger.info('embedder', 'Embedding cache cleared');
  }

  /**
   * Estatísticas
   */
  getStats() {
    const avgDuration = this.stats.totalEmbeddings > 0 
      ? Math.round(this.stats.totalDuration / this.stats.totalEmbeddings)
      : 0;
    
    const cacheHitRate = (this.stats.cacheHits + this.stats.cacheMisses) > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(1)
      : 0;
    
    return {
      model: this.model,
      dimensions: this.dimensions,
      totalEmbeddings: this.stats.totalEmbeddings,
      cacheSize: this.embeddingCache.size,
      cacheMaxSize: this.cacheMaxSize,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      avgDuration: `${avgDuration}ms`,
      totalDuration: `${this.stats.totalDuration}ms`
    };
  }

  /**
   * Informações do embedder
   */
  getInfo() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      baseUrl: this.baseUrl,
      cacheSize: this.embeddingCache.size,
      stats: this.getStats()
    };
  }
}
