import config from "../config/agent-system.json" with { type: "json" };
import { agentClasses } from "./agents/index.js";
import { toolMap } from "./tools/index.js";
import { globalToolRegistry } from "../lib/tools/index.js";
import { createOpencode } from "../sdk/index.js";

function registerConfiguredTools() {
  config.tools.forEach((toolKey) => {
    if (!globalToolRegistry.get(toolKey) && toolMap[toolKey]) {
      globalToolRegistry.register(toolKey, toolMap[toolKey]);
    }
  });
}

const SDK_ALWAYS_ON = process.env.SDK_AUTO_CONNECT !== "false";
const SDK_HOSTNAME = process.env.SDK_HOSTNAME || "127.0.0.1";
const SDK_PORT = Number(process.env.SDK_PORT || 4096);
const SDK_STARTUP_TIMEOUT = Number(process.env.SDK_STARTUP_TIMEOUT || 20000);
const SDK_RETRY_DELAY = Number(process.env.SDK_RETRY_DELAY || 5000);
const DEFAULT_SESSION_LABEL = process.env.SDK_SESSION_LABEL || "ChatIAS Web Console";
const sdkMode = SDK_ALWAYS_ON ? "auto" : "manual";
const sdkStatusDefaults = {
  connecting: "Conectando automaticamente ao OpenCode SDK...",
  manual: "SDK em modo manual. Configure SDK_AUTO_CONNECT=true para ligar.",
  disconnected: "SDK desconectado. Verifique o OpenCode CLI e tente novamente.",
};

function createSdkController(agentSystemConfig, sdkState) {
  const remoteModels = agentSystemConfig.sdk?.remoteModels || [];
  let runtimeClient = null;
  let runtimeServer = null;
  let connectPromise = null;
  let reconnectTimer = null;

  const connectionTokens = ["econnrefused", "econnreset", "fetch failed", "network", "timeout", "socket", "connection"];

  const updateState = (patch) => {
    Object.assign(sdkState, patch);
  };

  const markDisconnected = (errorMessage) => {
    runtimeClient = null;
    runtimeServer = null;
    updateState({
      initialized: false,
      status: "error",
      statusMessage: `SDK indisponível: ${errorMessage}`,
      lastError: errorMessage,
    });
    scheduleReconnect();
  };

  const isConnectionError = (error) => {
    const message = `${error?.message || ""} ${error?.stack || ""}`.toLowerCase();
    return connectionTokens.some((token) => message.includes(token));
  };

  const scheduleReconnect = (delay = SDK_RETRY_DELAY) => {
    if (!SDK_ALWAYS_ON) {
      return;
    }
    if (reconnectTimer) {
      return;
    }
    const nextRetryAt = new Date(Date.now() + delay).toISOString();
    updateState({ nextRetryAt, status: "connecting", statusMessage: "Tentando reconectar ao OpenCode SDK..." });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      ensureConnected().catch(() => {
        scheduleReconnect(Math.min(delay * 2, 60000));
      });
    }, delay);
  };

  const ensureConnected = async () => {
    if (runtimeClient) {
      return runtimeClient;
    }
    if (connectPromise) {
      return connectPromise;
    }

    updateState({
      initialized: false,
      status: "connecting",
      statusMessage: sdkStatusDefaults.connecting,
    });

    connectPromise = (async () => {
      try {
        const { client, server } = await createOpencode({
          hostname: SDK_HOSTNAME,
          port: SDK_PORT,
          timeout: SDK_STARTUP_TIMEOUT,
        });
        runtimeClient = client;
        runtimeServer = server;
        updateState({
          initialized: true,
          status: "connected",
          statusMessage: "SDK conectado e pronto.",
          lastError: null,
          connectedAt: new Date().toISOString(),
          nextRetryAt: null,
        });
        await ensureSession();
        return runtimeClient;
      } catch (error) {
        markDisconnected(error.message);
        throw error;
      } finally {
        connectPromise = null;
      }
    })();

    return connectPromise;
  };

  const ensureSession = async () => {
    const client = await ensureConnected();
    if (sdkState.sessionId) {
      try {
        await client.session.get({ path: { id: sdkState.sessionId } });
        return sdkState.sessionId;
      } catch {
        updateState({ sessionId: null });
      }
    }

    const response = await client.session.create({
      body: {
        name: DEFAULT_SESSION_LABEL,
        metadata: {
          source: "chatias-web",
        },
      },
    });

    const session = response?.data || response;
    const newId = session?.id || session?.session?.id;
    updateState({
      sessionId: newId,
      statusMessage: newId
        ? `SDK conectado • Sessão ${newId.slice(0, 8)}...`
        : "SDK conectado e pronto.",
    });
    return newId;
  };

  const formatResponse = (payload) => {
    if (!payload) {
      return "";
    }
    if (typeof payload === "string") {
      return payload;
    }
    if (typeof payload.content === "string") {
      return payload.content;
    }
    if (Array.isArray(payload.content)) {
      return payload.content
        .map((item) => (typeof item === "string" ? item : item?.text || JSON.stringify(item)))
        .join("\n");
    }
    if (Array.isArray(payload.parts)) {
      return payload.parts
        .map((part) => (typeof part?.text === "string" ? part.text : JSON.stringify(part)))
        .join("\n");
    }
    return JSON.stringify(payload, null, 2);
  };

  const sanitizeSummaryText = (text) => {
    if (!text || typeof text !== "string") {
      return "";
    }
    const lines = text.split(/\r?\n/);
    const filtered = lines
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) {
          return false;
        }
        if (!(line.startsWith("{") && line.endsWith("}"))) {
          return true;
        }
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed === "object" && parsed) {
            if (typeof parsed.type === "string" && parsed.type.startsWith("step-")) {
              return false;
            }
            if (parsed.sessionID && parsed.messageID && parsed.snapshot) {
              return false;
            }
          }
        } catch {
          return true;
        }
        return true;
      });
    let cleaned = filtered.join("\n").trim();
    if (/^```/.test(cleaned) && /```$/.test(cleaned)) {
      cleaned = cleaned.replace(/^```[a-z\-]*\s*/i, "").replace(/```$/i, "").trim();
    }
    return cleaned || text.trim();
  };

  const buildParts = (prompt, meta = {}) => {
    if (meta.parts?.length) {
      return meta.parts;
    }

    const parts = [];
    if (meta.localSummary) {
      parts.push({
        type: "text",
        text: `Resumo local do ${meta.agentLabel || "agente"}:\n${meta.localSummary}`,
      });
    } else if (meta.agentResult) {
      parts.push({
        type: "text",
        text: `Resultado do ${meta.agentLabel || "agente"}:\n${JSON.stringify(meta.agentResult, null, 2)}`,
      });
    }

    parts.push({
      type: "text",
      text: `${prompt}\n\nResuma em linguagem natural e destaque os próximos passos.`,
    });

    return parts;
  };

  const summarize = async (prompt, meta = {}) => {
    if (!remoteModels.length) {
      return null;
    }

    const client = await ensureConnected();
    const sessionId = await ensureSession();
    const parts = buildParts(prompt, meta);
    const attempts = [];

    for (const model of remoteModels) {
      try {
        const response = await client.session.prompt({
          path: { id: sessionId },
          body: {
            model,
            parts,
          },
        });
        const payload = response?.data || response;
        const summary = sanitizeSummaryText(formatResponse(payload));
        updateState({
          lastModel: model,
          lastSource: "remote",
          lastAttempts: attempts,
          lastSummary: summary,
          lastSuccessAt: new Date().toISOString(),
        });
        return {
          success: true,
          source: "remote",
          summary,
          model,
          attempts,
        };
      } catch (error) {
        attempts.push({ ...model, error: error.message });
        if (isConnectionError(error)) {
          markDisconnected(error.message);
          break;
        }
      }
    }

    updateState({
      lastSource: "remote",
      lastAttempts: attempts,
      lastModel: null,
      lastError: attempts.at(-1)?.error || "Todos os modelos remotos falharam.",
    });

    return {
      success: false,
      source: "remote",
      attempts,
    };
  };

  const shutdown = async () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      await runtimeServer?.close?.();
    } catch (error) {
      console.warn("Falha ao encerrar servidor OpenCode:", error.message);
    }
    runtimeClient = null;
    runtimeServer = null;
    updateState({
      initialized: false,
      status: SDK_ALWAYS_ON ? "connecting" : "manual",
      statusMessage: SDK_ALWAYS_ON ? sdkStatusDefaults.connecting : sdkStatusDefaults.manual,
    });
  };

  return {
    ensureConnected,
    ensureSession,
    summarize,
    shutdown,
  };
}

export function initializeAgentSystem() {
  registerConfiguredTools();

  const agents = {};
  const sdkState = {
    initialized: false,
    sessionId: null,
    lastModel: null,
    lastSource: null,
    lastAttempts: [],
    lastSummary: null,
    lastSuccessAt: null,
    connectedAt: null,
    nextRetryAt: null,
    history: [],
    mode: sdkMode,
    autoConnect: SDK_ALWAYS_ON,
    status: SDK_ALWAYS_ON ? "connecting" : "manual",
    statusMessage: SDK_ALWAYS_ON ? sdkStatusDefaults.connecting : sdkStatusDefaults.manual,
    lastError: null,
  };

  config.agents.forEach((agentConfig) => {
    const AgentClass = agentClasses[agentConfig.class];
    if (!AgentClass) {
      console.warn(`Agent class ${agentConfig.class} not found`);
      return;
    }

    // Passa as permissões do config para o agente
    const agentInstance = new AgentClass();
    // Configura permissões após a criação
    if (agentConfig.allowedTools) {
      agentInstance.allowedTools = agentConfig.allowedTools;
    }
    if (agentConfig.allowedSubagents) {
      agentInstance.allowedSubagents = agentConfig.allowedSubagents;
    }

    (agentConfig.subagents || []).forEach((subagentName) => {
      const SubagentClass = agentClasses[subagentName];
      if (SubagentClass) {
        const subagentInstance = new SubagentClass();

        // Configura permissões do subagente se definidas no config
        const subagentKey = subagentName.replace("Agent", "");
        if (config.subagents && config.subagents[subagentKey]) {
          const subagentConfig = config.subagents[subagentKey];
          if (subagentConfig.allowedTools) {
            subagentInstance.allowedTools = subagentConfig.allowedTools;
          }
          if (subagentConfig.allowedSubagents) {
            subagentInstance.allowedSubagents = subagentConfig.allowedSubagents;
          }
        }

        agentInstance.registerSubagent(subagentInstance);
      }
    });

    agents[agentConfig.key] = {
      key: agentConfig.key,
      label: agentConfig.label,
      instance: agentInstance,
      tools: agentConfig.tools,
    };
  });

  const sdk = createSdkController(config, sdkState);
  if (SDK_ALWAYS_ON) {
    sdk.ensureConnected().catch((error) => {
      console.warn("Falha ao conectar automaticamente ao SDK:", error.message);
    });
  }

  return {
    config,
    agents,
    tools: toolMap,
    sdkState,
    sdk,
    registerConfiguredTools,
    sdkMode,
    autoConnect: SDK_ALWAYS_ON,
  };
}

export const agentSystem = initializeAgentSystem();
