/**
 * Tool customizada para integração Ollama
 * @module lib/tools/ollama-tool
 */

import { createOllamaClient } from "../ollama/index.js";

/**
 * Tool Ollama para geração de texto com modelos locais
 */
export const ollamaTool = {
  name: "ollama_generate",
  description: "Gera texto usando modelos Ollama locais como fallback",
  enabled: true,
  parameters: {
    prompt: {
      type: "string",
      description: "Prompt para gerar texto",
      required: true,
    },
    model: {
      type: "string",
      description: "Modelo Ollama a usar (opcional, usa fallback se não especificado)",
      required: false,
    },
    temperature: {
      type: "number",
      description: "Temperatura (0.0-1.0)",
      required: false,
      default: 0.7,
    },
  },

  async execute({ prompt, model = null, temperature = 0.7 }) {
    const client = createOllamaClient({
      models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
    });

    // Se modelo específico foi fornecido
    if (model) {
      const result = await client.generate(model, prompt, { temperature });
      return result;
    }

    // Usa fallback automático
    const result = await client.generateWithFallback(prompt, { temperature });
    return result;
  },
};

/**
 * Tool Ollama para chat
 */
export const ollamaChatTool = {
  name: "ollama_chat",
  description: "Chat usando modelos Ollama locais",
  enabled: true,
  parameters: {
    messages: {
      type: "array",
      description: "Array de mensagens no formato [{role, content}]",
      required: true,
    },
    model: {
      type: "string",
      description: "Modelo Ollama a usar",
      required: false,
    },
  },

  async execute({ messages, model = "llama3.2" }) {
    const client = createOllamaClient();
    const result = await client.chat(messages, model);
    return result;
  },
};

/**
 * Tool para verificar status do Ollama
 */
export const ollamaStatusTool = {
  name: "ollama_status",
  description: "Verifica se Ollama está disponível e lista modelos",
  enabled: true,
  parameters: {},

  async execute() {
    const client = createOllamaClient();
    const available = await client.isAvailable();

    if (!available) {
      return {
        available: false,
        message: "Ollama não está disponível",
      };
    }

    const models = await client.listModels();
    return {
      available: true,
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      })),
    };
  },
};
