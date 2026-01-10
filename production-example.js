/**
 * Exemplo de uso em PRODUÇÃO do ChatIAS
 * Este arquivo demonstra como integrar o ChatIAS em uma aplicação real
 */

import { createOpencode } from "./sdk/index.js";
import { createOllamaClient } from "./lib/ollama/index.js";
import { globalToolRegistry } from "./lib/tools/index.js";
import { ollamaTool, ollamaChatTool, ollamaStatusTool } from "./lib/tools/ollama-tool.js";
import { globalAgentManager } from "./lib/agents/index.js";
import { globalMCPManager } from "./lib/mcp/index.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Cliente ChatIAS para produção
 */
class ProductionChatClient {
  constructor(config = {}) {
    this.sdkPort = config.sdkPort || process.env.SDK_PORT || 4096;
    this.opencode = null;
    this.client = null;
    this.ollamaClient = null;
    this.sessionId = null;

    // 12 modelos remotos configurados para fallback
    this.models = [
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
  }

  /**
   * Inicializa o cliente
   */
  async initialize() {
    // 1. Inicializar OpenCode SDK
    this.opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: this.sdkPort,
      timeout: 10000,
    });
    this.client = this.opencode.client;

    // 2. Inicializar Ollama Client
    this.ollamaClient = createOllamaClient({
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
      timeout: 30000,
    });

    // 3. Registrar tools
    globalToolRegistry.register("ollama_generate", ollamaTool);
    globalToolRegistry.register("ollama_chat", ollamaChatTool);
    globalToolRegistry.register("ollama_status", ollamaStatusTool);

    // 4. Registrar agentes
    this._registerAgents();

    // 5. Registrar MCP servers
    this._registerMCPServers();
  }

  /**
   * Registra agentes
   * @private
   */
  _registerAgents() {
    globalAgentManager.register("chat", {
      description: "Agente principal para conversas gerais",
      mode: "primary",
      model: { provider: "opencode", model: "minimax-m2.1-free" },
      temperature: 0.7,
      tools: { "*": true },
      enabled: true,
    });

    globalAgentManager.register("code-analyst", {
      description: "Analisa código sem modificar",
      mode: "primary",
      temperature: 0.2,
      tools: { read: true, grep: true, glob: true, edit: false },
      enabled: true,
    });
  }

  /**
   * Registra servidores MCP
   * @private
   */
  _registerMCPServers() {
    globalMCPManager.registerLocal("filesystem", {
      command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
      args: [process.cwd()],
      timeout: 5000,
      enabled: false, // Desabilitado por padrão
    });
  }

  /**
   * Cria uma sessão de chat
   */
  async createSession(title = "Chat Session") {
    const sessionRes = await this.client.session.create({
      body: { title: title },
    });

    this.sessionId = sessionRes?.data?.id ?? sessionRes?.id;

    if (!this.sessionId) {
      throw new Error("Falha ao criar sessão");
    }

    return this.sessionId;
  }

  /**
   * Envia mensagem com fallback automático
   * Ordem: Modelos remotos (12) → Ollama (3)
   */
  async sendMessage(prompt, options = {}) {
    const parts = [{ type: "text", text: prompt }];

    // Tentar modelos remotos
    for (const model of this.models) {
      try {
        const result = await this.client.session.prompt({
          path: { id: this.sessionId },
          body: { model: model, parts: parts },
        });

        if (result?.data && !result?.error) {
          return {
            success: true,
            source: "remote",
            model: model,
            data: result.data,
          };
        }
      } catch (error) {
        // Continua para próximo modelo
        continue;
      }
    }

    // Fallback: Ollama
    try {
      const result = await this.ollamaClient.generateWithFallback(prompt, {
        temperature: options.temperature || 0.7,
      });

      if (result.success) {
        return {
          success: true,
          source: "ollama",
          model: { providerID: "ollama", modelID: result.model },
          data: { content: result.response },
        };
      }
    } catch (error) {
      // Ollama também falhou
    }

    // Tudo falhou
    return {
      success: false,
      error: "Todos os modelos falharam (12 remotos + 3 Ollama)",
    };
  }

  /**
   * Encerra o cliente
   */
  async shutdown() {
    if (this.opencode) {
      await this.opencode.server.close();
    }
    globalMCPManager.stopAll();
  }
}

/**
 * Exemplo de uso em produção
 */
async function main() {
  const client = new ProductionChatClient();

  try {
    // Inicializar
    await client.initialize();
    console.log("✅ Cliente inicializado\n");

    // Criar sessão
    const sessionId = await client.createSession("Sessão de Produção");
    console.log(`✅ Sessão criada: ${sessionId}\n`);

    // Enviar mensagem
    const response = await client.sendMessage(
      "Qual é a capital do Brasil?",
      { temperature: 0.7 }
    );

    // Processar resposta
    if (response.success) {
      console.log(`✅ Resposta recebida de: ${response.source}`);
      console.log(`Modelo: ${response.model.providerID}/${response.model.modelID}`);
      console.log(`\nResposta:\n${JSON.stringify(response.data, null, 2)}`);
    } else {
      console.error(`❌ Falha: ${response.error}`);
    }

    // Encerrar
    await client.shutdown();
  } catch (error) {
    console.error("❌ Erro:", error.message);
    await client.shutdown();
    process.exit(1);
  }
}

// Executar apenas se for o script principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Exportar para uso como módulo
export { ProductionChatClient };
