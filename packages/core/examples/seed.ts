/**
 * Seed Example - Demonstrates how to use the native enterprise services
 * 
 * This file shows how to:
 * - Create companies and departments with hierarchy
 * - Create follow-ups (tasks, meetings, calls, emails, deadlines)
 * - Create automations with triggers and actions
 * - Configure integrations (Evolution, RDStation, Confirm8)
 */

import {
  createCompanyService,
  createDepartmentService,
  createFollowUpService,
  createAutomationService,
  createIntegrationService
} from '../src/services/index.js';

import { Logger, createLogger } from '../src/observability/index.js';

const logger = createLogger({
  enabled: true,
  level: 'info',
  transports: [{ type: 'console', enabled: true }]
});

const TENANT_ID = 'tenant_default';

async function seed() {
  console.log('🌱 Starting seed process...\n');

  const companyService = createCompanyService(logger);
  const departmentService = createDepartmentService(logger);
  const followUpService = createFollowUpService(logger);
  const automationService = createAutomationService(logger);
  const integrationService = createIntegrationService(logger);

  // ========== 1. CREATE COMPANIES ==========
  console.log('🏢 Creating companies...');

  const company1 = await companyService.create(TENANT_ID, 'acme', {
    name: 'Acme Corporation',
    document: '12.345.678/0001-90',
    documentType: 'CNPJ',
    email: 'contato@acme.com',
    phone: '+55 11 99999-0000',
    address: {
      street: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      country: 'Brasil'
    },
    settings: {
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
      language: 'pt-BR'
    },
    metadata: {
      industry: 'Technology',
      size: 'medium'
    }
  });
  console.log('✅ Company created:', company1.name);

  const company2 = await companyService.create(TENANT_ID, 'globex', {
    name: 'Globex Inc',
    document: '98.765.432/0001-00',
    documentType: 'CNPJ',
    email: 'contato@globex.com',
    phone: '+55 21 98888-1111',
    address: {
      street: 'Av. Rio Branco, 500',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '20090-000',
      country: 'Brasil'
    }
  });
  console.log('✅ Company created:', company2.name);

  // ========== 2. CREATE DEPARTMENTS ==========
  console.log('\n🏛️ Creating departments...');

  const tiDept = await departmentService.create(TENANT_ID, 'ti', {
    name: 'Tecnologia da Informação',
    code: 'TI',
    companyId: company1.id,
    settings: {
      allowExternalAccess: false,
      notificationEmail: 'ti@acme.com'
    }
  });
  console.log('✅ Department created:', tiDept.name);

  const devDept = await departmentService.create(TENANT_ID, 'dev', {
    name: 'Desenvolvimento',
    code: 'DEV',
    parentId: tiDept.id,
    companyId: company1.id
  });
  console.log('✅ Sub-department created:', devDept.name);

  const frontendDept = await departmentService.create(TENANT_ID, 'frontend', {
    name: 'Frontend Team',
    code: 'FE',
    parentId: devDept.id,
    companyId: company1.id
  });
  console.log('✅ Sub-department created:', frontendDept.name);

  const vendasDept = await departmentService.create(TENANT_ID, 'vendas', {
    name: 'Vendas',
    code: 'VENDAS',
    companyId: company1.id
  });
  console.log('✅ Department created:', vendasDept.name);

  // List department tree
  console.log('\n📋 Department tree:');
  const rootDepts = await departmentService.listRoots(TENANT_ID);
  for (const dept of rootDepts) {
    console.log(`  - ${dept.name} (${dept.code})`);
    const children = await departmentService.listChildren(TENANT_ID, dept.id);
    for (const child of children) {
      console.log(`    - ${child.name} (${child.code})`);
      const subChildren = await departmentService.listChildren(TENANT_ID, child.id);
      for (const subChild of subChildren) {
        console.log(`      - ${subChild.name} (${subChild.code})`);
      }
    }
  }

  // ========== 3. CREATE FOLLOW-UPS ==========
  console.log('\n📌 Creating follow-ups...');

  const followUp1 = await followUpService.create(TENANT_ID, 'meeting_001', {
    title: 'Reunião de alinhamento com cliente',
    description: 'Discussão sobre requisitos do novo projeto',
    type: 'MEETING',
    priority: 'HIGH',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    assigneeId: 'user_123',
    companyId: company1.id,
    departmentId: vendasDept.id,
    metadata: {
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      attendees: ['client@acme.com', 'sales@acme.com']
    }
  });
  console.log('✅ Follow-up created:', followUp1.title);

  const followUp2 = await followUpService.create(TENANT_ID, 'call_001', {
    title: 'Ligação de follow-up',
    type: 'CALL',
    priority: 'MEDIUM',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    assigneeId: 'user_456',
    companyId: company2.id
  });
  console.log('✅ Follow-up created:', followUp2.title);

  const followUp3 = await followUpService.create(TENANT_ID, 'deadline_001', {
    title: 'Entrega do projeto',
    type: 'DEADLINE',
    priority: 'URGENT',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assigneeId: 'user_123',
    departmentId: devDept.id
  });
  console.log('✅ Follow-up created:', followUp3.title);

  // List follow-ups
  console.log('\n📋 Follow-ups list:');
  const allFollowUps = await followUpService.list(TENANT_ID);
  for (const fu of allFollowUps) {
    const dueDate = fu.dueDate ? new Date(fu.dueDate).toLocaleDateString() : 'N/A';
    console.log(`  - [${fu.priority}] ${fu.title} (${fu.type}) - Due: ${dueDate}`);
  }

  // ========== 4. CREATE AUTOMATIONS ==========
  console.log('\n⚡ Creating automations...');

  const automation1 = await automationService.create(TENANT_ID, 'welcome_new_lead', {
    name: 'Welcome New Lead',
    description: 'Send welcome message to new leads',
    enabled: true,
    trigger: {
      type: 'EVENT',
      config: {
        eventName: 'lead.created'
      }
    },
    conditions: [
      {
        field: 'source',
        operator: 'EQUALS',
        value: 'website'
      }
    ],
    actions: [
      {
        type: 'SEND_MESSAGE',
        config: {
          message: 'Olá! Seja bem-vindo ao nosso serviço. Como podemos ajudar você hoje?',
          channel: 'whatsapp'
        },
        order: 0
      },
      {
        type: 'CREATE_TASK',
        config: {
          title: 'Contact new lead',
          priority: 'MEDIUM',
          dueInDays: 1
        },
        order: 1
      },
      {
        type: 'SEND_NOTIFICATION',
        config: {
          title: 'New lead created',
          message: 'A new lead has been created from website',
          channel: 'email',
          recipients: ['sales@company.com']
        },
        order: 2
      }
    ],
    settings: {
      maxExecutions: 100,
      executionWindow: '24h'
    }
  });
  console.log('✅ Automation created:', automation1.name);

  const automation2 = await automationService.create(TENANT_ID, 'daily_summary', {
    name: 'Daily Summary Report',
    description: 'Send daily summary of activities',
    enabled: true,
    trigger: {
      type: 'SCHEDULE',
      config: {
        cronExpression: '0 9 * * 1-5',
        timezone: 'America/Sao_Paulo'
      }
    },
    actions: [
      {
        type: 'CALL_WEBHOOK',
        config: {
          url: 'https://api.company.com/reports/daily',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ${WEBHOOK_TOKEN}'
          }
        },
        order: 0
      }
    ]
  });
  console.log('✅ Automation created:', automation2.name);

  // List automations
  console.log('\n📋 Automations list:');
  const allAutomations = await automationService.list(TENANT_ID);
  for (const auto of allAutomations) {
    const status = auto.enabled ? '🟢' : '🔴';
    console.log(`  ${status} ${auto.name} - Trigger: ${auto.trigger.type}`);
  }

  // ========== 5. CREATE INTEGRATIONS ==========
  console.log('\n🔗 Creating integrations...');

  const evolutionIntegration = await integrationService.create(TENANT_ID, 'evolution_whatsapp', {
    name: 'WhatsApp Business',
    type: 'EVOLUTION',
    description: 'Evolution API for WhatsApp Business',
    enabled: true,
    credentials: {
      baseUrl: process.env.EVOLUTION_BASE_URL || 'https://api.evolution.example.com',
      token: process.env.EVOLUTION_TOKEN || 'your-token-here',
      instanceName: 'main'
    },
    settings: {
      messageDelay: 1000,
      retryAttempts: 3
    }
  });
  console.log('✅ Integration created:', evolutionIntegration.name);

  const rdStationIntegration = await integrationService.create(TENANT_ID, 'rdstation_crm', {
    name: 'RD Station CRM',
    type: 'RDSTATION',
    description: 'RD Station integration for CRM and marketing automation',
    enabled: true,
    credentials: {
      clientId: process.env.RDSTATION_CLIENT_ID || 'your-client-id',
      clientSecret: process.env.RDSTATION_CLIENT_SECRET || 'your-client-secret',
      accessToken: process.env.RDSTATION_ACCESS_TOKEN || 'your-access-token',
      refreshToken: process.env.RDSTATION_REFRESH_TOKEN || 'your-refresh-token'
    },
    settings: {
      syncInterval: 300,
      webhookUrl: 'https://your-domain.com/webhooks/rdstation'
    }
  });
  console.log('✅ Integration created:', rdStationIntegration.name);

  const confirm8Integration = await integrationService.create(TENANT_ID, 'confirm8_business', {
    name: 'Confirm8 Business',
    type: 'CONFIRM8',
    description: 'Confirm8 Business Management integration',
    enabled: true,
    credentials: {
      apiKey: process.env.CONFIRM8_API_KEY || 'your-api-key',
      companyId: process.env.CONFIRM8_COMPANY_ID || 'your-company-id'
    }
  });
  console.log('✅ Integration created:', confirm8Integration.name);

  // Test connections
  console.log('\n🔍 Testing connections...');
  const integrations = await integrationService.list(TENANT_ID);
  for (const integ of integrations) {
    const result = await integrationService.testConnection(integ.id);
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${integ.name}: ${result.message}`);
  }

  // List integrations
  console.log('\n📋 Integrations list:');
  for (const integ of integrations) {
    const status = integ.enabled ? '🟢' : '🔴';
    console.log(`  ${status} ${integ.name} (${integ.type})`);
  }

  console.log('\n✨ Seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - Companies: ${allFollowUps.length}`);
  console.log(`  - Departments: ${rootDepts.length} roots, ${allFollowUps.length - rootDepts.length} children`);
  console.log(`  - Follow-ups: ${allFollowUps.length}`);
  console.log(`  - Automations: ${allAutomations.length}`);
  console.log(`  - Integrations: ${integrations.length}`);
}

seed().catch(console.error);
