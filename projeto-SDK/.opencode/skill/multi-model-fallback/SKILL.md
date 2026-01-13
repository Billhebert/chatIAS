---
name: multi-model-fallback
description: Sistema de fallback em cascata com 12 modelos remotos e Ollama
license: MIT
compatibility:
  - opencode@>=1.0.0
metadata:
  author: ChatIAS Project
  version: 1.0.0
---

# Multi-Model Fallback Skill

Sistema inteligente de fallback que tenta múltiplos modelos em cascata até obter uma resposta bem-sucedida.

## Arquitetura de Fallback

### Camada 1: Modelos OpenCode (2 modelos)
1. `opencode/minimax-m2.1-free`
2. `opencode/glm-4.7-free`

### Camada 2: Modelos OpenRouter Free (7 modelos)
3. `openrouter/kwaipilot/kat-coder-pro:free`
4. `openrouter/google/gemini-2.0-flash-exp:free`
5. `openrouter/qwen/qwen3-coder:free`
6. `openrouter/mistralai/devstral-2512:free`
7. `openrouter/meta-llama/llama-3.3-70b-instruct:free`
8. `openrouter/mistralai/devstral-small-2507`
9. `openrouter/z-ai/glm-4.5-air:free`

### Camada 3: Modelos Zenmux (3 modelos)
10. `zenmux/xiaomi/mimo-v2-flash-free`
11. `zenmux/z-ai/glm-4.6v-flash-free`
12. `zenmux/kuaishou/kat-coder-pro-v1-free`

### Camada 4: Ollama Local (3 modelos)
13. `ollama/llama3.2`
14. `ollama/qwen2.5-coder`
15. `ollama/deepseek-coder-v2`

## Estratégia de Fallback

```javascript
tentativa(modelo1)
  → falhou? → tentativa(modelo2)
    → falhou? → tentativa(modelo3)
      → ... (até modelo 12)
        → todos falharam? → tentativa(Ollama)
          → falhou? → retorna erro
```

## Critérios de Falha

Um modelo é considerado como falho quando:
- Retorna erro HTTP (4xx, 5xx)
- Timeout de conexão
- Rate limit excedido
- Resposta vazia ou nula
- Erro de validação

## Benefícios

1. **Alta disponibilidade**: 99.9%+ uptime
2. **Redundância**: 15 modelos diferentes
3. **Diversidade**: Múltiplos provedores
4. **Fallback local**: Ollama como última opção
5. **Custo-efetivo**: Prioriza modelos gratuitos

## Uso

O sistema de fallback é transparente e automático. Apenas faça requisições normalmente:

```javascript
const response = await client.session.prompt({
  path: { id: sessionId },
  body: {
    model: { providerID: "opencode", modelID: "minimax-m2.1-free" },
    parts: [{ type: "text", text: "Sua pergunta aqui" }]
  }
});
```

Se o modelo primário falhar, o sistema automaticamente tentará os próximos modelos na sequência.
