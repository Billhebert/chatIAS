import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  agents,
  agentConfig,
  summarizeWithFallback,
  ollamaClient,
  buildLocalSummary,
} from "./chat.js";
import { agentSystem } from "./modules/index.js";
import { globalToolRegistry } from "./lib/tools/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4173;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function buildAgentsPayload() {
  return Object.values(agents).map((agent) => ({
    key: agent.key,
    label: agent.label,
    description: agent.instance?.description || agent.label,
    enabled: agent.instance?.enabled !== false,
    subagents: agent.instance ? Array.from(agent.instance.subagents.keys()) : [],
    tools: (agent.tools || []).map((toolName) => ({
      name: toolName,
      origin: globalToolRegistry.getSource(toolName) || "local",
    })),
  }));
}

function buildToolsPayload() {
  return globalToolRegistry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    enabled: tool.enabled,
    parameters: tool.parameters,
    source: tool.source,
  }));
}

app.get("/api/agents", (req, res) => {
  res.json(buildAgentsPayload());
});

app.get("/api/tools", (req, res) => {
  res.json(buildToolsPayload());
});

app.get("/api/sdk", async (req, res) => {
  const configSdk = agentConfig?.sdk || {};
  const sdkState = agentSystem?.sdkState || {};
  const response = {
    sdk: {
      initialized: Boolean(sdkState.initialized),
      sessionId: sdkState.sessionId || null,
      mode: sdkState.mode || agentSystem?.sdkMode || "manual",
      autoConnect: sdkState.autoConnect ?? agentSystem?.autoConnect ?? false,
      status: sdkState.status || (sdkState.initialized ? "connected" : "disconnected"),
      statusMessage:
        sdkState.statusMessage ||
        (sdkState.initialized
          ? "SDK conectado e pronto."
          : sdkState.autoConnect
            ? "Tentando reconectar ao SDK automaticamente."
            : "SDK em modo manual. Configure SDK_AUTO_CONNECT=true."),
      lastError: sdkState.lastError || null,
      connectedAt: sdkState.connectedAt || null,
      nextRetryAt: sdkState.nextRetryAt || null,
      lastSuccessAt: sdkState.lastSuccessAt || null,
    },
    remoteModels: configSdk.remoteModels || [],
    ollamaModels: configSdk.ollamaModels || (ollamaClient?.models ?? []),
    lastModel: sdkState.lastModel || null,
    lastSource: sdkState.lastSource || null,
    lastSummary: sdkState.lastSummary || null,
    lastAttempts: sdkState.lastAttempts || [],
    history: sdkState.history || [],
    ollama: {
      available: (await ollamaClient?.isAvailable().catch(() => false)) || false,
    },
  };

  res.json(response);
});

app.post("/api/run", async (req, res) => {
  const { prompt, agent, fallback = true } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt é obrigatório" });
  }

  try {
    let agentKey = agent;
    if (!agentKey || agentKey === "auto") {
      const lower = prompt.toLowerCase();
      if (/(data|json|array|transform)/.test(lower)) {
        agentKey = "data";
      } else if (/(task|taref|agendar|schedule|execute)/.test(lower)) {
        agentKey = "task";
      } else {
        agentKey = "code";
      }
    }

    const selectedAgent = agents[agentKey];
    if (!selectedAgent) {
      throw new Error(`Agente não encontrado: ${agentKey}`);
    }

    const agentResult = await selectedAgent.instance.execute({
      code: prompt,
      data: prompt,
      tasks: prompt.split(","),
      checkSyntax: true,
      checkStyle: true,
      checkDeps: true,
      validate: true,
      transform: true,
      aggregate: true,
      schedule: true,
      execute: true,
      report: true,
    });

    const summary = fallback
      ? await summarizeWithFallback(prompt, agentResult, selectedAgent.label)
      : { source: "local", summary: buildLocalSummary(agentKey, agentResult), attempts: [], model: null };

    if (agentSystem?.sdkState) {
      agentSystem.sdkState.history = [
        {
          id: Date.now().toString(),
          prompt,
          agent: selectedAgent.label,
          source: summary.source,
          model: summary.model || null,
          attempts: summary.attempts,
          summary: summary.summary,
          timestamp: new Date().toISOString(),
        },
        ...(agentSystem.sdkState.history || []),
      ].slice(0, 20);
    }

    res.json({
      success: true,
      agent: selectedAgent.label,
      source: summary.source,
      model: summary.model || null,
      summary: summary.summary,
      attempts: summary.attempts,
      log: selectedAgent.instance?.getLog?.() || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ ChatIAS web server rodando em http://localhost:${PORT}`);
});
