import { agentSystem } from "./modules/index.js";
import { createOllamaClient } from "./lib/ollama/index.js";

export const agents = agentSystem.agents;
export const tools = agentSystem.tools;
export const agentConfig = agentSystem.config;

export const ollamaClient = createOllamaClient({
  baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  models: agentSystem?.config?.sdk?.ollamaModels || [
    "llama3.2",
    "qwen2.5-coder",
    "deepseek-coder-v2",
  ],
});

export function buildLocalSummary(agentKey, agentResult) {
  if (!agentKey || !agentResult) {
    return JSON.stringify(agentResult ?? {}, null, 2);
  }

  const formatters = {
    code: () => {
      const syntax = agentResult.checks?.syntax;
      const deps = agentResult.checks?.dependencies;
      const style = agentResult.checks?.style;
      return [
        "Resumo do CodeAnalyzer:",
        syntax
          ? syntax.valid
            ? "- Sintaxe aprovada"
            : `- Sintaxe com ${syntax.errors?.length || 0} problema(s)`
          : null,
        style
          ? style.formatted
            ? "- Estilo dentro do padrão"
            : `- ${style.warnings?.length || 0} aviso(s) de estilo`
          : null,
        deps ? `- ${deps.count || 0} dependência(s) detectadas` : null,
      ]
        .filter(Boolean)
        .join("\n");
    },
    data: () => {
      const validation = agentResult.steps?.validation;
      const transform = agentResult.steps?.transformation;
      const aggregation = agentResult.steps?.aggregation;
      return [
        "Resumo do DataProcessor:",
        validation
          ? validation.valid
            ? "- Dados aprovados na validação"
            : `- Dados inválidos (${validation.errors?.join(", ") || "motivo desconhecido"})`
          : null,
        transform ? `- Transformação aplicada (${transform.transformType || "custom"})` : null,
        aggregation ? `- ${aggregation.count || 0} itens agregados` : null,
      ]
        .filter(Boolean)
        .join("\n");
    },
    task: () => {
      const execution = agentResult.results?.execution;
      const report = agentResult.results?.report;
      return [
        "Resumo do TaskManager:",
        execution
          ? `- ${execution.successful || 0}/${execution.total || 0} tarefas concluídas`
          : null,
        report?.summary?.successRate ? `- Sucesso geral: ${report.summary.successRate}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    },
  };

  return formatters[agentKey]?.() || JSON.stringify(agentResult, null, 2);
}

export async function summarizeWithFallback(prompt, agentResult, agentLabel = "Agente") {
  const message = prompt || "Explique passo a passo o que o agente executou.";
  const attempts = [];
  const agentKey = Object.entries(agentSystem.agents || {}).find(
    ([, entry]) => entry.label === agentLabel,
  )?.[0];
  const localSummary = agentResult && agentKey ? buildLocalSummary(agentKey, agentResult) : null;

  if (agentSystem?.sdk?.summarize) {
    try {
      const remote = await agentSystem.sdk.summarize(message, {
        agentLabel,
        agentKey,
        agentResult,
        localSummary,
      });
      if (remote?.success && remote.summary) {
        return remote;
      }
      if (remote?.attempts?.length) {
        attempts.push(...remote.attempts);
      }
    } catch (error) {
      attempts.push({ source: "remote", error: error.message });
    }
  }

  if (localSummary) {
    return {
      source: "local",
      summary: localSummary,
      attempts,
      model: null,
    };
  }

  if (agentSystem?.agents?.code) {
    try {
      const result = await agentSystem.agents.code.instance.execute({
        code: message,
        checkSyntax: true,
        checkStyle: true,
        checkDeps: true,
      });
      return {
        source: "local",
        summary: JSON.stringify(result, null, 2),
        attempts,
        model: null,
      };
    } catch (error) {
      attempts.push({ source: "local", error: error.message });
    }
  }

  if (!ollamaClient) {
    throw new Error("Ollama client não inicializado");
  }

  const availability = await ollamaClient.isAvailable().catch(() => false);
  if (!availability) {
    throw new Error("Todos os modelos remotos falharam e Ollama está indisponível");
  }

  const fallback = await ollamaClient.generateWithFallback(message, {
    temperature: 0.7,
  });
  if (!fallback.success) {
    throw new Error(
      fallback.error || "Todos os modelos remotos falharam e fallback Ollama falhou",
    );
  }

  return {
    source: fallback.source,
    model: fallback.model,
    summary: fallback.response,
    attempts: [...attempts, ...(fallback.attempts || [])],
  };
}
