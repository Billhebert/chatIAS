# RD Station CRM API - Skill Documentation

## Visao Geral

O RD Station CRM e uma plataforma de gestao de vendas da RD Station (Resultados Digitais).
Esta skill documenta a integracao completa via API REST.

## Autenticacao

- **Metodo**: Token via query parameter
- **Base URL**: `https://crm.rdstation.com/api/v1`
- **Formato**: `?token=SEU_TOKEN`
- **Token Atual**: `684c0df9ab0fa6001e9745fd`

## Modelo de Dados

### Hierarquia de Entidades

```
Account (Conta RD Station)
├── Users (Usuarios do sistema)
├── Teams (Equipes)
├── Deal Pipelines (Funis de vendas)
│   └── Deal Stages (Etapas do funil)
├── Products (Catalogo de produtos)
├── Campaigns (Campanhas de marketing)
├── Deal Sources (Fontes de negociacao)
├── Deal Lost Reasons (Motivos de perda)
├── Custom Fields (Campos personalizados)
├── Organizations (Empresas/Clientes)
│   └── Contacts (Contatos/Pessoas)
│       └── Deals (Negociacoes)
│           ├── Deal Products (Produtos na negociacao)
│           ├── Activities (Anotacoes/Historico)
│           └── Tasks (Tarefas agendadas)
```

### Relacionamentos Principais

| Entidade | Relaciona com | Tipo |
|----------|---------------|------|
| Contact | Organization | N:1 |
| Deal | Contact | N:1 |
| Deal | Organization | N:1 |
| Deal | Deal Stage | N:1 |
| Deal | User | N:1 (responsavel) |
| Deal | Campaign | N:1 |
| Deal | Deal Source | N:1 |
| Deal Product | Deal | N:1 |
| Deal Product | Product | N:1 |
| Activity | Deal | N:1 |
| Task | Deal | N:1 |
| Deal Stage | Deal Pipeline | N:1 |
| Custom Field | Entity Type | N:1 |

## Endpoints por Recurso

### Contacts (Contatos)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /contacts | Lista contatos |
| POST | /contacts | Cria contato |
| GET | /contacts/:id | Busca contato |
| PUT | /contacts/:id | Atualiza contato |

**Campos principais**: name, title, email, phone, organization_id

### Organizations (Empresas)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /organizations | Lista empresas |
| POST | /organizations | Cria empresa |
| GET | /organizations/:id | Busca empresa |
| PUT | /organizations/:id | Atualiza empresa |
| GET | /organizations/:id/contacts | Lista contatos da empresa |

**Campos principais**: name, legal_name, cnpj, url, address, city, state, country

### Deals (Negociacoes)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /deals | Lista negociacoes |
| POST | /deals | Cria negociacao |
| GET | /deals/:id | Busca negociacao |
| PUT | /deals/:id | Atualiza negociacao |
| GET | /deals/:id/deal_products | Lista produtos da negociacao |
| POST | /deals/:id/deal_products | Adiciona produto |
| PUT | /deals/:id/deal_products/:dp_id | Atualiza produto |
| DELETE | /deals/:id/deal_products/:dp_id | Remove produto |

**Campos principais**: name, amount, deal_stage_id, user_id, organization_id, contact_id, win

**Status (win)**:
- `null` = Em andamento
- `true` = Ganha
- `false` = Perdida

### Deal Pipelines (Funis)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /deal_pipelines | Lista funis |
| POST | /deal_pipelines | Cria funil |
| GET | /deal_pipelines/:id | Busca funil |
| PUT | /deal_pipelines/:id | Atualiza funil |
| GET | /deal_pipelines/:id/deal_stages | Lista etapas do funil |
| POST | /deal_pipelines/:id/deal_stages | Cria etapa |

### Deal Stages (Etapas)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /deal_stages/:id | Busca etapa |
| PUT | /deal_stages/:id | Atualiza etapa |

### Tasks (Tarefas)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /tasks | Lista tarefas |
| POST | /tasks | Cria tarefa |
| GET | /tasks/:id | Busca tarefa |
| PUT | /tasks/:id | Atualiza tarefa |

**Tipos de tarefa**: call, email, meeting, task, lunch, whatsapp

### Activities (Anotacoes)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /deals/:id/activities | Lista anotacoes |
| POST | /deals/:id/activities | Cria anotacao |

### Products (Produtos)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /products | Lista produtos |
| POST | /products | Cria produto |
| GET | /products/:id | Busca produto |
| PUT | /products/:id | Atualiza produto |

**Recorrencia**: none, monthly, bimonthly, quarterly, semiannual, annual

### Campaigns (Campanhas)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /campaigns | Lista campanhas |
| POST | /campaigns | Cria campanha |
| GET | /campaigns/:id | Busca campanha |
| PUT | /campaigns/:id | Atualiza campanha |

### Custom Fields (Campos Personalizados)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /custom_fields | Lista campos |
| POST | /custom_fields | Cria campo |
| GET | /custom_fields/:id | Busca campo |
| PUT | /custom_fields/:id | Atualiza campo |
| DELETE | /custom_fields/:id | Deleta campo |

**Tipos**: text, text_area, integer, decimal, boolean, email_field, phone_field, url_field, selection, multi_selection, date_time

**Entidades**: Deal, Contact, Organization

### Deal Sources (Fontes)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /deal_sources | Lista fontes |
| POST | /deal_sources | Cria fonte |
| GET | /deal_sources/:id | Busca fonte |
| PUT | /deal_sources/:id | Atualiza fonte |

### Deal Lost Reasons (Motivos de Perda)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /deal_lost_reasons | Lista motivos |
| POST | /deal_lost_reasons | Cria motivo |
| GET | /deal_lost_reasons/:id | Busca motivo |
| PUT | /deal_lost_reasons/:id | Atualiza motivo |

### Users (Usuarios) - Somente Leitura
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /users | Lista usuarios |
| GET | /users/:id | Busca usuario |

### Teams (Equipes) - Somente Leitura
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /teams | Lista equipes |
| GET | /teams/:id | Busca equipe |

## Paginacao

Todos os endpoints de listagem suportam:

| Parametro | Descricao | Default | Max |
|-----------|-----------|---------|-----|
| page | Numero da pagina | 1 | - |
| limit | Itens por pagina | 20 | 200 |
| order | Campo de ordenacao | varies | - |
| direction | asc ou desc | asc | - |

**Resposta de paginacao**:
```json
{
  "total": 150,
  "has_more": true,
  "deals": [...]
}
```

## Filtros Comuns

### Deals
- `q`: Busca textual
- `win`: true/false/null
- `deal_stage_id`: ID da etapa
- `user_id`: ID do responsavel
- `created_at_start`: Data inicio (ISO 8601)
- `created_at_end`: Data fim (ISO 8601)

### Contacts / Organizations
- `q`: Busca por nome, email, telefone
- `user_id`: ID do responsavel

### Tasks
- `deal_id`: ID da negociacao
- `user_id`: ID do responsavel
- `done`: true/false
- `type`: Tipo de tarefa

### Custom Fields
- `entity_type`: Deal, Contact, Organization

## Formato de Requisicao

### Criar/Atualizar
```json
POST /contacts?token=XXX
Content-Type: application/json

{
  "contact": {
    "name": "Joao Silva",
    "email": "joao@empresa.com",
    "phone": "(11) 99999-9999",
    "organization_id": "abc123"
  }
}
```

### Resposta de Sucesso
```json
{
  "_id": "def456",
  "name": "Joao Silva",
  "email": "joao@empresa.com",
  "created_at": "2024-01-15T10:30:00Z",
  ...
}
```

### Resposta de Erro
```json
{
  "errors": ["Email ja existe"],
  "message": "Validation failed"
}
```

## Casos de Uso Comuns

### 1. Criar Negociacao Completa
```
1. POST /organizations → criar empresa
2. POST /contacts (organization_id) → criar contato
3. GET /deal_pipelines/:id/deal_stages → obter etapas
4. POST /deals (contact_id, deal_stage_id, amount) → criar deal
5. POST /deals/:id/deal_products → adicionar produtos
6. POST /tasks (deal_id) → agendar follow-up
```

### 2. Mover Deal no Funil
```
PUT /deals/:id
{
  "deal": {
    "deal_stage_id": "nova_etapa_id"
  }
}
```

### 3. Marcar Deal como Ganha
```
PUT /deals/:id
{
  "deal": {
    "win": true
  }
}
```

### 4. Marcar Deal como Perdida
```
PUT /deals/:id
{
  "deal": {
    "win": false,
    "deal_lost_reason_id": "motivo_id"
  }
}
```

## Tools Disponiveis

| Tool | Descricao |
|------|-----------|
| rdstation-contacts | CRUD de contatos |
| rdstation-deals | CRUD de negs + produtos |
| rdstation-organizations | CRUD de empresas |
| rdstation-activities | Anotacoes de deals |
| rdstation-tasks | Tarefas |
| rdstation-pipelines | Funis e etapas |
| rdstation-products | Catalogo de produtos |
| rdstation-campaigns | Campanhas |
| rdstation-custom-fields | Campos personalizados |
| rdstation-deal-sources | Fontes |
| rdstation-deal-reasons | Motivos de perda |
| rdstation-teams | Equipes (readonly) |
| rdstation-users | Usuarios (readonly) |

## Agentes Disponiveis

| Agente | Descricao |
|--------|-----------|
| rdstation-admin | Acesso CRUD completo |
| rdstation-explorer | Consultas e analises |
