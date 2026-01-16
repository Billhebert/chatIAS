/**
 * Database Layer for ChatIAS 3.0
 * 
 * This module provides a unified database interface using Prisma ORM.
 * Supports PostgreSQL with multi-tenant isolation.
 */

import { PrismaClient, Prisma, Tenant, User, Conversation, Message } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// PRISMA CLIENT
// ============================================================================

let prismaClient: PrismaClient | null = null;

/**
 * Get or create Prisma client singleton
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error']
    });
  }
  return prismaClient;
}

/**
 * Close Prisma client connection
 */
export async function closePrismaClient(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

// ============================================================================
// TENANT REPOSITORY
// ============================================================================

export class TenantRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(data: {
    name: string;
    slug?: string;
    plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  }): Promise<Tenant> {
    return await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug || this.generateSlug(data.name),
        plan: data.plan || 'STARTER'
      }
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { id }
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { slug }
    });
  }

  async list(options?: {
    status?: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';
    plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
    limit?: number;
    offset?: number;
  }): Promise<Tenant[]> {
    const where: Prisma.TenantWhereInput = {};
    
    if (options?.status) where.status = options.status;
    if (options?.plan) where.plan = options.plan;

    return await this.prisma.tenant.findMany({
      where,
      take: options?.limit || 100,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: Prisma.TenantUpdateInput): Promise<Tenant> {
    return await this.prisma.tenant.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);
  }
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

export class UserRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    email: string;
    name: string;
    role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';
    departmentId?: string;
  }): Promise<User> {
    return await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role || 'DEVELOPER',
        departmentId: data.departmentId
      }
    });
  }

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase() }
    });
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async listByDepartment(tenantId: string, departmentId: string): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: { tenantId, departmentId },
      orderBy: { name: 'asc' }
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
}

// ============================================================================
// COMPANY REPOSITORY
// ============================================================================

export class CompanyRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    name: string;
    legalName?: string;
    document?: string;
    documentType?: 'CNPJ' | 'CPF' | 'PASSPORT' | 'OTHER';
    website?: string;
    email?: string;
    phone?: string;
    address?: any;
  }): Promise<any> {
    return await this.prisma.company.create({
      data: {
        tenantId,
        name: data.name,
        legalName: data.legalName,
        document: data.document,
        documentType: data.documentType || 'OTHER',
        website: data.website,
        email: data.email,
        phone: data.phone,
        address: data.address
      }
    });
  }

  async findById(id: string): Promise<any | null> {
    return await this.prisma.company.findUnique({
      where: { id },
      include: {
        departments: true,
        contacts: true
      }
    });
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return await this.prisma.company.findMany({
      where: { tenantId },
      include: {
        departments: true,
        _count: {
          select: { contacts: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async update(id: string, data: any): Promise<any> {
    return await this.prisma.company.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({ where: { id } });
  }
}

// ============================================================================
// DEPARTMENT REPOSITORY
// ============================================================================

export class DepartmentRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    name: string;
    companyId?: string;
    parentId?: string;
    code?: string;
    description?: string;
    managerId?: string;
  }): Promise<any> {
    return await this.prisma.department.create({
      data: {
        tenantId,
        name: data.name,
        companyId: data.companyId,
        parentId: data.parentId,
        code: data.code,
        description: data.description,
        managerId: data.managerId
      }
    });
  }

  async findById(id: string): Promise<any | null> {
    return await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true
      }
    });
  }

  async findByTenant(tenantId: string, options?: {
    companyId?: string;
    parentId?: string | null;
  }): Promise<any[]> {
    const where: any = { tenantId };
    if (options?.companyId) where.companyId = options.companyId;
    if (options?.parentId !== undefined) where.parentId = options.parentId;

    return await this.prisma.department.findMany({
      where,
      include: {
        parent: true,
        children: true,
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async getTree(tenantId: string): Promise<any[]> {
    const all = await this.prisma.department.findMany({
      where: { tenantId },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { users: true }
        }
      }
    });

    const buildTree = (parentId: string | null): any[] => {
      return all
        .filter(d => d.parentId === parentId)
        .map(d => ({
          ...d,
          children: buildTree(d.id)
        }));
    };

    return buildTree(null);
  }

  async update(id: string, data: any): Promise<any> {
    return await this.prisma.department.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.department.delete({ where: { id } });
  }
}

// ============================================================================
// FOLLOW-UP REPOSITORY
// ============================================================================

export class FollowUpRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    title: string;
    description?: string;
    type: 'TASK' | 'MEETING' | 'CALL' | 'EMAIL' | 'DEADLINE' | 'REMINDER' | 'CUSTOM';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate?: Date;
    assignedToId?: string;
  }): Promise<any> {
    return await this.prisma.followUp.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority || 'MEDIUM',
        dueDate: data.dueDate,
        assignedToId: data.assignedToId
      },
      include: {
        assignedTo: true
      }
    });
  }

  async findById(id: string): Promise<any | null> {
    return await this.prisma.followUp.findUnique({
      where: { id },
      include: {
        assignedTo: true
      }
    });
  }

  async findByTenant(tenantId: string, options?: {
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
    assignedToId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const where: any = { tenantId };
    if (options?.status) where.status = options.status;
    if (options?.assignedToId) where.assignedToId = options.assignedToId;
    if (options?.priority) where.priority = options.priority;

    return await this.prisma.followUp.findMany({
      where,
      include: {
        assignedTo: true
      },
      take: options?.limit || 100,
      skip: options?.offset || 0,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' }
      ]
    });
  }

  async update(id: string, data: any): Promise<any> {
    return await this.prisma.followUp.update({
      where: { id },
      data,
      include: {
        assignedTo: true
      }
    });
  }

  async complete(id: string): Promise<any> {
    return await this.prisma.followUp.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.followUp.delete({ where: { id } });
  }
}

// ============================================================================
// AUTOMATION REPOSITORY
// ============================================================================

export class AutomationRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    name: string;
    description?: string;
    trigger: string;
    triggerConfig?: any;
    conditions?: any[];
    actions: any[];
  }): Promise<any> {
    return await this.prisma.automation.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        triggerConfig: data.triggerConfig || {},
        conditions: data.conditions,
        actions: data.actions
      }
    });
  }

  async findById(id: string): Promise<any | null> {
    return await this.prisma.automation.findUnique({
      where: { id },
      include: {
        logs: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return await this.prisma.automation.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { logs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByTrigger(tenantId: string, trigger: string): Promise<any[]> {
    return await this.prisma.automation.findMany({
      where: { tenantId, trigger, enabled: true }
    });
  }

  async update(id: string, data: any): Promise<any> {
    return await this.prisma.automation.update({
      where: { id },
      data
    });
  }

  async execute(id: string, userId: string | undefined, input: any): Promise<any> {
    const automation = await this.findById(id);
    if (!automation) throw new Error('Automation not found');

    const log = await this.prisma.automationLog.create({
      data: {
        automationId: id,
        userId,
        status: 'RUNNING',
        input
      }
    });

    try {
      // Execute actions (simplified - real implementation would process each action)
      const output = { executed: true, actions: automation.actions, timestamp: new Date() };

      await this.prisma.automation.update({
        where: { id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date()
        }
      });

      await this.prisma.automationLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          output
        }
      });

      return log;
    } catch (error: any) {
      await this.prisma.automationLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          error: error.message
        }
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.automation.delete({ where: { id } });
  }
}

// ============================================================================
// INTEGRATION CONFIG REPOSITORY
// ============================================================================

export class IntegrationConfigRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    type: 'EVOLUTION' | 'RDSTATION' | 'CONFIRM8' | 'WEBHOOK' | 'SLACK' | 'DISCORD' | 'EMAIL' | 'CUSTOM';
    name: string;
    config: any;
    companyId?: string;
  }): Promise<any> {
    return await this.prisma.integrationConfig.create({
      data: {
        tenantId,
        type: data.type,
        name: data.name,
        config: data.config,
        companyId: data.companyId
      }
    });
  }

  async findById(id: string): Promise<any | null> {
    return await this.prisma.integrationConfig.findUnique({
      where: { id }
    });
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return await this.prisma.integrationConfig.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
  }

  async findByType(tenantId: string, type: string): Promise<any | null> {
    return await this.prisma.integrationConfig.findFirst({
      where: { tenantId, type }
    });
  }

  async update(id: string, data: any): Promise<any> {
    return await this.prisma.integrationConfig.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: string, status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING'): Promise<any> {
    return await this.prisma.integrationConfig.update({
      where: { id },
      data: { status, lastSyncAt: new Date() }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.integrationConfig.delete({ where: { id } });
  }
}

// ============================================================================
// CONVERSATION REPOSITORY
// ============================================================================

export class ConversationRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    title?: string;
    participantIds?: string[];
  }): Promise<Conversation> {
    return await this.prisma.conversation.create({
      data: {
        tenantId,
        title: data.title,
        participants: data.participantIds ? {
          create: data.participantIds.map(userId => ({
            userId,
            role: 'MEMBER'
          }))
        } : undefined
      },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async findById(id: string): Promise<Conversation | null> {
    return await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async listByTenant(tenantId: string, options?: {
    status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const where: Prisma.ConversationWhereInput = { tenantId };
    if (options?.status) where.status = options.status;

    return await this.prisma.conversation.findMany({
      where,
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    await this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId,
        role: 'MEMBER'
      }
    });
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await this.prisma.conversationParticipant.deleteMany({
      where: {
        conversationId,
        userId
      }
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'ARCHIVED' | 'DELETED'): Promise<void> {
    await this.prisma.conversation.update({
      where: { id },
      data: { status }
    });
  }
}

// ============================================================================
// MESSAGE REPOSITORY
// ============================================================================

export class MessageRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(conversationId: string, data: {
    userId?: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
    content: string;
    contentType?: 'TEXT' | 'MARKDOWN' | 'CODE' | 'JSON' | 'HTML';
    metadata?: Record<string, any>;
  }): Promise<Message> {
    return await this.prisma.message.create({
      data: {
        conversationId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        contentType: data.contentType || 'TEXT',
        metadata: data.metadata || {}
      }
    });
  }

  async findByConversation(conversationId: string, options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: { conversationId },
      take: options?.limit || 100,
      skip: options?.offset || 0,
      orderBy: { createdAt: options?.orderBy === 'asc' ? 'asc' : 'desc' },
      include: {
        user: true
      }
    });
  }

  async getLastMessage(conversationId: string): Promise<Message | null> {
    return await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });
  }
}

// ============================================================================
// USAGE REPOSITORY
// ============================================================================

export class UsageRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async recordUsage(tenantId: string, data: {
    apiCalls?: number;
    storageBytes?: bigint;
    agentExecutions?: number;
    toolExecutions?: number;
    messages?: number;
    automationRuns?: number;
  }): Promise<void> {
    const periodStart = new Date();
    periodStart.setDate(1);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.usageRecord.upsert({
      where: {
        tenantId_periodStart: {
          tenantId,
          periodStart
        }
      },
      create: {
        tenantId,
        periodStart,
        periodEnd,
        apiCalls: data.apiCalls || 0,
        storageBytes: data.storageBytes || 0n,
        agentExecutions: data.agentExecutions || 0,
        toolExecutions: data.toolExecutions || 0,
        messages: data.messages || 0,
        automationRuns: data.automationRuns || 0,
        apiLimit: 10000,
        storageLimit: 1073741824n
      },
      update: {
        apiCalls: { increment: data.apiCalls || 0 },
        storageBytes: { increment: data.storageBytes || 0n },
        agentExecutions: { increment: data.agentExecutions || 0 },
        toolExecutions: { increment: data.toolExecutions || 0 },
        messages: { increment: data.messages || 0 },
        automationRuns: { increment: data.automationRuns || 0 }
      }
    });
  }

  async getCurrentUsage(tenantId: string): Promise<{
    apiCalls: number;
    storageBytes: bigint;
    agentExecutions: number;
    toolExecutions: number;
    messages: number;
    automationRuns: number;
  } | null> {
    const periodStart = new Date();
    periodStart.setDate(1);

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        tenantId_periodStart: {
          tenantId,
          periodStart
        }
      }
    });

    return record ? {
      apiCalls: record.apiCalls,
      storageBytes: record.storageBytes,
      agentExecutions: record.agentExecutions,
      toolExecutions: record.toolExecutions,
      messages: record.messages,
      automationRuns: record.automationRuns
    } : null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PrismaClient, Prisma } from '@prisma/client';

export function createTenantRepository(): TenantRepository {
  return new TenantRepository();
}

export function createUserRepository(): UserRepository {
  return new UserRepository();
}

export function createCompanyRepository(): CompanyRepository {
  return new CompanyRepository();
}

export function createDepartmentRepository(): DepartmentRepository {
  return new DepartmentRepository();
}

export function createFollowUpRepository(): FollowUpRepository {
  return new FollowUpRepository();
}

export function createAutomationRepository(): AutomationRepository {
  return new AutomationRepository();
}

export function createIntegrationConfigRepository(): IntegrationConfigRepository {
  return new IntegrationConfigRepository();
}

export function createConversationRepository(): ConversationRepository {
  return new ConversationRepository();
}

export function createMessageRepository(): MessageRepository {
  return new MessageRepository();
}

export function createUsageRepository(): UsageRepository {
  return new UsageRepository();
}
  return prismaClient;
}

/**
 * Close Prisma client connection
 */
export async function closePrismaClient(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

// ============================================================================
// TENANT REPOSITORY
// ============================================================================

export class TenantRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(data: {
    name: string;
    slug?: string;
    plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  }): Promise<Tenant> {
    return await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug || this.generateSlug(data.name),
        plan: data.plan || 'STARTER'
      }
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { id }
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { slug }
    });
  }

  async list(options?: {
    status?: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';
    plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
    limit?: number;
    offset?: number;
  }): Promise<Tenant[]> {
    const where: Prisma.TenantWhereInput = {};
    
    if (options?.status) where.status = options.status;
    if (options?.plan) where.plan = options.plan;

    return await this.prisma.tenant.findMany({
      where,
      take: options?.limit || 100,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: Prisma.TenantUpdateInput): Promise<Tenant> {
    return await this.prisma.tenant.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);
  }
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

export class UserRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    email: string;
    name: string;
    role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';
  }): Promise<User> {
    return await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role || 'DEVELOPER'
      }
    });
  }

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase() }
    });
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
}

// ============================================================================
// CONVERSATION REPOSITORY
// ============================================================================

export class ConversationRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(tenantId: string, data: {
    title?: string;
    participantIds?: string[];
  }): Promise<Conversation> {
    return await this.prisma.conversation.create({
      data: {
        tenantId,
        title: data.title,
        participants: data.participantIds ? {
          create: data.participantIds.map(userId => ({
            userId,
            role: 'MEMBER'
          }))
        } : undefined
      },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async findById(id: string): Promise<Conversation | null> {
    return await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async listByTenant(tenantId: string, options?: {
    status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const where: Prisma.ConversationWhereInput = { tenantId };
    if (options?.status) where.status = options.status;

    return await this.prisma.conversation.findMany({
      where,
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    await this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId,
        role: 'MEMBER'
      }
    });
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await this.prisma.conversationParticipant.deleteMany({
      where: {
        conversationId,
        userId
      }
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'ARCHIVED' | 'DELETED'): Promise<void> {
    await this.prisma.conversation.update({
      where: { id },
      data: { status }
    });
  }
}

// ============================================================================
// MESSAGE REPOSITORY
// ============================================================================

export class MessageRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(conversationId: string, data: {
    userId?: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
    content: string;
    contentType?: 'TEXT' | 'MARKDOWN' | 'CODE' | 'JSON' | 'HTML';
    metadata?: Record<string, any>;
  }): Promise<Message> {
    return await this.prisma.message.create({
      data: {
        conversationId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        contentType: data.contentType || 'TEXT',
        metadata: data.metadata || {}
      }
    });
  }

  async findByConversation(conversationId: string, options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: { conversationId },
      take: options?.limit || 100,
      skip: options?.offset || 0,
      orderBy: { createdAt: options?.orderBy === 'asc' ? 'asc' : 'desc' },
      include: {
        user: true
      }
    });
  }

  async getLastMessage(conversationId: string): Promise<Message | null> {
    return await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });
  }
}

// ============================================================================
// USAGE REPOSITORY
// ============================================================================

export class UsageRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async recordUsage(tenantId: string, data: {
    apiCalls?: number;
    storageBytes?: bigint;
    agentExecutions?: number;
    toolExecutions?: number;
    messages?: number;
  }): Promise<void> {
    const periodStart = new Date();
    periodStart.setDate(1); // First day of month
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.usageRecord.upsert({
      where: {
        tenantId_periodStart: {
          tenantId,
          periodStart
        }
      },
      create: {
        tenantId,
        periodStart,
        periodEnd,
        apiCalls: data.apiCalls || 0,
        storageBytes: data.storageBytes || 0n,
        agentExecutions: data.agentExecutions || 0,
        toolExecutions: data.toolExecutions || 0,
        messages: data.messages || 0
      },
      update: {
        apiCalls: { increment: data.apiCalls || 0 },
        storageBytes: { increment: data.storageBytes || 0n },
        agentExecutions: { increment: data.agentExecutions || 0 },
        toolExecutions: { increment: data.toolExecutions || 0 },
        messages: { increment: data.messages || 0 }
      }
    });
  }

  async getCurrentUsage(tenantId: string): Promise<{
    apiCalls: number;
    storageBytes: bigint;
    agentExecutions: number;
    toolExecutions: number;
    messages: number;
  } | null> {
    const periodStart = new Date();
    periodStart.setDate(1);

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        tenantId_periodStart: {
          tenantId,
          periodStart
        }
      }
    });

    return record ? {
      apiCalls: record.apiCalls,
      storageBytes: record.storageBytes,
      agentExecutions: record.agentExecutions,
      toolExecutions: record.toolExecutions,
      messages: record.messages
    } : null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PrismaClient, Prisma } from '@prisma/client';

export function createTenantRepository(): TenantRepository {
  return new TenantRepository();
}

export function createUserRepository(): UserRepository {
  return new UserRepository();
}

export function createConversationRepository(): ConversationRepository {
  return new ConversationRepository();
}

export function createMessageRepository(): MessageRepository {
  return new MessageRepository();
}

export function createUsageRepository(): UsageRepository {
  return new UsageRepository();
}