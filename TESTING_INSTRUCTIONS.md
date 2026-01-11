# 🧪 Instruções de Teste - SDK Como Provider Principal

## ✅ O Que Foi Implementado

1. **ChatEngine com SDK como PRIMARY provider**
   - Ollama como fallback secundário
   - Sistema de multi-model fallback (tenta 4 modelos em sequência)
   - Session management completo
   - Timeout de 15s por request

2. **Sistema de Logs Detalhado**
   - Logs por categoria (mcp, chat, request, response, etc)
   - Cores no console
   - SSE streaming para frontend
   - RequestId tracking

3. **Server-v2.js Completo**
   - API REST completa
   - UI de chat em `/chat-v2`
   - Health checks
   - Logs em tempo real

---

## 🔧 Passo 1: Configurar Servidor OpenCode

**Você precisa configurar o servidor OpenCode para usar um modelo FREE que funciona.**

### Modelos Recomendados (testados):

```bash
# OpenCode providers
opencode/glm-4.7-free
opencode/minimax-m2.1-free

# OpenRouter providers (mais confiáveis)
openrouter/google/gemini-2.0-flash-exp:free
openrouter/qwen/qwen3-coder:free
openrouter/mistralai/devstral-2512:free
openrouter/meta-llama/llama-3.3-70b-instruct:free
openrouter/z-ai/glm-4.5-air:free

# ZenMux providers
zenmux/xiaomi/mimo-v2-flash-free
zenmux/z-ai/glm-4.6v-flash-free
zenmux/kuaishou/kat-coder-pro-v1-free
```

### Configurar Servidor OpenCode:

**Opção A - Via arquivo de configuração:**
1. Procure por `E:/app/OpenCode/config.json` ou similar
2. Configure:
```json
{
  "model": {
    "provider": "openrouter",
    "model": "google/gemini-2.0-flash-exp:free"
  },
  "maxTokens": 2000
}
```

**Opção B - Via linha de comando:**
```bash
# Para no servidor atual (Ctrl+C)
# Reinicie com flags:
E:/app/OpenCode/opencode-cli.exe serve \
  --hostname=127.0.0.1 \
  --port=4096 \
  --model="openrouter/google/gemini-2.0-flash-exp:free" \
  --max-tokens=2000
```

**Opção C - Via variáveis de ambiente:**
```bash
set OPENCODE_MODEL=openrouter/google/gemini-2.0-flash-exp:free
set OPENCODE_MAX_TOKENS=2000
E:/app/OpenCode/opencode-cli.exe serve --hostname=127.0.0.1 --port=4096
```

---

## 🧪 Passo 2: Testar SDK Diretamente

Depois de configurar o servidor OpenCode, teste se o SDK está funcionando:

```bash
node test-sdk-prompt.js
```

**O que deve acontecer:**
- ✅ Cliente SDK criado
- ✅ Sessão criada com sucesso
- ✅ Mensagem enviada
- ✅ **Resposta recebida do modelo (sem erros de créditos)**

**Se ver erro de créditos:**
```
"This request requires more credits, or fewer max_tokens..."
```
→ O servidor OpenCode ainda está usando o modelo/configuração errada. Volte ao Passo 1.

---

## 🧪 Passo 3: Testar ChatEngine Completo

Teste o ChatEngine com SDK integrado:

```bash
node test-chat-quick.js
```

**O que deve acontecer:**
- ✅ Sistema carregado
- ✅ SDK conectado
- ✅ ChatEngine inicializado com provider: **sdk**
- ✅ Mensagem 1: resposta do **SDK** (não fallback)
- ✅ Mensagem 2: resposta do **SDK** (não fallback)
- ✅ Provider nos resultados: **"sdk"** (não "fallback" ou "ollama")

---

## 🧪 Passo 4: Testar Server Web Completo

Inicie o servidor web:

```bash
# Certifique-se que OpenCode está rodando na porta 4096
# Verifique: curl http://localhost:4096/global/health

# Inicie o servidor
set OPENCODE_AUTOSTART=false
node server-v2.js
```

**Testes via API:**

```bash
# 1. Health check
curl http://localhost:4174/api/health

# 2. System info
curl http://localhost:4174/api/system

# 3. Chat simples
curl -X POST http://localhost:4174/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Hello! How are you?\"}"

# 4. Chat mais complexo
curl -X POST http://localhost:4174/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Explique o que é um agente de IA\"}"

# 5. Ver logs recentes
curl "http://localhost:4174/api/logs?limit=20"

# 6. Ver logs de uma categoria específica
curl "http://localhost:4174/api/logs?category=mcp&limit=10"
```

**Teste via UI:**

1. Abra no navegador: `http://localhost:4174/chat-v2`
2. Digite uma mensagem
3. Verifique:
   - ✅ Resposta aparece
   - ✅ Badge mostra provider: **"sdk"** (não "fallback")
   - ✅ Logs aparecem na seção de debug
   - ✅ Intent detectado corretamente

---

## 📊 Verificação de Sucesso

### ✅ Indicadores de que está funcionando:

1. **Logs mostram:**
   ```
   [SUCCESS] SDK session created with <ModelName>: ses_xxxxx
   [SUCCESS] ChatEngine initialized with SDK as primary provider
   [INFO] Using OpenCode SDK (primary provider)...
   [SUCCESS] SDK responded successfully (XXX chars)
   ```

2. **Response JSON mostra:**
   ```json
   {
     "success": true,
     "text": "Resposta real do modelo, não mensagem de erro",
     "provider": "sdk",
     "intent": "conversational",
     "duration": 500
   }
   ```

3. **NO browser/UI:**
   - Badge verde: "SDK"
   - Resposta coerente (não mensagem de erro)
   - Logs mostram "Using OpenCode SDK"

### ❌ Indicadores de que NÃO está funcionando:

1. **Provider: "fallback"** → SDK não funcionou
2. **Response:** "Desculpe, não consegui me conectar..." → Todos providers falharam
3. **Logs:** "SDK returned empty/invalid response" → Modelo ainda com problema de créditos
4. **Logs:** "SDK failed: timeout" → Servidor OpenCode muito lento ou travado

---

## 🔧 Troubleshooting

### Problema: SDK sempre retorna "empty/invalid response"

**Causa:** Servidor OpenCode ainda usando modelo com erro de créditos

**Solução:**
1. Pare o servidor OpenCode (Ctrl+C)
2. Verifique configuração (Passo 1)
3. Reinicie com modelo FREE correto
4. Teste com `node test-sdk-prompt.js`
5. Se ainda falhar, tente outro modelo da lista

---

### Problema: "SDK timeout after 15s"

**Causa:** Modelo muito lento ou servidor sobrecarregado

**Soluções:**
1. Use modelo mais rápido: `gemini-2.0-flash-exp:free` ou `glm-4.7-free`
2. Aumente timeout no `chat-engine.js` (linha ~295):
   ```javascript
   setTimeout(() => reject(new Error('SDK timeout after 30s')), 30000)
   ```

---

### Problema: Ollama também falha (fetch failed)

**Causa:** Servidor Ollama não está rodando

**Soluções:**
1. Inicie Ollama: `ollama serve`
2. Ou desabilite Ollama no `system-config.json`:
   ```json
   "mcps": {
     "mcp_ollama": {
       "enabled": false
     }
   }
   ```

---

## 📝 Próximos Passos Após Testes Passarem

1. **Testar fallback:**
   - Pare o servidor OpenCode
   - Verifique se cai para Ollama automaticamente
   - Provider deve mudar de "sdk" → "ollama"

2. **Testar agentes:**
   ```bash
   curl -X POST http://localhost:4174/api/chat \
     -d '{"message":"use agent TestAgent to process something"}'
   ```

3. **Testar ferramentas:**
   ```bash
   curl http://localhost:4174/api/tools
   ```

4. **Implementar features avançadas:**
   - Tool Sequences
   - Middleware Chain
   - Circuit Breaker
   - Rate Limiting
   - Caching

---

## 🎯 Comandos Rápidos

```bash
# Setup
cd C:\Users\Bill\Desktop\chat2\chatIAS
set OPENCODE_AUTOSTART=false

# Teste 1: SDK direto
node test-sdk-prompt.js

# Teste 2: ChatEngine
node test-chat-quick.js

# Teste 3: Server web
node server-v2.js
# Abrir: http://localhost:4174/chat-v2

# Ver logs em tempo real
curl http://localhost:4174/api/logs/stream

# Health checks
curl http://localhost:4096/global/health  # OpenCode
curl http://localhost:4174/api/health      # ChatIAS
```

---

## 📚 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `src/core/chat-engine.js` | Motor principal com SDK primary |
| `src/core/logger.js` | Sistema de logs |
| `server-v2.js` | Servidor web completo |
| `public/chat-v2.html` | UI de chat |
| `test-sdk-prompt.js` | Teste direto do SDK |
| `test-chat-quick.js` | Teste completo do ChatEngine |
| `CHATENGINE_GUIDE.md` | Guia detalhado da arquitetura |

---

## ✅ Checklist Final

- [ ] Servidor OpenCode configurado com modelo FREE
- [ ] `test-sdk-prompt.js` passa sem erros
- [ ] `test-chat-quick.js` mostra provider: "sdk"
- [ ] Server web responde em http://localhost:4174
- [ ] Chat UI funciona em /chat-v2
- [ ] Resposta do chat é coerente (não mensagem de erro)
- [ ] Logs mostram "SDK responded successfully"
- [ ] Badge no UI mostra "SDK" verde

---

**Quando todos os checkboxes estiverem ✅, o sistema está 100% funcional com SDK como provider principal!** 🎉
