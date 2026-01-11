# 🚀 ChatIAS Pro 2.0 - Sistema de Chat Inteligente

> **Sistema completo de chat com agentes de IA, SDK OpenCode como provider primário, e fallback para Ollama**

[![Branch](https://img.shields.io/badge/branch-chatengine--version-blue)]()
[![Status](https://img.shields.io/badge/status-ready%20for%20testing-yellow)]()
[![Commits](https://img.shields.io/badge/commits-5%20new-green)]()

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Características](#características)
- [Arquitetura](#arquitetura)
- [Quick Start](#quick-start)
- [Documentação](#documentação)
- [Testes](#testes)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## 🎯 Visão Geral

ChatIAS Pro 2.0 é um sistema completo de chat inteligente com:

- **ChatEngine**: Motor de conversação com detecção de intenção e roteamento inteligente
- **SDK OpenCode como PRIMARY**: Primeira opção para todas as requisições
- **Ollama como FALLBACK**: Backup local quando SDK não disponível
- **Multi-Model Fallback**: Tenta múltiplos modelos free até um funcionar
- **Sistema de Logs Avançado**: Logs categorizados com SSE streaming
- **UI Moderna**: Interface web com debug em tempo real

---

## ✨ Características

### 🤖 ChatEngine Inteligente
- ✅ Detecção automática de intenção (greeting, conversational, agent, command)
- ✅ Roteamento para agentes ou LLMs baseado na intenção
- ✅ Histórico de conversação com contexto
- ✅ Session management completo
- ✅ Shutdown graceful

### 🔌 Providers
- ✅ **SDK OpenCode**: Provider primário
- ✅ **Ollama**: Fallback local
- ✅ **Multi-model**: Tenta 4+ modelos free em sequência
- ✅ Timeout configurável (15s padrão)
- ✅ Fallback automático entre providers

### 📊 Sistema de Logs
- ✅ Logs categorizados (mcp, chat, agent, tool, request, response, etc)
- ✅ Cores no console para fácil leitura
- ✅ SSE (Server-Sent Events) para streaming em tempo real
- ✅ RequestId tracking
- ✅ Filtros por categoria, level, requestId

### 🌐 Server Web
- ✅ API REST completa
- ✅ UI moderna com chat interativo
- ✅ Debug panel com logs em tempo real
- ✅ Health checks
- ✅ Static file serving

### 🧪 Testes Automatizados
- ✅ Teste direto do SDK (`test-sdk-prompt.js`)
- ✅ Teste completo do ChatEngine (`test-chat-quick.js`)
- ✅ Scripts quick-start para Windows e Linux

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    ChatIAS Pro 2.0                              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Server (Express)                        │ │
│  │  REST API + SSE Logs + Static Files + CORS               │ │
│  └────────────────────┬──────────────────────────────────────┘ │
│                       │                                         │
│  ┌────────────────────▼──────────────────────────────────────┐ │
│  │                    ChatEngine                             │ │
│  │  • Intent Detection (regex + LLM)                         │ │
│  │  • Smart Routing (agents, tools, LLM)                     │ │
│  │  │  • Session Management (SDK)                            │ │
│  │  • Conversation History                                   │ │
│  └────┬──────────┬──────────┬──────────┬────────────────────┘ │
│       │          │          │          │                       │
│   ┌───▼───┐  ┌───▼───┐  ┌───▼───┐  ┌───▼───┐                 │
│   │  SDK  │  │Ollama │  │Agents │  │Tools  │                 │
│   │PRIMARY│  │BACKUP │  │ System│  │System │                 │
│   └───┬───┘  └───────┘  └───────┘  └───────┘                 │
│       │                                                         │
│   ┌───▼────────────────────────────────────────────┐           │
│   │  OpenCode Server (localhost:4096)             │           │
│   │  • Session API (create/prompt/delete)         │           │
│   │  • Multi-model support (free models)          │           │
│   │  • Provider routing (OpenRouter/ZenMux)       │           │
│   └────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### Pré-requisitos

- Node.js 18+
- Servidor OpenCode rodando (porta 4096)
- (Opcional) Ollama instalado e rodando

### Instalação

```bash
# 1. Clone o repositório
git clone <repo-url>
cd chatIAS

# 2. Instale dependências
npm install

# 3. Configure servidor OpenCode com modelo FREE
# Ver TESTING_INSTRUCTIONS.md para detalhes

# 4. Rode o quick-start
# Windows:
quick-start.bat

# Linux/Mac:
chmod +x quick-start.sh
./quick-start.sh
```

### Uso Manual

```bash
# 1. Teste SDK diretamente
node test-sdk-prompt.js

# 2. Teste ChatEngine
node test-chat-quick.js

# 3. Inicie servidor web
node server-v2.js

# 4. Abra no navegador
# http://localhost:4174/chat-v2
```

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** | ⭐ Resumo completo da implementação |
| **[TESTING_INSTRUCTIONS.md](TESTING_INSTRUCTIONS.md)** | ⭐ Guia passo-a-passo de testes |
| **[CHATENGINE_GUIDE.md](CHATENGINE_GUIDE.md)** | Arquitetura detalhada do ChatEngine |
| **[README_FUNCIONANDO.md](README_FUNCIONANDO.md)** | Overview do sistema v2.0 |
| **[COMO_ADICIONAR_FERRAMENTAS.md](COMO_ADICIONAR_FERRAMENTAS.md)** | Como criar novas ferramentas |

---

## 🧪 Testes

### Teste 1: SDK Direto

```bash
node test-sdk-prompt.js
```

**Verifica:**
- ✅ Conexão com servidor OpenCode
- ✅ Criação de sessão SDK
- ✅ Envio de mensagem
- ✅ Resposta do modelo (sem erros)

### Teste 2: ChatEngine

```bash
node test-chat-quick.js
```

**Verifica:**
- ✅ Carregamento do sistema
- ✅ Inicialização do ChatEngine
- ✅ Provider: "sdk" (primário)
- ✅ Resposta conversacional
- ✅ Shutdown limpo

### Teste 3: Server Web

```bash
node server-v2.js
```

**Testa:**
- API: `curl http://localhost:4174/api/health`
- Chat: `curl -X POST http://localhost:4174/api/chat -d '{"message":"test"}'`
- UI: `http://localhost:4174/chat-v2`

---

## 📁 Estrutura do Projeto

```
chatIAS/
├── src/
│   ├── core/
│   │   ├── chat-engine.js          ⭐ Motor de chat principal
│   │   ├── logger.js               ⭐ Sistema de logs
│   │   ├── system-loader.js        Sistema de bootstrap
│   │   ├── base-agent.js           Classe base para agentes
│   │   ├── base-tool.js            Classe base para tools
│   │   └── ...
│   ├── agents/                     Agentes especializados
│   ├── tools/                      Ferramentas modulares
│   ├── mcp/                        MCP providers
│   └── knowledge-base/             Bases de conhecimento
├── config/
│   └── system-config.json          Configuração do sistema
├── public/
│   └── chat-v2.html                ⭐ UI do chat
├── sdk/                            OpenCode SDK
├── server-v2.js                    ⭐ Servidor web
├── test-sdk-prompt.js              ⭐ Teste SDK direto
├── test-chat-quick.js              ⭐ Teste ChatEngine
├── quick-start.bat                 Script Windows
├── quick-start.sh                  Script Linux/Mac
└── docs/                           Documentação completa
```

---

## 🔧 Configuração

### OpenCode Server

**Modelos FREE recomendados:**

```bash
# OpenRouter (mais confiável)
openrouter/google/gemini-2.0-flash-exp:free
openrouter/qwen/qwen3-coder:free
openrouter/z-ai/glm-4.5-air:free

# OpenCode
opencode/glm-4.7-free
opencode/minimax-m2.1-free

# ZenMux
zenmux/z-ai/glm-4.6v-flash-free
zenmux/kuaishou/kat-coder-pro-v1-free
```

**Como configurar:** Ver [TESTING_INSTRUCTIONS.md](TESTING_INSTRUCTIONS.md)

---

## 🐛 Troubleshooting

### Problema: SDK retorna "empty/invalid response"

**Causa:** Servidor OpenCode usando modelo com erro de créditos

**Solução:** Configure servidor com modelo FREE (ver documentação)

### Problema: "SDK timeout after 15s"

**Causa:** Modelo muito lento

**Solução:** Use modelo mais rápido (ex: `gemini-2.0-flash-exp:free`)

### Problema: Ollama falha (fetch failed)

**Causa:** Servidor Ollama não está rodando

**Solução:** `ollama serve` ou desabilite no config

---

## 📊 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Redireciona para /chat-v2 |
| GET | `/chat-v2` | UI do chat |
| GET | `/api/health` | Health check |
| GET | `/api/system` | Info do sistema |
| POST | `/api/chat` | Envia mensagem |
| GET | `/api/logs` | Lista logs (com filtros) |
| GET | `/api/logs/stream` | Stream de logs (SSE) |
| GET | `/api/tools` | Lista ferramentas |
| GET | `/api/agents` | Lista agentes |

---

## 🎯 Status do Projeto

| Componente | Status | Notas |
|------------|--------|-------|
| ChatEngine | ✅ **Completo** | SDK como primário |
| Logger | ✅ **Completo** | SSE + categorias |
| Server | ✅ **Completo** | REST API + UI |
| UI | ✅ **Completo** | Debug panel + logs |
| SDK Integration | ⚠️ **Precisa config** | Configurar modelo FREE |
| Testes | ✅ **Prontos** | 2 testes + quick-start |
| Documentação | ✅ **Completa** | 5 documentos |

---

## 🚀 Próximos Passos

1. ⚠️ **Configurar servidor OpenCode** com modelo FREE
2. ✅ Rodar testes (`test-sdk-prompt.js`, `test-chat-quick.js`)
3. ✅ Validar provider: "sdk" nas respostas
4. ✅ Testar fallback (parar OpenCode → deve usar Ollama)
5. 🎯 Implementar features avançadas:
   - Tool Sequences
   - Middleware Chain
   - Circuit Breaker
   - Rate Limiting
   - Caching

---

## 📝 Changelog

### Version 2.0 (Current - `chatengine-version` branch)

**[11/01/2026]** - Major refactor
- ✅ SDK OpenCode como provider PRIMARY
- ✅ Multi-model fallback system
- ✅ Enhanced logging with SSE
- ✅ Complete REST API
- ✅ Modern chat UI
- ✅ Automated tests
- ✅ Comprehensive documentation

---

## 🤝 Contribuindo

Este é um projeto privado. Para sugestões ou bugs, entre em contato com o mantenedor.

---

## 📄 Licença

Privado - Todos os direitos reservados

---

## 👤 Autor

**Bill Herbert**

---

## 🙏 Agradecimentos

- OpenCode SDK team
- Ollama project
- OpenRouter/ZenMux free tier providers

---

**Status:** ✅ **Ready for testing** | **Branch:** `chatengine-version` | **Last update:** 11/01/2026
