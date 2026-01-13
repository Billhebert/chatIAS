---
name: sdk-usage
description: Guia completo de uso do OpenCode SDK
license: MIT
compatibility:
  - opencode@>=1.0.0
metadata:
  author: ChatIAS Project
  version: 1.0.0
---

# OpenCode SDK Complete Usage Guide

Guia completo para utilizar 100% das funcionalidades do OpenCode SDK.

## Inicialização

### Método 1: Server + Client (Recomendado para desenvolvimento)
```javascript
import { createOpencode } from "@opencode-ai/sdk"

const { client, server } = await createOpencode({
  hostname: "127.0.0.1",
  port: 4096,
  timeout: 5000,
  config: {
    model: { provider: "opencode", model: "minimax-m2.1-free" }
  }
})
```

### Método 2: Client apenas (Para conectar a servidor existente)
```javascript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096"
})
```

## APIs Disponíveis

### 1. Session Management

#### Criar Sessão
```javascript
const session = await client.session.create({
  body: { title: "Minha Sessão" }
})
const sessionId = session.data.id
```

#### Enviar Prompt
```javascript
const response = await client.session.prompt({
  path: { id: sessionId },
  body: {
    model: { providerID: "opencode", modelID: "minimax-m2.1-free" },
    parts: [{ type: "text", text: "Olá!" }],
    noReply: false // true = apenas adiciona contexto sem resposta
  }
})
```

#### Listar Sessões
```javascript
const sessions = await client.session.list()
```

#### Atualizar Sessão
```javascript
await client.session.update({
  path: { id: sessionId },
  body: { title: "Novo Título" }
})
```

#### Deletar Sessão
```javascript
await client.session.delete({
  path: { id: sessionId }
})
```

### 2. File Operations

#### Buscar Texto
```javascript
const results = await client.file.grepText({
  body: {
    pattern: "function.*async",
    glob: "**/*.js",
    caseSensitive: false
  }
})
```

#### Encontrar Arquivos
```javascript
const files = await client.file.findFile({
  body: {
    pattern: "*.js",
    maxResults: 100
  }
})
```

#### Ler Arquivo
```javascript
const content = await client.file.read({
  body: {
    path: "/path/to/file.js",
    format: "content" // ou "patch"
  }
})
```

### 3. Configuration

#### Obter Configuração
```javascript
const config = await client.config.get()
```

#### Listar Providers
```javascript
const providers = await client.config.providers()
```

#### Informações do Sistema
```javascript
const health = await client.global.health()
const version = await client.global.version()
```

### 4. TUI Control

#### Anexar Prompt
```javascript
await client.tui.appendPrompt({
  body: { text: "Novo prompt" }
})
```

#### Mostrar Toast
```javascript
await client.tui.toast({
  body: { message: "Operação concluída!", type: "success" }
})
```

#### Abrir Diálogos
```javascript
await client.tui.openDialog({
  body: { dialog: "help" } // "sessions", "themes", "models"
})
```

### 5. Authentication

#### Definir Credenciais
```javascript
await client.auth.setKey({
  body: {
    provider: "openrouter",
    apiKey: "sk-or-v1-..."
  }
})
```

### 6. Events (Real-time)

#### Subscrever Eventos
```javascript
const eventStream = await client.global.event()

for await (const event of eventStream) {
  console.log("Evento:", event)

  if (event.type === "session:message") {
    console.log("Nova mensagem:", event.data)
  }
}
```

## Padrões e Melhores Práticas

### 1. Gerenciamento de Erros
```javascript
try {
  const response = await client.session.prompt({...})
} catch (error) {
  if (error.status === 429) {
    // Rate limit
    console.log("Rate limit atingido, tentando fallback...")
  } else if (error.status >= 500) {
    // Erro do servidor
    console.log("Erro do servidor, tentando próximo modelo...")
  }
}
```

### 2. Contexto sem Resposta
```javascript
// Adiciona contexto sem gerar resposta do AI
await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: "Contexto importante" }],
    noReply: true
  }
})
```

### 3. Shutdown Gracioso
```javascript
process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})
```

## TypeScript Support

```typescript
import type { OpencodeClient } from "@opencode-ai/sdk"

const client: OpencodeClient = await createOpencodeClient({...})
```

## Recursos Adicionais

- Documentação oficial: https://opencode.ai/docs/sdk/
- GitHub: https://github.com/anomalyco/opencode
- Types: `node_modules/@opencode-ai/sdk/src/gen/types.gen.ts`
