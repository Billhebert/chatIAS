#!/usr/bin/env node

/**
 * CLI INTERATIVO DE AGENTES
 * Interface de linha de comando para interagir com agentes e verificar chamadas
 */

import readline from "readline";
import fs from "fs";
import path from "path";
import { agentSystem } from "./modules/index.js";
import { globalToolRegistry } from "./lib/tools/index.js";
import { createOpencode } from "./sdk/index.js";
import { createOllamaClient } from "./lib/ollama/index.js";
import dotenv from "dotenv";


dotenv.config();

const REMOTE_MODELS = [
  { providerID: "opencode", modelID: "minimax-m2.1-free" },
  { providerID: "opencode", modelID: "glm-4.7-free" },
  { providerID: "openrouter", modelID: "kwaipilot/kat-coder-pro:free" },
  { providerID: "openrouter", modelID: "google/gemini-2.0-flash-exp:free" },
  { providerID: "openrouter", modelID: "qwen/qwen3-coder:free" },
  { providerID: "openrouter", modelID: "mistralai/devstral-2512:free" },
  { providerID: "openrouter", modelID: "meta-llama/llama-3.3-70b-instruct:free" },
  { providerID: "openrouter", modelID: "mistralai/devstral-small-2507" },
  { providerID: "openrouter", modelID: "z-ai/glm-4.5-air:free" },
  { providerID: "zenmux", modelID: "xiaomi/mimo-v2-flash-free" },
  { providerID: "zenmux", modelID: "z-ai/glm-4.6v-flash-free" },
  { providerID: "zenmux", modelID: "kuaishou/kat-coder-pro-v1-free" },
];

const OLLAMA_MODELS = ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"];
const SDK_AUTO_ON = process.env.SDK_AUTO_ON !== "false";
const SDK_PORT = Number(process.env.SDK_PORT || 4096);
const DEFAULT_PROMPT = "Explique passo a passo o que o agente executou.";
const PIPELINE_MODES = ["auto", "manual", "pipeline"];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const agents = agentSystem.agents;
const SESSION_DIR = path.join(process.cwd(), "sessions");

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function sessionFilePath(sessionId) {
  ensureSessionDir();
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

function loadSessionFromDisk(sessionId) {
  try {
    const filePath = sessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.warn("⚠️  Falha ao carregar sessão local:", error.message);
    return null;
  }
}

function persistSessionToDisk(sessionId, data) {
  if (!sessionId) return;
  try {
    const filePath = sessionFilePath(sessionId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.warn("⚠️  Falha ao salvar sessão local:", error.message);
  }
}

function safePersistSnapshot() {
  if (state.sdk.sessionId) {
    persistSessionToDisk(state.sdk.sessionId, sessionStateSnapshot());
  }
}

function appendSessionLog(entry) {
  if (!entry) return;
  state.sessionLogs.push({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
  if (state.sessionLogs.length > 100) {
    state.sessionLogs.shift();
  }
  safePersistSnapshot();
}

function addSessionHint(hint) {
  if (!hint) return;
  state.sessionHints.push(hint);
  if (state.sessionHints.length > 50) {
    state.sessionHints.shift();
  }
  safePersistSnapshot();
}

function buildPayload(agentKey, input, opts = {}) {
  if (agentKey === "data") {
    return {
      data: opts.parsed ?? input,
      validate: true,
      transform: true,
      transformType: opts.transformType || "uppercase",
      aggregate: true,
    };
  }
  if (agentKey === "task") {
    return {
      tasks: Array.isArray(input) && input.length
        ? input
        : ["Configurar pipeline", "Executar testes", "Gerar relatório"],
      schedule: true,
      execute: true,
      report: true,
    };
  }
  return {
    code: input,
    checkSyntax: true,
    checkStyle: true,
    checkDeps: true,
    shouldExecute: false,
  };
}

const state = {
  mode: "auto",
  showLogs: true,
  showTools: true,
  history: [],
  toolCache: {
    lastSync: null,
    tools: {},
  },
  sessionLogs: [],
  sessionHints: [],
  currentAgent: null,
  lastPipeline: null,
  sdk: {
    enabled: SDK_AUTO_ON,
    initialized: false,
    sessionId: null,
    client: null,
    server: null,
    ollamaClient: null,
    models: REMOTE_MODELS,
    ollamaModels: OLLAMA_MODELS,
    lastModel: null,
    lastResponse: null,
    lastSource: null,
    lastAttempts: [],
    toolsLoaded: false,
  },
};

function sessionStateSnapshot() {
  return {
    mode: state.mode,
    history: state.history,
    logs: state.sessionLogs,
    hints: state.sessionHints,
    lastPipeline: state.lastPipeline,
    sdk: {
      enabled: state.sdk.enabled,
      sessionId: state.sdk.sessionId,
      lastModel: state.sdk.lastModel,
      lastResponse: state.sdk.lastResponse,
      lastSource: state.sdk.lastSource,
      lastAttempts: state.sdk.lastAttempts,
      toolsLoaded: state.sdk.toolsLoaded,
    },
    toolCache: {
      lastSync: state.toolCache.lastSync,
      tools: { ...state.toolCache.tools },
    },
  };
}

async function registerToolsAndAgents() {
  Object.keys(agentSystem.tools).forEach((key) => {
    if (!globalToolRegistry.get(key)) {
      globalToolRegistry.register(key, agentSystem.tools[key]);
    }
  });

  console.log("✅ Agentes carregados via configuração:");
  Object.values(agents).forEach((agent) => {
    console.log(`   • ${agent.label}`);
  });
}

function clearScreen() {
  console.clear();
}

function showHeader() {
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(20) + "🤖 AGENTES INTERATIVOS" + " ".repeat(35) + "║");
  console.log("╚" + "═".repeat(78) + "╝\n");
}

function describeMode(mode) {
  if (mode === "pipeline") return "Autônomo (pipeline)";
  if (mode === "manual") return "Manual";
  return "Automático";
}

function showStatus() {
  console.log("📊 STATUS:");
  console.log(`   Modo: ${describeMode(state.mode)}`);
  console.log(`   Mostrar logs: ${state.showLogs ? "Sim" : "Não"}`);
  console.log(`   Mostrar tools: ${state.showTools ? "Sim" : "Não"}`);
  console.log(`   Histórico: ${state.history.length} interações`);
  const sdkStatus = state.sdk.enabled
    ? state.sdk.initialized
      ? `Conectado (sessão ${state.sdk.sessionId || "n/d"})`
      : "Ligado (aguardando conexão)"
    : "Desligado";
  console.log(`   SDK: ${sdkStatus}`);
  if (state.sdk.enabled) {
    const synced = state.sdk.toolsLoaded
      ? `sincronizadas (${Object.keys(state.toolCache.tools).length})`
      : "aguardando sincronização";
    console.log(`   Tools SDK: ${synced}`);
  }
  if (state.sdk.sessionId) {
    console.log(`   Sessão atual: ${state.sdk.sessionId}`);
    const filePath = sessionFilePath(state.sdk.sessionId);
    console.log(`   Persistência: ${filePath}`);
  }
  if (state.sessionLogs.length) {
    console.log(`   Logs persistidos: ${state.sessionLogs.length}`);
  }
  if (state.sessionHints.length) {
    console.log(`   Hints registrados: ${state.sessionHints.length}`);
  }
  if (state.sdk.lastModel) {
    console.log(
      `   Último modelo: ${state.sdk.lastModel.providerID}/${state.sdk.lastModel.modelID} (${state.sdk.lastSource || "?"})`,
    );
  }
  if (state.lastPipeline) {
    console.log(`   Pipeline: ${state.lastPipeline.steps.length} etapas executadas`);
  }
  console.log();
}

function showMenu() {
  console.log("═".repeat(80));
  console.log("📋 COMANDOS DISPONÍVEIS:\n");
  console.log("  🤖 AGENTES:");
  console.log("     /code <código>          - Analisa código com CodeAnalyzer");
  console.log("     /data <dados>           - Processa dados com DataProcessor");
  console.log("     /task <tarefas>         - Gerencia tarefas com TaskManager");
  console.log("     /auto <pergunta>        - Escolhe agente automaticamente");
  console.log("     /auto-pro <entrada>     - Executa pipeline autônomo multiagente\n");
  console.log("  ⚙️  CONFIGURAÇÃO:");
  console.log("     /mode [auto|manual|pipeline] - Altera modo de entrada livre");
  console.log("     /logs [on|off]          - Liga/desliga logs detalhados");
  console.log("     /tools [on|off]         - Liga/desliga exibição de tools");
  console.log("     /sdk [on|off]           - Liga/desliga integração com SDK\n");
  console.log("  📊 INFORMAÇÕES:");
  console.log("     /status                 - Mostra status atual");
  console.log("     /history                - Mostra histórico de interações");
  console.log("     /agents                 - Lista agentes disponíveis");
  console.log("     /pipeline               - Mostra último pipeline autônomo");
  console.log("     /help                   - Mostra este menu\n");
  console.log("  🚪 OUTROS:");
  console.log("     /clear                  - Limpa a tela");
  console.log("     /exit ou /quit          - Sai do programa");
  console.log("═".repeat(80));
  console.log();
}

function showAgents() {
  console.log("═".repeat(80));
  console.log("🤖 AGENTES DISPONÍVEIS:\n");
  console.log("1️⃣  CodeAnalyzer (use: /code)");
  console.log("   📝 Analisa código-fonte e detecta problemas");
  console.log("   📎 Subagentes: SyntaxChecker, CodeFormatter, DependencyAnalyzer");
  console.log(
    `   🔧 Ferramentas: ${formatToolOrigins(["file_reader", "code_executor"])}`,
  );
  console.log();
  console.log("2️⃣  DataProcessor (use: /data)");
  console.log("   📝 Processa e transforma dados");
  console.log("   📎 Subagentes: DataValidator, DataTransformer, DataAggregator");
  console.log(`   🔧 Ferramentas: ${formatToolOrigins(["json_parser"])}`);
  console.log();
  console.log("3️⃣  TaskManager (use: /task)");
  console.log("   📝 Gerencia execução de tarefas");
  console.log("   📎 Subagentes: TaskScheduler, TaskExecutor, TaskReporter");
  console.log(`   🔧 Ferramentas: ${formatToolOrigins(["file_reader"])}`);
  console.log();
  console.log("🧠 SDK Integration");
  console.log(`   Status: ${state.sdk.enabled ? "Ligada" : "Desligada"}`);
  console.log(
    `   Sessão: ${state.sdk.sessionId || "(não inicializada)"} | Modelo atual: ${state.sdk.lastModel ? `${state.sdk.lastModel.providerID}/${state.sdk.lastModel.modelID}` : "(a definir)"}`,
  );
  console.log();
  console.log("💡 Modo Pipeline (use: /mode pipeline ou /auto-pro)");
  console.log("   O orquestrador executa múltiplos agentes/subagentes de forma autônoma");
  console.log("═".repeat(80));
  console.log();
}

function detectAgent(input) {
  const lower = input.toLowerCase();
  const hasKeyword = (keywords) => keywords.some((word) => lower.includes(word));
  if (hasKeyword(["dados", "data", "array", "json", "transform", "aggregate"])) {
    return "data";
  }
  if (hasKeyword(["tarefa", "task", "agendar", "schedule", "execute", "report"])) {
    return "task";
  }
  return "code";
}

function formatSdkContent(response) {
  if (!response) {
    return null;
  }
  if (typeof response === "string") {
    return response;
  }
  if (typeof response.content === "string") {
    return response.content;
  }
  if (Array.isArray(response.content)) {
    return response.content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        return JSON.stringify(item);
      })
      .join("\n");
  }
  if (Array.isArray(response.parts)) {
    return response.parts
      .map((part) => (typeof part?.text === "string" ? part.text : JSON.stringify(part)))
      .join("\n");
  }
  return JSON.stringify(response, null, 2);
}

function truncate(text, size = 400) {
  if (!text) return "";
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function attemptJsonParse(value) {
  if (!value) return { parsed: value, isJson: false };
  try {
    const parsed = JSON.parse(value);
    return { parsed, isJson: true };
  } catch (error) {
    return { parsed: value, isJson: false };
  }
}

function parseTasks(value) {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function showHistory(limit = 10) {
  if (state.history.length === 0) {
    console.log("🕘 Nenhuma interação registrada ainda.\n");
    return;
  }
  const slice = state.history.slice(-limit).reverse();
  console.log(`🗂️  Últimas ${slice.length} interações:`);
  slice.forEach((entry, index) => {
    console.log(`\n${index + 1}. ${entry.timestamp} | ${entry.command}`);
    console.log(`   Agente: ${entry.agent || "-"} (${entry.mode})`);
    if (entry.pipelineStep) {
      console.log(`   Pipeline: ${entry.pipelineStep}`);
    }
    if (entry.summary) {
      console.log(`   Resultado: ${truncate(entry.summary, 200)}`);
    }
    if (entry.sdk?.model) {
      console.log(
        `   SDK: ${entry.sdk.source || "?"} → ${entry.sdk.model.providerID}/${entry.sdk.model.modelID}`,
      );
    } else if (state.sdk.enabled) {
      console.log("   SDK: não chamado");
    }
  });
  if (state.sdk.sessionId) {
    console.log(`\n🧷 Sessão atual: ${state.sdk.sessionId}`);
    console.log(`   Snapshot salvo em: ${sessionFilePath(state.sdk.sessionId)}`);
  }
  if (state.sessionLogs.length) {
    console.log("\n📝 Últimos eventos de sessão:");
    state.sessionLogs.slice(-5).forEach((log) => {
      console.log(
        `   [${log.timestamp}] ${log.type || "log"}: ${truncate(
          typeof log.payload === "string" ? log.payload : JSON.stringify(log.payload),
          160,
        )}`,
      );
    });
  }
  console.log();
}

function showPipelineSummary(pipeline) {
  if (!pipeline || !pipeline.steps?.length) {
    console.log("🧭 Nenhum pipeline autônomo executado ainda.\n");
    return;
  }
  console.log("🧭 Resumo do pipeline autônomo:");
  console.log(`   Entrada: ${truncate(pipeline.input, 120)}`);
  console.log(`   Agente base: ${pipeline.baseLabel}`);
  console.log(`   Etapas executadas: ${pipeline.steps.length}`);
  pipeline.steps.forEach((step, index) => {
    console.log(`\n${index + 1}. ${step.description}`);
    console.log(`   Agente: ${agents[step.agentKey]?.label || step.agentKey}`);
    console.log(`   Resultado: ${step.summary || "(sem resumo)"}`);
    if (step.sdkResult) {
      console.log(`   SDK: ${summarizeSdkResult(step.sdkResult)}`);
    }
  });
  console.log();
}

function addHistoryEntry({ command, agent, summary, sdkInfo, pipelineStep }) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    command,
    agent,
    mode: state.mode,
    summary,
    pipelineStep,
    sdk: sdkInfo,
  };
  state.history.push(entry);
  if (state.history.length > 50) {
    state.history.shift();
  }
  appendSessionLog({ type: "history", payload: entry });
}

function printAgentLog(agent) {
  if (!state.showLogs) return;
  const log = agent.getLog();
  if (!log.length) return;
  console.log("📜 Log do agente:");
  log.forEach((entry) => {
    console.log(`   [${entry.timestamp}] ${entry.agent}: ${entry.message}`);
  });
  console.log();
}

function printSdkAttempts(result) {
  if (!state.showLogs || !result?.attempts?.length) return;
  console.log("📡 Tentativas de modelos remotos:");
  result.attempts.forEach((attempt) => {
    console.log(
      `   • ${attempt.providerID}/${attempt.modelID} → ${attempt.error ? "falha" : "sucesso"}${attempt.error ? ` (${attempt.error})` : ""}`,
    );
  });
  console.log();
}

function resolveToolOrigin(toolName) {
  const cached = state.toolCache.tools[toolName];
  if (cached) return cached;
  const source = globalToolRegistry.getSource(toolName);
  if (source) {
    state.toolCache.tools[toolName] = source;
    state.toolCache.lastSync = new Date().toISOString();
    return source;
  }
  return "local";
}

function formatToolOrigins(toolNames = []) {
  if (!toolNames?.length) {
    return "nenhuma registrada";
  }
  return toolNames
    .map((name) => {
      const origin = resolveToolOrigin(name);
      const tag = origin === "sdk" ? "SDK" : origin === "mcp" ? "MCP" : "local";
      return `${name} [${tag}]`;
    })
    .join(", ");
}

function printTools(agentKey) {
  if (!state.showTools) return;
  const agent = agents[agentKey];
  if (!agent) return;
  console.log(`🧰 Ferramentas configuradas: ${formatToolOrigins(agent.tools)}`);
  console.log();
}

async function refreshSdkTools(force = false) {
  if (!state.sdk.enabled) {
    return;
  }
  if (!force && state.sdk.toolsLoaded) {
    return;
  }
  if (!state.sdk.initialized) {
    return;
  }
  const client = state.sdk.client;
  if (!client) {
    return;
  }
  await ensureSessionExists();
  try {
    if (typeof client.tool?.list !== "function") {
      console.warn("⚠️  Cliente SDK não expõe ferramenta de listagem.");
      return;
    }
    const response = await client.tool.list({
      path: { id: state.sdk.sessionId },
    });
    const tools = Array.isArray(response?.data) ? response.data : response?.tools || [];
    const cache = {};
    const now = new Date().toISOString();
    tools.forEach((tool) => {
      const toolId = tool?.name || tool?.id;
      if (!toolId) {
        return;
      }
      const source = tool?.metadata?.provider
        ? tool.metadata.provider
        : tool?.metadata?.source || "sdk";
      cache[toolId] = source === "sdk" || source === "mcp" ? source : "sdk";
      if (!globalToolRegistry.get(toolId)) {
        globalToolRegistry.register(toolId, {
          description: tool?.description || "Tool exposta via SDK",
          parameters: tool?.parameters || {},
          execute: async () => {
            console.warn(`⚠️  Tool ${toolId} é remota e não pode ser executada localmente.`);
            return { success: false, error: "Tool remota" };
          },
          enabled: false,
          metadata: tool?.metadata || {},
          source: cache[toolId],
        });
      }
    });
    state.toolCache = {
      lastSync: now,
      tools: cache,
    };
    state.sdk.toolsLoaded = true;
    safePersistSnapshot();
    console.log(`🔁 ${Object.keys(cache).length} tools SDK sincronizadas.`);
  } catch (error) {
    console.error("⚠️  Falha ao sincronizar tools SDK:", error.message);
    state.sdk.toolsLoaded = false;
    throw error;
  }
}

async function ensureSdk() {
  if (!state.sdk.enabled) {
    throw new Error("SDK está desligado");
  }
  if (state.sdk.initialized && state.sdk.client) {
    return state.sdk.client;
  }

  console.log("🔌 Inicializando OpenCode SDK...");
  try {
    const { client, server } = await createOpencode({
      hostname: "127.0.0.1",
      port: SDK_PORT,
    });
    state.sdk.client = client;
    state.sdk.server = server;
    state.sdk.ollamaClient = createOllamaClient({
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      models: state.sdk.ollamaModels,
    });
    state.sdk.initialized = true;
    await ensureSessionExists();
    if (state.sdk.enabled) {
      await refreshSdkTools();
    }
    return state.sdk.client;
  } catch (error) {
    console.error("❌ Falha ao iniciar SDK:", error.message);
    appendSessionLog({ type: "sdk-error", payload: error.message });
    await shutdownSdk();
    throw error;
  }
}

async function shutdownSdk() {
  if (!state.sdk.initialized) return;
  console.log("🛑 Encerrando SDK...");
  try {
    await state.sdk.server?.close?.();
  } catch (error) {
    console.warn("⚠️  Erro ao finalizar servidor SDK:", error.message);
  }
  state.sdk.client = null;
  state.sdk.server = null;
  state.sdk.initialized = false;
  state.sdk.lastModel = null;
  state.sdk.lastResponse = null;
  state.sdk.lastSource = null;
  state.sdk.lastAttempts = [];
  state.sdk.toolsLoaded = false;
}

async function callSdk(promptText, context = {}) {
  if (!state.sdk.enabled) {
    return null;
  }
  const client = await ensureSdk();
  if (!client) {
    throw new Error("SDK indisponível");
  }

  await ensureSessionExists();

  const parts = context.parts || [{ type: "text", text: promptText || DEFAULT_PROMPT }];
  const attempts = [];

  for (const model of state.sdk.models) {
    try {
      console.log(`🛰️  Tentando modelo ${model.providerID}/${model.modelID}...`);
      const response = await client.session.prompt({
        path: { id: state.sdk.sessionId },
        body: {
          model,
          parts,
        },
      });

      const formatted = formatSdkContent(response?.data ?? response);
      state.sdk.lastModel = model;
      state.sdk.lastResponse = formatted;
      state.sdk.lastSource = "remote";
      state.sdk.lastAttempts = attempts;
      persistSessionToDisk(state.sdk.sessionId, sessionStateSnapshot());
      return {
        success: true,
        source: "remote",
        model,
        response: formatted,
        raw: response,
        attempts,
      };
    } catch (error) {
      attempts.push({
        providerID: model.providerID,
        modelID: model.modelID,
        error: error.message,
      });
      console.warn(`   ↳ Falhou: ${error.message}`);
    }
  }

  if (!state.sdk.ollamaClient) {
    console.warn("🦙 Ollama não configurado, encerrando tentativas");
    const failure = {
      success: false,
      source: "remote",
      attempts,
      error: "Todos os modelos remotos falharam e Ollama está indisponível",
    };
    if (state.sdk.sessionId) {
      persistSessionToDisk(state.sdk.sessionId, sessionStateSnapshot());
    }
    return failure;
  }

  console.log("🦙 Todos os modelos remotos falharam. Tentando Ollama...");
  const fallback = await state.sdk.ollamaClient.generateWithFallback(promptText || DEFAULT_PROMPT, {
    temperature: context.temperature ?? 0.7,
  });

  if (fallback.success) {
    const modelInfo = { providerID: "ollama", modelID: fallback.model };
    state.sdk.lastModel = modelInfo;
    state.sdk.lastResponse = fallback.response;
    state.sdk.lastSource = "ollama";
    state.sdk.lastAttempts = attempts;
    if (state.sdk.sessionId) {
      persistSessionToDisk(state.sdk.sessionId, sessionStateSnapshot());
    }
    return {
      success: true,
      source: "ollama",
      model: modelInfo,
      response: fallback.response,
      raw: fallback,
      attempts,
    };
  }

  const finalFailure = {
    success: false,
    source: "ollama",
    attempts,
    error: fallback.error || "Todos os modelos falharam",
  };
  if (state.sdk.sessionId) {
    persistSessionToDisk(state.sdk.sessionId, sessionStateSnapshot());
  }
  return finalFailure;
}

function summarizeAgentResult(agentKey, result) {
  if (!result) return "Sem resultado";
  if (agentKey === "code") {
    const syntax = result.checks?.syntax?.valid ? "ok" : "problemas";
    const deps = result.checks?.dependencies?.count ?? 0;
    return `Sintaxe ${syntax}, dependências ${deps}`;
  }
  if (agentKey === "data") {
    const validation = result.steps?.validation?.valid ? "válido" : "inválido";
    const transform = result.steps?.transformation?.transformType || "sem transformação";
    return `Dados ${validation}, transformação ${transform}`;
  }
  if (agentKey === "task") {
    const success = result.results?.execution?.successful ?? 0;
    const total = result.results?.execution?.total ?? 0;
    return `${success}/${total} tarefas concluídas`;
  }
  return "Execução concluída";
}

function summarizeSdkResult(sdkResult) {
  if (!sdkResult) return "SDK não utilizado";
  if (!sdkResult.success) {
    return `Falha (${sdkResult.source || "desconhecida"})`;
  }
  return `${sdkResult.source === "ollama" ? "Ollama" : "Remoto"} · ${sdkResult.model.providerID}/${sdkResult.model.modelID}`;
}

async function executeWithSdk(agentKey, payload, meta = {}) {
  const agentConfig = agents[agentKey];
  if (!agentConfig) {
    console.log("❓ Agente desconhecido.");
    return null;
  }

  const agent = agentConfig.instance;
  agent.clearLog();
  state.currentAgent = agentConfig.label;

  console.log(`\n🚀 Executando ${agentConfig.label}...`);
  const result = await agent.execute(payload);
  printAgentLog(agent);
  printTools(agentKey);

  let sdkResult = null;
  if (state.sdk.enabled) {
    try {
      const promptText = meta.prompt || DEFAULT_PROMPT;
      sdkResult = await callSdk(promptText, { parts: meta.parts });
      if (sdkResult?.success) {
        console.log("🧠 Resposta do SDK:");
        console.log(truncate(sdkResult.response || "(sem conteúdo)"));
        console.log();
      } else if (sdkResult) {
        console.log(`⚠️  SDK falhou: ${sdkResult.error || "erro desconhecido"}`);
      }
      printSdkAttempts(sdkResult);
    } catch (error) {
      console.error("⚠️  Erro ao chamar SDK:", error.message);
    }
  }

  const summary = summarizeAgentResult(agentKey, result);
  console.log(`✅ ${agentConfig.label}: ${summary}\n`);
  addHistoryEntry({
    command: meta.command || agentConfig.label,
    agent: agentConfig.label,
    summary,
    pipelineStep: meta.pipelineStep,
    sdkInfo: sdkResult
      ? {
          model: sdkResult.model,
          source: sdkResult.source,
        }
      : null,
  });

  return { agentResult: result, sdkResult, summary };
}

function parseMode(value) {
  if (!value) return state.mode;
  const normalized = value.toLowerCase();
  return PIPELINE_MODES.includes(normalized) ? normalized : state.mode;
}

function ensureArgument(cmd, value) {
  if (!value) {
    console.log(`⚠️  Utilize: ${cmd} <valor>`);
    return false;
  }
  return true;
}

function buildAutonomousPipeline(baseAgentKey, context) {
  const steps = [
    {
      id: "primary",
      agentKey: baseAgentKey,
      description: `Executar ${agents[baseAgentKey].label}`,
      buildPayload: (ctx) => buildPayload(baseAgentKey, baseAgentKey === "task" ? ctx.taskList : ctx.input, {
        parsed: ctx.parsedInput,
      }),
      promptBuilder: (ctx) => ctx.input,
    },
  ];

  if (baseAgentKey === "code") {
    steps.push({
      id: "code-plan",
      agentKey: "task",
      description: "Planejar correções para o código",
      when: (ctx) => {
        const last = ctx.lastResult?.agentResult;
        const syntaxInvalid = last?.checks?.syntax && !last.checks.syntax.valid;
        const deps = last?.checks?.dependencies?.count ?? 0;
        return syntaxInvalid || deps > 0;
      },
      buildPayload: (ctx) => {
        const last = ctx.lastResult?.agentResult;
        const tasks = [];
        if (last?.checks?.syntax && !last.checks.syntax.valid) {
          tasks.push("Corrigir erros de sintaxe detectados");
        }
        if ((last?.checks?.dependencies?.count || 0) > 0) {
          tasks.push("Revisar e atualizar dependências");
        }
        tasks.push("Executar testes automatizados");
        return buildPayload("task", tasks);
      },
      promptBuilder: (ctx) => ctx.lastResult?.summary || ctx.input,
    });
  }

  if (baseAgentKey === "data") {
    steps.push({
      id: "data-clean",
      agentKey: "data",
      description: "Normalizar dados com transformação em dobro",
      when: (ctx) => {
        const last = ctx.lastResult?.agentResult;
        return Boolean(last && !last.steps?.validation?.valid);
      },
      buildPayload: (ctx) => buildPayload("data", ctx.parsedInput, {
        parsed: ctx.parsedInput,
        transformType: "double",
      }),
      promptBuilder: (ctx) => `Normalize os dados problemáticos: ${ctx.input}`,
    });
  }

  steps.push({
    id: "final-report",
    agentKey: "task",
    description: "Gerar relatório final e próximos passos",
    when: (ctx) => ctx.results.length > 0,
    buildPayload: () =>
      buildPayload("task", [
        "Documentar descobertas",
        "Comunicar equipe",
        "Planejar próximos passos",
      ]),
    promptBuilder: (ctx) =>
      `Resuma o pipeline (${ctx.results.length} etapas) e proponha próximos passos.`,
  });

  return steps;
}

async function runAutonomousPipeline(rawInput, command = "/auto-pro") {
  if (!rawInput) {
    console.log("⚠️  Informe o texto a ser analisado.");
    return;
  }

  const baseAgentKey = detectAgent(rawInput);
  const { parsed: parsedInput } = attemptJsonParse(rawInput);
  const context = {
    input: rawInput,
    parsedInput,
    taskList: parseTasks(rawInput),
    baseAgentKey,
    results: [],
    lastResult: null,
  };
  const pipeline = buildAutonomousPipeline(baseAgentKey, context);

  console.log(
    `🤖 Orquestrador autônomo iniciado (${pipeline.length} etapas previstas | agente base ${agents[baseAgentKey].label}).`,
  );

  for (const step of pipeline) {
    if (typeof step.when === "function" && !step.when(context)) {
      continue;
    }
    const payload = step.buildPayload(context);
    const prompt = step.promptBuilder ? step.promptBuilder(context) : rawInput;
    const execution = await executeWithSdk(step.agentKey, payload, {
      prompt,
      command: `${command} :: ${step.description}`,
      parts: [{ type: "text", text: prompt }],
      pipelineStep: step.description,
    });
    if (!execution) {
      continue;
    }
    const stepResult = {
      agentKey: step.agentKey,
      description: step.description,
      agentResult: execution.agentResult,
      sdkResult: execution.sdkResult,
      summary: execution.summary,
    };
    context.results.push(stepResult);
    context.lastResult = stepResult;
  }

  state.lastPipeline = {
    startedAt: new Date().toISOString(),
    baseLabel: agents[baseAgentKey].label,
    input: rawInput,
    steps: context.results,
  };
  if (state.sdk.sessionId) {
    persistSessionToDisk(state.sdk.sessionId, sessionStateSnapshot());
  }
  showPipelineSummary(state.lastPipeline);
}

async function handleCommand(rawInput) {
  const input = rawInput.trim();
  if (!input) return;

  if (!input.startsWith("/")) {
    if (state.mode === "auto") {
      await runAuto(input);
    } else if (state.mode === "pipeline") {
      await runAutonomousPipeline(input, "entrada-livre");
    } else {
      console.log("⚠️  Modo manual ativo. Use /code, /data ou /task.");
    }
    return;
  }

  const [command, ...rest] = input.split(" ");
  const value = rest.join(" ").trim();

  switch (command) {
    case "/code": {
      if (!ensureArgument(command, value)) break;
      await executeWithSdk("code", buildPayload("code", value), {
        prompt: value,
        command: input,
        parts: [{ type: "text", text: value }],
      });
      break;
    }
    case "/data": {
      if (!ensureArgument(command, value)) break;
      const parsed = attemptJsonParse(value).parsed;
      await executeWithSdk(
        "data",
        buildPayload("data", parsed, { parsed }),
        {
          prompt: typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2),
          command: input,
          parts: [{ type: "text", text: value }],
        },
      );
      break;
    }
    case "/task": {
      const tasks = parseTasks(value);
      await executeWithSdk("task", buildPayload("task", tasks), {
        prompt: tasks.join("\n") || "Gerencie a lista padrão de tarefas",
        command: input,
        parts: [{ type: "text", text: value || "Gerencie minhas tarefas" }],
      });
      break;
    }
    case "/auto": {
      if (!ensureArgument(command, value)) break;
      await runAuto(value, command);
      break;
    }
    case "/auto-pro": {
      if (!ensureArgument(command, value)) break;
      await runAutonomousPipeline(value, command);
      break;
    }
    case "/mode": {
      if (!ensureArgument(command, value)) break;
      const nextMode = parseMode(value);
      state.mode = nextMode;
      console.log(`🔁 Modo atualizado para: ${describeMode(state.mode)}`);
      break;
    }
    case "/logs": {
      const next = value ? parseToggleArg(value, state.showLogs) : !state.showLogs;
      state.showLogs = next;
      console.log(`📝 Logs detalhados: ${state.showLogs ? "ON" : "OFF"}`);
      break;
    }
    case "/tools": {
      const next = value ? parseToggleArg(value, state.showTools) : !state.showTools;
      state.showTools = next;
      console.log(`🧰 Exibição de tools: ${state.showTools ? "ON" : "OFF"}`);
      break;
    }
    case "/sdk": {
      if (!value) {
        console.log(`SDK está ${state.sdk.enabled ? "ligado" : "desligado"}. Use /sdk on, /sdk off, /sdk sync ou /sdk resume <id>.`);
        break;
      }
      const [sdkCommand, sdkValue] = value.split(" ");
      if (["on", "enable"].includes(sdkCommand.toLowerCase())) {
        state.sdk.enabled = true;
        console.log("🔌 SDK ativado. Será inicializado na próxima chamada.");
      } else if (["off", "disable"].includes(sdkCommand.toLowerCase())) {
        state.sdk.enabled = false;
        await shutdownSdk();
        console.log("🪫 SDK desativado.");
      } else if (sdkCommand.toLowerCase() === "resume") {
        await resumeSession(sdkValue);
      } else if (sdkCommand.toLowerCase() === "sync") {
        try {
          await refreshSdkTools(true);
          console.log("🔁 Tools SDK sincronizadas.");
        } catch (error) {
          console.error("⚠️  Não foi possível sincronizar tools SDK:", error.message);
        }
      } else {
        console.log("⚠️  Use /sdk on, /sdk off, /sdk sync ou /sdk resume <sessionId>");
      }
      break;
    }
    case "/status": {
      showStatus();
      break;
    }
    case "/history": {
      showHistory();
      break;
    }
    case "/pipeline": {
      showPipelineSummary(state.lastPipeline);
      break;
    }
    case "/agents": {
      showAgents();
      break;
    }
    case "/help": {
      showMenu();
      break;
    }
    case "/clear": {
      clearScreen();
      showHeader();
      showStatus();
      break;
    }
    case "/exit":
    case "/quit": {
      await gracefulShutdown();
      break;
    }
    default:
      console.log(`❓ Comando desconhecido: ${command}`);
  }
}

function parseToggleArg(value, current) {
  if (!value) return !current;
  if (["on", "true", "1"].includes(value.toLowerCase())) return true;
  if (["off", "false", "0"].includes(value.toLowerCase())) return false;
  return current;
}

async function resumeSession(sessionId) {
  if (!sessionId) {
    console.log("⚠️  Informe o ID da sessão para retomar.");
    return;
  }
  const snapshot = loadSessionFromDisk(sessionId);
  if (!snapshot) {
    console.log("⚠️  Sessão não encontrada na persistência local.");
    return;
  }
  if (!state.sdk.enabled) {
    console.log("⚠️  SDK está desligado. Ligue com /sdk on antes de retomar.");
    return;
  }
  try {
    state.mode = snapshot.mode ?? state.mode;
    state.history = snapshot.history ?? state.history;
    state.sessionLogs = snapshot.logs ?? [];
    state.sessionHints = snapshot.hints ?? [];
    state.lastPipeline = snapshot.lastPipeline ?? null;
    state.toolCache = snapshot.toolCache || state.toolCache;
    state.sdk.sessionId = snapshot.sdk?.sessionId || state.sdk.sessionId;
    state.sdk.lastModel = snapshot.sdk?.lastModel || null;
    state.sdk.lastResponse = snapshot.sdk?.lastResponse || null;
    state.sdk.lastSource = snapshot.sdk?.lastSource || null;
    state.sdk.lastAttempts = snapshot.sdk?.lastAttempts || [];
    state.sdk.toolsLoaded = snapshot.sdk?.toolsLoaded || false;
    safePersistSnapshot();
    await ensureSdk();
    console.log(`♻️  Sessão ${state.sdk.sessionId} retomada a partir do snapshot local.`);
  } catch (error) {
    console.error("⚠️  Não foi possível retomar a sessão:", error.message);
  }
}

async function runAuto(text, command = "/auto") {
  const agentKey = detectAgent(text);
  console.log(`🤖 Modo automático escolheu: ${agents[agentKey].label}`);
  await executeWithSdk(agentKey, buildPayload(agentKey, text), {
    prompt: text,
    command,
    parts: [{ type: "text", text: text }],
  });
}

function promptUser() {
  rl.setPrompt("👉  ");
  rl.prompt();
}

async function gracefulShutdown() {
  await shutdownSdk();
  console.log("👋 Até a próxima!");
  rl.close();
  process.exit(0);
}

async function main() {
  clearScreen();
  showHeader();
  await registerToolsAndAgents();
  showStatus();
  showMenu();

  rl.on("line", async (line) => {
    try {
      await handleCommand(line);
    } catch (error) {
      console.error("⚠️  Erro ao processar entrada:", error.message);
    } finally {
      promptUser();
    }
  });

  rl.on("SIGINT", async () => {
    await gracefulShutdown();
  });

  rl.on("close", async () => {
    await shutdownSdk();
  });

  promptUser();
}

process.on("SIGINT", async () => {
  await gracefulShutdown();
});

main().catch(async (error) => {
  console.error("❌ Falha na CLI:", error);
  await shutdownSdk();
  process.exit(1);
});
