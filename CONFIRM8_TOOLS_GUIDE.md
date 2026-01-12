# Confirm8 API Tools - Guia Completo

## 📦 Ferramentas Desenvolvidas

Criei **7 ferramentas profissionais** para integração completa com a API Confirm8 v3:

### 1. **Confirm8AuthTool** (`confirm8-auth.js`)
**Autenticação e gerenciamento de sessão**

**Actions:**
- `login` - Autentica usuário e obtém JWT token
- `logout` - Limpa sessão local
- `getToken` - Retorna token atual
- `getUser` - Retorna informações do usuário
- `isAuthenticated` - Verifica se está autenticado

**Exemplo:**
```javascript
const authTool = new Confirm8AuthTool({ baseUrl: 'https://api.confirm8.com/v3' });

// Login
const result = await authTool.execute({
  action: 'login',
  username: 'jessica',
  password: '12345'
});

// result = { success: true, data: { user, account, hasToken } }
```

---

### 2. **Confirm8UsersTool** (`confirm8-users.js`)
**Gerenciamento completo de usuários**

**Actions:**
- `create` - Criar usuário
- `list` - Listar usuários
- `get` - Buscar usuário por ID ou username
- `update` - Atualizar usuário
- `activate` / `deactivate` - Ativar/desativar usuário
- `getTasks` - Buscar tarefas do usuário
- `getTickets` - Buscar tickets do usuário
- `linkTasks` / `unlinkTasks` - Vincular/desvincular tarefas
- `getPermissions` - Buscar permissões
- `uploadPhoto` / `uploadSignature` - Upload de foto/assinatura

**Exemplo:**
```javascript
const usersTool = new Confirm8UsersTool({ authTool });

// Criar usuário
await usersTool.execute({
  action: 'create',
  username: 'joao',
  password: 'senha123',
  name: 'João Silva',
  email: 'joao@example.com'
});

// Listar usuários
const users = await usersTool.execute({ action: 'list' });
```

---

### 3. **Confirm8ClientsTool** (`confirm8-clients.js`)
**Gerenciamento de clientes**

**Actions:**
- `create` - Criar cliente
- `list` - Listar clientes
- `get` - Buscar cliente por ID
- `update` - Atualizar cliente
- `activate` / `deactivate` - Ativar/desativar cliente

**Exemplo:**
```javascript
const clientsTool = new Confirm8ClientsTool({ authTool });

// Criar cliente
await clientsTool.execute({
  action: 'create',
  name: 'Cliente ABC',
  email: 'cliente@abc.com'
});

// Listar todos
const clients = await clientsTool.execute({ action: 'list' });
```

---

### 4. **Confirm8TasksTool** (`confirm8-tasks.js`)
**Gerenciamento de tarefas/checklists**

**Actions:**
- `create` - Criar tarefa
- `list` - Listar tarefas
- `get` - Buscar tarefa por ID
- `update` - Atualizar tarefa
- `activate` / `deactivate` - Ativar/desativar tarefa

**Exemplo:**
```javascript
const tasksTool = new Confirm8TasksTool({ authTool });

// Criar tarefa
await tasksTool.execute({
  action: 'create',
  name: 'Verificar equipamento',
  task_type: 'order',
  estimated_time: '00:30:00',
  priority: 1
});
```

---

### 5. **Confirm8TicketsTool** (`confirm8-tickets.js`)
**Gerenciamento de ocorrências/tickets**

**Actions:**
- `create` - Criar ticket
- `list` - Listar tickets
- `get` - Buscar ticket por ID
- `update` - Atualizar ticket
- `activateBatch` / `deactivateBatch` - Ativar/desativar múltiplos tickets

**Exemplo:**
```javascript
const ticketsTool = new Confirm8TicketsTool({ authTool });

// Criar ticket
await ticketsTool.execute({
  action: 'create',
  client_id: 123,
  subject: 'Problema técnico',
  content: 'Descrição do problema',
  priority_id: 1
});
```

---

### 6. **Confirm8ItemsTool** (`confirm8-items.js`)
**Gerenciamento de itens e tipos de itens**

**Actions (Items):**
- `createItem` / `listItems` / `getItem` / `updateItem`
- `activateItem` / `deactivateItem`

**Actions (Item Types):**
- `createItemType` / `listItemTypes` / `getItemType` / `updateItemType`
- `activateItemType` / `deactivateItemType`

**Exemplo:**
```javascript
const itemsTool = new Confirm8ItemsTool({ authTool });

// Criar item
await itemsTool.execute({
  action: 'createItem',
  name: 'Equipamento XYZ',
  client_id: 123,
  type_id: 1
});

// Criar tipo de item
await itemsTool.execute({
  action: 'createItemType',
  name: 'Equipamento Industrial'
});
```

---

### 7. **Confirm8ProductsTool** (`confirm8-products.js`)
**Gerenciamento de produtos/insumos**

**Actions:**
- `create` - Criar produto
- `list` - Listar produtos
- `get` - Buscar produto por ID
- `update` - Atualizar produto
- `activate` / `deactivate` - Ativar/desativar produto

**Exemplo:**
```javascript
const productsTool = new Confirm8ProductsTool({ authTool });

// Criar produto
await productsTool.execute({
  action: 'create',
  name: 'Óleo Lubrificante',
  category: 'consumable',
  price: 49.90,
  stock: 100,
  description: 'Óleo sintético 5W30'
});
```

---

## 🚀 Fluxo de Uso Completo

### 1. Inicializar AuthTool
```javascript
import { Confirm8AuthTool } from './src/tools/confirm8-auth.js';

const authTool = new Confirm8AuthTool({
  baseUrl: 'https://api.confirm8.com/v3'
});
```

### 2. Fazer Login
```javascript
const loginResult = await authTool.execute({
  action: 'login',
  username: 'jessica',
  password: '12345'
});

if (loginResult.success) {
  console.log('Logged in as:', loginResult.data.user.name);
  // authTool agora tem o token JWT armazenado
}
```

### 3. Usar Outras Ferramentas
```javascript
// Todas as ferramentas recebem authTool como dependência
const usersTool = new Confirm8UsersTool({ authTool });
const clientsTool = new Confirm8ClientsTool({ authTool });
const tasksTool = new Confirm8TasksTool({ authTool });
const ticketsTool = new Confirm8TicketsTool({ authTool });
const itemsTool = new Confirm8ItemsTool({ authTool });
const productsTool = new Confirm8ProductsTool({ authTool });

// Agora todas fazem requisições autenticadas automaticamente
const users = await usersTool.execute({ action: 'list' });
const clients = await clientsTool.execute({ action: 'list' });
const tasks = await tasksTool.execute({ action: 'list' });
```

---

## 📋 Estrutura de Resposta Padrão

Todas as ferramentas retornam respostas no formato:

### Sucesso
```javascript
{
  success: true,
  status: 200,  // HTTP status code
  message: 'Operation successful',  // Mensagem amigável
  data: { ... },  // Dados retornados pela API
  count: 10  // Apenas em listas
}
```

### Erro
```javascript
{
  success: false,
  status: 400,  // HTTP status code
  action: 'create user',  // Ação que falhou
  message: 'Invalid Username or Password',
  error: { ... }  // Erro completo da API
}
```

---

## 🔧 Tratamento de Erros

Todas as ferramentas tratam automaticamente:
- **400** - Bad Request (dados inválidos)
- **403** - Forbidden (sem permissão)
- **404** - Not Found (recurso não existe)
- **Erros de rede** - Timeout, conexão recusada, etc.

**Exemplo:**
```javascript
const result = await usersTool.execute({
  action: 'get',
  user_id: 9999  // ID inexistente
});

if (!result.success) {
  console.error(`Failed to ${result.action}:`, result.message);
  console.error('Status:', result.status);
  console.error('Details:', result.error);
}
```

---

## 🎯 Keywords para SmartDecisionEngine

Cada ferramenta tem keywords específicas para detecção automática:

- **auth**: login, autenticar, authenticate, token, confirm8, logout
- **users**: user, usuário, users, usuários, criar usuário, permission, task user
- **clients**: client, cliente, clients, clientes, criar cliente
- **tasks**: task, tarefa, tasks, tarefas, checklist, criar tarefa
- **tickets**: ticket, tickets, ocorrência, ocorrências, occurrence, criar ticket
- **items**: item, items, itens, criar item, item type, tipo de item
- **products**: product, products, produto, produtos, insumo, criar produto

---

## 📦 Instalação de Dependências

```bash
npm install axios
```

---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env`:

```bash
CONFIRM8_BASE_URL=https://api.confirm8.com/v3
CONFIRM8_USERNAME=seu_usuario
CONFIRM8_PASSWORD=sua_senha
```

---

## ✨ Próximos Passos

1. ✅ 7 ferramentas criadas
2. ⏳ Registrar ferramentas no ChatIAS
3. ⏳ Testar integração end-to-end
4. ⏳ Adicionar mais endpoints (WOS, Modalities, Services, Properties)

---

**Resultado:** API Confirm8 totalmente integrada com ChatIAS Pro 2.0! 🎉
