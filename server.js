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

/**
 * Detecta saudações e mensagens simples que não precisam de agentes
 */
function isSimpleGreeting(prompt) {
  const lower = prompt.toLowerCase().trim();
  const greetings = [
    /^(oi|olá|ola|hey|e aí|eai|tudo bem|como vai|bom dia|boa tarde|boa noite)[\s\?\!]*$/i,
    /^(hi|hello|hey there)[\s\?\!]*$/i,
  ];

  return greetings.some(pattern => pattern.test(lower));
}

/**
 * Detecta se o prompt pode ser resolvido diretamente por uma tool
 * Retorna { useTool: true, toolName, params, summary } se detectado, ou { useTool: false }
 */
function detectDirectToolUse(prompt) {
  const lower = prompt.toLowerCase();

  // 1. OPERAÇÕES MATEMÁTICAS

  // Soma
  const somaMatch =
    prompt.match(/(?:somar|soma|quanto (?:é|e)|calcul(?:e|ar)|adicionar)\s*(\d+(?:\.\d+)?)\s*(?:\+|e|mais)\s*(\d+(?:\.\d+)?)/i) ||
    prompt.match(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/);
  if (somaMatch) {
    return {
      useTool: true,
      toolName: "soma",
      params: { a: parseFloat(somaMatch[1]), b: parseFloat(somaMatch[2]) },
    };
  }

  // Subtração
  const subtracaoMatch =
    prompt.match(/(?:subtrair|subtra(?:ir|ção)|quanto (?:é|e)|calcul(?:e|ar)|tirar)\s*(\d+(?:\.\d+)?)\s*(?:\-|menos)\s*(\d+(?:\.\d+)?)/i) ||
    prompt.match(/(\d+(?:\.\d+)?)\s*\-\s*(\d+(?:\.\d+)?)/);
  if (subtracaoMatch) {
    return {
      useTool: true,
      toolName: "subtracao",
      params: { a: parseFloat(subtracaoMatch[1]), b: parseFloat(subtracaoMatch[2]) },
    };
  }

  // Multiplicação
  const multiplicacaoMatch =
    prompt.match(/(?:multiplicar|multiplica|quanto (?:é|e)|calcul(?:e|ar)|vezes)\s*(\d+(?:\.\d+)?)\s*(?:\*|×|x|vezes)\s*(\d+(?:\.\d+)?)/i) ||
    prompt.match(/(\d+(?:\.\d+)?)\s*[×\*]\s*(\d+(?:\.\d+)?)/);
  if (multiplicacaoMatch) {
    return {
      useTool: true,
      toolName: "multiplicacao",
      params: { a: parseFloat(multiplicacaoMatch[1]), b: parseFloat(multiplicacaoMatch[2]) },
    };
  }

  // Divisão
  const divisaoMatch =
    prompt.match(/(?:dividir|dividi(?:r|são)|quanto (?:é|e)|calcul(?:e|ar))\s*(\d+(?:\.\d+)?)\s*(?:\/|÷|por)\s*(\d+(?:\.\d+)?)/i) ||
    prompt.match(/(\d+(?:\.\d+)?)\s*[\/÷]\s*(\d+(?:\.\d+)?)/);
  if (divisaoMatch) {
    return {
      useTool: true,
      toolName: "divisao",
      params: { a: parseFloat(divisaoMatch[1]), b: parseFloat(divisaoMatch[2]) },
    };
  }

  // 2. CONVERSÃO DE TEMPERATURA
  const tempMatch = prompt.match(/(?:converter|converta|transformar)\s*(\d+(?:\.\d+)?)\s*(?:graus?\s*)?([CFKcfk])\s*(?:para|em|to)\s*([CFKcfk])/i);
  if (tempMatch) {
    return {
      useTool: true,
      toolName: "converter_temperatura",
      params: {
        valor: parseFloat(tempMatch[1]),
        de: tempMatch[2].toUpperCase(),
        para: tempMatch[3].toUpperCase(),
      },
    };
  }

  // 3. CONVERSÃO DE DISTÂNCIA
  const distMatch = prompt.match(/(?:converter|converta|transformar)\s*(\d+(?:\.\d+)?)\s*(km|m|cm|mm|mi|milhas?|ft|pes|pés|in|polegadas?)\s*(?:para|em|to)\s*(km|m|cm|mm|mi|milhas?|ft|pes|pés|in|polegadas?)/i);
  if (distMatch) {
    return {
      useTool: true,
      toolName: "converter_distancia",
      params: {
        valor: parseFloat(distMatch[1]),
        de: distMatch[2],
        para: distMatch[3],
      },
    };
  }

  // 4. FORMATAÇÃO DE DATA
  if (/(?:que horas?|que dia|data atual|hora atual|formatar data)/i.test(prompt)) {
    return {
      useTool: true,
      toolName: "formatar_data",
      params: { formato: "completo" },
    };
  }

  return { useTool: false };
}

/**
 * Gera resposta amigável baseada no resultado da tool
 */
function generateToolSummary(toolName, toolResult) {
  if (!toolResult.success) {
    return `Erro: ${toolResult.error}`;
  }

  switch (toolName) {
    case "soma":
      return `A soma de ${toolResult.a} + ${toolResult.b} é ${toolResult.result}.`;
    case "subtracao":
      return `${toolResult.a} - ${toolResult.b} = ${toolResult.result}`;
    case "multiplicacao":
      return `${toolResult.a} × ${toolResult.b} = ${toolResult.result}`;
    case "divisao":
      return `${toolResult.a} ÷ ${toolResult.b} = ${toolResult.result}`;
    case "converter_temperatura":
      return toolResult.conversao;
    case "converter_distancia":
      return toolResult.conversao;
    case "formatar_data":
      return `Data e hora atual: ${toolResult.resultado}`;
    default:
      return JSON.stringify(toolResult, null, 2);
  }
}

app.post("/api/run", async (req, res) => {
  const { prompt, agent, fallback = true } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt é obrigatório" });
  }

  try {
    // Primeiro, verifica se é uma saudação simples
    if (isSimpleGreeting(prompt)) {
      const greetings = [
        "Olá! Como posso te ajudar hoje?",
        "Oi! Estou aqui para ajudar. O que você precisa?",
        "Olá! 👋 Que bom ter você aqui. Em que posso ajudar?",
      ];
      const summary = greetings[Math.floor(Math.random() * greetings.length)];

      return res.json({
        success: true,
        agent: "Resposta Direta",
        source: "direct",
        model: null,
        summary,
        attempts: [],
        log: [{ timestamp: new Date().toISOString(), message: "Resposta direta para saudação" }],
      });
    }

    // Segundo, verifica se podemos usar uma tool diretamente
    const toolDetection = detectDirectToolUse(prompt);

    if (toolDetection.useTool) {
      // Executa a tool diretamente sem passar por agentes
      const toolResult = await globalToolRegistry.execute(
        toolDetection.toolName,
        toolDetection.params
      );

      // Formata resposta amigável usando a função helper
      const summary = generateToolSummary(toolDetection.toolName, toolResult);

      const log = [
        {
          timestamp: new Date().toISOString(),
          message: `Chamou ferramenta: ${toolDetection.toolName}`,
        },
      ];

      if (agentSystem?.sdkState) {
        agentSystem.sdkState.history = [
          {
            id: Date.now().toString(),
            prompt,
            agent: `Tool: ${toolDetection.toolName}`,
            source: "tool",
            model: null,
            attempts: [],
            summary,
            timestamp: new Date().toISOString(),
          },
          ...(agentSystem.sdkState.history || []),
        ].slice(0, 20);
      }

      return res.json({
        success: true,
        agent: `Tool: ${toolDetection.toolName}`,
        source: "tool",
        model: null,
        summary,
        attempts: [],
        log,
        toolResult,
      });
    }

    // Se não detectou tool direta, usa o fluxo normal de agentes
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

    // Detectar que tipo de input é para ativar apenas os subagentes necessários
    const lower = prompt.toLowerCase();
    const hasCodeKeywords = /(?:function|class|const|let|var|import|export|async|await|if|for|while)/i.test(prompt);
    const hasJSONKeywords = /{.*}|\[.*\]/.test(prompt);
    const seemsLikeCode = hasCodeKeywords || (prompt.includes('{') && prompt.includes('}')) || (prompt.includes('(') && prompt.includes(')'));

    // Configuração inteligente baseada no tipo de input
    let agentParams;
    if (agentKey === "code") {
      agentParams = {
        code: prompt,
        checkSyntax: seemsLikeCode && prompt.length > 10,  // Só verifica sintaxe se parecer código real
        checkStyle: seemsLikeCode && hasCodeKeywords,      // Só verifica estilo se tiver palavras-chave
        checkDeps: seemsLikeCode && /import|require/.test(prompt), // Só verifica deps se tiver imports
        shouldExecute: false, // Nunca executar automaticamente por segurança
      };
    } else if (agentKey === "data") {
      agentParams = {
        data: prompt,
        validate: hasJSONKeywords,    // Só valida se tiver JSON
        transform: hasJSONKeywords,   // Só transforma se tiver dados
        aggregate: hasJSONKeywords,   // Só agrega se tiver dados
      };
    } else if (agentKey === "task") {
      agentParams = {
        tasks: prompt.split(",").map(t => t.trim()),
        schedule: prompt.split(",").length > 1,  // Só agenda se tiver múltiplas tarefas
        execute: false,   // Não executar automaticamente
        report: true,     // Sempre reportar
      };
    } else {
      // Fallback genérico
      agentParams = {
        code: prompt,
        data: prompt,
        tasks: prompt.split(","),
      };
    }

    const agentResult = await selectedAgent.instance.execute(agentParams);

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
