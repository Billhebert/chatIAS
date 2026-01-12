---
name: confirm8-api
description: Conhecimento profundo da API Confirm8 com relacionamentos, endpoints e estrategias de busca
license: MIT
compatibility: opencode
metadata:
  domain: confirm8
  type: api-reference
---

# Confirm8 API - Referencia Completa

## Visao Geral da Arquitetura

A API Confirm8 e um sistema de gestao de servicos de campo com as seguintes entidades principais:

```
                    ┌─────────────┐
                    │   Account   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   Clients   │ │    Users    │ │   Tasks     │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │    Items    │ │   Tickets   │ │  Services   │
    └──────┬──────┘ └─────────────┘ └─────────────┘
           │
    ┌──────▼──────┐
    │     WOS     │
    └─────────────┘
```

## Entidades e Relacionamentos

### 1. Clients (Clientes)
Representa empresas ou locais onde servicos sao executados.

**Campos principais:**
- `id`: ID unico
- `name`: Nome do cliente
- `email`: Email de contato
- `phone`: Telefone
- `deleted`: 'Y' ou 'N' (soft delete)

**Relacionamentos:**
- `items[]`: Equipamentos/ativos do cliente
- `wos[]`: Ordens de servico
- `headquarter`: Matriz (se for filial)
- `userGroup`: Grupo de usuarios responsaveis
- `properties[]`: Propriedades customizadas

**Endpoints:**
```
GET    /clients                    - Lista todos
GET    /clients/:id                - Busca por ID (com relations)
POST   /clients                    - Cria novo
PUT    /clients/:id                - Atualiza
PUT    /clients/:id/active         - Ativa (deleted: 'N')
PUT    /clients/:id/inactive       - Desativa (deleted: 'Y')
```

**Query params para list/get:**
- `relations=wos`
- `relations=items`
- `relations=headquarter`
- `relations=userGroup`
- `relations=properties`

---

### 2. Users (Usuarios)
Tecnicos, gestores e administradores do sistema.

**Campos principais:**
- `id`: ID unico
- `username`: Login
- `name`: Nome completo
- `email`: Email
- `phone`: Telefone
- `employee_id`: ID do colaborador

**Relacionamentos:**
- `tasks[]`: Tarefas atribuidas ao usuario
- `tickets[]`: Tickets do usuario
- `permissions[]`: Permissoes de acesso

**Endpoints:**
```
GET    /users                      - Lista todos
GET    /users/:id                  - Busca por ID
GET    /users/:username/user       - Busca por username
POST   /users                      - Cria novo
PUT    /users/:id                  - Atualiza
PUT    /users/:id/active           - Ativa
PUT    /users/:id/inactive         - Desativa
GET    /users/:id/tasks            - Tarefas do usuario
GET    /users/:id/tickets          - Tickets do usuario
GET    /users/:id/permissions      - Permissoes
POST   /users/link-tasks           - Vincula tarefas em lote
PUT    /users/:id/tasks/:task_id   - Desvincula tarefa
DELETE /users/:employee_id/tasks   - Desvincula todas
POST   /users/:id/photo            - Upload foto
POST   /users/:id/signature        - Upload assinatura
```

---

### 3. Items (Itens/Equipamentos)
Ativos e equipamentos dos clientes.

**Campos principais:**
- `id`: ID unico
- `name`: Nome do item
- `info`: Informacoes/descricao
- `item_type_id`: Tipo do item

**Relacionamentos:**
- `client`: Cliente proprietario
- `itemType`: Tipo do item
- `tickets[]`: Tickets relacionados

**Endpoints:**
```
GET    /items                      - Lista todos
GET    /items/:id                  - Busca por ID
POST   /items                      - Cria novo
PUT    /items/:id                  - Atualiza
PUT    /items/:id/active           - Ativa
PUT    /items/:id/inactive         - Desativa
```

### Item Types (Tipos de Item)
Categorias de equipamentos.

```
GET    /item-types                 - Lista todos
GET    /item-types/:id             - Busca por ID
POST   /item-types                 - Cria novo
PUT    /item-types/:id             - Atualiza
PUT    /item-types/:id/active      - Ativa
PUT    /item-types/:id/inactive    - Desativa
```

---

### 4. Tickets (Ocorrencias)
Chamados e ocorrencias registradas.

**Campos principais:**
- `id`: ID unico
- `subject`: Assunto
- `content`: Descricao detalhada
- `client_id`: Cliente relacionado
- `item_id`: Item relacionado
- `owner_user_id`: Usuario responsavel
- `category_id`: Categoria
- `priority_id`: Prioridade
- `status_id`: Status atual
- `subject_id`: Tipo de assunto

**Endpoints:**
```
GET    /tickets                    - Lista todos
GET    /tickets/:id                - Busca por ID
POST   /tickets                    - Cria novo
PUT    /tickets/:id                - Atualiza
PUT    /tickets/batch/active       - Ativa em lote
PUT    /tickets/batch/inactive     - Desativa em lote
```

**Operacoes em lote:**
```json
{
  "ids": ["1", "2", "3"],
  "deleted": "N"  // ou "Y" para desativar
}
```

---

### 5. Tasks (Tarefas/Checklists)
Tarefas que podem ser atribuidas a usuarios.

**Campos principais:**
- `id`: ID unico
- `name`: Nome da tarefa
- `task_type`: Tipo
- `estimated_time`: Tempo estimado
- `priority`: Prioridade (1-N)
- `mandatory`: 'Y' ou 'N'
- `editable`: 'Y' ou 'N'
- `multipliable`: 'Y' ou 'N'
- `has_feedback`: 'Y' ou 'N'

**Endpoints:**
```
GET    /tasks                      - Lista todos
GET    /tasks/:id                  - Busca por ID
POST   /tasks                      - Cria novo
PUT    /tasks/:id                  - Atualiza
PUT    /tasks/:id/active           - Ativa
PUT    /tasks/:id/inactive         - Desativa
```

---

### 6. Services (Servicos/Levantamentos)
Servicos disponiveis para execucao.

**Campos principais:**
- `id`: ID unico
- `name`: Nome do servico
- `info`: Descricao
- `task_id`: Tarefa vinculada
- `mandatory`: 'Y' ou 'N'

**Endpoints:**
```
GET    /services                   - Lista todos
GET    /services/:id               - Busca por ID
POST   /services                   - Cria novo
PUT    /services/:id               - Atualiza
PUT    /services/:id/active        - Ativa
PUT    /services/:id/inactive      - Desativa
```

---

### 7. WOS (Ordens de Servico)
Ordens de servico executadas em campo.

**Campos principais:**
- `id`: ID unico
- `client_id`: Cliente
- `user_id`: Tecnico responsavel
- `status`: Status da OS
- `scheduled_date`: Data agendada

**Endpoints:**
```
GET    /wos                        - Lista todos
GET    /wos/:id                    - Busca por ID
POST   /wos                        - Cria novo
PUT    /wos/:id                    - Atualiza
PUT    /wos/:id/active             - Ativa
PUT    /wos/:id/inactive           - Desativa
```

---

### 8. Products (Produtos/Insumos)
Materiais e pecas utilizados.

**Campos principais:**
- `id`: ID unico
- `name`: Nome do produto
- `description`: Descricao
- `category`: 'consumable' ou 'nonconsumable'
- `price`: Preco
- `stock`: Quantidade em estoque
- `external_id`: ID externo (integracao)
- `integration_id`: ID da integracao

**Endpoints:**
```
GET    /products                   - Lista todos
GET    /products/:id               - Busca por ID
POST   /products                   - Cria novo
PUT    /products/:id               - Atualiza
PUT    /products/:id/active        - Ativa
PUT    /products/:id/inactive      - Desativa
```

---

### 9. Modalities (Modalidades)
Tipos/categorias de servicos.

**Campos principais:**
- `id`: ID unico
- `modality`: Nome da modalidade
- `modality_color`: Cor (hex)

**Endpoints:**
```
GET    /modalities                 - Lista todos
GET    /modalities/:id             - Busca por ID
POST   /modalities                 - Cria novo
PUT    /modalities/:id             - Atualiza
PUT    /modalities/:id/active      - Ativa
PUT    /modalities/:id/inactive    - Desativa
```

---

### 10. Properties (Propriedades)
Campos customizados para entidades.

**Campos principais:**
- `id`: ID unico
- `property`: Nome da propriedade
- `description`: Descricao
- `type`: 'text', 'number', 'date', 'select', 'checkbox', 'textarea'
- `options`: Opcoes (para select)

**Endpoints:**
```
GET    /properties                 - Lista todos
GET    /properties/:id             - Busca por ID
POST   /properties                 - Cria novo
PUT    /properties/:id             - Atualiza
PUT    /properties/:id/active      - Ativa
PUT    /properties/:id/inactive    - Desativa
```

---

## Autenticacao

Todas as requisicoes requerem os seguintes headers:

```
Authorization: Bearer <JWT_TOKEN>
X-API-DOMAIN: <domain>
X-APIKEY-TOKEN: <apikey>
Content-Type: application/json
```

**Endpoint de login:**
```
POST /login
Body: { "username": "...", "password": "..." }
Response: { "user": {...}, "account": {...}, "refreshToken": "..." }
```

---

## Estrategias de Busca Avancadas

### Busca Completa de Cliente
```
1. GET /clients/:id?relations=wos&relations=items&relations=properties
2. Para cada item: GET /items/:item_id (detalhes)
3. GET /tickets?client_id=:id
4. Para cada WOS: GET /wos/:wos_id
```

### Dashboard de Usuario
```
1. GET /users/:id
2. GET /users/:id/tasks
3. GET /users/:id/tickets
4. GET /users/:id/permissions
5. GET /wos?user_id=:id (WOS atribuidas)
```

### Inventario Completo
```
1. GET /item-types (categorias)
2. GET /items (todos os itens)
3. GET /clients (para enriquecer com nomes)
4. Agrupar items por item_type e client
```

### Analise de Tickets
```
1. GET /tickets
2. GET /users (para nomes dos responsaveis)
3. GET /clients (para nomes dos clientes)
4. Agrupar por status, prioridade, categoria
```

---

## Padroes de Resposta

### Sucesso
```json
{
  "success": true,
  "data": { ... },
  "count": 10  // para listagens
}
```

### Erro
```json
{
  "success": false,
  "status": 400,
  "message": "Descricao do erro",
  "error": { ... }
}
```

---

## Soft Delete

Todas as entidades usam soft delete:
- `deleted: 'N'` = Ativo
- `deleted: 'Y'` = Inativo/Deletado

Para ativar/desativar:
- `PUT /<entity>/:id/active` com body `{ "deleted": "N" }`
- `PUT /<entity>/:id/inactive` com body `{ "deleted": "Y" }`
