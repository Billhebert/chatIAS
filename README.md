# ChatIAS Pro 2.0

Sistema de chat com IA usando OpenCode SDK como provider principal e Ollama como fallback.

## 🚀 Como Iniciar

```bash
node server-v2.js
```

## ✨ Funcionalidades

- ✅ **OpenCode SDK como provider principal**
- ✅ **Gerenciamento inteligente do servidor OpenCode**:
  - Usa servidor existente (porta 4096) se estiver rodando e funcionando
  - Cria novo servidor (porta 4097) se necessário
  - Testa conexão antes de usar
- ✅ **Ollama como fallback** (se disponível)
- ✅ **Multi-model fallback automático** (10 modelos gratuitos)
- ✅ **Configuração correta**: maxTokens: 2000
- ✅ **Sem timeout no SDK**: aguarda tempo necessário para resposta
- ✅ **Interface web**: http://localhost:4174/chat-v2

## 📊 Arquitetura

```
┌─────────────────────────────────────────────┐
│         ChatIAS Server (port 4174)          │
│  ┌───────────────────────────────────────┐  │
│  │         ChatEngine                    │  │
│  │  - Intent Detection                   │  │
│  │  - Provider Selection                 │  │
│  │  - Auto Model Switching               │  │
│  └───────────────────────────────────────┘  │
│              │                │              │
│      ┌───────┴────┐    ┌─────┴──────┐      │
│      │    SDK     │    │   Ollama   │      │
│      │ (Primary)  │    │ (Fallback) │      │
│      └───────┬────┘    └────────────┘      │
└──────────────│──────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │  OpenCode Server    │
    │   (port 4096/4097)  │
    │                     │
    │  maxTokens: 2000    │
    │  10 free models     │
    └─────────────────────┘
```

## 🎯 Comportamento do Servidor OpenCode

### Se OpenCode já estiver aberto (porta 4096):
1. ✅ Verifica se está rodando
2. ✅ Testa criando uma sessão
3. ✅ Se funcionar → USA o existente
4. ✅ Se falhar → Cria novo na porta 4097

### Se OpenCode não estiver aberto:
1. ✅ Cria novo servidor na porta 4097
2. ✅ Configura com maxTokens: 2000
3. ✅ Usa esse servidor

## 🔧 Endpoints

| Endpoint | Descrição |
|----------|-----------|
| `http://localhost:4174/chat-v2` | Interface web |
| `http://localhost:4174/api/chat` | POST - Enviar mensagem |
| `http://localhost:4174/api/health` | GET - Status |
| `http://localhost:4174/api/system` | GET - Info do sistema |
| `http://localhost:4174/api/tools` | GET - Ferramentas |
| `http://localhost:4174/api/agents` | GET - Agentes |
| `http://localhost:4174/api/logs` | GET - Logs |

## 🎨 Teste Rápido

```bash
curl -X POST http://localhost:4174/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Olá! Quanto é 2+2?"}'
```

## 📝 Notas Importantes

1. **Sempre funciona** - tanto com OpenCode aberto quanto sem
2. **Sem timeout** - SDK aguarda tempo necessário para resposta
3. **maxTokens: 2000** - configurado corretamente para modelos free
4. **Multi-model** - troca automaticamente se modelo falhar

## 🛑 Parar

Pressione `Ctrl+C` no terminal para parar gracefulmente.
