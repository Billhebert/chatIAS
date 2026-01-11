/**
 * server-v2.js - ChatIAS Pro 2.0 - Production Version
 * 
 * Funcionalidades:
 * - Verifica se OpenCode já está rodando (porta 4096)
 * - Se sim, usa o existente (testando se funciona)
 * - Se não, cria novo servidor (porta 4097)
 * - Sem timeout no SDK (aguarda indefinidamente)
 * - shell: true para Windows
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createSystem } from "./src/core/system-loader.js";
import { ChatEngine } from "./src/core/chat-engine.js";
import { logger } from "./src/core/logger.js";
import { OllamaEmbedder } from "./src/core/ollama-embedder.js";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4174;
const OPENCODE_CLI = path.normalize(process.env.OPENCODE_CLI || "E:\\app\\OpenCode\\opencode-cli.exe");
const OPENCODE_PORT = process.env.OPENCODE_PORT || 4097;  // Porta para NOVO servidor

// Sistema e ChatEngine globais
let system = null;
let chatEngine = null;
let opencodeProcess = null;  // Processo do opencode-cli.exe (se criado)
let ollamaEmbedder = null;   // Embedder para RAG

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Middleware de logging
app.use((req, res, next) => {
  const requestId = `http_${Date.now()}`;
  req.requestId = requestId;
  
  if (!req.path.startsWith('/chat-v2') && 
      !req.path.includes('.') && 
      req.path !== '/api/health' &&
      req.path !== '/api/logs') {
    logger.request(req.method, req.path, req.body, requestId);
  }
  
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (!req.path.startsWith('/chat-v2') && 
        !req.path.includes('.') && 
        req.path !== '/api/health' &&
        req.path !== '/api/logs') {
      logger.response(res.statusCode, duration, requestId);
    }
  });
  
  next();
});

/**
 * Gerencia o servidor OpenCode
 * 1. Tenta usar servidor existente na porta 4096
 * 2. Se não funcionar, cria novo na porta 4097
 */
async function manageOpenCodeServer() {
  // 1. Primeiro tenta usar servidor existente
  const existingPort = 4096;
  const existingUrl = `http://127.0.0.1:${existingPort}`;
  
  try {
    logger.info('mcp', `Checking for existing OpenCode server on port ${existingPort}...`);
    
    const healthCheck = await fetch(`${existingUrl}/global/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (healthCheck.ok) {
      // Encontrou servidor existente - testa se funciona
      logger.success('mcp', `✅ Found existing OpenCode server`, { url: existingUrl });
      logger.info('mcp', `Testing if existing server is working...`);
      
      const testClient = createOpencodeClient({ baseUrl: existingUrl });
      try {
        const testSession = await testClient.session.create({
          body: { title: "test_connection" }
        });
        logger.success('mcp', `✅ Existing server is working!`, { 
          sessionId: testSession.data?.id 
        });
        logger.success('mcp', `✅ Using existing server (not creating new one)`);
        return existingUrl;
      } catch (sessionError) {
        logger.warn('mcp', `⚠️ Existing server not working: ${sessionError.message}`);
        logger.warn('mcp', `⚠️ Will create new server on port ${OPENCODE_PORT}`);
        throw sessionError;  // Vai para o catch e cria novo
      }
    }
  } catch (e) {
    logger.info('mcp', `No working existing server found, creating new one...`);
  }
  
  // 2. Cria novo servidor OpenCode
  const newServerUrl = `http://127.0.0.1:${OPENCODE_PORT}`;
  logger.info('mcp', `Creating NEW OpenCode server on port ${OPENCODE_PORT}`, { 
    cli: OPENCODE_CLI 
  });
  
  return new Promise((resolve, reject) => {
    const args = [`serve`, `--hostname=127.0.0.1`, `--port=${OPENCODE_PORT}`];
    
    logger.info('mcp', `Executing: ${OPENCODE_CLI} ${args.join(' ')}`, {
      env: `OPENCODE_CONFIG_CONTENT={model:"opencode/glm-4.7-free",maxTokens:2000}`
    });
    
    opencodeProcess = spawn(OPENCODE_CLI, args, {
      shell: true,  // IMPORTANTE para Windows
      env: {
        ...process.env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({
          model: "opencode/glm-4.7-free",
          maxTokens: 2000,  // IMPORTANTE: limita tokens para modelos free
          temperature: 0.7
        })
      }
    });
    
    let output = "";
    let hasResolved = false;
    
    opencodeProcess.stdout?.on('data', (chunk) => {
      if (hasResolved) return;
      
      const text = chunk.toString();
      output += text;
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('listening') || line.includes('listening on')) {
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
          if (match) {
            hasResolved = true;
            logger.success('mcp', `✅ OpenCode server started`, { 
              url: match[1], 
              port: OPENCODE_PORT,
              config: 'maxTokens:2000'
            });
            resolve(match[1]);
            return;
          }
        }
      }
    });
    
    opencodeProcess.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      logger.error('mcp', `OpenCode stderr: ${text}`);
    });
    
    opencodeProcess.on('exit', (code) => {
      logger.warn('mcp', `OpenCode process exited with code ${code}`);
      if (code !== 0 && !hasResolved) {
        reject(new Error(`OpenCode exited with code ${code}`));
      }
    });
    
    opencodeProcess.on('error', (error) => {
      logger.error('mcp', `Failed to spawn OpenCode: ${error.message}`);
      reject(error);
    });
    
    // Timeout de 10s para startup
    setTimeout(() => {
      if (!hasResolved && opencodeProcess && !output.includes('listening')) {
        logger.warn('mcp', `OpenCode startup timeout after 10s, trying to continue...`);
        resolve(newServerUrl);
      }
    }, 10000);
  });
}

/**
 * Inicializa o sistema
 */
async function initSystem() {
  logger.info('system', '╔══════════════════════════════════════════════════════╗');
  logger.info('system', '║           ChatIAS Pro 2.0 - FINAL VERSION          ║');
  logger.info('system', '╚══════════════════════════════════════════════════════╝');

  // 1. Carrega o sistema
  logger.info('system', 'Loading system configuration...');
  
  system = await createSystem({
    configPath: path.join(__dirname, "config", "system-config.json"),
    verbose: false,
    strictValidation: false
  });

  logger.success('system', `System loaded`, {
    agents: system.agentRegistry.size(),
    tools: system.toolRegistry.size(),
    kbs: system.knowledgeBaseRegistry.size(),
    mcps: system.mcpRegistry.size()
  });

  // 2. Gerencia servidor OpenCode (usa existente ou cria novo)
  let sdkClient = null;
  let opencodeUrl = null;
  
  try {
    opencodeUrl = await manageOpenCodeServer();
    
    // Aguarda um pouco para servidor estar pronto
    logger.info('mcp', 'Waiting for OpenCode server to be fully ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verifica health final
    const healthCheck = await fetch(`${opencodeUrl}/global/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!healthCheck.ok) {
      throw new Error(`OpenCode health check failed: ${healthCheck.status}`);
    }
    
    // Cria cliente SDK
    sdkClient = createOpencodeClient({ baseUrl: opencodeUrl });
    logger.success('mcp', `✅ SDK client created successfully`, { url: opencodeUrl });
    
  } catch (error) {
    logger.error('mcp', `Failed to initialize OpenCode: ${error.message}`);
  }

  // 3. Obtém Ollama como fallback
  const ollamaProvider = system.mcpRegistry.get("mcp_ollama");
  if (ollamaProvider && ollamaProvider.connected) {
    logger.success('mcp', `Ollama connected`, { url: ollamaProvider.baseUrl });
    
    // Inicializa embedder para RAG
    logger.info('embedder', 'Initializing Ollama embedder for RAG...');
    ollamaEmbedder = new OllamaEmbedder({
      baseUrl: ollamaProvider.baseUrl,
      model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
      dimensions: 768,
      cacheMaxSize: 500
    });
    
    const embedderInitialized = await ollamaEmbedder.initialize();
    if (embedderInitialized) {
      logger.success('embedder', 'Ollama embedder ready', ollamaEmbedder.getInfo());
    } else {
      logger.warn('embedder', 'Ollama embedder failed to initialize - RAG will use mock embeddings');
      ollamaEmbedder = null;
    }
  } else {
    logger.warn('mcp', 'Ollama not connected - RAG will use mock embeddings');
  }

  // 4. Cria o ChatEngine COM SISTEMA INTELIGENTE
  chatEngine = new ChatEngine({
    defaultModel: "llama3.2:latest",
    temperature: 0.7,
    maxTokens: 4000,
    maxHistory: 20,
    smartIntentDetection: true,
    intentConfidenceThreshold: 0.7,
    // RAG Configuration
    enableRAG: true,
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantCollection: process.env.QDRANT_COLLECTION || 'knowledge_base',
    ragTopK: 5,
    ragScoreThreshold: 0.7,
    embedder: ollamaEmbedder,  // Injeta o embedder do Ollama
    // Smart System
    enableAgents: true,
    enableTools: true
  });

  // 5. Inicializa o ChatEngine
  await chatEngine.initialize({
    ollama: ollamaProvider,
    sdk: sdkClient,
    toolRegistry: system.toolRegistry,
    agentRegistry: system.agentRegistry
  });

  logger.info('system', '╔══════════════════════════════════════════════════════╗');
  logger.success('system', '║              System Ready                              ║');
  logger.info('system', '╚══════════════════════════════════════════════════════╝');
}

/**
 * GET /api/system
 */
app.get("/api/system", (req, res) => {
  if (!system || !chatEngine) {
    return res.status(503).json({ error: "Sistema não inicializado" });
  }

  const systemInfo = system.getSystemInfo();
  const chatInfo = chatEngine.getInfo();

  res.json({
    ...systemInfo,
    chat: chatInfo
  });
});

/**
 * GET /api/health
 */
app.get("/api/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    system: !!system,
    chatEngine: !!chatEngine,
    activeProvider: chatEngine?.activeProvider || null
  };

  if (chatEngine?.ollama) {
    try {
      const isHealthy = await chatEngine.ollama.checkHealth();
      health.ollama = isHealthy ? "connected" : "disconnected";
    } catch {
      health.ollama = "error";
    }
  } else {
    health.ollama = "not_configured";
  }

  health.sdk = chatEngine?.sdk ? "configured" : "not_configured";

  res.json(health);
});

/**
 * POST /api/chat
 */
app.post("/api/chat", async (req, res) => {
  if (!chatEngine) {
    return res.status(503).json({ error: "ChatEngine não inicializado" });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: "Mensagem é obrigatória" });
  }

  try {
    const result = await chatEngine.chat(message.trim());

    res.json({
      success: result.success,
      response: result.text,
      strategy: result.strategy,
      strategyConfidence: result.strategyConfidence,
      strategyReasoning: result.strategyReasoning,
      provider: result.provider,
      usedAgent: result.usedAgent,
      usedTool: result.usedTool,
      usedRAG: result.usedRAG,
      ragResults: result.ragResults,
      duration: result.duration,
      requestId: result.requestId,
      logs: result.logs || [],
      error: result.error
    });

  } catch (error) {
    logger.error('system', `Chat error: ${error.message}`, { stack: error.stack });
    
    res.json({
      success: false,
      error: error.message,
      response: "Desculpe, ocorreu um erro interno."
    });
  }
});

/**
 * POST /api/chat/clear
 */
app.post("/api/chat/clear", (req, res) => {
  if (chatEngine) {
    chatEngine.clearHistory();
    logger.info('system', 'Chat history cleared');
  }
  res.json({ success: true, message: "Histórico limpo" });
});

/**
 * GET /api/agents
 */
app.get("/api/agents", (req, res) => {
  if (!system) {
    return res.status(503).json({ error: "Sistema não inicializado" });
  }

  const agents = system.agentRegistry.list().map(agent => ({
    name: agent.id || agent.name,
    description: agent.description,
    enabled: agent.enabled
  }));

  res.json({
    success: true,
    agents,
    count: agents.length
  });
});

/**
 * GET /api/tools
 */
app.get("/api/tools", (req, res) => {
  if (!system) {
    return res.status(503).json({ error: "Sistema não inicializado" });
  }

  const tools = system.toolRegistry.list().map(tool => ({
    name: tool.id || tool.name,
    description: tool.description,
    enabled: tool.enabled,
    parameters: tool.parameters || tool.config?.parameters
  }));

  res.json({
    success: true,
    tools,
    count: tools.length
  });
});

/**
 * GET /debug-chat - Interface de debug
 */
app.get("/debug-chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "debug-chat.html"));
});

/**
 * GET /api/logs
 */
app.get("/api/logs", (req, res) => {
  const { level, category, limit } = req.query;
  
  const logs = logger.getLogs({
    level: level || null,
    category: category || null,
    limit: limit ? parseInt(limit) :100
  });

  res.json({
    success: true,
    logs,
    count: logs.length,
    stats: logger.getStats()
  });
});

/**
 * GET /api/logs/stream
 */
app.get("/api/logs/stream", (req, res) => {
  logger.info('request', 'SSE connection started', null);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  } catch (e) {
    logger.error('system', `SSE write error: ${e.message}`);
    return;
  }

  const interval = setInterval(() => {
    try {
      const recentLogs = logger.getLogs({ limit: 1 });
      if (recentLogs.length > 0 && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'log', log: recentLogs[0] })}\n\n`);
      }
    } catch (e) {
      logger.error('system', `SSE interval error: ${e.message}`);
      clearInterval(interval);
    }
  }, 500);

  req.on('close', () => {
    logger.info('request', 'SSE connection closed', null);
    clearInterval(interval);
    if (!res.writableEnded) {
      res.end();
    }
  });
});

/**
 * POST /api/rag/add-documents
 * Adiciona documentos ao Qdrant
 */
app.post("/api/rag/add-documents", async (req, res) => {
  if (!chatEngine || !chatEngine.rag) {
    return res.status(503).json({ error: "RAG system not initialized" });
  }

  const { documents } = req.body;

  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ error: "Documents array is required" });
  }

  try {
    const result = await chatEngine.rag.addDocuments(documents);
    res.json({
      success: result.success,
      added: result.added,
      skipped: result.skipped,
      error: result.error
    });
  } catch (error) {
    logger.error('system', `Add documents error: ${error.message}`);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rag/search
 * Busca documentos no Qdrant
 */
app.post("/api/rag/search", async (req, res) => {
  if (!chatEngine || !chatEngine.rag) {
    return res.status(503).json({ error: "RAG system not initialized" });
  }

  const { query, topK, scoreThreshold } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const result = await chatEngine.rag.search(query, { topK, scoreThreshold });
    res.json({
      success: result.success,
      results: result.results,
      context: result.context,
      duration: result.duration,
      error: result.error
    });
  } catch (error) {
    logger.error('system', `RAG search error: ${error.message}`);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rag/info
 * Informações do sistema RAG
 */
app.get("/api/rag/info", (req, res) => {
  if (!chatEngine || !chatEngine.rag) {
    return res.status(503).json({ error: "RAG system not initialized" });
  }

  res.json(chatEngine.rag.getInfo());
});

/**
 * POST /api/decision/analyze
 * Analisa uma mensagem e retorna a decisão (sem executar)
 */
app.post("/api/decision/analyze", async (req, res) => {
  if (!chatEngine || !chatEngine.decisionEngine) {
    return res.status(503).json({ error: "Decision engine not initialized" });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const decision = await chatEngine.decisionEngine.analyze(message);
    res.json({
      success: true,
      decision: {
        strategy: decision.strategy,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        metadata: decision.metadata
      }
    });
  } catch (error) {
    logger.error('system', `Decision analysis error: ${error.message}`);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /chat-v2
 */
app.get("/chat-v2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat-v2.html"));
});

/**
 * GET /debug-chat - Para debugar problemas do frontend
 */
app.get("/debug-chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "debug-chat.html"));
});

/**
 * GET /rag-upload - Página de upload de documentos para RAG
 */
app.get("/rag-upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "rag-upload.html"));
});

/**
 * Inicializa o servidor
 */
async function startServer() {
  try {
    await initSystem();

    app.listen(PORT, () => {
      logger.info('system', '╔══════════════════════════════════════════════════════╗');
      logger.success('system', `║  Server running on http://localhost:${PORT}           ║`);
      logger.info('system', '╠══════════════════════════════════════════════════════╣');
      logger.info('system', `║  Chat UI:    http://localhost:${PORT}/chat-v2          ║`);
      logger.info('system', `║  RAG Upload: http://localhost:${PORT}/rag-upload       ║`);
      logger.info('system', `║  Health:     http://localhost:${PORT}/api/health       ║`);
      logger.info('system', `║  Tools:      http://localhost:${PORT}/api/tools        ║`);
      logger.info('system', `║  Agents:     http://localhost:${PORT}/api/agents       ║`);
      logger.info('system', `║  Logs:       http://localhost:${PORT}/api/logs         ║`);
      logger.info('system', '╚══════════════════════════════════════════════════════╝');
    });

  } catch (error) {
    logger.error('system', `Failed to start server: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('system', 'Shutting down gracefully...');
  
  if (chatEngine) {
    await chatEngine.shutdown();
  }
  
  if (opencodeProcess) {
    opencodeProcess.kill();
    logger.info('system', 'OpenCode server stopped');
  }
  
  logger.info('system', 'Goodbye!');
  process.exit(0);
}

// Handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  logger.error('system', `Uncaught exception: ${error.message}`, { stack: error.stack });
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('system', `Unhandled rejection: ${reason}`, { promise });
});

// Inicia o servidor
startServer();
