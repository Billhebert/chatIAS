/**
 * SmartDecisionEngine - Sistema Inteligente de Decisão
 * 
 * Decide quando usar:
 * - Apenas LLM (conversas simples)
 * - RAG + LLM (perguntas que precisam de conhecimento)
 * - Agentes (tarefas complexas)
 * - Ferramentas (ações específicas)
 * 
 * Filosofia:
 * - Conversas simples: APENAS LLM (rápido, eficiente)
 * - Perguntas sobre conhecimento: RAG + LLM
 * - Comandos/ações: Ferramentas
 * - Tarefas complexas: Agentes
 */

import { logger } from './logger.js';

export class SmartDecisionEngine {
  constructor(options = {}) {
    this.llmConfidenceThreshold = options.llmConfidenceThreshold || 0.7;
    this.ragConfidenceThreshold = options.ragConfidenceThreshold || 0.6;
    this.enableRAG = options.enableRAG !== false;
    this.enableAgents = options.enableAgents !== false;
    this.enableTools = options.enableTools !== false;
    
    // Cache de decisões (evita processar a mesma mensagem várias vezes)
    this.decisionCache = new Map();
    this.cacheMaxSize = 100;
  }

  /**
   * Analisa a mensagem e decide a estratégia
   * 
   * Retorna:
   * {
   *   strategy: 'llm' | 'rag' | 'agent' | 'tool',
   *   confidence: number (0-1),
   *   reasoning: string,
   *   metadata: object
   * }
   */
  async analyze(message, context = {}) {
    const requestId = context.requestId || 'unknown';
    const startTime = Date.now();
    
    // Verifica cache
    const cacheKey = this._getCacheKey(message);
    if (this.decisionCache.has(cacheKey)) {
      const cached = this.decisionCache.get(cacheKey);
      logger.debug('decision', `Using cached decision: ${cached.strategy}`, null, requestId);
      return cached;
    }

    logger.debug('decision', 'Analyzing message...', { length: message.length }, requestId);

    // 1. Análise rápida de padrões (regex-based)
    const quickDecision = this._quickPatternAnalysis(message, requestId);
    if (quickDecision.confidence >= 0.9) {
      logger.info('decision', `Quick decision: ${quickDecision.strategy} (${Math.round(quickDecision.confidence * 100)}%)`, 
        { method: 'pattern', reasoning: quickDecision.reasoning }, requestId);
      this._cacheDecision(cacheKey, quickDecision);
      return quickDecision;
    }

    // 2. Análise semântica (mais profunda)
    const semanticDecision = await this._semanticAnalysis(message, context, requestId);
    if (semanticDecision.confidence >= this.llmConfidenceThreshold) {
      logger.info('decision', `Semantic decision: ${semanticDecision.strategy} (${Math.round(semanticDecision.confidence * 100)}%)`, 
        { method: 'semantic', reasoning: semanticDecision.reasoning }, requestId);
      this._cacheDecision(cacheKey, semanticDecision);
      return semanticDecision;
    }

    // 3. Fallback: conversacional com LLM
    const fallbackDecision = {
      strategy: 'llm',
      confidence: 0.5,
      reasoning: 'No clear pattern or semantic match, defaulting to conversational',
      metadata: { method: 'fallback' },
      duration: Date.now() - startTime
    };

    logger.info('decision', `Fallback decision: llm`, { reasoning: fallbackDecision.reasoning }, requestId);
    this._cacheDecision(cacheKey, fallbackDecision);
    return fallbackDecision;
  }

  /**
   * Análise rápida por padrões (regex-based)
   * - Saudações
   * - Comandos explícitos
   * - Perguntas específicas
   */
  _quickPatternAnalysis(message, requestId) {
    const lower = message.toLowerCase().trim();

    // === SAUDAÇÕES: Apenas LLM ===
    const greetingPatterns = [
      /^(oi|olá|ola|hey|hi|hello|e aí|eai|bom dia|boa tarde|boa noite|good morning|good afternoon|good evening)\b/i,
      /^(tudo bem|como vai|how are you|what's up|whatsup)\b/i
    ];
    
    for (const pattern of greetingPatterns) {
      if (pattern.test(lower)) {
        return {
          strategy: 'llm',
          confidence: 0.95,
          reasoning: 'Greeting detected - simple conversational response',
          metadata: { type: 'greeting', pattern: 'matched' }
        };
      }
    }

    // === AGRADECIMENTOS: Apenas LLM ===
    const thanksPatterns = [
      /^(obrigad[oa]|valeu|thanks|thank you|brigad[oa])\b/i
    ];
    
    for (const pattern of thanksPatterns) {
      if (pattern.test(lower)) {
        return {
          strategy: 'llm',
          confidence: 0.95,
          reasoning: 'Thanks detected - simple acknowledgment',
          metadata: { type: 'thanks', pattern: 'matched' }
        };
      }
    }

    // === CONVERSAS CURTAS: Apenas LLM ===
    // Mensagens muito curtas (< 10 chars) geralmente são conversacionais
    if (lower.length < 10) {
      return {
        strategy: 'llm',
        confidence: 0.85,
        reasoning: 'Very short message - likely conversational',
        metadata: { type: 'short', length: lower.length }
      };
    }

    // === PERGUNTAS SOBRE CONHECIMENTO: RAG ===
    const knowledgeQuestionPatterns = [
      // Perguntas sobre "o que é", "como funciona"
      /^(o que é|what is|o q é|oq é|explique|explain|defina|define)\b/i,
      /\b(como funciona|how does|how to|como fazer|como se faz)\b/i,
      /\b(qual a diferença|what's the difference|diferença entre)\b/i,
      /\b(me explique|me diga sobre|tell me about|fale sobre)\b/i,
      
      // Perguntas com contexto técnico
      /\b(documentação|documentation|docs|api|sdk|função|function|classe|class|método|method)\b/i
    ];
    
    for (const pattern of knowledgeQuestionPatterns) {
      if (pattern.test(lower)) {
        return {
          strategy: 'rag',
          confidence: 0.9,
          reasoning: 'Knowledge question detected - needs RAG for accurate response',
          metadata: { type: 'knowledge_question', pattern: 'matched' }
        };
      }
    }

    // === COMANDOS DE AÇÃO: TOOLS ===
    // Identifica tool ESPECÍFICA baseada em keywords
    const toolPatterns = [
      {
        tool: 'file_reader',
        keywords: ['read file', 'ler arquivo', 'open file', 'abrir arquivo', 'file content', 'conteúdo do arquivo'],
        confidence: 0.95
      },
      {
        tool: 'code_executor',
        keywords: ['execute code', 'executar código', 'run code', 'rodar código', 'execute', 'executar'],
        confidence: 0.95
      },
      {
        tool: 'json_parser',
        keywords: ['parse json', 'parsear json', 'validate json', 'validar json', 'json parser'],
        confidence: 0.95
      },
      {
        tool: 'soma',
        keywords: ['soma', 'somar', 'add', 'addition', 'calcular', 'calculate'],
        confidence: 0.9
      },
      {
        tool: 'confirm8_auth',
        keywords: ['confirm8', 'auth', 'login', 'logout', 'authenticate', 'token', 'autenticar'],
        confidence: 0.95
      },
      {
        tool: 'confirm8_users',
        keywords: ['confirm8', 'user', 'usuario', 'users', 'create user', 'list users', 'employee', 'funcionario'],
        confidence: 0.95
      },
      {
        tool: 'confirm8_clients',
        keywords: ['confirm8', 'client', 'cliente', 'clients', 'create client', 'list clients'],
        confidence: 0.95
      },
      {
        tool: 'confirm8_tasks',
        keywords: ['confirm8', 'task', 'tarefa', 'tasks', 'tarefas', 'create task', 'order', 'checklist'],
        confidence: 0.95
      },
      {
        tool: 'confirm8_tickets',
        keywords: ['confirm8', 'ticket', 'tickets', 'create ticket', 'list tickets'],
        confidence: 0.95
      },
      {
        tool: 'confirm8_items',
        keywords: ['confirm8', 'item', 'items', 'itemtype', 'create item', 'list items'],
        confidence: 0.95
      }
    ];
    
    for (const toolPattern of toolPatterns) {
      const matchedKeywords = toolPattern.keywords.filter(keyword => 
        lower.includes(keyword.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        return {
          strategy: 'tool',
          confidence: toolPattern.confidence,
          reasoning: `Identified ${toolPattern.tool} tool - matched keywords: ${matchedKeywords.join(', ')}`,
          metadata: { 
            type: 'tool_command', 
            pattern: 'matched',
            suggestedTool: toolPattern.tool,
            matchedKeywords
          }
        };
      }
    }
    
    // Fallback genérico para tools
    const genericToolPatterns = [
      /^(execute|run|rodar|executar|listar|list|criar|create|deletar|delete|buscar|search|find|procurar)\b/i,
      /\b(arquivo|file|diretório|directory|pasta|folder)\b.*\b(criar|deletar|listar|buscar)\b/i
    ];
    
    for (const pattern of genericToolPatterns) {
      if (pattern.test(lower)) {
        return {
          strategy: 'tool',
          confidence: 0.8,
          reasoning: 'Action command detected - requires tool execution (no specific tool identified)',
          metadata: { type: 'tool_command', pattern: 'matched_generic' }
        };
      }
    }

    // === TAREFAS COMPLEXAS: AGENTS ===
    // Identifica agent ESPECÍFICO baseado em keywords
    const agentPatterns = [
      {
        agent: 'code_analyzer',
        keywords: ['code', 'código', 'analyze', 'analise', 'syntax', 'sintaxe', 'dependencies', 'dependências', 'import', 'format', 'style', 'lint', 'refatore', 'refactor'],
        confidence: 0.9
      },
      {
        agent: 'data_processor',
        keywords: ['data', 'dados', 'json', 'validate', 'valide', 'transform', 'transforme', 'process', 'processe', 'aggregate', 'agregar'],
        confidence: 0.9
      },
      {
        agent: 'task_manager',
        keywords: ['task', 'tarefa', 'schedule', 'agendar', 'execute', 'executar', 'report', 'relatório'],
        confidence: 0.85
      }
    ];
    
    for (const agentPattern of agentPatterns) {
      const matchedKeywords = agentPattern.keywords.filter(keyword => 
        lower.includes(keyword.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        return {
          strategy: 'agent',
          confidence: agentPattern.confidence,
          reasoning: `Identified ${agentPattern.agent} agent - matched keywords: ${matchedKeywords.join(', ')}`,
          metadata: { 
            type: 'agent_task', 
            pattern: 'matched',
            suggestedAgent: agentPattern.agent,
            matchedKeywords
          }
        };
      }
    }
    
    // Fallback genérico para agents
    const genericAgentPatterns = [
      /\b(analise|analyze|processe|process|valide|validate|teste|test|revise|review)\b/i,
      /\b(otimize|optimize|melhore|improve)\b/i,
      /\b(gere um relatório|generate a report|crie um documento|create a document)\b/i
    ];
    
    for (const pattern of genericAgentPatterns) {
      if (pattern.test(lower)) {
        return {
          strategy: 'agent',
          confidence: 0.75,
          reasoning: 'Complex task detected - requires agent orchestration (no specific agent identified)',
          metadata: { type: 'agent_task', pattern: 'matched_generic' }
        };
      }
    }

    // Nenhum padrão forte detectado
    return {
      strategy: 'unknown',
      confidence: 0.3,
      reasoning: 'No strong pattern match',
      metadata: { method: 'pattern_analysis' }
    };
  }

  /**
   * Análise semântica (mais complexa)
   * Usa heurísticas baseadas em:
   * - Comprimento da mensagem
   * - Presença de palavras-chave
   * - Estrutura da frase
   * - Contexto da conversa
   */
  async _semanticAnalysis(message, context, requestId) {
    const lower = message.toLowerCase();
    const words = lower.split(/\s+/);
    const wordCount = words.length;

    // === Heurística 1: Comprimento da mensagem ===
    // Mensagens curtas (<= 5 palavras) geralmente são conversacionais
    if (wordCount <= 5 && !this._hasKnowledgeKeywords(lower)) {
      return {
        strategy: 'llm',
        confidence: 0.75,
        reasoning: 'Short message without knowledge keywords - conversational',
        metadata: { wordCount, method: 'heuristic_length' }
      };
    }

    // === Heurística 2: Presença de interrogação ===
    const hasQuestionMark = message.includes('?');
    const hasQuestionWord = /^(what|who|where|when|why|how|qual|quem|onde|quando|por que|como)\b/i.test(lower);
    
    if ((hasQuestionMark || hasQuestionWord) && this._hasKnowledgeKeywords(lower)) {
      return {
        strategy: 'rag',
        confidence: 0.8,
        reasoning: 'Question with knowledge keywords - needs RAG',
        metadata: { hasQuestionMark, hasQuestionWord, method: 'heuristic_question' }
      };
    }

    // === Heurística 3: Contexto da conversa ===
    // Se a mensagem anterior foi uma pergunta sobre conhecimento,
    // esta provavelmente é um follow-up
    if (context.lastStrategy === 'rag' && wordCount <= 8) {
      return {
        strategy: 'rag',
        confidence: 0.7,
        reasoning: 'Follow-up to previous RAG query',
        metadata: { lastStrategy: context.lastStrategy, method: 'heuristic_context' }
      };
    }

    // === Heurística 4: Palavras-chave técnicas ===
    if (this._hasTechnicalKeywords(lower)) {
      return {
        strategy: 'rag',
        confidence: 0.75,
        reasoning: 'Technical keywords present - likely needs documentation',
        metadata: { method: 'heuristic_technical' }
      };
    }

    // Nenhuma decisão clara
    return {
      strategy: 'unknown',
      confidence: 0.4,
      reasoning: 'No clear semantic pattern',
      metadata: { method: 'semantic_analysis' }
    };
  }

  /**
   * Verifica se a mensagem tem palavras-chave de conhecimento
   */
  _hasKnowledgeKeywords(text) {
    const knowledgeKeywords = [
      'documentação', 'documentation', 'docs', 'api', 'sdk',
      'função', 'function', 'método', 'method', 'classe', 'class',
      'como funciona', 'how does', 'how to', 'o que é', 'what is',
      'explique', 'explain', 'tutorial', 'guia', 'guide'
    ];
    
    return knowledgeKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Verifica se a mensagem tem palavras-chave técnicas
   */
  _hasTechnicalKeywords(text) {
    const technicalKeywords = [
      'código', 'code', 'script', 'programa', 'program',
      'algoritmo', 'algorithm', 'implementação', 'implementation',
      'bug', 'erro', 'error', 'exception', 'debugging',
      'performance', 'otimização', 'optimization',
      'arquitetura', 'architecture', 'design pattern'
    ];
    
    return technicalKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Gera chave de cache
   */
  _getCacheKey(message) {
    // Normaliza: lowercase, remove espaços extras, limita a 100 chars
    return message.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100);
  }

  /**
   * Armazena decisão em cache
   */
  _cacheDecision(key, decision) {
    // Se o cache está cheio, remove o mais antigo
    if (this.decisionCache.size >= this.cacheMaxSize) {
      const firstKey = this.decisionCache.keys().next().value;
      this.decisionCache.delete(firstKey);
    }
    
    this.decisionCache.set(key, decision);
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.decisionCache.clear();
    logger.info('decision', 'Decision cache cleared');
  }

  /**
   * Estatísticas do cache
   */
  getCacheStats() {
    return {
      size: this.decisionCache.size,
      maxSize: this.cacheMaxSize,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
      hits: this.cacheHits,
      misses: this.cacheMisses
    };
  }
}
