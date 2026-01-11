/**
 * Server V2 - Servidor web do ChatIAS com ChatEngine
 * 
 * Arquitetura correta:
 * - Chat é o centro (usa LLM para entender e responder)
 * - Agentes são ferramentas que o chat PODE usar quando necessário
 * - Ollama como provider principal, SDK como fallback
 * 
 * v2.1 - Com sistema de logs detalhado
 */


import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createSystem } from "./src/core/system-loader.js";
import { ChatEngine } from "./src/core/chat-engine.js";
import { logger } from "./src/core/logger.js";
import { createOpencodeClient } from "./sdk/client.js";
import { createOpencodeServer } from "./sdk/server.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 4174;


// Sistema e ChatEngine globais
let system = null;
let chatEngine = null;
let opencodeServer = null;  // Servidor OpenCode (se iniciado automaticamente)


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// Middleware de logging para requests HTTP
app.use((req, res, next) => {
  const requestId = `http_${Date.now()}`;
  req.requestId = requestId;
  
  // Loga requests (exceto static files e health checks)
  if (!req.path.startsWith('/chat-v2') && 
      !req.path.includes('.') && 
      req.path !== '/api/health' &&
      req.path !== '/api/logs') {
    logger.request(req.method, req.path, req.body, requestId);
  }
  
  // Captura response
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
 * Inicializa o sistema
 */
async function initSystem() {
  logger.info('system', '╔════════════════════════════════════════════════════════╗');
  logger.info('system', '║           ChatIAS Pro 2.0 - Initializing               ║');
  logger.info('system', '╚════════════════════════════════════════════════════════╝');


  // 1. Carrega o sistema (agents, tools, KBs, MCPs)
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


  // 2. Configura SDK (OpenCode) como fallback
  let sdkClient = null;
  let sdkUrl = process.env.OPENCODE_URL || "http://localhost:4096";
  const autoStartSdk = process.env.OPENCODE_AUTOSTART === 'true';
  
  try {
    // Testa se já existe um servidor OpenCode rodando
    let sdkConnected = false;
    try {
      const healthCheck = await fetch(`${sdkUrl}/global/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      sdkConnected = healthCheck.ok;
    } catch (e) {
      sdkConnected = false;
    }
    
    // Se não está conectado e autostart está habilitado, inicia o servidor
    if (!sdkConnected && autoStartSdk) {
      logger.info('mcp', 'Starting OpenCode server automatically...', null);
      try {
        opencodeServer = await createOpencodeServer({
          hostname: '127.0.0.1',
          port: 4096,
          timeout: 10000,
          config: {
            model: 'openrouter/google/gemini-2.0-flash-exp:free',
            maxTokens: 2000,  // IMPORTANTE: limita tokens para modelos free
            temperature: 0.7
          }
        });
        sdkUrl = opencodeServer.url;
        sdkConnected = true;
        logger.success('mcp', `OpenCode server started`, { url: sdkUrl });
      } catch (e) {
        logger.warn('mcp', `Failed to start OpenCode server: ${e.message}`);
      }
    }
    
    // Cria cliente SDK
    sdkClient = createOpencodeClient({ baseUrl: sdkUrl });
    
    if (sdkConnected) {
      logger.success('mcp', `SDK connected`, { url: sdkUrl });
    } else {
      logger.warn('mcp', `SDK configured but not reachable`, { url: sdkUrl });
      logger.info('mcp', `Tip: Start OpenCode manually or set OPENCODE_AUTOSTART=true`);
    }
  } catch (error) {
    logger.warn('mcp', `SDK not available: ${error.message}`);
  }


  // 3. Obtém provider Ollama do sistema
  const ollamaProvider = system.mcpRegistry.get("mcp_ollama");
  if (ollamaProvider && ollamaProvider.connected) {
    logger.success('mcp', `Ollama connected`, { url: ollamaProvider.baseUrl });
  } else {
    logger.warn('mcp', 'Ollama not connected');
  }


  // 4. Cria o ChatEngine (cérebro do chat)
  chatEngine = new ChatEngine({
    defaultModel: "llama3.2:latest",
    temperature: 0.7,
    maxTokens: 4000,
    maxHistory: 20,
    smartIntentDetection: true,  // Usa LLM para casos ambíguos
    intentConfidenceThreshold: 0.7
  });


  // 5. Inicializa o ChatEngine com todos os recursos
  await chatEngine.initialize({
    ollama: ollamaProvider,
    sdk: sdkClient,
    toolRegistry: system.toolRegistry,
    agentRegistry: system.agentRegistry
  });


  logger.info('system', '╔════════════════════════════════════════════════════════╗');
  logger.success('system', '║              System Ready                              ║');
  logger.info('system', '╚════════════════════════════════════════════════════════╝');
}


/**
 * GET /api/system - Info do sistema
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
 * GET /api/health - Health check
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
 * POST /api/chat - Endpoint principal do chat
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
    // Processa a mensagem pelo ChatEngine
    const result = await chatEngine.chat(message.trim());


    res.json({
      success: result.success,
      response: result.text,
      intent: result.intent,
      intentConfidence: result.intentConfidence,
      intentMethod: result.intentMethod,
      provider: result.provider,
      usedAgent: result.usedAgent,
      usedTool: result.usedTool,
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
 * POST /api/chat/clear - Limpa histórico de conversa
 */
app.post("/api/chat/clear", (req, res) => {
  if (chatEngine) {
    chatEngine.clearHistory();
    logger.info('system', 'Chat history cleared');
  }
  res.json({ success: true, message: "Histórico limpo" });
});


/**
 * GET /api/agents - Lista agentes disponíveis
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
 * GET /api/tools - Lista ferramentas disponíveis
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
 * GET /api/logs - Retorna logs do sistema
 */
app.get("/api/logs", (req, res) => {
  const { level, category, limit } = req.query;
  
  const logs = logger.getLogs({
    level: level || null,
    category: category || null,
    limit: limit ? parseInt(limit) : 100
  });

  res.json({
    success: true,
    logs,
    count: logs.length,
    stats: logger.getStats()
  });
});


/**
 * GET /api/logs/stream - Server-Sent Events para logs em tempo real
 */
app.get("/api/logs/stream", (req, res) => {
  logger.info('request', 'SSE connection started', null);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering
  res.flushHeaders();

  // Envia evento inicial
  try {
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  } catch (e) {
    logger.error('system', `SSE write error: ${e.message}`);
    return;
  }

  // Intervalo para enviar novos logs
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

  // Cleanup quando conexão fechar
  req.on('close', () => {
    logger.info('request', 'SSE connection closed', null);
    clearInterval(interval);
    if (!res.writableEnded) {
      res.end();
    }
  });
});


/**
 * GET /chat-v2 - Interface web do chat
 */
app.get("/chat-v2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat-v2.html"));
});


/**
 * Inicializa o servidor
 */
async function startServer() {
  try {
    // Inicializa o sistema
    await initSystem();

    // Inicia o servidor HTTP
    app.listen(PORT, () => {
      logger.info('system', '╔════════════════════════════════════════════════════════╗');
      logger.success('system', `║  Server running on http://localhost:${PORT}           ║`);
      logger.info('system', '╠════════════════════════════════════════════════════════╣');
      logger.info('system', `║  Chat UI:    http://localhost:${PORT}/chat-v2          ║`);
      logger.info('system', `║  Health:     http://localhost:${PORT}/api/health       ║`);
      logger.info('system', `║  Tools:      http://localhost:${PORT}/api/tools        ║`);
      logger.info('system', `║  Agents:     http://localhost:${PORT}/api/agents       ║`);
      logger.info('system', `║  Logs:       http://localhost:${PORT}/api/logs         ║`);
      logger.info('system', '╚════════════════════════════════════════════════════════╝');
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
  
  // Shutdown ChatEngine (fecha sessão SDK)
  if (chatEngine) {
    await chatEngine.shutdown();
  }
  
  // Para servidor OpenCode se foi iniciado automaticamente
  if (opencodeServer) {
    await opencodeServer.stop();
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
