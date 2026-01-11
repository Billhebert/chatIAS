/**
 * Teste direto do SDK session.prompt()
 */

import { createOpencodeClient } from './sdk/client.js';

async function main() {
  console.log('🧪 Teste direto do SDK OpenCode\n');

  try {
    // 1. Criar cliente
    console.log('📡 Criando cliente SDK...');
    const sdk = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
    console.log('✅ Cliente criado\n');

    // 2. Criar sessão
    console.log('🔐 Criando sessão...');
    const sessionResponse = await sdk.session.create({
      body: {
        name: 'Test-Session',
        model: {
          provider: 'opencode',
          model: 'minimax-m2.1-free',
          temperature: 0.7,
          maxTokens: 2000
        }
      }
    });

    console.log('📋 Session Response:');
    console.log(JSON.stringify(sessionResponse, null, 2));
    console.log();

    const sessionId = sessionResponse.data.id;
    console.log(`✅ Sessão criada: ${sessionId}\n`);

    // 3. Enviar mensagem
    console.log('💬 Enviando mensagem: "Hello! How are you?"\n');
    
    const promptResponse = await sdk.session.prompt({
      path: { id: sessionId },
      body: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello! How are you?' }]
      }
    });

    console.log('📋 Prompt Response:');
    console.log(JSON.stringify(promptResponse, null, 2));
    console.log();

    // 4. Extrair resposta
    if (promptResponse?.data?.messages) {
      const assistantMsg = promptResponse.data.messages.find(m => m.role === 'assistant');
      if (assistantMsg) {
        console.log('🤖 Resposta do assistente:');
        console.log(JSON.stringify(assistantMsg, null, 2));
        console.log();

        if (assistantMsg.parts && assistantMsg.parts[0]) {
          console.log('💬 Texto extraído:');
          console.log(assistantMsg.parts[0].text || assistantMsg.parts[0].content);
          console.log();
        }
      } else {
        console.log('⚠️  Nenhuma mensagem de assistente encontrada');
      }
    } else {
      console.log('⚠️  Formato de resposta inesperado');
    }

    // 5. Limpar
    console.log('🧹 Fechando sessão...');
    await sdk.session.delete({ path: { id: sessionId } });
    console.log('✅ Sessão fechada\n');

    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    process.exit(0);

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
