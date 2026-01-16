import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const existingTenant = await prisma.tenant.findFirst();
  if (existingTenant) {
    console.log('⚠️  Database already has data, skipping seed');
    return;
  }

  console.log('Creating default tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      id: 'default-tenant',
      name: 'Demo Company',
      slug: 'demo',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL'
    }
  });

  console.log('Creating default company...');
  const company = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo Corp',
      legalName: 'Demo Corporation',
      document: '12345678000100',
      documentType: 'CNPJ',
      website: 'https://democorp.com',
      email: 'contato@democorp.com',
      phone: '+55 11 99999-9999',
      address: {
        street: 'Av. Paulista',
        number: '1000',
        city: 'São Paulo',
        state: 'SP',
        zip: '01310-100',
        country: 'Brasil'
      }
    }
  });

  console.log('Creating departments...');
  const salesDept = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Sales',
      code: 'SALES',
      description: 'Sales and business development team'
    }
  });

  const supportDept = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Support',
      code: 'SUPPORT',
      description: 'Customer support and success team'
    }
  });

  console.log('Creating default admin user...');
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      name: 'Admin User',
      role: 'OWNER',
      status: 'ACTIVE',
      departmentId: salesDept.id,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      emailVerified: true
    }
  });

  console.log('Creating sample follow-ups...');
  await prisma.followUp.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: 'Welcome to ChatIAS 3.0',
        description: 'This is a sample follow-up to get you started with the platform. Explore the dashboard and start creating your own workflows!',
        type: 'TASK',
        priority: 'HIGH',
        status: 'PENDING',
        assignedToId: adminUser.id
      },
      {
        tenantId: tenant.id,
        title: 'Schedule quarterly review',
        description: 'Review automation performance and metrics for Q1',
        type: 'MEETING',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        tenantId: tenant.id,
        title: 'Contact potential leads',
        description: 'Follow up with leads from the last campaign',
        type: 'CALL',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        assignedToId: adminUser.id
      }
    ]
  });

  console.log('Creating sample automations...');
  await prisma.automation.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Welcome Message',
        description: 'Sends a welcome message to new users',
        trigger: 'user.created',
        triggerConfig: {},
        conditions: Prisma.JsonNull,
        actions: [
          { type: 'send_message', config: { message: 'Welcome to ChatIAS! We are happy to have you here.' } }
        ],
        enabled: true,
        executionCount: 0
      },
      {
        tenantId: tenant.id,
        name: 'High Priority Alert',
        description: 'Sends notification for high priority follow-ups',
        trigger: 'followup.created',
        triggerConfig: { priority: 'HIGH' },
        conditions: [{ field: 'priority', operator: 'equals', value: 'HIGH' }],
        actions: [
          { type: 'create_notification', config: { title: 'High Priority Task', channel: 'email' } }
        ],
        enabled: true,
        executionCount: 0
      },
      {
        tenantId: tenant.id,
        name: 'Daily Summary',
        description: 'Sends daily summary of activities',
        trigger: 'schedule.daily',
        triggerConfig: { time: '09:00' },
        conditions: Prisma.JsonNull,
        actions: [
          { type: 'generate_report', config: { type: 'daily_summary' } }
        ],
        enabled: true,
        executionCount: 0
      }
    ]
  });

  console.log('Creating sample integration...');
  await prisma.integrationConfig.create({
    data: {
      tenantId: tenant.id,
      companyId: company.id,
      type: 'EVOLUTION',
      name: 'WhatsApp Integration',
      config: {
        baseUrl: 'https://evolution-api.example.com',
        instanceName: 'chatias',
        enabled: true
      },
      status: 'DISCONNECTED',
      metadata: {
        description: 'Integration with Evolution API for WhatsApp messaging',
        features: ['send_message', 'receive_message', 'groups']
      }
    }
  });

  console.log('Creating sample contacts...');
  await prisma.contact.createMany({
    data: [
      {
        companyId: company.id,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+55 11 98888-8888',
        position: 'CEO',
        notes: 'Key decision maker'
      },
      {
        companyId: company.id,
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+55 11 97777-7777',
        position: 'CTO',
        notes: 'Technical contact'
      }
    ]
  });

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📋 Default login credentials:');
  console.log('   Email: admin@demo.com');
  console.log('');
  console.log('🔗 API Endpoints:');
  console.log('   GET  /api/stats - View system statistics');
  console.log('   POST /api/seed - Re-run this seed script');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
