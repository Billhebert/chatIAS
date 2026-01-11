# 🚀 Quick Start - ChatIAS Pro 2.0 com RAG + Ollama Embeddings

## Setup Completo em 5 Passos

### 1️⃣ Instale o Ollama

**Windows/Mac/Linux:**
```bash
# Instale: https://ollama.com/download

# Inicie o serviço
ollama serve

# Teste
ollama list
```

### 2️⃣ Baixe o Modelo de Embeddings

```bash
# Modelo recomendado (768 dimensões, melhor qualidade)
ollama pull nomic-embed-text

# Ou alternativas:
# ollama pull mxbai-embed-large  # 1024 dims, mais lento
# ollama pull all-minilm         # 384 dims, mais rápido
```

### 3️⃣ Inicie o Qdrant (Docker)

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# Verifique
curl http://localhost:6333/healthz
```

### 4️⃣ Popule o Qdrant com Dados

```bash
# Gera embeddings REAIS com Ollama
node scripts/populate-qdrant.js
```

**Output esperado:**
```
🚀 ChatIAS - Qdrant Population Script (WITH REAL EMBEDDINGS)
=============================================================

1️⃣  Checking Qdrant at http://localhost:6333...
   ✅ Qdrant is running

2️⃣  Checking Ollama at http://localhost:11434...
   ✅ Ollama is running
   ✅ Model "nomic-embed-text" is available

3️⃣  Testing embedding generation...
   ✅ Embedding generated: 768 dimensions

4️⃣  Checking collection "knowledge_base"...
   📦 Collection not found, creating with 768 dimensions...
   ✅ Collection created

5️⃣  Generating embeddings for 10 documents...
   ⏳ This will take a few moments...

   📝 Processing document 1/10... ✅
   📝 Processing document 2/10... ✅
   ...

   ⬆️  Uploading to Qdrant...
   ✅ Upload complete

6️⃣  Collection info:
   📊 Points: 10
   📊 Vectors: 10
   📊 Dimensions: 768
   📊 Status: green

✅ Done! Qdrant is ready with REAL embeddings!
```

### 5️⃣ Inicie o ChatIAS

```bash
node server-v2.js
```

**Output esperado:**
```
[mcp] Ollama connected (url: http://localhost:11434)
[embedder] Initializing Ollama embedder for RAG...
[embedder] Testing embedding generation...
[embedder] ✅ Ollama embedder ready (model: nomic-embed-text, dimensions: 768)
[rag] Initializing RAG system...
[rag] ✅ Collection "knowledge_base" ready
[system] ✅ System Ready

Server running on http://localhost:4174
Chat UI: http://localhost:4174/chat-v2
```

## 🎯 Testando o Sistema

### Teste 1: Conversa Simples (LLM-only)

```
Você: oi
Bot: [Strategy: LLM ⚡ 95%] Olá! Como posso ajudar?
```

**Logs:**
```
[decision] Strategy: llm (95% - Greeting detected)
[llm] Using LLM-only mode (fastest)
[response] Generated in 450ms
```

### Teste 2: Pergunta com Conhecimento (RAG)

```
Você: o que é o ChatIAS?
Bot: [Strategy: RAG 📚 90%] O ChatIAS Pro 2.0 é um sistema inteligente...
```

**Logs:**
```
[decision] Strategy: rag (90% - Knowledge question detected)
[rag] Searching knowledge base...
[embedder] Generating embedding with Ollama...
[embedder] ✅ Embedding generated (768 dims, 85ms)
[rag] ✅ Found 3 relevant documents (45ms total)
[llm] Generating response with context...
[response] Generated in 1250ms (using RAG)
```

### Teste 3: Busca Direta na API

```bash
curl -X POST http://localhost:4174/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "como funciona o RAG?"}'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "score": 0.89,
      "text": "RAG (Retrieval-Augmented Generation) é uma técnica..."
    }
  ],
  "duration": 120
}
```

## 📊 Monitorando Embeddings

### Info do RAG

```bash
curl http://localhost:4174/api/rag/info
```

**Response:**
```json
{
  "enabled": true,
  "baseUrl": "http://localhost:6333",
  "collectionName": "knowledge_base",
  "dimensions": 768,
  "hasEmbedder": true,
  "embedderInfo": {
    "model": "nomic-embed-text",
    "dimensions": 768,
    "totalEmbeddings": 45,
    "cacheHitRate": "78.5%",
    "avgDuration": "82ms"
  }
}
```

## 🔧 Troubleshooting

### Ollama não conecta

```bash
# Verifique se está rodando
ps aux | grep ollama

# Reinicie
killall ollama
ollama serve

# Teste
ollama list
```

### Modelo de embedding não encontrado

```bash
# Liste modelos disponíveis
ollama list

# Pull novamente
ollama pull nomic-embed-text

# Teste manualmente
ollama run nomic-embed-text "test"
```

### Embeddings lentos

**Problema:** Cada embedding demora > 2 segundos

**Solução:**
1. Use modelo menor: `ollama pull all-minilm` (384 dims, 3x mais rápido)
2. Aumente batch size no código
3. Verifique CPU/RAM disponível

### Qdrant retorna resultados ruins

**Problema:** RAG retorna documentos irrelevantes

**Soluções:**
1. Ajuste `scoreThreshold` (padrão: 0.7):
   ```javascript
   ragScoreThreshold: 0.6  // Menos restritivo
   ```

2. Aumente `topK` (padrão: 5):
   ```javascript
   ragTopK: 10  // Mais resultados
   ```

3. Repovoar com dados mais relevantes
4. Usar modelo de embedding melhor: `mxbai-embed-large`

## 🎓 Customização

### Adicionar Seus Documentos

Edite `scripts/populate-qdrant.js`:

```javascript
const documents = [
  {
    text: "Seu conhecimento aqui...",
    metadata: {
      source: "meu_doc",
      category: "categoria",
      tags: ["tag1", "tag2"]
    }
  },
  // ... mais documentos
];
```

Depois rode:
```bash
node scripts/populate-qdrant.js
```

### Usar Modelo Diferente

Em `.env`:
```bash
OLLAMA_EMBED_MODEL=mxbai-embed-large
```

**Atenção:** Se mudar o modelo, precisa:
1. Deletar collection antiga
2. Recriar com novas dimensões
3. Repopular todos os documentos

## 📈 Performance

| Modelo | Dimensões | Velocidade | Qualidade | Recomendado para |
|--------|-----------|-----------|-----------|------------------|
| `nomic-embed-text` | 768 | ~100ms | ⭐⭐⭐⭐⭐ | Produção (balanceado) |
| `mxbai-embed-large` | 1024 | ~200ms | ⭐⭐⭐⭐⭐ | Máxima qualidade |
| `all-minilm` | 384 | ~30ms | ⭐⭐⭐ | Desenvolvimento rápido |

**Benchmarks (i7-10700K):**
- Embedding generation: 50-150ms
- Qdrant search: 5-20ms
- Total RAG overhead: ~100-200ms vs LLM-only

## ✅ Checklist Completo

- [ ] Ollama instalado e rodando
- [ ] Modelo `nomic-embed-text` baixado
- [ ] Qdrant rodando no Docker
- [ ] Script de população executado com sucesso
- [ ] ChatIAS iniciado e conectado
- [ ] Teste: conversa simples funciona
- [ ] Teste: pergunta sobre conhecimento usa RAG
- [ ] Logs mostram estratégias corretas
- [ ] `/api/rag/info` retorna dados válidos

## 🎉 Pronto!

Seu ChatIAS agora tem:
- ✅ RAG funcional com embeddings reais
- ✅ Busca semântica precisa
- ✅ Decisão inteligente automática
- ✅ Cache de embeddings
- ✅ Fallback graceful

**Próximos passos:**
1. Adicione seus documentos reais
2. Ajuste thresholds para seu caso de uso
3. Monitore performance e cache hit rate
4. Expanda a base de conhecimento gradualmente
