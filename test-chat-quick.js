/**
 * Teste rápido do ChatEngine com SDK
 */

import { createSystem } from './src/core/system-loader.js';
import { ChatEngine } from './src/core/chat-engine.js';
import { createOpencodeClient } from './sdk/client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🧪 Iniciando teste do ChatEngine com SDK...\n');

  try {
    // 1. Carregar sistema
    console.log('📦 Carregando sistema...');
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: false,
      strictValidation: false
    });
    console.log(`✅ Sistema carregado (${system.agentRegistry.size()} agentes, ${system.toolRegistry.size()} tools)\n`);

    // 2. Configurar SDK
    console.log('🔌 Conectando ao SDK OpenCode...');
    const sdkUrl = 'http://localhost:4096';
    let sdkClient = null;
    let sdkConnected = false;
    
    try {
      const healthCheck = await fetch(`${sdkUrl}/global/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      sdkConnected = healthCheck.ok;
      
      if (sdkConnected) {
        sdkClient = createOpencodeClient({ baseUrl: sdkUrl });
        console.log(`✅ SDK conectado (${sdkUrl})\n`);
      } else {
        console.log(`⚠️  SDK não responde (${sdkUrl})\n`);
      }
    } catch (e) {
      console.log(`⚠️  SDK não disponível: ${e.message}\n`);
    }

    // 3. Obter Ollama do sistema
    const ollamaProvider = system.mcpRegistry.get("mcp_ollama");
    if (ollamaProvider && ollamaProvider.connected) {
      console.log(`✅ Ollama conectado (${ollamaProvider.baseUrl})\n`);
    } else {
      console.log(`⚠️  Ollama não conectado\n`);
    }

    // 4. Inicializar ChatEngine
    console.log('🤖 Inicializando ChatEngine...');
    const chatEngine = new ChatEngine({
      defaultModel: 'llama3.2:latest',
      temperature: 0.7,
      maxTokens: 2000
    });
    
    await chatEngine.initialize({
      ollama: ollamaProvider,
      sdk: sdkClient,
      toolRegistry: system.toolRegistry,
      agentRegistry: system.agentRegistry
    });
    
    console.log(`✅ ChatEngine inicializado (provider: ${chatEngine.activeProvider})`);
    if (chatEngine.currentModel) {
      console.log(`   Modelo: ${chatEngine.currentModel.name}`);
      console.log(`   Session ID: ${chatEngine.sdkSessionId}\n`);
    } else {
      console.log(`   (Nenhum modelo configurado)\n`);
    }

    // 5. Teste de mensagem simples
    console.log('💬 Testando mensagem de chat...');
    console.log('   Pergunta: "Hello! How are you?"\n');
    
    const result = await chatEngine.chat('Hello! How are you?');
    
    console.log('📊 Resultado:');
    console.log(`   ✅ Success: ${result.success}`);
    console.log(`   📝 Response: ${result.text.substring(0, 200)}${result.text.length > 200 ? '...' : ''}`);
    console.log(`   🎯 Intent: ${result.intent} (${Math.round(result.intentConfidence * 100)}%)`);
    console.log(`   🔧 Provider: ${result.provider}`);
    console.log(`   ⏱️  Duration: ${result.duration}ms`);
    console.log(`   📜 Logs: ${result.logs.length} entries\n`);

    // 6. Teste de mensagem conversacional mais complexa
    console.log('💬 Testando mensagem mais complexa...');
    console.log('   Pergunta: "Explique o que é um agente de IA em 2 frases"\n');
    
    const result2 = await chatEngine.chat('Explique o que é um agente de IA em 2 frases');
    
    console.log('📊 Resultado:');
    console.log(`   ✅ Success: ${result2.success}`);
    console.log(`   📝 Response: ${result2.text}`);
    console.log(`   🎯 Intent: ${result2.intent}`);
    console.log(`   🔧 Provider: ${result2.provider}`);
    console.log(`   ⏱️  Duration: ${result2.duration}ms\n`);

    // 7. Cleanup
    console.log('🧹 Limpando...');
    await chatEngine.shutdown();
    console.log('✅ Sessão SDK encerrada\n');

    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    process.exit(0);

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
