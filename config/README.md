# ChatIAS 3.0 - Configuração por JSON

Todo o sistema ChatIAS 3.0 é configurado através de um arquivo JSON. Não é necessário modificar código para:

- Cadastrar empresas
- Criar departamentos e sub-departamentos
- Configurar integrações (Evolution, RDStation, Confirm8)
- Definir níveis de acesso
- Criar follow-ups e tarefas
- Configurar automações e workflows
- Definir agentes e ferramentas

## Arquivo de Configuração

O arquivo principal é `config/system-config.json` (veja o exemplo em `config/system-config.example.json`).

```json
{
  "system": {
    "name": "ChatIAS Enterprise Platform",
    "version": "3.0.0",
    "environment": "production",
    "multiTenant": {
      "enabled": true,
      "defaultPlan": "professional"
    }
  },

  "companies": { ... },
  "departments": { ... },
  "accessLevels": { ... },
  "followUps": { ... },
  "automations": { ... },
  "integrations": { ... },
  "agents": { ... },
  "tools": { ... },
  "toolSequences": { ... }
}
```

## Estrutura de Configuração

### 1. System (Sistema)

```json
"system": {
  "name": "Nome da Plataforma",
  "version": "3.0.0",
  "environment": "production",
  "multiTenant": {
    "enabled": true,
    "defaultPlan": "professional",
    "allowTenantCreation": true
  }
}
```

### 2. Companies (Empresas)

```json
"companies": {
  "acme-corp": {
    "id": "acme-corp",
    "name": "Acme Corporation",
    "legalName": "Acme Corporation Ltda",
    "document": "12.345.678/0001-90",
    "documentType": "CNPJ",
    "website": "https://acme.com.br",
    "email": "contato@acme.com.br",
    "phone": "(11) 99999-9999",
    "address": {
      "street": "Av. Paulista",
      "city": "São Paulo",
      "state": "SP",
      "country": "Brasil"
    },
    "settings": {
      "defaultCurrency": "BRL",
      "defaultTimezone": "America/Sao_Paulo"
    },
    "enabled": true
  }
}
```

### 3. Departments (Departamentos com Hierarquia)

```json
"departments": {
  "ti": {
    "id": "ti",
    "name": "Tecnologia da Informação",
    "code": "TI",
    "description": "Departamento de TI",
    "companyId": "acme-corp",
    "settings": {
      "budget": 500000,
      "costCenter": "CC-001"
    },
    "enabled": true
  },
  "desenvolvimento": {
    "id": "desenvolvimento",
    "name": "Desenvolvimento",
    "code": "DEV",
    "parentId": "ti",
    "description": "Equipe de Desenvolvimento",
    "enabled": true
  }
}
```

### 4. Access Levels (Níveis de Acesso)

```json
"accessLevels": {
  "admin": {
    "id": "admin",
    "name": "Admin",
    "level": 80,
    "description": "Acesso administrativo",
    "permissions": [
      { "resource": "users", "actions": ["create", "read", "update", "delete"] },
      { "resource": "integrations", "actions": ["create", "read", "update", "delete"] },
      { "resource": "automations", "actions": ["create", "read", "update", "delete"] }
    ]
  }
}
```

### 5. Follow-ups (Tarefas e Lembretes)

```json
"followUps": {
  "daily-standup": {
    "id": "daily-standup",
    "title": "Daily Standup",
    "description": "Reunião diária de alinhamento",
    "type": "MEETING",
    "priority": "HIGH",
    "dueDate": "09:00",
    "assignedTo": "team-leads",
    "enabled": true
  }
}
```

### 6. Automations (Automações)

```json
"automations": {
  "welcome-new-lead": {
    "id": "welcome-new-lead",
    "name": "Boas-vindas para Novos Leads",
    "trigger": {
      "type": "EVENT",
      "config": {
        "eventName": "lead.created",
        "source": "rdstation"
      }
    },
    "conditions": [
      {
        "field": "source",
        "operator": "equals",
        "value": "rdstation"
      }
    ],
    "actions": [
      {
        "id": "1",
        "type": "SEND_MESSAGE",
        "config": {
          "channel": "whatsapp",
          "to": "{{contact.phone}}",
          "message": "Olá {{contact.name}}!"
        }
      },
      {
        "id": "2",
        "type": "CREATE_TASK",
        "config": {
          "title": "Follow-up com {{contact.name}}",
          "type": "CALL",
          "priority": "MEDIUM"
        }
      }
    ],
    "enabled": true
  }
}
```

**Tipos de Trigger:**
- `SCHEDULE` - Agendamento com cron
- `EVENT` - Dispara quando evento ocorre
- `WEBHOOK` - Via HTTP POST
- `MANUAL` - Pelo usuário
- `CONDITION_MET` - Quando condição é satisfeita

**Tipos de Ação:**
- `SEND_MESSAGE` - Envia mensagem
- `SEND_EMAIL` - Envia email
- `CREATE_TASK` - Cria tarefa
- `CALL_WEBHOOK` - Chama webhook
- `RUN_AGENT` - Executa agente
- `SEND_NOTIFICATION` - Envia notificação
- `UPDATE_CONTACT` - Atualiza contato

### 7. Integrações

```json
"integrations": {
  "evolution-api": {
    "id": "evolution-api",
    "type": "EVOLUTION",
    "name": "Evolution API (WhatsApp)",
    "companyId": "acme-corp",
    "credentials": {
      "baseUrl": "${EVOLUTION_BASE_URL}",
      "instanceName": "chatias-main",
      "token": "${EVOLUTION_TOKEN}"
    },
    "enabled": true
  },
  "rdstation-crm": {
    "id": "rdstation-crm",
    "type": "RDSTATION",
    "name": "RD Station CRM",
    "credentials": {
      "clientId": "${RDSTATION_CLIENT_ID}",
      "clientSecret": "${RDSTATION_CLIENT_SECRET}",
      "accessToken": "${RDSTATION_ACCESS_TOKEN}"
    },
    "enabled": true
  },
  "confirm8": {
    "id": "confirm8",
    "type": "CONFIRM8",
    "name": "Confirm8 Business",
    "credentials": {
      "username": "${CONFIRM8_USERNAME}",
      "password": "${CONFIRM8_PASSWORD}"
    },
    "enabled": true
  }
}
```

**Tipos de Integração:**
- `EVOLUTION` - WhatsApp Business API
- `RDSTATION` - CRM RD Station
- `CONFIRM8` - Gestão Empresarial
- `WEBHOOK` - Webhook Genérico
- `SLACK` - Slack
- `EMAIL` - Servidor SMTP

### 8. Agentes

```json
"agents": {
  "llm-automation": {
    "id": "llm-automation",
    "name": "Automation Agent",
    "description": "Agente de automação inteligente",
    "enabled": true,
    "version": "1.0.0",
    "tags": ["automation", "nlp"],
    "capabilities": {
      "nlp": true,
      "toolUse": true,
      "multiStep": true
    },
    "routing": {
      "keywords": ["automatizar", "criar", "agendar"],
      "priority": 10,
      "minConfidence": 0.7
    },
    "mcp": {
      "optional": ["openai"],
      "preference": "cloud",
      "fallback": true
    }
  }
}
```

### 9. Ferramentas

```json
"tools": {
  "file-reader": {
    "id": "file-reader",
    "name": "File Reader",
    "category": "file",
    "enabled": true,
    "parameters": {
      "path": {
        "type": "string",
        "required": true
      }
    },
    "constraints": {
      "allowedPaths": ["/data"],
      "allowedExtensions": [".txt", ".md", ".json"]
    }
  }
}
```

## Variáveis de Ambiente

Use `${NOME_VARIAVEL}` no JSON para referenciar variáveis de ambiente:

```json
"credentials": {
  "token": "${EVOLUTION_TOKEN}",
  "apiKey": "${OPENAI_API_KEY}"
}
```

## Hot Reload

O sistema suporta hot reload de configuração. Configure no sistema:

```json
"system": {
  "hotReload": true
}
```

Quando o arquivo `system-config.json` for modificado, o sistema recarrega automaticamente.

## Validação

O sistema valida o JSON na inicialização:

```bash
# Validar configuração
npx chatias validate config/system-config.json
```

## Exemplo Completo

Veja o arquivo `config/system-config.example.json` para um exemplo completo e funcional.

## Inicialização

```typescript
import { createSystem } from '@chatias/core';

const system = await createSystem({
  configPath: './config/system-config.json',
  enableMultiTenant: true
});

// Pronto! Todas as configurações foram carregadas do JSON
```

## Resumo

| Funcionalidade | Configurado via JSON? |
|----------------|----------------------|
| Empresas | ✅ Sim |
| Departamentos | ✅ Sim |
| Sub-departamentos | ✅ Sim |
| Níveis de acesso | ✅ Sim |
| Follow-ups | ✅ Sim |
| Automações | ✅ Sim |
| Integrações | ✅ Sim |
| Agentes | ✅ Sim |
| Ferramentas | ✅ Sim |
| Workflows | ✅ Sim |
| Knowledge Base | ✅ Sim |
| Multi-tenant | ✅ Sim |

**Tudo é configurável via JSON. Sem necessidade de código.**
