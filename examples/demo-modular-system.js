/**
 * Demonstração do sistema modular sem depender do OpenCode SDK rodando
 * Este exemplo mostra como usar os sistemas de agentes, tools e MCP
 */

import { globalAgentManager } from "../lib/agents/index.js";
import { globalToolRegistry } from "../lib/tools/index.js";
import { ollamaTool, ollamaChatTool, ollamaStatusTool } from "../lib/tools/ollama-tool.js";
import { globalMCPManager } from "../lib/mcp/index.js";
import { createOllamaClient } from "../lib/ollama/index.js";

console.log("🚀 Demonstração do Sistema Modular ChatIAS\n");
console.log("=" .repeat(60));

// ===== 1. SISTEMA DE AGENTES =====
console.log("\n📋 1. SISTEMA DE AGENTES MODULAR\n");

// Registrar agentes
globalAgentManager.register("chat", {
  description: "Agente principal para conversas",
  mode: "primary",
  temperature: 0.7,
  tools: { "*": true },
  enabled: true,
});

globalAgentManager.register("code-analyst", {
  description: "Analisa código sem modificar",
  mode: "primary",
  temperature: 0.2,
  tools: { read: true, grep: true, edit: false },
  enabled: true,
});

globalAgentManager.register("researcher", {
  description: "Pesquisa informações",
  mode: "subagent",
  tools: { webfetch: true, read: true },
  enabled: true,
});

console.log("Agentes registrados:");
globalAgentManager.list({ enabled: true }).forEach((agent) => {
  console.log(`  ✓ ${agent.name} (${agent.mode}) - ${agent.description}`);
});

// Desabilitar e reabilitar um agente
console.log("\nTestando habilitar/desabilitar:");
console.log("  • Desabilitando 'researcher'...");
globalAgentManager.disable("researcher");

console.log(`  • Agentes ativos: ${globalAgentManager.list({ enabled: true }).length}`);

console.log("  • Reabilitando 'researcher'...");
globalAgentManager.enable("researcher");

console.log(`  • Agentes ativos: ${globalAgentManager.list({ enabled: true }).length}`);

// ===== 2. SISTEMA DE TOOLS =====
console.log("\n" + "=" .repeat(60));
console.log("\n🔧 2. SISTEMA DE TOOLS CUSTOMIZADAS\n");

// Registrar tools Ollama
globalToolRegistry.register("ollama_generate", ollamaTool);
globalToolRegistry.register("ollama_chat", ollamaChatTool);
globalToolRegistry.register("ollama_status", ollamaStatusTool);

// Criar uma tool customizada de exemplo
globalToolRegistry.register("example_tool", {
  description: "Tool de exemplo para demonstração",
  enabled: true,
  parameters: {
    message: { type: "string", required: true },
  },
  execute: async ({ message }) => {
    return { result: `Processado: ${message}`, timestamp: new Date().toISOString() };
  },
});

console.log("Tools registradas:");
globalToolRegistry.list().forEach((tool) => {
  console.log(`  ✓ ${tool.name} - ${tool.description}`);
});

// Testar execução de tool
console.log("\nTestando execução de tool:");
const toolResult = await globalToolRegistry.execute("example_tool", {
  message: "Hello World",
});
console.log("  Resultado:", JSON.stringify(toolResult, null, 2));

// Desabilitar tool
console.log("\nTestando habilitar/desabilitar tool:");
globalToolRegistry.disable("example_tool");
console.log(`  • Tools ativas: ${globalToolRegistry.list(true).length}`);

globalToolRegistry.enable("example_tool");
console.log(`  • Tools ativas: ${globalToolRegistry.list(true).length}`);

// ===== 3. SISTEMA MCP =====
console.log("\n" + "=" .repeat(60));
console.log("\n🔌 3. SISTEMA DE MCP SERVERS\n");

// Registrar servidores MCP
globalMCPManager.registerLocal("filesystem", {
  command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
  args: [process.cwd()],
  timeout: 5000,
  enabled: true,
});

globalMCPManager.registerRemote("api-server", {
  url: "https://api.example.com/mcp",
  headers: { Authorization: "Bearer token" },
  enabled: false,
});

console.log("Servidores MCP registrados:");
globalMCPManager.list().forEach((server) => {
  console.log(`  ${server.enabled ? "✓" : "○"} ${server.name} (${server.type})`);
});

console.log("\nTestando habilitar/desabilitar:");
globalMCPManager.disable("filesystem");
console.log(`  • Servidores ativos: ${globalMCPManager.list(true).length}`);

globalMCPManager.enable("filesystem");
console.log(`  • Servidores ativos: ${globalMCPManager.list(true).length}`);

// ===== 4. CLIENTE OLLAMA =====
console.log("\n" + "=" .repeat(60));
console.log("\n🦙 4. CLIENTE OLLAMA (FALLBACK)\n");

const ollamaClient = createOllamaClient({
  baseUrl: "http://localhost:11434",
  models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
});

console.log("Cliente Ollama configurado:");
console.log(`  • URL base: http://localhost:11434`);
console.log(`  • Modelos: llama3.2, qwen2.5-coder, deepseek-coder-v2`);

console.log("\nVerificando disponibilidade...");
const available = await ollamaClient.isAvailable();

if (available) {
  console.log("  ✓ Ollama está disponível!");

  const models = await ollamaClient.listModels();
  console.log(`  ✓ Modelos instalados: ${models.length}`);

  models.forEach((model) => {
    console.log(`    • ${model.name}`);
  });

  // Teste opcional de geração
  console.log("\n  Teste de geração (apenas se Ollama estiver rodando):");
  const testResult = await ollamaClient.generateWithFallback("Diga olá em uma frase.", {
    temperature: 0.7,
  });

  if (testResult.success) {
    console.log(`    ✓ Resposta recebida do modelo ${testResult.model}`);
    console.log(`    Resposta: ${testResult.response.substring(0, 100)}...`);
  } else {
    console.log(`    ✗ Falha: ${testResult.error}`);
  }
} else {
  console.log("  ⚠️  Ollama não está disponível (isso é normal se não estiver instalado)");
  console.log("  💡 Para instalar: curl -fsSL https://ollama.ai/install.sh | sh");
}

// ===== RESUMO =====
console.log("\n" + "=" .repeat(60));
console.log("\n📊 RESUMO DO SISTEMA MODULAR\n");

console.log("Componentes ativos:");
console.log(`  • Agentes: ${globalAgentManager.list({ enabled: true }).length} ativos`);
console.log(`    - Primários: ${globalAgentManager.listPrimary().length}`);
console.log(`    - Subagentes: ${globalAgentManager.listSubagents().length}`);
console.log(`  • Tools: ${globalToolRegistry.list(true).length} ativas`);
console.log(`  • MCP Servers: ${globalMCPManager.list(true).length} ativos`);
console.log(`  • Ollama: ${available ? "Disponível ✓" : "Indisponível ○"}`);

console.log("\n✅ Sistema modular totalmente funcional!");
console.log("\n" + "=" .repeat(60) + "\n");
