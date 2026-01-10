/**
 * ChatIAS - Sistema de chat com múltiplos modelos e fallback Ollama
 * Usa 100% do OpenCode SDK com arquitetura modular
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
 * Gerenciador do OpenCode SDK
 */
class OpenCodeManager {
  constructor() {
    this.initialized = false;
    this.sdkPort = process.env.SDK_PORT || 4096;
    this.opencode = null;
    this.client = null;
    this.ollamaClient = null;

    // 12 modelos remotos configurados
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
   * Inicializa o SDK e todos os sistemas modulares
   */
  async initialize() {
    console.log("🚀 Inicializando ChatIAS com arquitetura modular...\n");

    // 1. Inicializar OpenCode SDK
    try {
      await this.initializeSDK();
    } catch (error) {
      console.log("   ⚠️ OpenCode SDK não disponível:", error.message);
      console.log("   Continuando sem OpenCode SDK...\n");
      this.client = null; // Marca como não disponível
    }

    // 2. Inicializar Ollama Client
    this.initializeOllama();

    // 3. Registrar tools customizadas
    this.registerTools();

    // 4. Registrar agentes
    this.registerAgents();

    // 5. Registrar servidores MCP
    this.registerMCPServers();

    console.log("\n✅ ChatIAS inicializado com sucesso!\n");
    this.initialized = true;
  }

  /**
   * Inicializa o OpenCode SDK
   */
  async initializeSDK() {
    console.log("📦 Inicializando OpenCode SDK...");

    this.opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: this.sdkPort,
      timeout: 10000,
      config: {
        model: {
          provider: "opencode",
          model: "minimax-m2.1-free",
        },
      },
    });

    this.client = this.opencode.client;
    console.log(`   ✓ SDK iniciado na porta ${this.sdkPort}`);
  }

  /**
   * Inicializa o cliente Ollama
   */
  initializeOllama() {
    console.log("🦙 Inicializando Ollama Client...");

    this.ollamaClient = createOllamaClient({
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
      timeout: 30000,
    });

    console.log("   ✓ Ollama Client criado");
  }

  /**
   * Registra tools customizadas
   */
  registerTools() {
    console.log("🔧 Registrando tools customizadas...");

    globalToolRegistry.register("ollama_generate", ollamaTool);
    globalToolRegistry.register("ollama_chat", ollamaChatTool);
    globalToolRegistry.register("ollama_status", ollamaStatusTool);

    console.log(`   ✓ ${globalToolRegistry.list().length} tools registradas`);
  }

  /**
   * Registra agentes
   */
  registerAgents() {
    console.log("🤖 Registrando agentes...");

    // Agente principal de chat
    globalAgentManager.register("chat", {
      description: "Agente principal para conversas gerais",
      mode: "primary",
      model: { provider: "opencode", model: "minimax-m2.1-free" },
      temperature: 0.7,
      maxSteps: 50,
      tools: { "*": true },
      enabled: true,
    });

    // Analista de código
    globalAgentManager.register("code-analyst", {
      description: "Analisa código sem modificar",
      mode: "primary",
      temperature: 0.2,
      tools: { read: true, grep: true, glob: true, edit: false, write: false },
      enabled: true,
    });

    // Escritor de código
    globalAgentManager.register("code-writer", {
      description: "Escreve e edita código",
      mode: "primary",
      temperature: 0.3,
      tools: { "*": true },
      enabled: true,
    });

    // Pesquisador (subagente)
    globalAgentManager.register("researcher", {
      description: "Pesquisa informações",
      mode: "subagent",
      tools: { webfetch: true, grep: true, glob: true, read: true },
      enabled: true,
    });

    // Testador (subagente)
    globalAgentManager.register("tester", {
      description: "Executa e analisa testes",
      mode: "subagent",
      tools: { bash: true, read: true, grep: true },
      enabled: true,
    });

    console.log(`   ✓ ${globalAgentManager.list({ enabled: true }).length} agentes registrados`);
  }

  /**
   * Registra servidores MCP
   */
  registerMCPServers() {
    console.log("🔌 Registrando servidores MCP...");

    // Filesystem MCP (exemplo)
    globalMCPManager.registerLocal("filesystem", {
      command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
      args: [process.cwd()],
      env: {},
      timeout: 5000,
      enabled: false, // Desabilitado por padrão, pode ser ativado
    });

    console.log(`   ✓ ${globalMCPManager.list().length} servidores MCP registrados`);
  }

  /**
   * Encerra o SDK e todos os recursos
   */
  async shutdown() {
    if (!this.opencode) return;

    console.log("\n🛑 Encerrando ChatIAS...");

    // Parar servidores MCP
    globalMCPManager.stopAll();

    // Fechar SDK
    try {
      await this.opencode.server.close();
      console.log("   ✓ OpenCode SDK encerrado");
    } catch (error) {
      console.warn(`   ⚠️ Erro ao encerrar SDK: ${error.message}`);
    }
  }
}

/**
 * Cliente de chat com fallback em cascata
 */
class ChatClient extends OpenCodeManager {
  constructor() {
    super();
    this.sessionId = null;
  }

  /**
   * Cria uma nova sessão de chat
   */
  async createSession(title = "Chat Session") {
    if (!this.client) {
      console.log(`   ⚠️ OpenCode SDK não disponível, pulando criação de sessão\n`);
      return null;
    }

    console.log(`📝 Criando sessão: "${title}"`);

    try {
      const sessionRes = await this.client.session.create({
        body: { title: title },
      });

      // Debug: ver a resposta real
      console.log("   Debug - Resposta completa:", JSON.stringify(sessionRes, null, 2));

      // Tentar diferentes formatos de resposta
      this.sessionId = sessionRes?.data?.id ?? sessionRes?.id ?? sessionRes ?? null;

      if (this.sessionId && typeof this.sessionId === 'string') {
        console.log(`   ✓ Sessão criada: ${this.sessionId}\n`);
      } else {
        console.error("   ✗ Resposta não contém ID válido");
        console.error("   sessionRes.data:", sessionRes?.data);
        console.error("   sessionRes.id:", sessionRes?.id);
        console.error("   sessionRes:", sessionRes);
        throw new Error("Falha ao criar sessão - ID não encontrado na resposta");
      }
    } catch (error) {
      console.error(`   ✗ Erro ao criar sessão: ${error.message}`);
      if (error.response) {
        console.error("   Resposta de erro:", error.response);
      }
      return null; // Retorna null em vez de lançar erro
    }
  }

  /**
   * Envia mensagem com sistema de fallback em cascata
   * Ordem: Modelo especificado → 12 modelos remotos → Ollama
   */
  async sendMessage(parts, providerID = null, modelID = null) {
    // 1. Tenta modelo especificado (se fornecido)
    if (providerID && modelID) {
      console.log(`💬 Tentando modelo: ${providerID}/${modelID}`);
      const result = await this._tryModel({ providerID, modelID }, parts);
      if (result.success) return result;
    }

    // 2. Tenta os 12 modelos remotos em sequência
    console.log("🔄 Iniciando fallback em cascata...\n");

    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      console.log(`   [${i + 1}/${this.models.length}] Tentando: ${model.providerID}/${model.modelID}`);

      const result = await this._tryModel(model, parts);

      if (result.success) {
        console.log(`   ✓ Sucesso com ${model.providerID}/${model.modelID}\n`);
        return result;
      }

      console.log(`   ✗ Falhou: ${result.error}\n`);
    }

    // 3. Último recurso: Ollama
    console.log("🦙 Todos os modelos remotos falharam. Tentando Ollama como fallback final...\n");

    return await this._tryOllama(parts);
  }

  /**
   * Tenta usar um modelo específico
   * @private
   */
  async _tryModel(model, parts) {
    try {
      const result = await this.client.session.prompt({
        path: { id: this.sessionId },
        body: {
          model: model,
          parts: parts,
        },
      });

      // Verifica se houve erro ou resposta vazia
      if (
        result?.error ||
        result?.data?.error ||
        result.data === null ||
        Object.keys(result.data || {}).length === 0
      ) {
        throw new Error(result?.error?.message || "Resposta vazia");
      }

      return {
        success: true,
        model: model,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        model: model,
        error: error.message,
      };
    }
  }

  /**
   * Tenta usar Ollama como fallback
   * @private
   */
  async _tryOllama(parts) {
    try {
      // Extrai o texto dos parts
      const prompt = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      // Usa o cliente Ollama com fallback automático
      const result = await this.ollamaClient.generateWithFallback(prompt, {
        temperature: 0.7,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log(`   ✓ Ollama respondeu com sucesso usando ${result.model}\n`);

      return {
        success: true,
        model: { providerID: "ollama", modelID: result.model },
        data: {
          type: "ollama",
          content: result.response,
          metadata: result.metadata,
        },
      };
    } catch (error) {
      console.error(`   ✗ Ollama falhou: ${error.message}\n`);

      return {
        success: false,
        error: "Todos os modelos (remotos e Ollama) falharam",
      };
    }
  }

  /**
   * Lista todas as sessões
   */
  async listSessions() {
    try {
      const sessions = await this.client.session.list();
      return sessions.data || [];
    } catch (error) {
      console.error("Erro ao listar sessões:", error);
      return [];
    }
  }

  /**
   * Obtém informações do sistema
   */
  async getSystemInfo() {
    try {
      const health = await this.client.global.health();
      const version = await this.client.global.version();
      const config = await this.client.config.get();

      return { health, version, config };
    } catch (error) {
      console.error("Erro ao obter informações do sistema:", error);
      return null;
    }
  }
}

/**
 * Função principal
 */
async function main() {
  const client = new ChatClient();

  // Configurar shutdown gracioso
  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Recebido SIGINT. Encerrando...");
    await client.shutdown();
    process.exit(0);
  });

  try {
    // 1. Inicializar todos os sistemas
    await client.initialize();

    // 2. Criar sessão de chat
    const sessionId = await client.createSession("Teste ChatIAS com Ollama Fallback");

    if (!sessionId) {
      console.log("\n⚠️ Não foi possível criar sessão com OpenCode SDK");
      console.log("💡 Isso é esperado se o OpenCode não estiver instalado ou rodando");
      console.log("   Para testar sem OpenCode, execute: node chat-standalone.js\n");
      console.log("📊 STATUS DOS SISTEMAS\n");
      console.log(`Agentes ativos: ${globalAgentManager.list({ enabled: true }).length}`);
      console.log(`Tools registradas: ${globalToolRegistry.list().length}`);
      console.log(`Servidores MCP: ${globalMCPManager.list().length}`);
      console.log("\n💡 Para usar o chat completo, instale o OpenCode:");
      console.log("   npm install -g @opencode-ai/cli");
      console.log("   Documentação: https://opencode.ai/docs/sdk/\n");
      return;
    }

    // 3. Enviar mensagem de teste
    console.log("=" .repeat(60));
    console.log("TESTE: Enviando mensagem com sistema de fallback");
    console.log("=" .repeat(60) + "\n");

    const response = await client.sendMessage([
      { type: "text", text: "Escreva um poema curto sobre inteligência artificial." },
    ]);

    // 4. Mostrar resultado
    console.log("=" .repeat(60));
    console.log("RESULTADO");
    console.log("=" .repeat(60));
    console.log(`\nModelo usado: ${response.model?.providerID}/${response.model?.modelID}`);
    console.log(`Sucesso: ${response.success}\n`);

    if (response.success) {
      if (response.data.type === "ollama") {
        console.log("Resposta (Ollama):");
        console.log(response.data.content);
      } else {
        console.log("Resposta:");
        console.log(JSON.stringify(response.data, null, 2));
      }
    } else {
      console.log("Erro:", response.error);
    }

    console.log("\n" + "=" .repeat(60) + "\n");

    // 5. Mostrar status dos sistemas
    console.log("📊 STATUS DOS SISTEMAS\n");
    console.log(`Agentes ativos: ${globalAgentManager.list({ enabled: true }).length}`);
    console.log(`Tools registradas: ${globalToolRegistry.list().length}`);
    console.log(`Servidores MCP: ${globalMCPManager.list().length}`);

  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    console.error("\n💡 Dica: Execute 'node chat-standalone.js' para testar sem OpenCode SDK");
  } finally {
    // Encerrar
    await client.shutdown();
  }
}

// Executar
main();
