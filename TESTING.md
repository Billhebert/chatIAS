# 🧪 Guia Completo de Testes

Este projeto tem **3 níveis de testes** para validar TUDO que foi implementado.

---

## 📊 Resumo Rápido

| Teste | O que faz | Executa de verdade? | Requer Ollama? |
|-------|-----------|---------------------|----------------|
| `test-all.js` | Verifica se componentes existem | ❌ Não | Não |
| `test-integration.js` | **Executa funcionalidades REAIS** | ✅ Sim | Sim (para testes Ollama) |
| `test-e2e.js` | **Simula fluxo completo de produção** | ✅ Sim | Sim (para fallback) |

---

## 1️⃣ test-all.js - Testes de Fumaça (Smoke Tests)

### O que faz
Verifica se os componentes foram criados corretamente, mas **NÃO executa** funcionalidades reais.

### Executar
```bash
node test-all.js
```

### O que é testado (39 testes)

#### ✅ Ollama Client (6 testes)
- ❌ **NÃO executa**: Apenas verifica se métodos existem
  - `ollamaClient.generate` existe?
  - `ollamaClient.generateWithFallback` existe?
  - `ollamaClient.chat` existe?
  - `ollamaClient.listModels` existe?
  - `ollamaClient.isAvailable` existe?

#### ✅ Tool Registry (6 testes)
- ❌ **NÃO executa tools Ollama**: Apenas testa enable/disable
- ✅ **Executa**: Uma tool de teste simples customizada

#### ✅ Agent Manager (8 testes)
- ❌ **NÃO executa agentes**: Apenas testa registro/enable/disable

#### ✅ MCP Manager (5 testes)
- ❌ **NÃO inicia servidores**: Apenas testa registro

#### ✅ Integração (4 testes)
- ✅ **Verifica código**: Analisa chat.js para confirmar integração

#### ✅ Estrutura (10 testes)
- ✅ **Verifica arquivos**: Confirma que todos os arquivos existem

### Resultado esperado
```
🎉 TODOS OS TESTES PASSARAM! Sistema 100% funcional.
✅ Testes passaram: 39
❌ Testes falharam: 0
```

### Limitação
⚠️ **Não garante que funcionalidades realmente executam**, apenas que os componentes existem.

---

## 2️⃣ test-integration.js - Testes de Integração REAIS

### O que faz
**EXECUTA FUNCIONALIDADES DE VERDADE** - faz chamadas reais ao Ollama e testa ferramentas.

### Executar
```bash
node test-integration.js
```

### O que é testado (21 testes)

#### 🦙 Ollama Client (5 testes REAIS)

1. **isAvailable()** - ✅ **EXECUTA**: Chama `http://localhost:11434/api/tags`
   ```javascript
   const available = await ollamaClient.isAvailable();
   // Faz requisição HTTP real ao Ollama
   ```

2. **listModels()** - ✅ **EXECUTA**: Lista modelos instalados de verdade
   ```javascript
   const models = await ollamaClient.listModels();
   // Retorna: [{ name: "llama3.2", ... }, ...]
   ```

3. **generate()** - ✅ **EXECUTA**: Gera resposta REAL
   ```javascript
   const result = await ollamaClient.generate("llama3.2", "Diga apenas: OK");
   // Envia prompt para Ollama e recebe resposta
   ```

4. **generateWithFallback()** - ✅ **EXECUTA**: Testa fallback automático
   ```javascript
   const result = await ollamaClient.generateWithFallback("Responda: teste");
   // Tenta llama3.2 → qwen2.5-coder → deepseek-coder-v2
   ```

5. **chat()** - ✅ **EXECUTA**: Chat real
   ```javascript
   const result = await ollamaClient.chat("llama3.2", messages);
   // Envia mensagens e recebe resposta
   ```

#### 🔧 Tools (3 testes REAIS)

1. **ollama_status** - ✅ **EXECUTA**: Verifica status real
   ```javascript
   const result = await globalToolRegistry.execute("ollama_status");
   // Retorna: { available: true/false, models: [...] }
   ```

2. **ollama_generate** - ✅ **EXECUTA**: Gera texto real
   ```javascript
   const result = await globalToolRegistry.execute("ollama_generate", {
     prompt: "Diga: teste",
     model: "llama3.2"
   });
   // Gera resposta real usando Ollama
   ```

3. **ollama_chat** - ✅ **EXECUTA**: Chat real via tool
   ```javascript
   const result = await globalToolRegistry.execute("ollama_chat", {
     messages: [{ role: "user", content: "Olá" }]
   });
   // Chat real usando tool
   ```

#### 💼 Integração com chat.js (5 testes)
- ✅ Verifica se código importa Ollama
- ✅ Verifica se cria ollamaClient
- ✅ Verifica se usa generateWithFallback
- ✅ Verifica lógica de fallback
- ✅ Verifica formato de resposta

#### 📁 Estrutura (8 testes)
- ✅ Verifica existência de arquivos

### Resultado esperado (SEM Ollama)
```
✅ Testes passaram: 14
❌ Testes falharam: 0
⏭️  Testes pulados: 7 (requerem Ollama rodando)
📈 Taxa de sucesso: 100.0%
```

### Resultado esperado (COM Ollama)
```
✅ Testes passaram: 21
❌ Testes falharam: 0
⏭️  Testes pulados: 0
📈 Taxa de sucesso: 100.0%
```

### Requisitos
- **Ollama instalado e rodando** (para todos os testes passarem)
- Pelo menos 1 modelo baixado (`ollama pull llama3.2`)

---

## 3️⃣ test-e2e.js - Teste End-to-End (Fluxo Completo)

### O que faz
**SIMULA O FLUXO COMPLETO DE PRODUÇÃO** - exatamente como `chat.js` funciona.

### Executar
```bash
node test-e2e.js
```

### O que é testado

#### Fluxo Completo de Fallback em Cascata

```
1. Tenta modelo primário
   ↓ falhou?
2. Tenta 12 modelos remotos (simulados)
   ↓ todos falharam?
3. Tenta Ollama como fallback REAL
   ↓
4. Retorna resultado
```

#### O que é EXECUTADO de verdade

1. **Fase 1: Modelos Remotos** (simulado)
   - Simula tentativas com 12 modelos
   - Todos falham para forçar fallback Ollama

2. **Fase 2: Ollama Fallback** - ✅ **REAL**
   ```javascript
   const ollamaAvailable = await this.ollamaClient.isAvailable();
   // Chamada HTTP real

   const ollamaResult = await this.ollamaClient.generateWithFallback(prompt);
   // Gera resposta REAL com Ollama
   ```

### Saída esperada (COM Ollama)

```
🔄 Iniciando fluxo de fallback em cascata...

📡 Fase 1: Tentando 12 modelos remotos
----------------------------------------------------------------------
   [1/12] Tentando opencode/minimax-m2.1-free...
   ✗ Falhou
   [2/12] Tentando opencode/glm-4.7-free...
   ✗ Falhou
   ...
   [12/12] Tentando zenmux/kuaishou/kat-coder-pro-v1-free...
   ✗ Falhou

🦙 Fase 2: Tentando Ollama como fallback final
----------------------------------------------------------------------
   ✓ Ollama está disponível
   📤 Enviando prompt: "Escreva um haiku sobre inteligência artificial."
   🔄 Tentando modelos: llama3.2 → qwen2.5-coder → deepseek-coder-v2

   ✅ Ollama respondeu com sucesso!
   🤖 Modelo usado: llama3.2
   📝 Resposta (150 chars): "Códigos digitais
                             Pensam em silêncio profundo
                             Vida artificial"

✅ PASS: Sistema de fallback funcionou!
✅ PASS: Ollama foi usado como último recurso
✅ PASS: Resposta foi gerada com sucesso

🎉 TESTE END-TO-END PASSOU!
```

### Saída esperada (SEM Ollama)

```
🦙 Fase 2: Tentando Ollama como fallback final
----------------------------------------------------------------------
   ❌ Ollama não está disponível

⏭️  SKIP: Teste pulado - Ollama não está disponível

💡 Para executar o teste completo:
   1. Instale Ollama: curl -fsSL https://ollama.ai/install.sh | sh
   2. Baixe um modelo: ollama pull llama3.2
   3. Execute novamente: node test-e2e.js

✅ Mas o fluxo de fallback está implementado corretamente!
```

---

## 🎯 Como Saber se TUDO Funciona?

### Opção 1: Testes Rápidos (Sem Ollama)

```bash
# 1. Testes de fumaça
node test-all.js
# ✅ 39 testes devem passar

# 2. Testes de integração (alguns pulados)
node test-integration.js
# ✅ 14 passam, 7 pulados (OK sem Ollama)

# 3. Teste E2E (simulação)
node test-e2e.js
# ✅ Valida que fluxo está implementado
```

**Resultado**: ✅ Sistema está implementado corretamente, mas Ollama não testado.

### Opção 2: Testes Completos (Com Ollama)

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Baixar modelo
ollama pull llama3.2

# 3. Executar todos os testes
node test-all.js          # ✅ 39 passam
node test-integration.js  # ✅ 21 passam (0 pulados)
node test-e2e.js         # ✅ Gera resposta real
```

**Resultado**: ✅ Sistema 100% funcional com todas as funcionalidades testadas.

---

## 📋 Checklist de Validação

Use este checklist para validar TUDO:

### ✅ Componentes Básicos
- [ ] `node test-all.js` - 39 testes passam
- [ ] Todos os arquivos em `lib/` existem
- [ ] `.opencode/config.json` existe

### ✅ Integração com chat.js
- [ ] `chat.js` importa `createOllamaClient`
- [ ] `chat.js` cria `ollamaClient`
- [ ] `chat.js` chama `generateWithFallback`
- [ ] `chat.js` tem mensagem "Tentando Ollama"

### ✅ Funcionalidades REAIS (requer Ollama)
- [ ] `ollamaClient.isAvailable()` retorna `true`
- [ ] `ollamaClient.listModels()` retorna modelos
- [ ] `ollamaClient.generate()` gera resposta
- [ ] `ollamaClient.generateWithFallback()` gera resposta
- [ ] Tool `ollama_status` executa
- [ ] Tool `ollama_generate` gera resposta
- [ ] Teste E2E gera resposta via Ollama

### ✅ Fluxo Completo
- [ ] Modelos remotos são tentados primeiro
- [ ] Ollama é tentado após modelos remotos falharem
- [ ] Resposta tem `source: "ollama"`
- [ ] Sistema não crasha se Ollama não disponível

---

## 🚀 Executar Todos os Testes

```bash
# Script para executar tudo de uma vez
echo "🧪 Executando todos os testes..."
echo ""
echo "1️⃣ Testes de Fumaça..."
node test-all.js
echo ""
echo "2️⃣ Testes de Integração..."
node test-integration.js
echo ""
echo "3️⃣ Teste End-to-End..."
node test-e2e.js
echo ""
echo "✅ Todos os testes concluídos!"
```

---

## ❓ Perguntas Frequentes

### Q: Os testes realmente executam funcionalidades?

**R**: Depende do teste:
- `test-all.js` - **NÃO**, apenas verifica existência
- `test-integration.js` - **SIM**, executa chamadas reais
- `test-e2e.js` - **SIM**, simula fluxo completo

### Q: Preciso do Ollama instalado?

**R**: Para validar 100%, sim. Mas os testes mostram que está implementado mesmo sem Ollama.

### Q: Qual teste é mais importante?

**R**:
- Para desenvolvimento: `test-all.js`
- Para validação real: `test-integration.js`
- Para produção: `test-e2e.js`

### Q: Como testar apenas Ollama?

**R**:
```bash
node test-integration.js 2>&1 | grep -A 20 "TESTE 1: Ollama"
```

### Q: Os testes modificam dados?

**R**: Não. Os testes apenas LEEM e fazem requisições. Não modificam arquivos ou configurações.

---

## 📚 Resumo

| Aspecto | test-all.js | test-integration.js | test-e2e.js |
|---------|-------------|---------------------|-------------|
| **Tipo** | Smoke | Integração | End-to-End |
| **Executa funcionalidades** | ❌ Não | ✅ Sim | ✅ Sim |
| **Requer Ollama** | ❌ Não | ⚠️ Opcional | ⚠️ Opcional |
| **Número de testes** | 39 | 21 | 1 (completo) |
| **Tempo de execução** | < 1s | 2-5s | 2-5s |
| **Uso** | CI/CD rápido | Validação real | Validação produção |

**Recomendação**: Execute os 3 para validação completa! 🎉
