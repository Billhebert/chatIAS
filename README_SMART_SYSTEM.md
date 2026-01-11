# ChatIAS Pro 2.0 - Sistema Inteligente de Chat

Sistema de chat avançado com decisão inteligente automática, suporte a RAG (Qdrant), múltiplos LLMs, agentes e ferramentas.

## 🎯 O que mudou?

### Sistema Inteligente de Decisão

O ChatIAS agora decide **automaticamente** qual estratégia usar para cada mensagem:

| Estratégia | Quando usa | Exemplo |
|------------|-----------|---------|
| **LLM-only** | Conversas simples, saudações, agradecimentos | "oi", "obrigado" |
| **RAG + LLM** | Perguntas sobre conhecimento, documentação | "o que é...", "como funciona..." |
| **Agentes** | Tarefas complexas, análises | "analise este código" |
| **Ferramentas** | Comandos diretos, ações | "liste arquivos", "execute script" |

### Vantagens

✅ **Mais rápido**: Conversas simples não passam por RAG/Agentes  
✅ **Mais preciso**: Perguntas técnicas usam conhecimento do Qdrant  
✅ **Mais inteligente**: Decisões baseadas em padrões e análise semântica  
✅ **Mais eficiente**: Cache de decisões e embeddings  
✅ **Transparente**: Logs detalhados de cada decisão

## 🚀 Quick Start

### 1. Inicie o Qdrant (Docker)

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### 2. Popule com dados iniciais

```bash
node scripts/populate-qdrant.js
```

### 3. Inicie o ChatIAS

```bash
node server-v2.js
```

### 4. Abra o chat

http://localhost:4174/chat-v2

## 📊 Exemplos de Uso

### Conversa Simples (LLM-only - RÁPIDO)

```
Usuário: oi, tudo bem?
Sistema: [decision] Strategy: llm (95% confidence - Greeting detected)
        [llm] Using LLM-only mode (fastest)
        [response] Generated in 450ms
```

### Pergunta com Conhecimento (RAG + LLM)

```
Usuário: o que é o ChatIAS?
Sistema: [decision] Strategy: rag (90% confidence - Knowledge question)
        [rag] Searching knowledge base...
        [rag] Found 3 relevant documents (45ms)
        [llm] Generating response with context...
        [response] Generated in 1250ms

Resposta: "O ChatIAS Pro 2.0 é um sistema inteligente de chat que usa múltiplas 
estratégias... [baseado em documentos encontrados]"
```

### Tarefa Complexa (Agent)

```
Usuário: analise o código do chat-engine.js
Sistema: [decision] Strategy: agent (85% confidence - Complex task)
        [agent] Using code-analysis agent...
        [agent] Analysis complete
        [response] Generated in 3200ms
```

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# Qdrant (RAG)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=knowledge_base

# OpenCode
OPENCODE_CLI=E:\\app\\OpenCode\\opencode-cli.exe
OPENCODE_PORT=4097

# Server
PORT=4174
```

### Configuração Programática

```javascript
const chatEngine = new ChatEngine({
  // RAG
  enableRAG: true,
  qdrantUrl: 'http://localhost:6333',
  qdrantCollection: 'knowledge_base',
  ragTopK: 5,
  ragScoreThreshold: 0.7,
  
  // Smart System
  enableAgents: true,
  enableTools: true,
  
  // LLM
  defaultModel: 'llama3.2:latest',
  temperature: 0.7,
  maxTokens: 4000
});
```

## 📡 API Endpoints

### Chat

```bash
POST /api/chat
{
  "message": "o que é o ChatIAS?"
}

Response:
{
  "success": true,
  "response": "...",
  "strategy": "rag",
  "strategyConfidence": 0.9,
  "strategyReasoning": "Knowledge question detected",
  "provider": "sdk",
  "usedRAG": true,
  "ragResults": [...],
  "duration": 1250
}
```

### RAG Management

```bash
# Adicionar documentos
POST /api/rag/add-documents
{
  "documents": [
    {
      "text": "Conteúdo do documento...",
      "metadata": { "source": "docs", "category": "intro" }
    }
  ]
}

# Buscar documentos
POST /api/rag/search
{
  "query": "o que é ChatIAS",
  "topK": 5,
  "scoreThreshold": 0.7
}

# Info do RAG
GET /api/rag/info
```

### Decision Testing

```bash
# Testar decisão (sem executar)
POST /api/decision/analyze
{
  "message": "o que é o ChatIAS?"
}

Response:
{
  "decision": {
    "strategy": "rag",
    "confidence": 0.9,
    "reasoning": "Knowledge question detected",
    "metadata": { "type": "knowledge_question", "pattern": "matched" }
  }
}
```

## 🧠 Como Funciona o Sistema de Decisão

### 1. Análise Rápida (Regex)

Detecta padrões óbvios:
- Saudações: `/^(oi|olá|hey)/i`
- Perguntas: `/^(o que é|what is|como funciona)/i`
- Comandos: `/^(execute|run|listar)/i`

### 2. Análise Semântica

Se nenhum padrão forte for detectado, analisa:
- Comprimento da mensagem
- Palavras-chave técnicas
- Estrutura da frase
- Contexto da conversa anterior

### 3. Cache

Decisões são armazenadas em cache (até 100 itens) para respostas instantâneas.

## 🎨 Customização

### Adicionar Novos Padrões

Edite `src/core/smart-decision-engine.js`:

```javascript
const knowledgeQuestionPatterns = [
  // Adicione seus padrões aqui
  /\b(minha palavra-chave personalizada)\b/i
];
```

### Ajustar Thresholds

```javascript
const decisionEngine = new SmartDecisionEngine({
  llmConfidenceThreshold: 0.7,  // Quão confiante precisa ser
  ragConfidenceThreshold: 0.6,   // Threshold para RAG
  enableRAG: true,
  enableAgents: true,
  enableTools: true
});
```

## 📈 Performance

| Estratégia | Latência Média | Quando Usar |
|------------|---------------|-------------|
| LLM-only | ~450ms | Conversas simples |
| RAG + LLM | ~1250ms | Perguntas técnicas |
| Agent | ~3200ms | Tarefas complexas |
| Tool | ~200ms | Ações diretas |

## 🐛 Troubleshooting

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

1. Verifique se a collection existe: `http://localhost:6333/collections/knowledge_base`
2. Verifique se há documentos: `GET /api/rag/info`
3. Ajuste o `scoreThreshold` (padrão: 0.7)
4. Popule com dados: `node scripts/populate-qdrant.js`

### Estratégia errada sendo escolhida

1. Veja os logs detalhados de decisão
2. Teste com: `POST /api/decision/analyze`
3. Ajuste padrões no `SmartDecisionEngine`
4. Limpe o cache de decisões

### Performance lenta

1. Conversas simples devem usar LLM-only (~450ms)
2. Se tudo está indo para RAG, ajuste os padrões
3. Verifique se o cache de decisões está funcionando
4. Monitore logs: `GET /api/logs?category=decision`

## 📚 Arquivos Importantes

```
chatIAS/
├── src/core/
│   ├── chat-engine.js           # Motor principal (com RAG integrado)
│   ├── smart-decision-engine.js # Sistema de decisão inteligente
│   ├── qdrant-rag.js           # Integração com Qdrant
│   └── logger.js               # Sistema de logs
├── scripts/
│   └── populate-qdrant.js      # Script para popular Qdrant
├── server-v2.js                # Servidor HTTP
├── SMART_SYSTEM_GUIDE.md       # Guia detalhado
└── README.md                   # Este arquivo
```

## 🎓 Próximos Passos

1. **Adicione seus dados ao Qdrant**: Edite `scripts/populate-qdrant.js` com seus documentos
2. **Use um modelo de embedding real**: Atualmente usa mock (valores aleatórios)
3. **Customize padrões**: Ajuste `SmartDecisionEngine` para seu domínio
4. **Monitore logs**: Use `/api/logs` para entender decisões
5. **Otimize thresholds**: Teste diferentes valores para melhor performance

## 📝 License

MIT
