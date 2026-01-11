/**
 * BaseKnowledgeBase - Classe base abstrata para Knowledge Bases
 *
 * Garante que todas as knowledge bases tenham:
 * - Métodos de consulta padronizados
 * - Sistema de indexação
 * - Cache de consultas
 * - Versionamento de documentos
 * - Métricas e telemetria
 */

import EventEmitter from 'events';

export class BaseKnowledgeBase extends EventEmitter {
  constructor(config) {
    super();

    // Validação obrigatória
    if (!config) {
      throw new Error('KnowledgeBase config is required');
    }
    if (!config.id) {
      throw new Error('KnowledgeBase id is required');
    }
    if (!config.class) {
      throw new Error('KnowledgeBase class name is required');
    }

    this.id = config.id;
    this.class = config.class;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.version = config.version || '1.0.0';

    // Metadata
    this.description = config.description || '';
    this.tags = config.tags || [];
    this.topics = config.topics || [];

    // Documents
    this.documents = new Map();
    this.documentConfigs = config.documents || [];

    // Index (para busca rápida)
    this.index = new Map();
    this.indexedAt = null;

    // Cache
    this.cache = {
      enabled: config.cache?.enabled !== false,
      ttl: config.cache?.ttl || 3600000, // 1 hora
      maxSize: config.cache?.maxSize || 1000,
      store: new Map()
    };

    // Usage tracking
    this.usedBy = config.usedBy || [];

    // Logs
    this.queryLog = [];

    // Metrics
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalQueryTime: 0,
      averageQueryTime: 0,
      lastQuery: null,
      popularTopics: new Map()
    };

    // State
    this.initialized = false;
    this.indexed = false;
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    // Override em subclasses
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    // Override em subclasses
  }

  /**
   * Lifecycle: Antes da query
   */
  async beforeQuery(query) {
    // Override em subclasses
    return query;
  }

  /**
   * Lifecycle: Após query
   */
  async afterQuery(results) {
    // Override em subclasses
    return results;
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * Carrega documentos para a knowledge base
   */
  async loadDocuments() {
    throw new Error(`loadDocuments() must be implemented by ${this.class}`);
  }

  /**
   * Método abstrato - DEVE ser implementado por todas as subclasses
   * Realiza consulta na knowledge base
   */
  async search(query) {
    throw new Error(`search() must be implemented by ${this.class}`);
  }

  /**
   * Inicializa a knowledge base
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.log('Initializing knowledge base', 'info');

    // Carrega documentos
    await this.loadDocuments();

    // Cria índice
    await this.buildIndex();

    // Chama hook
    await this.onInit();

    this.initialized = true;
    this.log('Knowledge base initialized successfully', 'info');
    this.emit('initialized');
  }

  /**
   * Adiciona um documento
   */
  addDocument(document) {
    if (!document.id) {
      throw new Error('Document must have an id');
    }

    const doc = {
      id: document.id,
      title: document.title || document.id,
      content: document.content || '',
      source: document.source || 'manual',
      priority: document.priority || 'medium',
      tags: document.tags || [],
      metadata: document.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: document.version || '1.0.0'
    };

    this.documents.set(doc.id, doc);
    this.log(`Added document: ${doc.id}`, 'debug');

    // Marca índice como desatualizado
    this.indexed = false;

    this.emit('document-added', doc);
  }

  /**
   * Atualiza um documento
   */
  updateDocument(id, updates) {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }

    const updated = {
      ...doc,
      ...updates,
      id: doc.id, // Não permite alterar ID
      updatedAt: new Date().toISOString()
    };

    this.documents.set(id, updated);
    this.log(`Updated document: ${id}`, 'debug');

    // Marca índice como desatualizado
    this.indexed = false;

    this.emit('document-updated', updated);
  }

  /**
   * Remove um documento
   */
  removeDocument(id) {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }

    this.documents.delete(id);
    this.log(`Removed document: ${id}`, 'debug');

    // Marca índice como desatualizado
    this.indexed = false;

    this.emit('document-removed', doc);
  }

  /**
   * Obtém um documento
   */
  getDocument(id) {
    return this.documents.get(id);
  }

  /**
   * Lista todos os documentos
   */
  listDocuments(filters = {}) {
    let docs = Array.from(this.documents.values());

    // Filtra por tags
    if (filters.tags && filters.tags.length > 0) {
      docs = docs.filter(doc =>
        filters.tags.some(tag => doc.tags.includes(tag))
      );
    }

    // Filtra por priority
    if (filters.priority) {
      docs = docs.filter(doc => doc.priority === filters.priority);
    }

    // Filtra por source
    if (filters.source) {
      docs = docs.filter(doc => doc.source === filters.source);
    }

    return docs;
  }

  /**
   * Constrói índice de busca
   */
  async buildIndex() {
    this.log('Building search index', 'info');

    this.index.clear();

    for (const doc of this.documents.values()) {
      // Indexa por palavras-chave do título e conteúdo
      const words = this.extractKeywords(doc.title + ' ' + doc.content);

      for (const word of words) {
        if (!this.index.has(word)) {
          this.index.set(word, new Set());
        }
        this.index.get(word).add(doc.id);
      }

      // Indexa por tags
      for (const tag of doc.tags) {
        const tagKey = `tag:${tag}`;
        if (!this.index.has(tagKey)) {
          this.index.set(tagKey, new Set());
        }
        this.index.get(tagKey).add(doc.id);
      }

      // Indexa por priority
      const priorityKey = `priority:${doc.priority}`;
      if (!this.index.has(priorityKey)) {
        this.index.set(priorityKey, new Set());
      }
      this.index.get(priorityKey).add(doc.id);
    }

    this.indexed = true;
    this.indexedAt = new Date().toISOString();
    this.log(`Index built: ${this.index.size} keys, ${this.documents.size} documents`, 'info');
  }

  /**
   * Extrai palavras-chave de um texto
   */
  extractKeywords(text) {
    // Remove pontuação, converte para lowercase e divide em palavras
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // Remove palavras muito curtas

    // Remove duplicatas
    return [...new Set(words)];
  }

  /**
   * Busca no índice
   */
  searchIndex(keywords) {
    if (!this.indexed) {
      throw new Error('Index not built. Call buildIndex() first.');
    }

    const results = new Map(); // docId -> score

    for (const keyword of keywords) {
      const docIds = this.index.get(keyword);
      if (docIds) {
        for (const docId of docIds) {
          results.set(docId, (results.get(docId) || 0) + 1);
        }
      }
    }

    // Ordena por score (maior primeiro)
    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([docId, score]) => ({
        document: this.documents.get(docId),
        score
      }));
  }

  /**
   * Verifica cache
   */
  checkCache(queryKey) {
    if (!this.cache.enabled) {
      return null;
    }

    const cached = this.cache.store.get(queryKey);
    if (!cached) {
      return null;
    }

    // Verifica TTL
    const now = Date.now();
    if (now - cached.timestamp > this.cache.ttl) {
      this.cache.store.delete(queryKey);
      return null;
    }

    return cached.results;
  }

  /**
   * Armazena no cache
   */
  storeCache(queryKey, results) {
    if (!this.cache.enabled) {
      return;
    }

    // Verifica tamanho do cache
    if (this.cache.store.size >= this.cache.maxSize) {
      // Remove entrada mais antiga
      const firstKey = this.cache.store.keys().next().value;
      this.cache.store.delete(firstKey);
    }

    this.cache.store.set(queryKey, {
      results,
      timestamp: Date.now()
    });
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.cache.store.clear();
    this.log('Cache cleared', 'info');
  }

  /**
   * Método principal de consulta (wrapper)
   */
  async query(query) {
    // Check if enabled
    if (!this.enabled) {
      throw new Error(`KnowledgeBase ${this.id} is disabled`);
    }

    // Check if initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Generate cache key
      const cacheKey = typeof query === 'string' ? query : JSON.stringify(query);

      // Check cache
      const cached = this.checkCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        this.log('Cache hit', 'debug');
        return cached;
      }

      this.metrics.cacheMisses++;

      // Before query hook
      const processedQuery = await this.beforeQuery(query);

      // Search
      this.log(`Querying: ${JSON.stringify(processedQuery)}`, 'debug');
      const results = await this.search(processedQuery);

      // After query hook
      const processedResults = await this.afterQuery(results);

      // Store in cache
      this.storeCache(cacheKey, processedResults);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(query, duration);

      this.log(`Query completed in ${duration}ms, ${processedResults.length} results`, 'info');
      this.emit('queried', { query: processedQuery, results: processedResults, duration });

      return processedResults;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Query failed after ${duration}ms: ${error.message}`, 'error');
      this.emit('error', { query, error, duration });
      throw error;
    }
  }

  /**
   * Busca por tópico
   */
  async queryByTopic(topic) {
    return await this.query({ type: 'topic', value: topic });
  }

  /**
   * Busca por tags
   */
  async queryByTags(tags) {
    return await this.query({ type: 'tags', value: tags });
  }

  /**
   * Busca por priority
   */
  async queryByPriority(priority) {
    return await this.query({ type: 'priority', value: priority });
  }

  /**
   * Atualiza métricas
   */
  updateMetrics(query, duration) {
    this.metrics.totalQueries++;
    this.metrics.totalQueryTime += duration;
    this.metrics.averageQueryTime = this.metrics.totalQueryTime / this.metrics.totalQueries;
    this.metrics.lastQuery = new Date().toISOString();

    // Track popular topics
    if (typeof query === 'object' && query.type === 'topic') {
      const topic = query.value;
      this.metrics.popularTopics.set(
        topic,
        (this.metrics.popularTopics.get(topic) || 0) + 1
      );
    }
  }

  /**
   * Sistema de logging
   */
  log(message, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      kb: this.id,
      level,
      message
    };

    this.queryLog.push(entry);

    // Keep only last 500 entries
    if (this.queryLog.length > 500) {
      this.queryLog = this.queryLog.slice(-500);
    }

    this.emit('log', entry);
  }

  /**
   * Obtém logs
   */
  getLog() {
    return this.queryLog;
  }

  /**
   * Limpa logs
   */
  clearLog() {
    this.queryLog = [];
  }

  /**
   * Obtém métricas
   */
  getMetrics() {
    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      ...this.metrics,
      cacheHitRate: cacheTotal > 0
        ? (this.metrics.cacheHits / cacheTotal) * 100
        : 0,
      popularTopics: Array.from(this.metrics.popularTopics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }))
    };
  }

  /**
   * Obtém informações da knowledge base
   */
  getInfo() {
    return {
      id: this.id,
      class: this.class,
      version: this.version,
      description: this.description,
      tags: this.tags,
      topics: this.topics,
      enabled: this.enabled,
      initialized: this.initialized,
      indexed: this.indexed,
      indexedAt: this.indexedAt,
      documentCount: this.documents.size,
      indexSize: this.index.size,
      cacheSize: this.cache.store.size,
      usedBy: this.usedBy,
      metrics: this.getMetrics()
    };
  }

  /**
   * Habilita a knowledge base
   */
  enable() {
    this.enabled = true;
    this.log('Knowledge base enabled', 'info');
    this.emit('enabled');
  }

  /**
   * Desabilita a knowledge base
   */
  disable() {
    this.enabled = false;
    this.log('Knowledge base disabled', 'info');
    this.emit('disabled');
  }

  /**
   * Exporta knowledge base
   */
  export() {
    return {
      id: this.id,
      class: this.class,
      version: this.version,
      description: this.description,
      tags: this.tags,
      topics: this.topics,
      documents: Array.from(this.documents.values()),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Importa knowledge base
   */
  async import(data) {
    this.log('Importing knowledge base', 'info');

    for (const doc of data.documents || []) {
      this.addDocument(doc);
    }

    // Reconstrói índice
    await this.buildIndex();

    this.log(`Imported ${data.documents?.length || 0} documents`, 'info');
  }

  /**
   * Destrói a knowledge base
   */
  async destroy() {
    this.log('Destroying knowledge base', 'info');

    // Chama hook
    await this.onDestroy();

    // Limpa dados
    this.documents.clear();
    this.index.clear();
    this.clearCache();

    this.initialized = false;
    this.indexed = false;

    this.emit('destroyed');
    this.removeAllListeners();
  }
}
