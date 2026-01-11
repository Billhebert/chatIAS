/**
 * populate-qdrant.js - Script para popular o Qdrant com dados iniciais
 * Usa Ollama para gerar embeddings REAIS
 * 
 * Uso:
 * node scripts/populate-qdrant.js
 * 
 * Requisitos:
 * 1. Qdrant rodando: docker run -d -p 6333:6333 qdrant/qdrant
 * 2. Ollama rodando: ollama serve
 * 3. Modelo de embedding: ollama pull nomic-embed-text
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'knowledge_base';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

// Documentos de exemplo (ATUALIZE COM SEUS DADOS REAIS!)
const documents = [
  // Sobre o ChatIAS
  {
    text: "O ChatIAS Pro 2.0 é um sistema inteligente de chat que usa múltiplas estratégias para responder perguntas. Ele pode usar apenas LLM para conversas simples, RAG (Retrieval-Augmented Generation) para perguntas técnicas, agentes para tarefas complexas, e ferramentas para ações específicas.",
    metadata: {
      source: "docs",
      category: "introduction",
      tags: ["chatias", "overview"]
    }
  },
  {
    text: "O sistema de decisão inteligente do ChatIAS analisa cada mensagem e decide automaticamente qual estratégia usar: LLM-only para conversas rápidas, RAG+LLM para perguntas sobre conhecimento, Agentes para tarefas complexas, ou Ferramentas para comandos diretos.",
    metadata: {
      source: "docs",
      category: "architecture",
      tags: ["decision-engine", "smart-system"]
    }
  },
  
  // Sobre RAG
  {
    text: "RAG (Retrieval-Augmented Generation) é uma técnica que combina busca em base de conhecimento com geração de texto. O ChatIAS usa Qdrant como vector database para armazenar e buscar documentos relevantes antes de gerar respostas.",
    metadata: {
      source: "docs",
      category: "rag",
      tags: ["rag", "qdrant", "retrieval"]
    }
  },
  {
    text: "Para usar o RAG no ChatIAS, você precisa ter o Qdrant rodando no Docker na porta 6333, criar uma collection chamada 'knowledge_base', e popular com documentos usando embeddings de 768 dimensões gerados pelo Ollama com o modelo nomic-embed-text.",
    metadata: {
      source: "docs",
      category: "setup",
      tags: ["qdrant", "docker", "setup", "ollama"]
    }
  },
  
  // Sobre embeddings
  {
    text: "O ChatIAS usa o Ollama para gerar embeddings de texto. O modelo padrão é nomic-embed-text que gera vetores de 768 dimensões. Embeddings são representações numéricas de texto que permitem busca semântica eficiente.",
    metadata: {
      source: "docs",
      category: "embeddings",
      tags: ["ollama", "embeddings", "nomic-embed-text"]
    }
  },
  
  // Sobre agentes
  {
    text: "Agentes no ChatIAS são módulos especializados que podem executar tarefas complexas como análise de código, refatoração, geração de relatórios, e validação de dados. Eles são ativados automaticamente quando o sistema detecta uma tarefa que requer processamento avançado.",
    metadata: {
      source: "docs",
      category: "agents",
      tags: ["agents", "complex-tasks"]
    }
  },
  
  // Sobre ferramentas
  {
    text: "Ferramentas (tools) são funções específicas que executam ações diretas como listar arquivos, executar scripts, buscar em APIs, ou manipular dados. O ChatIAS detecta comandos na mensagem do usuário e chama a ferramenta apropriada automaticamente.",
    metadata: {
      source: "docs",
      category: "tools",
      tags: ["tools", "functions", "actions"]
    }
  },
  
  // Sobre o OpenCode SDK
  {
    text: "O ChatIAS usa o OpenCode SDK para se conectar a múltiplos modelos de LLM gratuitos. O sistema tenta 10 modelos diferentes em ordem de prioridade, incluindo Gemini 2.0 Flash, Qwen3 Coder, Llama 3.3 70B, e outros modelos free do OpenRouter, ZenMux e OpenCode.",
    metadata: {
      source: "docs",
      category: "providers",
      tags: ["opencode", "sdk", "llm", "models"]
    }
  },
  {
    text: "O sistema de fallback do ChatIAS funciona em cascata: primeiro tenta o OpenCode SDK com modelos remotos free, se falhar usa Ollama local como backup, e se ambos falharem retorna uma mensagem de erro informativa. Não há timeout nas chamadas ao SDK - o sistema aguarda indefinidamente.",
    metadata: {
      source: "docs",
      category: "reliability",
      tags: ["fallback", "ollama", "reliability"]
    }
  },
  
  // Configuração
  {
    text: "Para configurar o ChatIAS, defina as variáveis de ambiente: QDRANT_URL (padrão: http://localhost:6333), QDRANT_COLLECTION (padrão: knowledge_base), OLLAMA_URL (padrão: http://localhost:11434), OLLAMA_EMBED_MODEL (padrão: nomic-embed-text), OPENCODE_CLI (caminho do executável), e PORT (padrão: 4174).",
    metadata: {
      source: "docs",
      category: "configuration",
      tags: ["config", "environment", "setup"]
    }
  },
  
  // API Endpoints
  {
    text: "O ChatIAS expõe vários endpoints REST: POST /api/chat para conversar, GET /api/system para info do sistema, POST /api/rag/add-documents para adicionar docs ao Qdrant, POST /api/rag/search para buscar docs, POST /api/decision/analyze para testar o motor de decisão, e GET /api/rag/info para ver estatísticas do RAG.",
    metadata: {
      source: "docs",
      category: "api",
      tags: ["api", "endpoints", "rest"]
    }
  }
];

// === Helper Functions ===

async function generateEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text
      })
    });
    
    if (!response.ok) {
      throw new Error(`Embedding API failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

async function checkQdrant() {
  const response = await fetch(`${QDRANT_URL}/healthz`, {
    signal: AbortSignal.timeout(5000)
  });
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  
  return true;
}

async function checkOllama() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`, {
    signal: AbortSignal.timeout(5000)
  });
  
  if (!response.ok) {
    throw new Error(`Ollama not accessible: ${response.status}`);
  }
  
  const data = await response.json();
  const hasModel = data.models?.some(m => m.name.includes(EMBED_MODEL));
  
  return { ok: true, hasModel, models: data.models };
}

async function pullModel() {
  console.log(`   📦 Pulling model "${EMBED_MODEL}" (this may take a few minutes)...`);
  
  const response = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: EMBED_MODEL })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.status) {
          process.stdout.write(`\r   📦 ${data.status}                    `);
        }
      } catch (e) {
        // Ignora linhas inválidas
      }
    }
  }
  
  console.log('\n   ✅ Model pulled successfully\n');
}

async function checkCollection() {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    signal: AbortSignal.timeout(5000)
  });
  
  return response.status !== 404;
}

async function createCollection(dimensions) {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: {
        size: dimensions,
        distance: 'Cosine'
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create collection: ${response.status}`);
  }
  
  return true;
}

async function uploadPoints(points) {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
    signal: AbortSignal.timeout(60000)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload points: ${response.status}`);
  }
  
  return true;
}

async function getCollectionInfo() {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
  const data = await response.json();
  return data.result;
}

// === Main Script ===

async function main() {
  console.log('🚀 ChatIAS - Qdrant Population Script (WITH REAL EMBEDDINGS)');
  console.log('=============================================================\n');
  
  // 1. Verifica Qdrant
  console.log(`1️⃣  Checking Qdrant at ${QDRANT_URL}...`);
  try {
    await checkQdrant();
    console.log('   ✅ Qdrant is running\n');
  } catch (error) {
    console.error('   ❌ Qdrant not accessible:', error.message);
    console.error('   💡 Make sure Qdrant is running: docker run -d -p 6333:6333 qdrant/qdrant\n');
    process.exit(1);
  }
  
  // 2. Verifica Ollama
  console.log(`2️⃣  Checking Ollama at ${OLLAMA_URL}...`);
  try {
    const ollama = await checkOllama();
    console.log('   ✅ Ollama is running');
    
    if (!ollama.hasModel) {
      console.log(`   ⚠️  Model "${EMBED_MODEL}" not found locally`);
      await pullModel();
    } else {
      console.log(`   ✅ Model "${EMBED_MODEL}" is available\n`);
    }
  } catch (error) {
    console.error('   ❌ Ollama not accessible:', error.message);
    console.error('   💡 Make sure Ollama is running: ollama serve\n');
    process.exit(1);
  }
  
  // 3. Testa embedding
  console.log(`3️⃣  Testing embedding generation...`);
  try {
    const testEmbedding = await generateEmbedding('test');
    console.log(`   ✅ Embedding generated: ${testEmbedding.length} dimensions\n`);
    
    const EXPECTED_DIMS = testEmbedding.length;
    
    // 4. Verifica/Cria collection
    console.log(`4️⃣  Checking collection "${COLLECTION_NAME}"...`);
    const exists = await checkCollection();
    
    if (!exists) {
      console.log(`   📦 Collection not found, creating with ${EXPECTED_DIMS} dimensions...`);
      await createCollection(EXPECTED_DIMS);
      console.log('   ✅ Collection created\n');
    } else {
      console.log('   ✅ Collection exists\n');
    }
    
    // 5. Gera embeddings e popula
    console.log(`5️⃣  Generating embeddings for ${documents.length} documents...`);
    console.log('   ⏳ This will take a few moments...\n');
    
    const points = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      process.stdout.write(`   📝 Processing document ${i + 1}/${documents.length}... `);
      
      const embedding = await generateEmbedding(doc.text);
      
      points.push({
        id: Date.now() + i,
        vector: embedding,
        payload: {
          text: doc.text,
          metadata: doc.metadata
        }
      });
      
      console.log('✅');
    }
    
    console.log('\n   ⬆️  Uploading to Qdrant...');
    await uploadPoints(points);
    console.log('   ✅ Upload complete\n');
    
    // 6. Verifica collection info
    console.log(`6️⃣  Collection info:`);
    const info = await getCollectionInfo();
    console.log(`   📊 Points: ${info.points_count || 0}`);
    console.log(`   📊 Vectors: ${info.vectors_count || 0}`);
    console.log(`   📊 Dimensions: ${EXPECTED_DIMS}`);
    console.log(`   📊 Status: ${info.status || 'unknown'}\n`);
    
  } catch (error) {
    console.error('   ❌ Error:', error.message, '\n');
    process.exit(1);
  }
  
  console.log('✅ Done! Qdrant is ready with REAL embeddings!\n');
  console.log('Next steps:');
  console.log('1. Start ChatIAS: node server-v2.js');
  console.log('2. Open chat: http://localhost:4174/chat-v2');
  console.log('3. Try asking: "o que é o ChatIAS?" or "como funciona o RAG?"\n');
  console.log('💡 The system will use RAG automatically for knowledge questions!\n');
}

main().catch(console.error);
