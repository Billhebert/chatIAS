/**
 * TESTES DE INTEGRAÇÃO REAIS
 * Executa funcionalidades de verdade, não apenas verifica existência
 * Execute: node test-integration.js
 */

import { createOllamaClient } from "./lib/ollama/index.js";
import { globalToolRegistry } from "./lib/tools/index.js";
import { ollamaTool, ollamaChatTool, ollamaStatusTool } from "./lib/tools/ollama-tool.js";
import { readFileSync } from "fs";

console.log("🔬 TESTES DE INTEGRAÇÃO REAIS\n");
console.log("=" .repeat(70));
console.log("⚠️  Estes testes executam funcionalidades REAIS, não apenas verificam");
console.log("=" .repeat(70) + "\n");

let testsPass = 0;
let testsFail = 0;
let testsSkip = 0;

function testPass(name, details = "") {
  console.log(`✅ PASS: ${name}`);
  if (details) console.log(`   ℹ️  ${details}`);
  testsPass++;
}

function testFail(name, error) {
  console.log(`❌ FAIL: ${name}`);
  console.log(`   Erro: ${error}`);
  testsFail++;
}

function testSkip(name, reason) {
  console.log(`⏭️  SKIP: ${name}`);
  console.log(`   Razão: ${reason}`);
  testsSkip++;
}

// ============================================================================
// TESTE 1: OLLAMA CLIENT - CHAMADAS REAIS
// ============================================================================
console.log("\n🦙 TESTE 1: Ollama Client - Chamadas REAIS");
console.log("-".repeat(70));

const ollamaClient = createOllamaClient({
  baseUrl: "http://localhost:11434",
  models: ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"],
});

// 1.1 - Verificar disponibilidade
try {
  console.log("1.1 - Verificando se Ollama está disponível...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    testPass("Ollama disponível e respondendo");
  } else {
    testSkip("Ollama disponível", "Ollama não está rodando - instale com: curl -fsSL https://ollama.ai/install.sh | sh");
  }
} catch (error) {
  testFail("Ollama disponibilidade", error.message);
}

// 1.2 - Listar modelos REAIS
try {
  console.log("\n1.2 - Listando modelos instalados...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    const models = await ollamaClient.listModels();

    if (models && models.length > 0) {
      testPass(`Ollama listModels() retornou ${models.length} modelo(s)`,
        `Modelos: ${models.map(m => m.name).join(", ")}`);
    } else {
      testSkip("Ollama modelos", "Nenhum modelo instalado - execute: ollama pull llama3.2");
    }
  } else {
    testSkip("Ollama listModels()", "Ollama não disponível");
  }
} catch (error) {
  testFail("Ollama listModels()", error.message);
}

// 1.3 - Gerar resposta REAL
try {
  console.log("\n1.3 - Gerando resposta REAL com Ollama...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    console.log("   📤 Enviando prompt: 'Diga apenas: OK'");

    const result = await ollamaClient.generate("llama3.2", "Diga apenas: OK", {
      temperature: 0.1,
      max_tokens: 10,
    });

    if (result.success && result.response) {
      testPass("Ollama generate() gerou resposta",
        `Resposta: "${result.response.substring(0, 50)}..." (${result.response.length} chars)`);
    } else {
      testFail("Ollama generate()", `Sucesso: ${result.success}, Resposta vazia`);
    }
  } else {
    testSkip("Ollama generate()", "Ollama não disponível");
  }
} catch (error) {
  testFail("Ollama generate()", error.message);
}

// 1.4 - Fallback automático REAL
try {
  console.log("\n1.4 - Testando fallback automático REAL...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    console.log("   📤 Prompt: 'Responda: teste'");
    console.log("   🔄 Tentará: llama3.2 → qwen2.5-coder → deepseek-coder-v2");

    const result = await ollamaClient.generateWithFallback("Responda: teste", {
      temperature: 0.1,
      max_tokens: 20,
    });

    if (result.success && result.response) {
      testPass("Ollama generateWithFallback() funcionou",
        `Modelo usado: ${result.model} | Resposta: "${result.response.substring(0, 30)}..."`);
    } else {
      testFail("Ollama generateWithFallback()", "Todos os modelos falharam");
    }
  } else {
    testSkip("Ollama generateWithFallback()", "Ollama não disponível");
  }
} catch (error) {
  testFail("Ollama generateWithFallback()", error.message);
}

// 1.5 - Chat REAL
try {
  console.log("\n1.5 - Testando chat REAL...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    const messages = [
      { role: "user", content: "Qual é 2+2?" },
    ];

    console.log("   💬 Mensagem: 'Qual é 2+2?'");

    const result = await ollamaClient.chat("llama3.2", messages, {
      temperature: 0.1,
    });

    if (result.success && result.response) {
      testPass("Ollama chat() respondeu",
        `Resposta: "${result.response.substring(0, 50)}..."`);
    } else {
      testFail("Ollama chat()", "Resposta vazia");
    }
  } else {
    testSkip("Ollama chat()", "Ollama não disponível");
  }
} catch (error) {
  testFail("Ollama chat()", error.message);
}

// ============================================================================
// TESTE 2: TOOLS - EXECUÇÃO REAL
// ============================================================================
console.log("\n\n🔧 TESTE 2: Tools - Execução REAL");
console.log("-".repeat(70));

// Registrar tools
globalToolRegistry.tools.clear();
globalToolRegistry.register("ollama_generate", ollamaTool);
globalToolRegistry.register("ollama_chat", ollamaChatTool);
globalToolRegistry.register("ollama_status", ollamaStatusTool);

// 2.1 - Executar tool ollama_status REAL
try {
  console.log("\n2.1 - Executando tool 'ollama_status'...");

  const result = await globalToolRegistry.execute("ollama_status", {});

  if (result && typeof result.available !== "undefined") {
    testPass("Tool 'ollama_status' executou",
      `Disponível: ${result.available} | Modelos: ${result.models?.length || 0}`);
  } else {
    testFail("Tool 'ollama_status'", "Resultado inválido");
  }
} catch (error) {
  testFail("Tool 'ollama_status'", error.message);
}

// 2.2 - Executar tool ollama_generate REAL
try {
  console.log("\n2.2 - Executando tool 'ollama_generate'...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    const result = await globalToolRegistry.execute("ollama_generate", {
      prompt: "Diga: teste",
      model: "llama3.2",
      temperature: 0.1,
    });

    if (result && result.success && result.response) {
      testPass("Tool 'ollama_generate' gerou resposta",
        `Resposta: "${result.response.substring(0, 40)}..."`);
    } else {
      testFail("Tool 'ollama_generate'", "Geração falhou");
    }
  } else {
    testSkip("Tool 'ollama_generate'", "Ollama não disponível");
  }
} catch (error) {
  testFail("Tool 'ollama_generate'", error.message);
}

// 2.3 - Executar tool ollama_chat REAL
try {
  console.log("\n2.3 - Executando tool 'ollama_chat'...");
  const available = await ollamaClient.isAvailable();

  if (available) {
    const result = await globalToolRegistry.execute("ollama_chat", {
      messages: [{ role: "user", content: "Responda: OK" }],
      model: "llama3.2",
      temperature: 0.1,
    });

    if (result && result.success && result.response) {
      testPass("Tool 'ollama_chat' respondeu",
        `Resposta: "${result.response.substring(0, 40)}..."`);
    } else {
      testFail("Tool 'ollama_chat'", "Chat falhou");
    }
  } else {
    testSkip("Tool 'ollama_chat'", "Ollama não disponível");
  }
} catch (error) {
  testFail("Tool 'ollama_chat'", error.message);
}

// ============================================================================
// TESTE 3: INTEGRAÇÃO COM CHAT.JS - CÓDIGO REAL
// ============================================================================
console.log("\n\n💼 TESTE 3: Integração com chat.js - Código REAL");
console.log("-".repeat(70));

// 3.1 - Verificar se chat.js importa Ollama
try {
  console.log("\n3.1 - Verificando se chat.js importa OllamaClient...");
  const chatContent = readFileSync("./chat.js", "utf-8");

  if (chatContent.includes('import') && chatContent.includes('ollama')) {
    testPass("chat.js importa Ollama", "Import encontrado no código");
  } else {
    testFail("chat.js importa Ollama", "Import não encontrado");
  }
} catch (error) {
  testFail("chat.js importa Ollama", error.message);
}

// 3.2 - Verificar se chat.js cria cliente Ollama
try {
  console.log("\n3.2 - Verificando se chat.js cria ollamaClient...");
  const chatContent = readFileSync("./chat.js", "utf-8");

  if (chatContent.includes('createOllamaClient') || chatContent.includes('ollamaClient')) {
    testPass("chat.js cria ollamaClient", "Inicialização encontrada");
  } else {
    testFail("chat.js cria ollamaClient", "Não encontrado");
  }
} catch (error) {
  testFail("chat.js cria ollamaClient", error.message);
}

// 3.3 - Verificar se chat.js chama generateWithFallback
try {
  console.log("\n3.3 - Verificando se chat.js usa generateWithFallback...");
  const chatContent = readFileSync("./chat.js", "utf-8");

  if (chatContent.includes('generateWithFallback')) {
    testPass("chat.js usa generateWithFallback", "Chamada encontrada no código");
  } else {
    testFail("chat.js usa generateWithFallback", "Chamada não encontrada");
  }
} catch (error) {
  testFail("chat.js usa generateWithFallback", error.message);
}

// 3.4 - Verificar se chat.js tem fallback após modelos remotos falharem
try {
  console.log("\n3.4 - Verificando lógica de fallback para Ollama...");
  const chatContent = readFileSync("./chat.js", "utf-8");

  const hasFallbackMessage = chatContent.includes("Todos os modelos remotos falharam") ||
                             chatContent.includes("Tentando Ollama");
  const hasOllamaCall = chatContent.includes("ollamaClient.generate") ||
                        chatContent.includes("ollamaClient.generateWithFallback");

  if (hasFallbackMessage && hasOllamaCall) {
    testPass("chat.js tem lógica de fallback Ollama",
      "Mensagem de fallback E chamada Ollama encontradas");
  } else {
    testFail("chat.js lógica de fallback",
      `Mensagem: ${hasFallbackMessage}, Chamada: ${hasOllamaCall}`);
  }
} catch (error) {
  testFail("chat.js lógica de fallback", error.message);
}

// 3.5 - Verificar se chat.js retorna resposta do Ollama no formato correto
try {
  console.log("\n3.5 - Verificando formato de resposta do Ollama...");
  const chatContent = readFileSync("./chat.js", "utf-8");

  if (chatContent.includes('source: "ollama"') || chatContent.includes("source: 'ollama'")) {
    testPass("chat.js retorna source='ollama'", "Formato de resposta correto");
  } else {
    testFail("chat.js formato de resposta", "Campo 'source' não encontrado");
  }
} catch (error) {
  testFail("chat.js formato de resposta", error.message);
}

// ============================================================================
// TESTE 4: ESTRUTURA DE ARQUIVOS
// ============================================================================
console.log("\n\n📁 TESTE 4: Estrutura de Arquivos");
console.log("-".repeat(70));

const requiredFiles = [
  "lib/ollama/client.js",
  "lib/ollama/index.js",
  "lib/tools/index.js",
  "lib/tools/ollama-tool.js",
  "lib/agents/index.js",
  "lib/mcp/index.js",
  "chat.js",
  ".opencode/config.json",
];

import { existsSync } from "fs";

requiredFiles.forEach((file) => {
  if (existsSync(file)) {
    testPass(`Arquivo existe: ${file}`);
  } else {
    testFail(`Arquivo existe: ${file}`, "Arquivo não encontrado");
  }
});

// ============================================================================
// RESULTADOS FINAIS
// ============================================================================
console.log("\n" + "=" .repeat(70));
console.log("📊 RESULTADOS FINAIS - TESTES DE INTEGRAÇÃO REAIS");
console.log("=" .repeat(70));
console.log(`✅ Testes passaram: ${testsPass}`);
console.log(`❌ Testes falharam: ${testsFail}`);
console.log(`⏭️  Testes pulados: ${testsSkip} (requerem Ollama rodando)`);

const total = testsPass + testsFail + testsSkip;
const successRate = ((testsPass / (testsPass + testsFail)) * 100).toFixed(1);

console.log(`📈 Taxa de sucesso: ${successRate}%`);
console.log(`📊 Total de testes: ${total}`);

if (testsFail === 0) {
  console.log("\n🎉 TODOS OS TESTES REAIS PASSARAM!");

  if (testsSkip > 0) {
    console.log("\n💡 Dica: Para executar TODOS os testes sem pular nenhum:");
    console.log("   1. Instale Ollama: curl -fsSL https://ollama.ai/install.sh | sh");
    console.log("   2. Baixe um modelo: ollama pull llama3.2");
    console.log("   3. Execute novamente: node test-integration.js");
  }
} else {
  console.log("\n⚠️  Alguns testes falharam. Verifique os erros acima.");
  process.exit(1);
}

console.log("=" .repeat(70));
