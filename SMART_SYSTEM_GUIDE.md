# ChatIAS Pro 2.0 - Configuração do Ambiente

## Variáveis de Ambiente

# Qdrant (RAG)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=knowledge_base

# OpenCode
OPENCODE_CLI=E:\\app\\OpenCode\\opencode-cli.exe
OPENCODE_PORT=4097

# Server
PORT=4174

## Como usar o Qdrant

### 1. Iniciar o Qdrant com Docker

```bash
# Iniciar container
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# Verificar se está rodando
docker ps | grep qdrant
```

### 2. Criar a collection (primeira vez)

```bash
# Criar collection "knowledge_base" com vetores de 768 dimensões
curl -X PUT http://localhost:6333/collections/knowledge_base \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'
```

### 3. Popular com documentos (exemplo)

```javascript
// Endpoint: POST /api/rag/add-documents
const documents = [
  {
    text: "O ChatIAS é um sistema inteligente de chat com suporte a RAG, agentes e ferramentas.",
    metadata: { source: "docs", category: "intro" }
  },
  {
    text: "Para usar o RAG, você precisa ter o Qdrant rodando na porta 6333.",
    metadata: { source: "docs", category: "setup" }
  }
];

fetch('http://localhost:4174/api/rag/add-documents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documents })
});
```

### 4. Testar busca

```bash
# Buscar documentos similares
curl -X POST http://localhost:6333/collections/knowledge_base/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 5,
    "score_threshold": 0.7
  }'
```

## Como funciona o Sistema Inteligente

### Decisões automáticas:

1. **LLM-only** (mais rápido)
   - Saudações: "oi", "olá", "bom dia"
   - Agradecimentos: "obrigado", "valeu"
   - Conversas curtas: < 10 caracteres
   - Conversas casuais sem conhecimento técnico

2. **RAG + LLM** (busca conhecimento)
   - Perguntas: "o que é...", "como funciona...", "explique..."
   - Perguntas técnicas: "documentação", "api", "sdk"
   - Perguntas sobre conhecimento específico

3. **Agentes** (tarefas complexas)
   - "analise este código"
   - "refatore esta função"
   - "gere um relatório"

4. **Ferramentas** (ações diretas)
   - "execute script.js"
   - "liste arquivos da pasta"
   - "busque no github"

### Exemplos de uso:

```bash
# Conversa simples (LLM-only)
"oi, tudo bem?"
"obrigado pela ajuda"

# Pergunta com conhecimento (RAG + LLM)
"o que é o ChatIAS?"
"como funciona o sistema de RAG?"
"explique a arquitetura"

# Tarefa complexa (Agent)
"analise o código do chat-engine.js"
"refatore este código para usar async/await"

# Ação direta (Tool)
"liste os arquivos da pasta src"
"execute o teste unitário"
```

## Benefícios do Sistema Inteligente

✅ **Mais rápido**: Conversas simples não passam por RAG/Agents
✅ **Mais preciso**: Perguntas técnicas usam conhecimento do Qdrant
✅ **Mais inteligente**: Decide automaticamente a melhor estratégia
✅ **Mais eficiente**: Cache de decisões e embeddings
✅ **Mais econômico**: Evita chamadas desnecessárias a LLMs complexos

## Logs e Debugging

O sistema loga todas as decisões:

```
[decision] Analyzing message with SmartDecisionEngine...
[decision] Strategy selected: rag (confidence: 90%, reasoning: Knowledge question detected)
[rag] Searching for: "o que é ChatIAS"...
[rag] Found 3 relevant documents (duration: 45ms)
[llm] Generating response with context...
[response] Response generated (duration: 1250ms, strategy: rag, provider: sdk)
```

## Troubleshooting

### Qdrant não conecta
```bash
# Verificar se está rodando
docker ps | grep qdrant

# Ver logs
docker logs qdrant

# Reiniciar
docker restart qdrant
```

### RAG não retorna resultados
- Verifique se a collection existe
- Verifique se há documentos na collection
- Ajuste o `scoreThreshold` (padrão: 0.7)

### Estratégia errada sendo escolhida
- Verifique os logs de decisão
- Ajuste os padrões no `SmartDecisionEngine`
- Limpe o cache de decisões
