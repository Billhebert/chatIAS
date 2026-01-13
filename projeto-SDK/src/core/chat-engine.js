/**
 * ChatEngine - Motor de conversação inteligente
 * 
 * Responsabilidades:
 * - Detectar intenção do usuário (chat, agent, tool)
 * - Decidir qual provider usar (Ollama, SDK)
 * - Chamar agentes quando necessário
 * - Manter histórico de conversação
 * - Orquestrar fallbacks
 */

import { logger } from './logger.js';
import { SmartDecisionEngine } from './smart-decision-engine.js';
import { QdrantRAG } from './qdrant-rag.js';

export class ChatEngine {
  constructor(options = {}) {
    this.defaultModel = options.defaultModel || 'llama3.2:latest';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 4000;
    this.maxHistory = options.maxHistory || 20;
    this.smartIntentDetection = options.smartIntentDetection !== false;
    this.intentConfidenceThreshold = options.intentConfidenceThreshold || 0.7;
    
    this.history = [];
    this.ollama = null;
    this.sdk = null;
    this.sdkSessionId = null;
    this.currentModel = null;
    this.currentModelIndex = 0;
    this.freeModels = null;  // Será preenchido no initialize
    this.toolRegistry = null;
    this.agentRegistry = null;
    this.activeProvider = null;
    this.logs = [];
    
    // Novos sistemas inteligentes
    this.decisionEngine = new SmartDecisionEngine({
      enableRAG: options.enableRAG !== false,
      enableAgents: options.enableAgents !== false,
      enableTools: options.enableTools !== false
    });
    
    this.rag = new QdrantRAG({
      baseUrl: options.qdrantUrl || 'http://localhost:6333',
      collectionName: options.qdrantCollection || 'knowledge_base',
      topK: options.ragTopK || 5,
      scoreThreshold: options.ragScoreThreshold || 0.7,
      enabled: options.enableRAG !== false
    });
    
    this.lastStrategy = null;  // Para contexto de decisão
  }

  /**
   * Inicializa o ChatEngine com recursos
   */
  async initialize(context) {
    this.ollama = context.ollama;
    this.sdk = context.sdk;
    this.toolRegistry = context.toolRegistry;
    this.agentRegistry = context.agentRegistry;
    this.sdkSessionId = null;
    
    // Inicializa RAG
    logger.info('system', 'Initializing RAG system...');
    const ragInitialized = await this.rag.initialize();
    if (ragInitialized) {
      logger.success('system', 'RAG system ready', this.rag.getInfo());
    } else {
      logger.warn('system', 'RAG system disabled - will use LLM only');
    }

    // Cria sessão SDK se disponível
    if (this.sdk) {
      // Lista de modelos free para tentar (em ordem de prioridade)
      // Formato: "provider/model" como string simples
      this.freeModels = [
        // OpenRouter (geralmente mais rápido e confiável)
        { model: 'openrouter/google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (OpenRouter)' },
        { model: 'openrouter/qwen/qwen3-coder:free', name: 'Qwen3 Coder (OpenRouter)' },
        { model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (OpenRouter)' },
        { model: 'openrouter/z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (OpenRouter)' },
        { model: 'openrouter/mistralai/devstral-2512:free', name: 'Devstral (OpenRouter)' },
        
        // ZenMux (backup)
        { model: 'zenmux/z-ai/glm-4.6v-flash-free', name: 'GLM 4.6v Flash (ZenMux)' },
        { model: 'zenmux/kuaishou/kat-coder-pro-v1-free', name: 'Kat Coder Pro (ZenMux)' },
        { model: 'zenmux/xiaomi/mimo-v2-flash-free', name: 'Mimo v2 Flash (ZenMux)' },
        
        // OpenCode (última opção)
        { model: 'opencode/glm-4.7-free', name: 'GLM-4.7 (OpenCode)' },
        { model: 'opencode/minimax-m2.1-free', name: 'MiniMax M2.1 (OpenCode)' }
      ];

      let sessionCreated = false;
      let lastError = null;

      // Tenta criar sessão com cada modelo até um funcionar
      for (const modelConfig of this.freeModels) {
        if (sessionCreated) break;

        try {
          logger.info('chat', `Trying model: ${modelConfig.name}...`);
          
          const sessionResponse = await this.sdk.session.create({
            body: {
              title: `ChatIAS - ${modelConfig.name}`,
              model: modelConfig.model,  // Formato simples: "provider/model"
              maxTokens: 2000  // IMPORTANTE: limita tokens para modelos free
            }
          });

          if (sessionResponse.data && sessionResponse.data.id) {
            this.sdkSessionId = sessionResponse.data.id;
            this.currentModel = modelConfig;
            this.currentModelIndex = this.freeModels.indexOf(modelConfig);
            logger.success('chat', `SDK session created with ${modelConfig.name}: ${this.sdkSessionId}`);
            this.activeProvider = 'sdk';
            sessionCreated = true;
          }
        } catch (error) {
          lastError = error;
          logger.warn('chat', `Model ${modelConfig.name} failed during creation: ${error.message}`);
        }
      }

      if (sessionCreated) {
        logger.success('chat', 'ChatEngine initialized with SDK as primary provider');
      } else {
        logger.error('chat', `Failed to create SDK session with any model. Last error: ${lastError?.message}`);
        this.activeProvider = this.ollama?.connected ? 'ollama' : 'none';
        
        if (this.activeProvider === 'ollama') {
          logger.info('chat', 'Falling back to Ollama as primary provider');
        }
      }
    } else if (this.ollama && this.ollama.connected) {
      this.activeProvider = 'ollama';
      logger.success('chat', 'ChatEngine initialized with Ollama as primary provider');
    } else {
      this.activeProvider = 'none';
      logger.warn('chat', 'ChatEngine initialized without providers');
    }

    // Registra tools disponíveis
    if (this.toolRegistry) {
      const tools = this.toolRegistry.list();
      logger.info('chat', `Registered ${tools.length} tools`);
    }

    // Registra agentes disponíveis
    if (this.agentRegistry) {
      const agents = this.agentRegistry.list();
      logger.info('chat', `Registered ${agents.length} agents`);
    }
  }

  /**
   * Detecta intenção do usuário
   */
  async detectIntent(message) {
    const lower = message.toLowerCase();
    
    // Padrões de intenção (regex)
    const patterns = {
      question: /^(what|who|where|when|why|how|qual|quem|onde|quando|por que|como)\b/i,
      command: /^(execute|run|rodar|executar|fazer)\b/i,
      agent: /(analise|analyze|processe|process|valide|validate)\b/i,
      greeting: /^(oi|olá|hello|hi|hey|bom dia|boa tarde|boa noite)\b/i
    };

    // Detecta com regex (rápido)
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(lower)) {
        logger.debug('intent', `Matched: ${intent} pattern`);
        return {
          type: intent,
          confidence: 0.8,
          method: 'regex'
        };
      }
    }

    // Se não detectou e tem smart detection, usa LLM
    if (this.smartIntentDetection && this.activeProvider !== 'none') {
      try {
        const llmIntent = await this._detectIntentWithLLM(message);
        if (llmIntent.confidence >= this.intentConfidenceThreshold) {
          return llmIntent;
        }
      } catch (error) {
        logger.warn('intent', `LLM intent detection failed: ${error.message}`);
      }
    }

    // Default: conversational
    return {
      type: 'conversational',
      confidence: 0.5,
      method: 'default'
    };
  }

  /**
   * Detecta intenção usando LLM
   */
  async _detectIntentWithLLM(message) {
    const prompt = `Analyze this user message and classify its intent:
Message: "${message}"

Classify as ONE of:
- question: user is asking for information
- command: user wants to execute an action
- agent: user wants to use a specialized agent
- conversational: general conversation
- greeting: saying hello

Respond with ONLY the intent type, nothing else.`;

    let response;
    if (this.activeProvider === 'ollama' && this.ollama) {
      response = await this.ollama.generate({
        model: this.defaultModel,
        prompt,
        temperature: 0.1
      });
    } else if (this.sdk) {
      response = await this.sdk.generate(prompt);
    }

    const intent = response?.text?.trim().toLowerCase();
    const validIntents = ['question', 'command', 'agent', 'conversational', 'greeting'];
    
    if (validIntents.includes(intent)) {
      return {
        type: intent,
        confidence: 0.9,
        method: 'llm'
      };
    }

    return {
      type: 'conversational',
      confidence: 0.5,
      method: 'llm_fallback'
    };
  }

  /**
   * Processa mensagem de chat COM SISTEMA INTELIGENTE
   */
  async chat(message, options = {}) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('request', `Message: "${message}"`, { length: message.length }, requestId);

    try {
      // 1. DECISÃO INTELIGENTE: Qual estratégia usar?
      logger.info('decision', 'Analyzing message with SmartDecisionEngine...', null, requestId);
      const decision = await this.decisionEngine.analyze(message, {
        requestId,
        lastStrategy: this.lastStrategy,
        historySize: this.history.length
      });
      
      logger.success('decision', `Strategy selected: ${decision.strategy}`, {
        confidence: `${Math.round(decision.confidence * 100)}%`,
        reasoning: decision.reasoning
      }, requestId);
      
      this.lastStrategy = decision.strategy;

      // 2. EXECUTA ESTRATÉGIA
      let result;
      
      switch (decision.strategy) {
        case 'llm':
          // Apenas LLM - conversação simples (MAIS RÁPIDO)
          result = await this._handleLLMOnly(message, requestId);
          break;
          
        case 'rag':
          // RAG + LLM - perguntas sobre conhecimento
          result = await this._handleRAGQuery(message, requestId);
          break;
          
        case 'agent':
          // Agente especializado - tarefas complexas
          // Passa a sugestão do decision engine
          result = await this._handleAgentTask(message, requestId, decision.metadata);
          break;
          
        case 'tool':
          // Ferramenta específica - ações diretas
          // Passa a sugestão do decision engine
          result = await this._handleToolCommand(message, requestId, decision.metadata);
          break;
          
        default:
          // Fallback para LLM
          logger.warn('decision', `Unknown strategy "${decision.strategy}", falling back to LLM`, null, requestId);
          result = await this._handleLLMOnly(message, requestId);
      }

      // 3. Adiciona ao histórico
      this._addToHistory('user', message);
      this._addToHistory('assistant', result.text);

      const duration = Date.now() - startTime;
      logger.success('response', `Response generated`, { 
        duration: `${duration}ms`,
        strategy: decision.strategy,
        provider: result.provider 
      }, requestId);

      return {
        success: true,
        text: result.text,
        strategy: decision.strategy,
        strategyConfidence: decision.confidence,
        strategyReasoning: decision.reasoning,
        provider: result.provider,
        usedAgent: result.usedAgent,
        usedTool: result.usedTool,
        usedRAG: result.usedRAG,
        ragResults: result.ragResults,
        duration,
        requestId,
        logs: this._getRequestLogs(requestId)
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('system', `Chat error: ${error.message}`, { stack: error.stack }, requestId);

      return {
        success: false,
        text: "Desculpe, ocorreu um erro ao processar sua mensagem.",
        error: error.message,
        duration,
        requestId,
        logs: this._getRequestLogs(requestId)
      };
    }
  }

  /**
   * Handler: Apenas LLM (conversação simples)
   * Mais rápido - sem busca em RAG, sem agentes
   */
  async _handleLLMOnly(message, requestId) {
    logger.info('llm', 'Using LLM-only mode (fastest)', null, requestId);
    return await this._handleConversationalIntent(message, requestId);
  }

  /**
   * Handler: RAG + LLM (perguntas sobre conhecimento)
   * Busca contexto relevante antes de gerar resposta
   */
  async _handleRAGQuery(message, requestId) {
    logger.info('rag', 'Using RAG mode - searching knowledge base...', null, requestId);
    
    // 1. Busca contexto no Qdrant
    const ragResult = await this.rag.search(message, { requestId });
    
    if (!ragResult.success || ragResult.results.length === 0) {
      logger.warn('rag', 'No relevant context found, falling back to LLM-only', null, requestId);
      return await this._handleLLMOnly(message, requestId);
    }
    
    logger.success('rag', `Found ${ragResult.results.length} relevant documents`, null, requestId);
    
    // 2. Constrói prompt com contexto
    const contextualPrompt = `${ragResult.context}\n\nUsuário: ${message}\n\nAssistente: Baseando-me no contexto acima, vou responder:`;
    
    // 3. Gera resposta com contexto
    const llmResult = await this._handleConversationalIntent(contextualPrompt, requestId);
    
    return {
      ...llmResult,
      usedRAG: true,
      ragResults: ragResult.results.map(r => ({
        score: r.score,
        text: r.text.substring(0, 100) + '...'
      }))
    };
  }

  /**
   * Handler: Tarefas com Agentes
   * Delega para agente especializado
   */
  async _handleAgentTask(message, requestId, metadata = {}) {
    logger.info('agent', 'Using agent mode - finding appropriate agent...', null, requestId);
    
    // Se o decision engine sugeriu um agente específico, usa ele primeiro
    if (metadata.suggestedAgent) {
      logger.info('agent', `Decision engine suggested: ${metadata.suggestedAgent}`, { keywords: metadata.matchedKeywords }, requestId);
      const suggestedAgent = this._findAgentById(metadata.suggestedAgent);
      
      if (suggestedAgent) {
        logger.info('agent', `Using suggested agent: ${suggestedAgent.id}`, null, requestId);
        try {
          const result = await suggestedAgent.execute({ input: message });
          const formatted = this._formatAgentResponse(suggestedAgent, result);

          return {
            text: formatted,
            provider: 'agent',
            usedAgent: suggestedAgent.id
          };
        } catch (error) {
          logger.error('agent', `Suggested agent failed: ${error.message}, trying fallback`, null, requestId);
        }
      } else {
        logger.warn('agent', `Suggested agent "${metadata.suggestedAgent}" not found`, null, requestId);
      }
    }
    
    return await this._handleAgentIntent(message, requestId);
  }

  /**
   * Handler: Ferramenta (ações específicas)
   * Executa ferramenta diretamente
   */
  async _handleToolCommand(message, requestId, metadata = {}) {
    logger.info('tool', 'Using tool mode - executing command...', null, requestId);
    
    // Se o decision engine sugeriu uma ferramenta específica, usa ela primeiro
    if (metadata.suggestedTool) {
      logger.info('tool', `Decision engine suggested: ${metadata.suggestedTool}`, { keywords: metadata.matchedKeywords }, requestId);
      const suggestedTool = this._findToolById(metadata.suggestedTool);
      
      if (suggestedTool) {
        logger.info('tool', `✅ Found suggested tool: ${suggestedTool.id}`, null, requestId);
        logger.info('tool', `🔧 Executing tool: ${suggestedTool.id}`, { name: suggestedTool.name }, requestId);
        try {
          const params = this._extractToolParams(message, metadata.suggestedTool);
          logger.info('tool', `📥 Tool params extracted:`, params, requestId);
          
          const result = await suggestedTool.execute(params);
          
          logger.success('tool', `✅ Tool executed successfully: ${suggestedTool.id}`, { 
            success: result.success,
            hasData: !!result.data 
          }, requestId);
          
          return {
            text: JSON.stringify(result, null, 2),
            provider: 'tool',
            usedTool: suggestedTool.id
          };
        } catch (error) {
          logger.error('tool', `❌ Tool execution failed: ${error.message}`, { stack: error.stack }, requestId);
          logger.error('tool', `Suggested tool failed: ${error.message}, trying fallback`, null, requestId);
        }
      } else {
        logger.warn('tool', `⚠️ Suggested tool "${metadata.suggestedTool}" not found in registry`, null, requestId);
        logger.warn('tool', `Available tools: ${this.toolRegistry ? Array.from(this.toolRegistry.list()).map(t => t.id).join(', ') : 'none'}`, null, requestId);
      }
    }
    
    return await this._handleCommandIntent(message, requestId);
  }

  /**
   * Processa intenção conversacional (usa LLM)
   */
  async _handleConversationalIntent(message, requestId) {
    logger.info('mcp', 'Routing to LLM for conversational response', null, requestId);
    logger.debug('mcp', `SDK state: hasSDK=${!!this.sdk}, sessionId=${this.sdkSessionId}`, null, requestId);

    // Prepara contexto do histórico
    const context = this._buildContextFromHistory();
    const promptWithContext = context ? `${context}\n\nUser: ${message}\nAssistant:` : message;

    // 1. Tenta SDK primeiro (PROVIDER PRINCIPAL)
    if (this.sdk && this.sdkSessionId) {
      logger.info('mcp', 'Using OpenCode SDK (primary provider)...', null, requestId);
      logger.debug('mcp', `Session: ${this.sdkSessionId}, Model: ${this.currentModel?.name || 'unknown'}`, null, requestId);
      try {
        logger.info('mcp', `Sending prompt to SDK...`, { messageLength: message.length }, requestId);
        
        const promptPromise = this.sdk.session.prompt({
          path: { id: this.sdkSessionId },
          body: {
            role: 'user',
            parts: [{ type: 'text', text: message }]
            // NÃO força o modelo aqui - usa o da sessão
          }
        });

        logger.info('mcp', `Waiting for SDK response (NO TIMEOUT - waits indefinitely)...`, null, requestId);
        
        // SEM TIMEOUT - aguarda indefinidamente
        const response = await promptPromise;

        logger.info('mcp', `✅ SDK response received!`, null, requestId);
        
        // Log detalhado da resposta SDK para debug
        logger.info('mcp', `SDK raw response: ${JSON.stringify(response).substring(0, 500)}`, null, requestId);
        logger.debug('mcp', `SDK response type: ${typeof response}, hasData: ${!!response?.data}`, null, requestId);

        // SDK retorna mensagem no formato { data: { parts: [...] } }
        let text = '';
        if (response && response.data) {
          logger.debug('mcp', `SDK data keys: ${Object.keys(response.data).join(', ')}`, null, requestId);
          
          // Formato correto: data.parts[] com type: "text"
          if (response.data.parts && Array.isArray(response.data.parts)) {
            const textPart = response.data.parts.find(p => p.type === 'text');
            if (textPart) {
              text = textPart.text || '';
            }
          }
          
          // Checar se tem erro no response (data.info.error)
          if (response.data.info && response.data.info.error) {
            const errorMsg = response.data.info.error.data?.message || response.data.info.error.name;
            logger.error('mcp', `SDK model error: ${errorMsg}`, null, requestId);
            
            // Se é erro de créditos/modelo, tenta próximo modelo
            if (errorMsg.includes('credits') || errorMsg.includes('max_tokens') || 
                errorMsg.includes('rate limit') || errorMsg.includes('quota')) {
              logger.warn('mcp', `Model ${this.currentModel?.name} failed, trying next model...`, null, requestId);
              logger.info('mcp', `Current model index: ${this.currentModelIndex}, Total models: ${this.freeModels?.length}`, null, requestId);
              
              // Tenta recriar sessão com próximo modelo
              const success = await this._tryNextModel(requestId);
              logger.info('mcp', `Model switch success: ${success}`, null, requestId);
              
              if (success) {
                // Recursão: tenta enviar a mensagem novamente com novo modelo
                logger.info('mcp', `Retrying message with new model...`, null, requestId);
                return await this._handleConversationalIntent(message, requestId);
              } else {
                logger.warn('mcp', `Failed to switch model, falling back...`, null, requestId);
              }
            }
          }
          
          // Fallback: formato antigo com messages
          if (!text && response.data.messages && Array.isArray(response.data.messages)) {
            logger.debug('mcp', `SDK has ${response.data.messages.length} messages`, null, requestId);
            const assistantMsg = response.data.messages.find(m => m.role === 'assistant');
            if (assistantMsg && assistantMsg.parts && assistantMsg.parts[0]) {
              text = assistantMsg.parts[0].text || assistantMsg.parts[0].content || '';
            }
          }
        }

        if (text && text.length > 0) {
          logger.success('mcp', `✅ SDK responded successfully (${text.length} chars)`, null, requestId);
          logger.debug('mcp', `Response text preview: ${text.substring(0, 100)}...`, null, requestId);
          return {
            text: text,
            provider: 'sdk'
          };
        } else {
          logger.warn('mcp', `⚠️ SDK returned empty/invalid response (text="${text}", hasParts=${!!response.data?.parts})`, null, requestId);
        }
      } catch (error) {
        logger.warn('mcp', `SDK failed: ${error.message}, falling back to Ollama...`, null, requestId);
      }
    } else if (this.sdk && !this.sdkSessionId) {
      logger.warn('mcp', 'SDK available but no session created, falling back to Ollama...', null, requestId);
    }

    // 2. Fallback para Ollama
    if (this.ollama && this.ollama.connected) {
      logger.info('mcp', 'Falling back to Ollama (local)...', null, requestId);
      try {
        const response = await this.ollama.generate({
          model: this.defaultModel,
          prompt: promptWithContext,
          temperature: this.temperature
        });

        return {
          text: response.text,
          provider: 'ollama'
        };
      } catch (error) {
        logger.error('mcp', `Ollama failed: ${error.message}`, null, requestId);
      }
    }

    // 3. Fallback final: resposta padrão
    logger.warn('mcp', 'All providers failed, using default response', null, requestId);
    return {
      text: 'Desculpe, não consegui me conectar aos serviços de IA no momento. Por favor, verifique se o servidor OpenCode SDK está rodando (porta 4096) ou se o Ollama está ativo.',
      provider: 'fallback'
    };
  }

  /**
   * Processa intenção de agente
   */
  async _handleAgentIntent(message, requestId) {
    logger.info('agent', 'Processing with agent...', null, requestId);

    // Encontra agente apropriado baseado em keywords
    const agent = this._findBestAgent(message);

    if (!agent) {
      logger.warn('agent', 'No suitable agent found, falling back to conversational', null, requestId);
      return await this._handleConversationalIntent(message, requestId);
    }

    logger.info('agent', `Using agent: ${agent.id}`, null, requestId);

    try {
      const result = await agent.execute({ input: message });
      
      // Formata resposta do agente
      const formatted = this._formatAgentResponse(agent, result);

      return {
        text: formatted,
        provider: 'agent',
        usedAgent: agent.id
      };
    } catch (error) {
      logger.error('agent', `Agent execution failed: ${error.message}`, null, requestId);
      return await this._handleConversationalIntent(message, requestId);
    }
  }

  /**
   * Processa intenção de comando
   */
  async _handleCommandIntent(message, requestId) {
    logger.info('tool', 'Processing as command/tool...', null, requestId);

    // Detecta se é uma tool específica
    const tool = this._detectTool(message);

    if (tool) {
      logger.info('tool', `Using tool: ${tool.id}`, null, requestId);
      try {
        const result = await tool.execute(this._extractToolParams(message));
        return {
          text: JSON.stringify(result, null, 2),
          provider: 'tool',
          usedTool: tool.id
        };
      } catch (error) {
        logger.error('tool', `Tool execution failed: ${error.message}`, null, requestId);
      }
    }

    // Se não achou tool, trata como conversacional
    return await this._handleConversationalIntent(message, requestId);
  }

  /**
   * Encontra melhor agente baseado em keywords
   */
  _findBestAgent(message) {
    if (!this.agentRegistry) return null;

    const agents = this.agentRegistry.list();
    const lower = message.toLowerCase();

    for (const agent of agents) {
      const keywords = agent.routing?.keywords || [];
      if (keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
        return agent;
      }
    }

    return null;
  }
  
  /**
   * Encontra agente por ID específico
   */
  _findAgentById(agentId) {
    if (!this.agentRegistry) return null;
    
    const agents = this.agentRegistry.list();
    return agents.find(agent => agent.id === agentId);
  }
  
  /**
   * Encontra tool por ID específico
   */
  _findToolById(toolId) {
    if (!this.toolRegistry) return null;
    
    const tools = this.toolRegistry.list();
    return tools.find(tool => tool.id === toolId);
  }

  /**
   * Detecta tool baseado na mensagem
   */
  _detectTool(message) {
    if (!this.toolRegistry) return null;
    
    const tools = this.toolRegistry.list();
    const lower = message.toLowerCase();
    
    // Tenta encontrar tool por keywords
    for (const tool of tools) {
      const keywords = tool.routing?.keywords || [];
      if (keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
        return tool;
      }
    }
    
    return null;
  }

  /**
   * Extrai parâmetros para tool baseado no toolId
   */
  _extractToolParams(message, toolId = null) {
    const params = {};
    const lower = message.toLowerCase();
    
    // === CONFIRM8 TOOLS ===
    if (toolId && toolId.startsWith('confirm8_')) {
      // Detecta a ação baseada em palavras-chave
      if (lower.includes('listar') || lower.includes('buscar') || lower.includes('list') || 
          lower.includes('mostrar') || lower.includes('show') || lower.includes('todos') || 
          lower.includes('all')) {
        params.action = 'list';
      } else if (lower.includes('criar') || lower.includes('create') || lower.includes('add') || lower.includes('novo')) {
        params.action = 'create';
      } else if (lower.includes('atualizar') || lower.includes('update') || lower.includes('modificar')) {
        params.action = 'update';
      } else if (lower.includes('deletar') || lower.includes('delete') || lower.includes('remover')) {
        params.action = 'delete';
      } else if (lower.includes('buscar') || lower.includes('get') || lower.includes('ver')) {
        params.action = 'get';
      } else {
        // Default para listagem
        params.action = 'list';
      }
      
      return params;
    }
    
    // === OUTRAS TOOLS ===
    // Extração básica baseada no tipo de tool
    if (toolId === 'soma') {
      // Extrai números da mensagem
      const numbers = message.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        params.a = parseInt(numbers[0]);
        params.b = parseInt(numbers[1]);
      }
    } else if (toolId === 'file_reader') {
      // Extrai path do arquivo
      const pathMatch = message.match(/['"]([^'"]+)['"]/);
      if (pathMatch) {
        params.path = pathMatch[1];
      }
    } else if (toolId === 'json_parser') {
      // Extrai JSON da mensagem
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        params.json = jsonMatch[0];
      }
    } else if (toolId === 'code_executor') {
      // Extrai código entre ```
      const codeMatch = message.match(/```(?:js|javascript)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        params.code = codeMatch[1].trim();
      }
    }
    
    return params;
  }

  /**
   * Formata resposta do agente
   */
  _formatAgentResponse(agent, result) {
    return `[${agent.id}] ${JSON.stringify(result, null, 2)}`;
  }

  /**
   * Constrói contexto do histórico
   */
  _buildContextFromHistory() {
    if (this.history.length === 0) return '';

    return this.history
      .slice(-6) // Últimas 3 trocas
      .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');
  }

  /**
   * Adiciona ao histórico
   */
  _addToHistory(role, content) {
    this.history.push({ role, content, timestamp: new Date().toISOString() });
    
    // Mantém apenas maxHistory mensagens
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  /**
   * Obtém logs de uma request
   */
  _getRequestLogs(requestId) {
    return logger.getRequestLogs(requestId);
  }

  /**
   * Limpa histórico
   */
  clearHistory() {
    this.history = [];
    logger.info('system', 'Chat history cleared');
  }

  /**
   * Limpa logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Informações do ChatEngine
   */
  getInfo() {
    return {
      activeProvider: this.activeProvider,
      defaultModel: this.defaultModel,
      historySize: this.history.length,
      maxHistory: this.maxHistory,
      temperature: this.temperature,
      hasOllama: !!this.ollama,
      hasSDK: !!this.sdk,
      sdkSessionId: this.sdkSessionId,
      toolsCount: this.toolRegistry?.size() || 0,
      agentsCount: this.agentRegistry?.size() || 0,
      rag: this.rag.getInfo(),
      lastStrategy: this.lastStrategy
    };
  }

  /**
   * Tenta próximo modelo da lista
   */
  async _tryNextModel(requestId) {
    if (!this.freeModels || !this.sdk) return false;
    
    const nextIndex = this.currentModelIndex + 1;
    if (nextIndex >= this.freeModels.length) {
      logger.warn('chat', 'No more models to try', null, requestId);
      return false;
    }

    const nextModel = this.freeModels[nextIndex];
    logger.info('chat', `Trying next model: ${nextModel.name}...`, null, requestId);

    try {
      // Fecha sessão atual
      if (this.sdkSessionId) {
        await this.sdk.session.delete({ path: { id: this.sdkSessionId } });
      }

      // Cria nova sessão com próximo modelo
      const sessionResponse = await this.sdk.session.create({
        body: {
          title: `ChatIAS - ${nextModel.name}`,
          model: nextModel.model,
          maxTokens: 2000
        }
      });

      if (sessionResponse.data && sessionResponse.data.id) {
        this.sdkSessionId = sessionResponse.data.id;
        this.currentModel = nextModel;
        this.currentModelIndex = nextIndex;
        logger.success('chat', `Switched to ${nextModel.name}: ${this.sdkSessionId}`, null, requestId);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('chat', `Failed to switch to ${nextModel.name}: ${error.message}`, null, requestId);
      return false;
    }
  }

  /**
   * Shutdown - Limpa recursos e sessões
   */
  async shutdown() {
    logger.info('chat', 'Shutting down ChatEngine...');

    // Fecha sessão SDK se existir
    if (this.sdk && this.sdkSessionId) {
      try {
        logger.info('chat', `Closing SDK session: ${this.sdkSessionId}`);
        await this.sdk.session.delete({
          path: { id: this.sdkSessionId }
        });
        logger.success('chat', 'SDK session closed');
      } catch (error) {
        logger.warn('chat', `Failed to close SDK session: ${error.message}`);
      }
    }

    // Limpa histórico
    this.clearHistory();
    
    logger.success('chat', 'ChatEngine shutdown complete');
  }
}
