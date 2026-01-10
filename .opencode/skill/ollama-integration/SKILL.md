---
name: ollama-integration
description: Integração com Ollama para modelos locais como fallback
license: MIT
compatibility:
  - opencode@>=1.0.0
metadata:
  author: ChatIAS Project
  version: 1.0.0
---

# Ollama Integration Skill

Esta skill fornece integração com Ollama para usar modelos locais como fallback quando todos os modelos remotos falharem.

## Uso

O Ollama é automaticamente acionado como último recurso quando:
1. Todos os 12 modelos remotos configurados falharem
2. A conexão com provedores remotos estiver indisponível
3. Houver erros de quota/rate limit

## Modelos Suportados

Os seguintes modelos Ollama estão configurados:
- `llama3.2` - Modelo geral de propósito
- `qwen2.5-coder` - Especializado em código
- `deepseek-coder-v2` - Especializado em código avançado

## Configuração

### Pré-requisitos
1. Instale o Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
2. Baixe os modelos:
   ```bash
   ollama pull llama3.2
   ollama pull qwen2.5-coder
   ollama pull deepseek-coder-v2
   ```
3. Verifique se o Ollama está rodando: `ollama list`

### Configuração no projeto

A integração Ollama está configurada em `.opencode/config.json`:

```json
{
  "tool": {
    "ollama": {
      "enabled": true,
      "priority": "fallback",
      "models": ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"]
    }
  }
}
```

## Fluxo de Fallback

1. **Modelo primário** → Tenta o modelo especificado
2. **Fallback remoto** → Tenta os 12 modelos remotos configurados
3. **Fallback Ollama** → Usa modelos locais Ollama
4. **Erro final** → Retorna erro se tudo falhar

## Vantagens

- ✅ **Privacidade**: Modelos rodando localmente
- ✅ **Sem custo**: Não depende de APIs pagas
- ✅ **Sempre disponível**: Funciona offline
- ✅ **Sem rate limits**: Sem limites de requisições

## Desvantagens

- ⚠️ **Performance**: Modelos locais podem ser mais lentos
- ⚠️ **Qualidade**: Podem ter qualidade inferior aos modelos de nuvem
- ⚠️ **Recursos**: Requerem GPU/CPU significativa
