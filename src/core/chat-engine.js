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
    this.toolRegistry = null;
    this.agentRegistry = null;
    this.activeProvider = null;
    this.logs = [];
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

    // Cria sessão SDK se disponível
    if (this.sdk) {
      // Lista de modelos free para tentar (em ordem de prioridade)
      const freeModels = [
        { provider: 'opencode', model: 'minimax-m2.1-free', name: 'MiniMax M2.1 Free' },
        { provider: 'opencode', model: 'glm-4.7-free', name: 'GLM-4.7 Free' },
        { provider: 'openrouter', model: 'kwaipilot/kat-coder-pro:free', name: 'Kwai Coder Free' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-thinking-exp:free', name: 'Gemini 2.0 Flash Free' }
      ];

      let sessionCreated = false;
      let lastError = null;

      // Tenta criar sessão com cada modelo até um funcionar
      for (const modelConfig of freeModels) {
        if (sessionCreated) break;

        try {
          logger.info('chat', `Trying model: ${modelConfig.name}...`);
          
          const sessionResponse = await this.sdk.session.create({
            body: {
              name: 'ChatIAS-Session',
              model: {
                provider: modelConfig.provider,
                model: modelConfig.model,
                temperature: 0.7,
                maxTokens: 2000  // Configuração conservadora para modelos free
              }
            }
          });

          if (sessionResponse.data && sessionResponse.data.id) {
            this.sdkSessionId = sessionResponse.data.id;
            this.currentModel = modelConfig;
            logger.success('chat', `SDK session created with ${modelConfig.name}: ${this.sdkSessionId}`);
            this.activeProvider = 'sdk';
            sessionCreated = true;
          }
        } catch (error) {
          lastError = error;
          logger.warn('chat', `Model ${modelConfig.name} failed: ${error.message}`);
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
   * Processa mensagem de chat
   */
  async chat(message, options = {}) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.info('request', `Message: "${message}"`, { length: message.length }, requestId);

    try {
      // 1. Detecta intenção
      logger.debug('intent', 'Starting intent analysis...', null, requestId);
      const intent = await this.detectIntent(message);
      logger.info('intent', `Detected: ${intent.type} (${Math.round(intent.confidence * 100)}% via ${intent.method})`, null, requestId);

      // 2. Processa baseado na intenção
      logger.info('system', `Processing as: ${intent.type}`, null, requestId);
      let result;

      if (intent.type === 'agent') {
        result = await this._handleAgentIntent(message, requestId);
      } else if (intent.type === 'command') {
        result = await this._handleCommandIntent(message, requestId);
      } else {
        result = await this._handleConversationalIntent(message, requestId);
      }

      // 3. Adiciona ao histórico
      this._addToHistory('user', message);
      this._addToHistory('assistant', result.text);

      const duration = Date.now() - startTime;
      logger.success('response', `Response generated`, { 
        duration: `${duration}ms`,
        intent: intent.type,
        provider: result.provider 
      }, requestId);

      return {
        success: true,
        text: result.text,
        intent: intent.type,
        intentConfidence: intent.confidence,
        intentMethod: intent.method,
        provider: result.provider,
        usedAgent: result.usedAgent,
        usedTool: result.usedTool,
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
      try {
        // Timeout de 15 segundos para SDK
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SDK timeout after 15s')), 15000)
        );

        const promptPromise = this.sdk.session.prompt({
          path: { id: this.sdkSessionId },
          body: {
            role: 'user',
            parts: [{ type: 'text', text: message }]  // SDK espera parts com type e text
          }
        });

        const response = await Promise.race([promptPromise, timeoutPromise]);

        logger.debug('mcp', `SDK raw response: ${JSON.stringify(response)}`, null, requestId);
        logger.debug('mcp', `SDK response type: ${typeof response}, hasData: ${!!response?.data}`, null, requestId);

        // SDK retorna mensagem no formato { data: { messages: [...] } }
        let text = '';
        if (response && response.data) {
          // Formato com array de mensagens
          if (response.data.messages && Array.isArray(response.data.messages)) {
            const assistantMsg = response.data.messages.find(m => m.role === 'assistant');
            if (assistantMsg && assistantMsg.parts && assistantMsg.parts[0]) {
              text = assistantMsg.parts[0].text || assistantMsg.parts[0].content || '';
            }
          }
          // Fallback: tenta outros formatos
          if (!text && response.data.content) {
            text = response.data.content;
          }
          if (!text && typeof response.data === 'string') {
            text = response.data;
          }
        }

        if (text && text.length > 0) {
          logger.success('mcp', `SDK responded successfully (${text.length} chars)`, null, requestId);
          return {
            text: text,
            provider: 'sdk'
          };
        } else {
          logger.warn('mcp', 'SDK returned empty/invalid response, falling back...', null, requestId);
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
   * Detecta tool baseado na mensagem
   */
  _detectTool(message) {
    // Implementação simplificada
    return null;
  }

  /**
   * Extrai parâmetros para tool
   */
  _extractToolParams(message) {
    // Implementação simplificada
    return {};
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
      agentsCount: this.agentRegistry?.size() || 0
    };
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
