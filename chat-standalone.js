/**
 * ChatIAS - Versão Standalone (funciona sem OpenCode SDK rodando)
 * Demonstra o sistema modular e fallback Ollama
 */

import { createOllamaClient } from "./lib/ollama/index.js";
import { globalToolRegistry } from "./lib/tools/index.js";
import { ollamaTool, ollamaChatTool, ollamaStatusTool } from "./lib/tools/ollama-tool.js";
import { globalAgentManager } from "./lib/agents/index.js";
import { globalMCPManager } from "./lib/mcp/index.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Cliente de chat standalone (sem OpenCode SDK)
 */
class StandaloneChatClient {
  constructor() {
    this.ollamaClient = null;
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

  async initialize() {
    console.log("🚀 Inicializando ChatIAS Standalone (sem OpenCode SDK)\n");

    // Inicializar Ollama
    this.initializeOllama();

    // Registrar tools
    this.registerTools();

    // Registrar agentes
    this.registerAgents();

    // Registrar MCP
    this.registerMCPServers();

    console.log("\n✅ ChatIAS Standalone inicializado!\n");
  }

  initializeOllama() {
    console.log("🦙 Inicializando Ollama Client...");
    this.ollamaClient = createOllamaClient({
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
      timeout: 30000,
    });
    console.log("   ✓ Ollama Client criado");
  }

  registerTools() {
    console.log("🔧 Registrando tools...");
    globalToolRegistry.register("ollama_generate", ollamaTool);
    globalToolRegistry.register("ollama_chat", ollamaChatTool);
    globalToolRegistry.register("ollama_status", ollamaStatusTool);
    console.log(`   ✓ ${globalToolRegistry.list().length} tools registradas`);
  }

  registerAgents() {
    console.log("🤖 Registrando agentes...");

    globalAgentManager.register("chat", {
      description: "Agente principal",
      mode: "primary",
      enabled: true,
    });

    globalAgentManager.register("code-analyst", {
      description: "Analista de código",
      mode: "primary",
      enabled: true,
    });

    console.log(`   ✓ ${globalAgentManager.list({ enabled: true }).length} agentes registrados`);
  }

  registerMCPServers() {
    console.log("🔌 Registrando MCP servers...");
    globalMCPManager.registerLocal("filesystem", {
      command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
      args: [process.cwd()],
      enabled: false,
    });
    console.log(`   ✓ ${globalMCPManager.list().length} servidores MCP registrados`);
  }

  async sendMessage(prompt) {
    console.log("=" .repeat(60));
    console.log("SIMULANDO FALLBACK EM CASCATA");
    console.log("=" .repeat(60) + "\n");

    // Simular tentativa com modelos remotos
    console.log("🔄 Simulando tentativas com modelos remotos...\n");

    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      console.log(`   [${i + 1}/${this.models.length}] Tentando: ${model.providerID}/${model.modelID}`);
      console.log(`   ✗ Falhou (simulado - SDK não está rodando)\n`);
    }

    // Tentar Ollama
    console.log("🦙 Todos os modelos remotos falharam (simulado)");
    console.log("   Tentando Ollama como fallback final...\n");

    const result = await this.ollamaClient.generateWithFallback(prompt, {
      temperature: 0.7,
    });

    return result;
  }
}

async function main() {
  const client = new StandaloneChatClient();

  try {
    await client.initialize();

    console.log("=" .repeat(60));
    console.log("TESTE DE MENSAGEM");
    console.log("=" .repeat(60) + "\n");

    const prompt = "Escreva um poema curto sobre inteligência artificial.";
    console.log(`Prompt: "${prompt}"\n`);

    const result = await client.sendMessage(prompt);

    console.log("=" .repeat(60));
    console.log("RESULTADO");
    console.log("=" .repeat(60) + "\n");

    if (result.success) {
      console.log(`✅ Sucesso com Ollama: ${result.model}\n`);
      console.log("Resposta:");
      console.log(result.response);
      console.log("\nMetadata:");
      console.log(`  - Tempo total: ${result.metadata.total_duration}ns`);
      console.log(`  - Tokens gerados: ${result.metadata.eval_count}`);
    } else {
      console.log("❌ Falha:", result.error);
      console.log("\n💡 Dica:");
      console.log("   Certifique-se de ter o Ollama instalado e rodando:");
      console.log("   1. Instale: curl -fsSL https://ollama.ai/install.sh | sh");
      console.log("   2. Baixe um modelo: ollama pull llama3.2");
      console.log("   3. Verifique: ollama list");
    }

    console.log("\n" + "=" .repeat(60));
    console.log("\n📊 STATUS DOS SISTEMAS\n");
    console.log(`Agentes ativos: ${globalAgentManager.list({ enabled: true }).length}`);
    console.log(`Tools registradas: ${globalToolRegistry.list().length}`);
    console.log(`Servidores MCP: ${globalMCPManager.list().length}`);
    console.log(`Ollama: ${result.success ? "Disponível ✓" : "Indisponível ○"}`);

    console.log("\n" + "=" .repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
  }
}

main();
