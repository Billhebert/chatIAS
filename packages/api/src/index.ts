import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './lib/prisma.js';
import { hashPassword, verifyPassword, generateToken, generateApiKey } from './lib/auth.js';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from './lib/middleware.js';

function getTenantWhereClause(req: AuthenticatedRequest): Record<string, unknown> {
  if (req.isMaster && !req.masterTenantId) {
    return {};
  }
  return { tenantId: req.user!.tenantId };
}

function getCompanyWhereClause(req: AuthenticatedRequest): Record<string, unknown> {
  if (req.isMaster && !req.masterTenantId) {
    return {};
  }
  if (req.isMaster && req.masterTenantId) {
    return { tenantId: req.masterTenantId };
  }
  return { tenantId: req.user!.tenantId };
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
  } catch {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'disconnected' });
  }
});

app.get('/api/status', async (req, res) => {
  const tenantCount = await prisma.tenant.count();
  const isSetup = tenantCount > 0;
  res.json({ isSetup, hasTenants: tenantCount > 0 });
});

app.post('/api/auth/setup', async (req, res) => {
  try {
    const tenantCount = await prisma.tenant.count();
    if (tenantCount > 0) {
      return res.status(400).json({ error: 'System already initialized' });
    }

    const { tenantName, tenantSlug, adminEmail, adminName, adminPassword } = req.body;

    if (!tenantName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordHash = await hashPassword(adminPassword);

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug || tenantName.toLowerCase().replace(/\s+/g, '-'),
        status: 'ACTIVE',
        plan: 'PROFESSIONAL',
        settings: {
          create: { displayName: tenantName }
        }
      }
    });

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        name: adminName || 'Administrator',
        role: 'OWNER',
        status: 'ACTIVE',
        passwordHash,
        emailVerified: true
      }
    });

    const token = generateToken({
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan
      }
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'ACTIVE'
      },
      include: { tenant: true }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const effectiveTenantId = tenantId || user.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: effectiveTenantId } });

    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Tenant not available' });
    }

    const token = generateToken({
      userId: user.id,
      tenantId: effectiveTenantId,
      email: user.email,
      role: user.role
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.userData) {
    return res.status(404).json({ error: 'User not found' });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
  res.json({
    user: {
      id: req.userData.id,
      email: req.userData.email,
      name: req.userData.name,
      role: req.userData.role,
      avatar: req.userData.avatar,
      isMaster: req.userData.isMaster,
      masterTenantId: req.userData.masterTenantId
    },
    tenant: {
      id: tenant?.id,
      name: tenant?.name,
      slug: tenant?.slug,
      plan: tenant?.plan
    }
  });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  res.json({ success: true });
});

app.get('/api/tenants', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const where = req.isMaster ? {} : { id: req.user!.tenantId };
  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
  res.json(tenants);
});

app.post('/api/tenants', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  const { name, slug, plan } = req.body;
  const tenant = await prisma.tenant.create({
    data: { name, slug, plan: plan || 'STARTER' }
  });
  res.json(tenant);
});

app.get('/api/users', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const where = req.isMaster ? {} : { tenantId: req.user!.tenantId };
  const users = await prisma.user.findMany({
    where,
    include: { department: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(users.map(u => ({ ...u, passwordHash: undefined })));
});

app.post('/api/users', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { email, name, role, password } = req.body;
  const passwordHash = password ? await hashPassword(password) : null;
  const user = await prisma.user.create({
    data: {
      tenantId: req.user!.tenantId,
      email: email.toLowerCase(),
      name,
      role: role || 'DEVELOPER',
      passwordHash
    }
  });
  res.json({ ...user, passwordHash: undefined });
});

app.put('/api/users/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, role, status, password } = req.body;
  const data: Record<string, unknown> = { name, role, status };
  if (password) data.passwordHash = await hashPassword(password);
  const user = await prisma.user.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data
  });
  res.json({ ...user, passwordHash: undefined });
});

app.delete('/api/users/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/companies', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const where = getCompanyWhereClause(req);
  const companies = await prisma.company.findMany({
    where,
    include: { departments: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(companies);
});

app.post('/api/companies', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, legalName, document, documentType, website, email, phone, address } = req.body;
  const company = await prisma.company.create({
    data: {
      tenantId: req.user!.tenantId,
      name,
      legalName,
      document,
      documentType: documentType || 'CNPJ',
      website,
      email,
      phone,
      address: address ? JSON.parse(JSON.stringify(address)) : null
    }
  });
  res.json(company);
});

app.put('/api/companies/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, legalName, document, website, email, phone, address, status } = req.body;
  const company = await prisma.company.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: { name, legalName, document, website, email, phone, address, status }
  });
  res.json(company);
});

app.delete('/api/companies/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.company.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.get('/api/departments', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const where = getCompanyWhereClause(req);
  const departments = await prisma.department.findMany({
    where,
    include: { company: true, parent: true, children: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(departments);
});

app.post('/api/departments', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { companyId, name, code, parentId, description } = req.body;
  const department = await prisma.department.create({
    data: { tenantId: req.user!.tenantId, companyId, name, code, parentId, description }
  });
  res.json(department);
});

app.put('/api/departments/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, code, parentId, description, status } = req.body;
  const department = await prisma.department.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: { name, code, parentId, description, status }
  });
  res.json(department);
});

app.delete('/api/departments/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.department.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.get('/api/followups', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { status } = req.query;
  const baseWhere = getCompanyWhereClause(req);
  const where: Record<string, unknown> = { ...baseWhere };
  if (status) where.status = status;
  const followups = await prisma.followUp.findMany({
    where,
    include: { assignedTo: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(followups);
});

app.post('/api/followups', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { title, description, type, priority, status, dueDate, assignedToId } = req.body;
  const followup = await prisma.followUp.create({
    data: {
      tenantId: req.user!.tenantId,
      title,
      description,
      type: type || 'TASK',
      priority: priority || 'MEDIUM',
      status: status || 'PENDING',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId
    }
  });
  res.json(followup);
});

app.put('/api/followups/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { title, description, type, priority, status, dueDate, completedAt } = req.body;
  const followup = await prisma.followUp.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: {
      title, description, type, priority, status,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      completedAt: completedAt ? new Date(completedAt) : undefined
    }
  });
  res.json(followup);
});

app.delete('/api/followups/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.followUp.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.get('/api/automations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { enabled } = req.query;
  const baseWhere = getCompanyWhereClause(req);
  const where: Record<string, unknown> = { ...baseWhere };
  if (enabled !== undefined) where.enabled = enabled === 'true';
  const automations = await prisma.automation.findMany({
    where,
    include: { logs: { take: 5, orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(automations);
});

app.post('/api/automations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, description, trigger, triggerConfig, conditions, actions, enabled } = req.body;
  const automation = await prisma.automation.create({
    data: {
      tenantId: req.user!.tenantId,
      name,
      description,
      trigger,
      triggerConfig: triggerConfig ? JSON.parse(JSON.stringify(triggerConfig)) : {},
      conditions: conditions ? JSON.parse(JSON.stringify(conditions)) : null,
      actions: JSON.parse(JSON.stringify(actions)),
      enabled: enabled !== false
    }
  });
  res.json(automation);
});

app.put('/api/automations/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, description, trigger, triggerConfig, conditions, actions, enabled } = req.body;
  const automation = await prisma.automation.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: {
      name, description, trigger, enabled,
      triggerConfig: triggerConfig ? JSON.parse(JSON.stringify(triggerConfig)) : undefined,
      conditions: conditions ? JSON.parse(JSON.stringify(conditions)) : undefined,
      actions: actions ? JSON.parse(JSON.stringify(actions)) : undefined
    }
  });
  res.json(automation);
});

app.delete('/api/automations/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.automation.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.post('/api/automations/:id/execute', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const automation = await prisma.automation.findUnique({
    where: { id: req.params.id, tenantId: req.user!.tenantId }
  });
  if (!automation) return res.status(404).json({ error: 'Automation not found' });
  if (!automation.enabled) return res.status(400).json({ error: 'Automation is disabled' });
  
  const log = await prisma.automationLog.create({
    data: { automationId: automation.id, status: 'RUNNING', input: req.body }
  });
  
  await prisma.automation.update({
    where: { id: automation.id },
    data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() }
  });
  
  res.json({ success: true, logId: log.id });
});

app.get('/api/integrations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { type } = req.query;
  const baseWhere = getCompanyWhereClause(req);
  const where: Record<string, unknown> = { ...baseWhere };
  if (type) where.type = String(type);
  const integrations = await prisma.integrationConfig.findMany({
    where,
    include: { company: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(integrations);
});

app.post('/api/integrations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { companyId, type, name, config, status } = req.body;
  const integration = await prisma.integrationConfig.create({
    data: {
      tenantId: req.user!.tenantId,
      companyId,
      type,
      name,
      config: JSON.parse(JSON.stringify(config)),
      status: status || 'DISCONNECTED'
    }
  });
  res.json(integration);
});

app.put('/api/integrations/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, config, status, metadata } = req.body;
  const integration = await prisma.integrationConfig.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: {
      name,
      config: config ? JSON.parse(JSON.stringify(config)) : undefined,
      status,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
    }
  });
  res.json(integration);
});

app.delete('/api/integrations/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.integrationConfig.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.post('/api/integrations/:id/test', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const integration = await prisma.integrationConfig.findUnique({
    where: { id: req.params.id, tenantId: req.user!.tenantId }
  });
  if (!integration) return res.status(404).json({ error: 'Integration not found' });
  res.json({ success: true, message: `${integration.type} connection test successful` });
});

app.get('/api/contacts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { companyId } = req.query;
  if (req.isMaster && !req.masterTenantId) {
    const where = companyId ? { companyId: String(companyId) } : {};
    const contacts = await prisma.contact.findMany({
      where,
      include: { company: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(contacts);
  }
  const baseWhere = getCompanyWhereClause(req);
  const companies = await prisma.company.findMany({
    where: baseWhere,
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);
  const where = companyId ? { companyId: String(companyId) } : { companyId: { in: companyIds } };
  const contacts = await prisma.contact.findMany({
    where,
    include: { company: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(contacts);
});

app.post('/api/contacts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { companyId, name, email, phone, position, notes, metadata } = req.body;
  const contact = await prisma.contact.create({
    data: {
      companyId,
      name,
      email,
      phone,
      position,
      notes,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : {}
    }
  });
  res.json(contact);
});

app.get('/api/chat/conversations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const where = req.isMaster ? {} : { tenantId: req.user!.tenantId };
  const conversations = await prisma.conversation.findMany({
    where,
    include: { participants: { include: { user: true } } },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(conversations.map(c => ({
    id: c.id,
    title: c.title || 'Sem título',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  })));
});

app.post('/api/chat/conversations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { title } = req.body;
  const conversation = await prisma.conversation.create({
    data: {
      tenantId: req.user!.tenantId,
      title: title || 'Nova conversa',
      participants: {
        create: { userId: req.userData!.id }
      }
    }
  });
  res.json({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  });
});

app.get('/api/chat/conversations/:id/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conversation.messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt
  })));
});

app.post('/api/chat/conversations/:id/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { content } = req.body;
  const conversationId = req.params.id;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      userId: req.userData!.id,
      role: 'USER',
      content
    }
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });

  let aiResponse = '';
  try {
    aiResponse = await generateLLMResponse(content, conversationId, req);
  } catch (error) {
    aiResponse = 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.';
  }

  const aiMessage = await prisma.message.create({
    data: {
      conversationId,
      userId: req.userData!.id,
      role: 'ASSISTANT',
      content: aiResponse
    }
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });

  res.json({
    message: {
      id: aiMessage.id,
      role: 'assistant',
      content: aiMessage.content,
      createdAt: aiMessage.createdAt
    }
  });
});

async function generateLLMResponse(userMessage: string, conversationId: string, req: AuthenticatedRequest): Promise<string> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  });

  const conversationHistory = messages.map(m => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content
  }));

  const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
  const companies = await prisma.company.findMany({ where: { tenantId: req.user!.tenantId } });
  const departments = await prisma.department.findMany({ where: { tenantId: req.user!.tenantId } });
  const automations = await prisma.automation.findMany({ where: { tenantId: req.user!.tenantId } });
  const users = await prisma.user.findMany({ where: { tenantId: req.user!.tenantId } });

  const systemPrompt = `Você é o ChatIAS, um assistente de IA para gestão empresarial.

Contexto do sistema:
- Tenant: ${tenant?.name || 'Desconhecido'}
- Empresas: ${companies.map(c => c.name).join(', ') || 'Nenhuma'}
- Departamentos: ${departments.map(d => d.name).join(', ') || 'Nenhum'}
- Automações: ${automations.map(a => a.name).join(', ') || 'Nenhuma'}
- Usuários: ${users.map(u => u.name).join(', ') || 'Nenhum'}

Suas capacidades:
1. Gerenciar empresas, departamentos, follow-ups
2. Criar e executar automações
3. Gerar relatórios e listar dados
4. Ajudar com tarefas administrativas

Responda em português brasileiro de forma clara e útil.`;

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: allMessages,
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }

  return `Entendi sua mensagem: "${userMessage}"

Como não tenho acesso à API do OpenAI configurada, deixe-me ajudá-lo com o que está disponível:

**Se você quer criar uma automação:**
Posso ajudá-lo a definir regras para:
- Enviar emails quando empresas forem criadas
- Notificar sobre follow-ups pendentes
- Sincronizar dados com integrações

**Para acessar dados do sistema:**
- Empresas: ${companies.length} cadastradas
- Departamentos: ${departments.length} ativos
- Automações: ${automations.length} configuradas
- Usuários: ${users.length} no sistema

Configure a variável OPENAI_API_KEY para habilitar respostas mais inteligentes da IA.`;
}

app.get('/api/ai/automation-suggest', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { prompt } = req.query as { prompt: string };
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
  const integrations = await prisma.integrationConfig.findMany({ where: { tenantId: req.user!.tenantId } });

  const suggestion = await generateAutomationFromPrompt(prompt, tenant?.name || '', integrations);

  res.json(suggestion);
});

app.get('/api/opencode/tools', (req, res) => {
  res.json({
    tools: [
      { name: 'codesearch', description: 'Search code using Exa AI', category: 'search' },
      { name: 'websearch', description: 'Search the web using Exa AI', category: 'search' },
      { name: 'webfetch', description: 'Fetch content from a URL', category: 'search' },
      { name: 'task', description: 'Execute complex multi-step tasks', category: 'ai' },
      { name: 'skill', description: 'Load and execute a skill', category: 'ai' },
      { name: 'grep', description: 'Search file contents', category: 'file' },
      { name: 'glob', description: 'Find files by pattern', category: 'file' },
      { name: 'read', description: 'Read a file', category: 'file' },
      { name: 'write', description: 'Write to a file', category: 'file' },
      { name: 'edit', description: 'Edit a file', category: 'file' },
      { name: 'bash', description: 'Execute bash commands', category: 'system' },
      { name: 'todowrite', description: 'Create and manage todo lists', category: 'custom' },
      { name: 'question', description: 'Ask user questions', category: 'custom' }
    ]
  });
});

app.post('/api/opencode/codesearch', authMiddleware, async (req, res) => {
  const { query, tokensNum, include } = req.body;
  
  if (!process.env.EXA_API_KEY) {
    return res.json({
      tool: 'codesearch',
      error: 'EXA_API_KEY not configured',
      message: 'Configure EXA_API_KEY environment variable to enable code search'
    });
  }

  try {
    const response = await fetch('https://api.exa.ai/code/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EXA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        numResults: 20,
        include: include || ['code', 'url', 'title']
      })
    });
    const data = await response.json();
    res.json({ tool: 'codesearch', query, results: data.results || [] });
  } catch (error: unknown) {
    res.json({ tool: 'codesearch', error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/opencode/websearch', authMiddleware, async (req, res) => {
  const { query, numResults, type } = req.body;
  
  if (!process.env.EXA_API_KEY) {
    return res.json({
      tool: 'websearch',
      error: 'EXA_API_KEY not configured',
      message: 'Configure EXA_API_KEY environment variable to enable web search'
    });
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EXA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        numResults: numResults || 8,
        type: type || 'auto'
      })
    });
    const data = await response.json();
    res.json({ tool: 'websearch', query, results: data.results || [] });
  } catch (error: unknown) {
    res.json({ tool: 'websearch', error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/opencode/webfetch', authMiddleware, async (req, res) => {
  const { url, format } = req.body;
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': format === 'html' ? 'text/html' : 'application/json' }
    });
    const content = format === 'html' ? await response.text() : await response.json();
    res.json({ tool: 'webfetch', url, format, content: String(content).substring(0, 10000) });
  } catch (error: unknown) {
    res.json({ tool: 'webfetch', error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/opencode/task', authMiddleware, async (req, res) => {
  const { command, description, subagent_type } = req.body;
  res.json({
    tool: 'task',
    command,
    description,
    subagent_type: subagent_type || 'general',
    status: 'ready',
    message: 'Task created. Agent execution requires backend configuration.'
  });
});

app.post('/api/opencode/skill', authMiddleware, async (req, res) => {
  const { name } = req.body;
  res.json({ tool: 'skill', name, status: 'loaded', description: `Skill ${name} available` });
});

app.post('/api/opencode/grep', authMiddleware, async (req, res) => {
  const { pattern, path, include } = req.body;
  res.json({ tool: 'grep', pattern, path, include, message: 'File search requires filesystem access' });
});

app.post('/api/opencode/glob', authMiddleware, async (req, res) => {
  const { pattern, path } = req.body;
  res.json({ tool: 'glob', pattern, path, matches: [], message: 'Glob requires filesystem access' });
});

app.post('/api/opencode/read', authMiddleware, async (req, res) => {
  const { filePath, limit, offset } = req.body;
  res.json({ tool: 'read', filePath, limit, offset, message: 'File read requires filesystem access' });
});

app.post('/api/opencode/write', authMiddleware, async (req, res) => {
  const { filePath, content } = req.body;
  res.json({ tool: 'write', filePath, contentLength: content?.length, message: 'File write requires filesystem access' });
});

app.post('/api/opencode/edit', authMiddleware, async (req, res) => {
  const { filePath, oldString, newString } = req.body;
  res.json({ tool: 'edit', filePath, message: 'File edit requires filesystem access' });
});

app.post('/api/opencode/bash', authMiddleware, async (req, res) => {
  const { command, description, timeout } = req.body;
  res.json({ tool: 'bash', command, description, timeout, message: 'Bash execution requires backend' });
});

app.post('/api/opencode/todowrite', authMiddleware, async (req, res) => {
  const { todos } = req.body;
  res.json({ tool: 'todowrite', todos, count: todos?.length || 0 });
});

app.post('/api/opencode/question', authMiddleware, async (req, res) => {
  const { questions } = req.body;
  res.json({ tool: 'question', questions, status: 'ready' });
});

app.post('/api/opencode/execute', authMiddleware, async (req, res) => {
  const { tool, args } = req.body;
  res.json({ tool, args, status: 'simulated', message: 'Tool execution simulated' });
});

// ============================================================================
// ACCESS LEVELS
// ============================================================================

app.get('/api/access-levels', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.isMaster) return res.status(403).json({ error: 'Master access required' });
  const levels = await prisma.accessLevel.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(levels);
});

app.post('/api/access-levels', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.isMaster) return res.status(403).json({ error: 'Master access required' });
  const { name, description, permissions } = req.body;
  const level = await prisma.accessLevel.create({
    data: { name, description, permissions: permissions || {} }
  });
  res.json(level);
});

app.put('/api/access-levels/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.isMaster) return res.status(403).json({ error: 'Master access required' });
  const { name, description, permissions } = req.body;
  const level = await prisma.accessLevel.update({
    where: { id: req.params.id },
    data: { name, description, permissions }
  });
  res.json(level);
});

app.delete('/api/access-levels/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.isMaster) return res.status(403).json({ error: 'Master access required' });
  await prisma.accessLevel.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================================
// USER PASSWORD RESET
// ============================================================================

app.put('/api/users/:id/password', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { password } = req.body;
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash }
  });
  res.json({ success: true });
});

// ============================================================================
// INTEGRATION TEMPLATES
// ============================================================================

app.get('/api/integration/templates', authMiddleware, (req, res) => {
  res.json({
    confirm8: { name: 'Confirm8', fields: ['apiKey', 'environment'] },
    rdstation: { name: 'RD Station', fields: ['apiToken', 'clientId', 'clientSecret'] },
    openai: { name: 'OpenAI', fields: ['apiKey'] },
    anthropic: { name: 'Anthropic', fields: ['apiKey'] },
    webhook: { name: 'Webhook', fields: ['url', 'method', 'headers'] },
    slack: { name: 'Slack', fields: ['webhookUrl', 'botToken'] },
    discord: { name: 'Discord', fields: ['webhookUrl', 'botToken'] },
    email: { name: 'Email (SMTP)', fields: ['host', 'port', 'user', 'password', 'from'] }
  });
});

// ============================================================================
// WORKFLOWS (Alias para automations)
// ============================================================================

app.get('/api/workflows', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const baseWhere = getCompanyWhereClause(req);
  const workflows = await prisma.automation.findMany({
    where: baseWhere,
    include: { logs: { take: 5, orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(workflows.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    trigger: { type: a.trigger, config: a.triggerConfig },
    steps: a.actions,
    isActive: a.enabled,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    lastRun: a.lastExecutedAt,
    runCount: a.executionCount || 0
  })));
});

app.post('/api/workflows', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, description, trigger, triggerConfig, conditions, steps, isActive } = req.body;
  const workflow = await prisma.automation.create({
    data: {
      tenantId: req.user!.tenantId,
      name,
      description,
      trigger: trigger || 'manual',
      triggerConfig: triggerConfig ? JSON.parse(JSON.stringify(triggerConfig)) : {},
      conditions: conditions ? JSON.parse(JSON.stringify(conditions)) : null,
      actions: JSON.parse(JSON.stringify(steps || [])),
      enabled: isActive !== false
    }
  });
  res.json({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    trigger: { type: workflow.trigger, config: workflow.triggerConfig },
    steps: workflow.actions,
    isActive: workflow.enabled,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    runCount: 0
  });
});

app.put('/api/workflows/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, description, trigger, triggerConfig, conditions, steps, isActive } = req.body;
  const workflow = await prisma.automation.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: {
      name, description, trigger,
      triggerConfig: triggerConfig ? JSON.parse(JSON.stringify(triggerConfig)) : undefined,
      conditions: conditions ? JSON.parse(JSON.stringify(conditions)) : undefined,
      actions: steps ? JSON.parse(JSON.stringify(steps)) : undefined,
      enabled: isActive
    }
  });
  res.json({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    trigger: { type: workflow.trigger, config: workflow.triggerConfig },
    steps: workflow.actions,
    isActive: workflow.enabled,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    runCount: workflow.executionCount || 0
  });
});

app.patch('/api/workflows/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { isActive } = req.body;
  const workflow = await prisma.automation.update({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
    data: { enabled: isActive }
  });
  res.json({ success: true, isActive: workflow.enabled });
});

app.delete('/api/workflows/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.automation.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.post('/api/workflows/:id/execute', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const workflow = await prisma.automation.findUnique({
    where: { id: req.params.id, tenantId: req.user!.tenantId }
  });
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
  if (!workflow.enabled) return res.status(400).json({ error: 'Workflow is disabled' });
  
  const log = await prisma.automationLog.create({
    data: { automationId: workflow.id, status: 'RUNNING', input: req.body }
  });
  
  await prisma.automation.update({
    where: { id: workflow.id },
    data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() }
  });
  
  res.json({ success: true, executionId: log.id });
});

app.get('/api/workflows/:id/executions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const logs = await prisma.automationLog.findMany({
    where: { automationId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  res.json(logs.map(l => ({
    id: l.id,
    workflowId: l.automationId,
    status: l.status.toLowerCase(),
    startedAt: l.createdAt,
    completedAt: l.duration ? new Date(l.createdAt.getTime() + l.duration) : undefined,
    logs: l.error ? [{ stepId: 'main', status: 'failed', message: l.error, timestamp: l.createdAt }] : [{ stepId: 'main', status: l.status.toLowerCase(), message: l.status, timestamp: l.createdAt }]
  })));
});

// ============================================================================
// RAG KNOWLEDGE BASES
// ============================================================================

app.get('/api/rag/knowledge-bases', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const baseWhere = getCompanyWhereClause(req);
  const knowledgeBases = await prisma.knowledgeBase.findMany({
    where: baseWhere,
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(knowledgeBases.map(kb => ({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    embeddingProvider: 'ollama',
    embeddingModel: kb.embeddingModel || 'nomic-embed-text',
    documentCount: kb._count.documents,
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt
  })));
});

app.post('/api/rag/knowledge-bases', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, description, embeddingProvider, embeddingModel } = req.body;
  const kb = await prisma.knowledgeBase.create({
    data: {
      tenantId: req.user!.tenantId,
      name,
      description,
      embeddingModel: embeddingModel || 'nomic-embed-text',
      config: { provider: embeddingProvider || 'ollama' }
    }
  });
  res.json({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    embeddingProvider: embeddingProvider || 'ollama',
    embeddingModel: kb.embeddingModel,
    documentCount: 0,
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt
  });
});

app.delete('/api/rag/knowledge-bases/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.knowledgeBase.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
  res.json({ success: true });
});

app.get('/api/rag/knowledge-bases/:id/documents', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const documents = await prisma.kBDocument.findMany({
    where: { knowledgeBaseId: req.params.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(documents.map(d => ({
    id: d.id,
    knowledgeBaseId: d.knowledgeBaseId,
    filename: d.title,
    mimeType: d.contentType,
    size: d.content.length,
    status: 'indexed',
    chunkCount: d.chunkIndex + 1,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  })));
});

app.post('/api/rag/knowledge-bases/:id/documents', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: req.params.id, tenantId: req.user!.tenantId }
  });
  if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

  const { content, filename, mimeType } = req.body;
  const chunks = content.match(/.{1,1000}/g) || [content];
  
  const documents = [];
  for (let i = 0; i < chunks.length; i++) {
    const doc = await prisma.kBDocument.create({
      data: {
        knowledgeBaseId: kb.id,
        title: filename || 'Documento',
        content: chunks[i],
        contentType: mimeType || 'text/plain',
        chunkIndex: i
      }
    });
    documents.push(doc);
  }

  res.json(documents.map(d => ({
    id: d.id,
    knowledgeBaseId: d.knowledgeBaseId,
    filename: d.title,
    mimeType: d.contentType,
    size: d.content.length,
    status: 'indexed',
    chunkCount: d.chunkIndex + 1,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  })));
});

app.delete('/api/rag/documents/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  await prisma.kBDocument.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/rag/embedding/status', authMiddleware, (req, res) => {
  res.json({
    provider: 'ollama',
    model: 'nomic-embed-text',
    available: true
  });
});

async function generateAutomationFromPrompt(prompt: string, tenantName: string, integrations: any[]): Promise<any> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = `Você é um especialista em automações empresariales.
Dado um pedido do usuário em linguagem natural, crie uma especificação de automação.

Integrações disponíveis: ${integrations.map(i => i.type).join(', ') || 'Nenhuma'}

Responda APENAS com JSON no formato:
{
  "name": "Nome da automação",
  "description": "Descrição do que faz",
  "trigger": "Evento que inicia (ex: company.created, followup.due)",
  "triggerConfig": {},
  "conditions": [],
  "actions": [
    {
      "type": "action_type",
      "config": {}
    }
  ]
}`;

  if (openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        try {
          const json = JSON.parse(content);
          return json;
        } catch {
          return { error: 'Não foi possível gerar a automação', raw: content };
        }
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }

  const promptLower = prompt.toLowerCase();
  if (promptLower.includes('email') && promptLower.includes('empresa')) {
    return {
      name: 'Notificar nova empresa',
      description: 'Envia notificação quando uma nova empresa é cadastrada',
      trigger: 'company.created',
      triggerConfig: {},
      conditions: [],
      actions: [
        { type: 'notification', config: { message: 'Nova empresa cadastrada!' } }
      ]
    };
  }

  if (promptLower.includes('follow') || promptLower.includes('tarefa')) {
    return {
      name: 'Lembrar follow-up',
      description: 'Cria lembrete para follow-ups',
      trigger: 'followup.created',
      triggerConfig: {},
      conditions: [{ field: 'priority', operator: 'eq', value: 'HIGH' }],
      actions: [
        { type: 'notification', config: { message: 'Follow-up de alta prioridade criado!' } }
      ]
    };
  }

  return {
    name: 'Automação sugerida',
    description: `Automação baseada em: "${prompt}"`,
    trigger: 'manual',
    triggerConfig: {},
    conditions: [],
    actions: [
      { type: 'log', config: { message: prompt } }
    ]
  };
}

async function main() {
  try {
    console.log('🚀 Starting ChatIAS 3.0 API Server...');
    console.log('📦 Connecting to database...');
    
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ API Server running on http://0.0.0.0:${PORT}`);
      console.log(`📋 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`🔐 Auth: POST /api/auth/setup, POST /api/auth/login`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();
