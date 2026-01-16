/**
 * Follow-Up and Automation Services for ChatIAS 3.0
 * 
 * Native implementation of:
 * - Follow-Up Management (Tasks, Meetings, Reminders)
 * - Automation Engine (Triggers, Actions, Workflows)
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// FOLLOW-UP SERVICE
// ============================================================================

export interface FollowUp {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  dueDate?: Date;
  completedAt?: Date;
  assignedToId?: string;
  assignedTo?: UserSummary;
  relatedContactId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  department?: string;
}

export type FollowUpType = 'TASK' | 'MEETING' | 'CALL' | 'EMAIL' | 'DEADLINE' | 'REMINDER' | 'CUSTOM';
export type FollowUpPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

export interface CreateFollowUpInput {
  title: string;
  description?: string;
  type: FollowUpType;
  priority?: FollowUpPriority;
  dueDate?: Date;
  assignedToId?: string;
  relatedContactId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateFollowUpInput extends Partial<CreateFollowUpInput> {
  status?: FollowUpStatus;
}

export class FollowUpService extends EventEmitter {
  private followUps: Map<string, FollowUp> = new Map();
  private byTenant: Map<string, Set<string>> = new Map();
  private byAssignedTo: Map<string, Set<string>> = new Map();
  private byStatus: Map<string, Set<string>> = new Map();

  constructor() {
    super();
  }

  async create(tenantId: string, input: CreateFollowUpInput): Promise<FollowUp> {
    const id = uuidv4();
    const now = new Date();

    const followUp: FollowUp = {
      id,
      tenantId,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority || 'MEDIUM',
      status: 'PENDING',
      dueDate: input.dueDate,
      assignedToId: input.assignedToId,
      relatedContactId: input.relatedContactId,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now
    };

    this.followUps.set(id, followUp);

    // Index by tenant
    if (!this.byTenant.has(tenantId)) {
      this.byTenant.set(tenantId, new Set());
    }
    this.byTenant.get(tenantId)!.add(id);

    // Index by assignedTo
    if (input.assignedToId) {
      if (!this.byAssignedTo.has(input.assignedToId)) {
        this.byAssignedTo.set(input.assignedToId, new Set());
      }
      this.byAssignedTo.get(input.assignedToId)!.add(id);
    }

    // Index by status
    if (!this.byStatus.has('PENDING')) {
      this.byStatus.set('PENDING', new Set());
    }
    this.byStatus.get('PENDING')!.add(id);

    this.emit('followup:created', { followUp });
    return followUp;
  }

  async findById(id: string): Promise<FollowUp | null> {
    return this.followUps.get(id) || null;
  }

  async findByTenant(tenantId: string, options?: {
    status?: FollowUpStatus;
    assignedToId?: string;
    priority?: FollowUpPriority;
    type?: FollowUpType;
    limit?: number;
    offset?: number;
  }): Promise<FollowUp[]> {
    let followUpIds = this.byTenant.get(tenantId);
    if (!followUpIds) return [];

    let results = Array.from(followUpIds)
      .map(id => this.followUps.get(id)!)
      .filter(Boolean);

    // Apply filters
    if (options?.status) {
      results = results.filter(f => f.status === options.status);
    }
    if (options?.assignedToId) {
      results = results.filter(f => f.assignedToId === options.assignedToId);
    }
    if (options?.priority) {
      results = results.filter(f => f.priority === options.priority);
    }
    if (options?.type) {
      results = results.filter(f => f.type === options.type);
    }

    // Sort by priority and due date
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    results.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate!.getTime() - b.dueDate!.getTime();
    });

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async update(id: string, input: UpdateFollowUpInput): Promise<FollowUp> {
    const followUp = this.followUps.get(id);
    if (!followUp) {
      throw new Error(`FollowUp not found: ${id}`);
    }

    // Update status index
    if (input.status && input.status !== followUp.status) {
      this.byStatus.get(followUp.status)?.delete(id);
      if (!this.byStatus.has(input.status)) {
        this.byStatus.set(input.status, new Set());
      }
      this.byStatus.get(input.status)!.add(id);
    }

    // Update assignedTo index
    if (input.assignedToId && input.assignedToId !== followUp.assignedToId) {
      this.byAssignedTo.get(followUp.assignedToId!)?.delete(id);
      if (!this.byAssignedTo.has(input.assignedToId)) {
        this.byAssignedTo.set(input.assignedToId, new Set());
      }
      this.byAssignedTo.get(input.assignedToId)!.add(id);
    }

    const updated: FollowUp = {
      ...followUp,
      ...input,
      updatedAt: new Date()
    };

    this.followUps.set(id, updated);
    this.emit('followup:updated', { followUp: updated, changes: input });
    return updated;
  }

  async complete(id: string): Promise<FollowUp> {
    return this.update(id, {
      status: 'COMPLETED',
      completedAt: new Date()
    });
  }

  async cancel(id: string): Promise<FollowUp> {
    return this.update(id, { status: 'CANCELLED' });
  }

  async delete(id: string): Promise<void> {
    const followUp = this.followUps.get(id);
    if (!followUp) {
      throw new Error(`FollowUp not found: ${id}`);
    }

    this.followUps.delete(id);
    this.byTenant.get(followUp.tenantId)?.delete(id);
    if (followUp.assignedToId) {
      this.byAssignedTo.get(followUp.assignedToId)?.delete(id);
    }
    this.byStatus.get(followUp.status)?.delete(id);

    this.emit('followup:deleted', { followUpId: id });
  }

  async getOverdue(tenantId: string): Promise<FollowUp[]> {
    const now = new Date();
    return this.findByTenant(tenantId, { status: 'PENDING' })
      .then(followUps => followUps.filter(f => 
        f.dueDate && f.dueDate < now && f.status === 'PENDING'
      ));
  }

  async markOverdue(): Promise<void> {
    const now = new Date();
    for (const [id, followUp] of this.followUps) {
      if (followUp.dueDate && followUp.dueDate < now && followUp.status === 'PENDING') {
        await this.update(id, { status: 'OVERDUE' });
      }
    }
  }

  getStatistics(tenantId: string): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    byPriority: Record<string, number>;
  } {
    const followUps = this.byTenant.has(tenantId) 
      ? Array.from(this.byTenant.get(tenantId)!)
          .map(id => this.followUps.get(id)!)
          .filter(Boolean)
      : [];

    const now = new Date();
    const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };

    followUps.forEach(f => {
      byPriority[f.priority]++;
    });

    return {
      total: followUps.length,
      pending: followUps.filter(f => f.status === 'PENDING').length,
      inProgress: followUps.filter(f => f.status === 'IN_PROGRESS').length,
      completed: followUps.filter(f => f.status === 'COMPLETED').length,
      overdue: followUps.filter(f => f.status === 'OVERDUE' || 
        (f.dueDate && f.dueDate < now && f.status === 'PENDING')).length,
      byPriority
    };
  }

  clear(): void {
    this.followUps.clear();
    this.byTenant.clear();
    this.byAssignedTo.clear();
    this.byStatus.clear();
  }
}

// ============================================================================
// AUTOMATION SERVICE
// ============================================================================

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  triggerConfig: Record<string, any>;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  config: Record<string, any>;
  order: number;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  userId?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
  createdAt: Date;
}

export type AutomationTrigger = 'SCHEDULE' | 'EVENT' | 'WEBHOOK' | 'MANUAL' | 'CONDITION_MET' | 'DATA_CHANGE';
export type AutomationActionType = 
  | 'SEND_MESSAGE' | 'SEND_EMAIL' | 'CREATE_TASK' | 'UPDATE_FIELD' 
  | 'CALL_WEBHOOK' | 'RUN_AGENT' | 'SEND_NOTIFICATION' 
  | 'SCHEDULE_FOLLOWUP' | 'UPDATE_CONTACT' | 'CREATE_DEAL' | 'CUSTOM';

export interface CreateAutomationInput {
  name: string;
  description?: string;
  trigger: {
    type: AutomationTrigger;
    config: Record<string, any>;
  };
  conditions?: AutomationCondition[];
  actions: Omit<AutomationAction, 'id'>[];
  enabled?: boolean;
}

export interface AutomationExecutor {
  execute(action: AutomationAction, context: Record<string, any>): Promise<Record<string, any>>;
}

export class AutomationService extends EventEmitter {
  private automations: Map<string, Automation> = new Map();
  private logs: Map<string, AutomationLog[]> = new Map();
  private byTenant: Map<string, Set<string>> = new Map();
  private byTrigger: Map<string, Set<string>> = new Map();
  private executors: Map<AutomationActionType, AutomationExecutor> = new Map();
  private cronJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.registerDefaultExecutors();
  }

  private registerDefaultExecutors(): void {
    // Send Message Executor
    this.executors.set('SEND_MESSAGE', {
      async execute(action, context) {
        console.log(`[Automation] Sending message:`, action.config);
        return { success: true, messageId: uuidv4() };
      }
    });

    // Send Email Executor
    this.executors.set('SEND_EMAIL', {
      async execute(action, context) {
        console.log(`[Automation] Sending email:`, action.config);
        return { success: true, emailId: uuidv4() };
      }
    });

    // Create Task Executor
    this.executors.set('CREATE_TASK', {
      async execute(action, context) {
        console.log(`[Automation] Creating task:`, action.config);
        return { success: true, taskId: uuidv4() };
      }
    });

    // Call Webhook Executor
    this.executors.set('CALL_WEBHOOK', {
      async execute(action, context) {
        console.log(`[Automation] Calling webhook:`, action.config);
        return { success: true, status: 200 };
      }
    });

    // Send Notification Executor
    this.executors.set('SEND_NOTIFICATION', {
      async execute(action, context) {
        console.log(`[Automation] Sending notification:`, action.config);
        return { success: true };
      }
    });

    // Create FollowUp Executor
    this.executors.set('SCHEDULE_FOLLOWUP', {
      async execute(action, context) {
        console.log(`[Automation] Scheduling follow-up:`, action.config);
        return { success: true, followUpId: uuidv4() };
      }
    });
  }

  registerExecutor(type: AutomationActionType, executor: AutomationExecutor): void {
    this.executors.set(type, executor);
  }

  async create(tenantId: string, input: CreateAutomationInput): Promise<Automation> {
    const id = uuidv4();
    const now = new Date();

    const automation: Automation = {
      id,
      tenantId,
      name: input.name,
      description: input.description,
      trigger: input.trigger.type,
      triggerConfig: input.trigger.config,
      conditions: input.conditions,
      actions: input.actions.map((a, i) => ({ ...a, id: uuidv4(), order: i })),
      enabled: input.enabled !== false,
      executionCount: 0,
      createdAt: now,
      updatedAt: now
    };

    this.automations.set(id, automation);

    // Index by tenant
    if (!this.byTenant.has(tenantId)) {
      this.byTenant.set(tenantId, new Set());
    }
    this.byTenant.get(tenantId)!.add(id);

    // Index by trigger
    const triggerKey = `${tenantId}:${input.trigger.type}`;
    if (!this.byTrigger.has(triggerKey)) {
      this.byTrigger.set(triggerKey, new Set());
    }
    this.byTrigger.get(triggerKey)!.add(id);

    // Start schedule if needed
    if (automation.enabled && automation.trigger === 'SCHEDULE') {
      this.startSchedule(automation);
    }

    this.emit('automation:created', { automation });
    return automation;
  }

  private startSchedule(automation: Automation): void {
    const cron = automation.triggerConfig.cron;
    if (!cron) return;

    // Simple interval-based scheduling (in production, use cron-parser)
    const interval = this.parseCronToMs(cron);
    if (!interval) return;

    const jobId = automation.id;
    const job = setInterval(() => {
      this.execute(automation.id);
    }, interval);

    this.cronJobs.set(jobId, job);
  }

  private parseCronToMs(cron: string): number | null {
    // Simple parser for common patterns
    const patterns: Record<string, number> = {
      '* * * * *': 60000,        // Every minute
      '0 * * * *': 3600000,      // Every hour
      '0 0 * * *': 86400000,     // Every day
      '0 0 * * 1': 86400000 * 7, // Every week
    };

    return patterns[cron] || null;
  }

  async findById(id: string): Promise<Automation | null> {
    return this.automations.get(id) || null;
  }

  async findByTenant(tenantId: string): Promise<Automation[]> {
    const automationIds = this.byTenant.get(tenantId);
    if (!automationIds) return [];
    
    return Array.from(automationIds)
      .map(id => this.automations.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByTrigger(tenantId: string, trigger: AutomationTrigger): Promise<Automation[]> {
    const triggerKey = `${tenantId}:${trigger}`;
    const automationIds = this.byTrigger.get(triggerKey);
    if (!automationIds) return [];
    
    return Array.from(automationIds)
      .map(id => this.automations.get(id)!)
      .filter(a => a.enabled);
  }

  async update(id: string, data: Partial<CreateAutomationInput>): Promise<Automation> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation not found: ${id}`);
    }

    // Stop existing schedule
    if (this.cronJobs.has(id)) {
      clearInterval(this.cronJobs.get(id)!);
      this.cronJobs.delete(id);
    }

    const updated: Automation = {
      ...automation,
      ...data,
      trigger: data.trigger?.type || automation.trigger,
      triggerConfig: data.trigger?.config || automation.triggerConfig,
      conditions: data.conditions ?? automation.conditions,
      actions: data.actions 
        ? data.actions.map((a, i) => ({ ...a, id: uuidv4(), order: i }))
        : automation.actions,
      updatedAt: new Date()
    };

    this.automations.set(id, updated);

    // Start new schedule if enabled
    if (updated.enabled && updated.trigger === 'SCHEDULE') {
      this.startSchedule(updated);
    }

    this.emit('automation:updated', { automation: updated, changes: data });
    return updated;
  }

  async toggle(id: string): Promise<Automation> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation not found: ${id}`);
    }

    if (automation.enabled) {
      // Disable
      if (this.cronJobs.has(id)) {
        clearInterval(this.cronJobs.get(id)!);
        this.cronJobs.delete(id);
      }
      await this.update(id, { enabled: false });
    } else {
      // Enable
      await this.update(id, { enabled: true });
    }

    return this.automations.get(id)!;
  }

  async execute(id: string, context: Record<string, any> = {}, userId?: string): Promise<AutomationLog> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation not found: ${id}`);
    }

    if (!automation.enabled) {
      throw new Error(`Automation is disabled: ${id}`);
    }

    const log: AutomationLog = {
      id: uuidv4(),
      automationId: id,
      userId,
      status: 'RUNNING',
      input: context,
      createdAt: new Date()
    };

    if (!this.logs.has(id)) {
      this.logs.set(id, []);
    }
    this.logs.get(id)!.unshift(log);

    const startTime = Date.now();

    try {
      // Check conditions
      if (automation.conditions && automation.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(automation.conditions, context);
        if (!conditionsMet) {
          log.status = 'CANCELLED';
          log.duration = Date.now() - startTime;
          this.emit('automation:skipped', { automation, log });
          return log;
        }
      }

      // Execute actions
      const results: Record<string, any> = {};
      for (const action of automation.actions.sort((a, b) => a.order - b.order)) {
        const executor = this.executors.get(action.type);
        if (executor) {
          results[action.id] = await executor.execute(action, { ...context, ...results });
        } else {
          console.warn(`[Automation] No executor for action type: ${action.type}`);
        }
      }

      log.status = 'SUCCESS';
      log.output = results;
      log.duration = Date.now() - startTime;

      // Update automation
      automation.executionCount++;
      automation.lastExecutedAt = new Date();
      this.automations.set(id, automation);

      this.emit('automation:executed', { automation, log });

    } catch (error: any) {
      log.status = 'FAILED';
      log.error = error.message;
      log.duration = Date.now() - startTime;

      this.emit('automation:failed', { automation, log, error });
    }

    return log;
  }

  private evaluateConditions(conditions: AutomationCondition[], context: Record<string, any>): boolean {
    for (const condition of conditions) {
      const value = this.getValueByPath(context, condition.field);
      let result = false;

      switch (condition.operator) {
        case 'equals':
          result = value === condition.value;
          break;
        case 'not_equals':
          result = value !== condition.value;
          break;
        case 'contains':
          result = String(value).includes(condition.value);
          break;
        case 'greater_than':
          result = Number(value) > Number(condition.value);
          break;
        case 'less_than':
          result = Number(value) < Number(condition.value);
          break;
        case 'exists':
          result = value !== undefined && value !== null;
          break;
        case 'not_exists':
          result = value === undefined || value === null;
          break;
      }

      if (condition.logic === 'OR') {
        if (result) return true;
      } else {
        if (!result) return false;
      }
    }
    return true;
  }

  private getValueByPath(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async getLogs(automationId: string, limit = 100): Promise<AutomationLog[]> {
    return (this.logs.get(automationId) || []).slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation not found: ${id}`);
    }

    if (this.cronJobs.has(id)) {
      clearInterval(this.cronJobs.get(id)!);
      this.cronJobs.delete(id);
    }

    this.automations.delete(id);
    this.byTenant.get(automation.tenantId)?.delete(id);
    this.logs.delete(id);

    this.emit('automation:deleted', { automationId: id });
  }

  getStatistics(tenantId: string): {
    total: number;
    enabled: number;
    totalExecutions: number;
    recentFailures: number;
  } {
    const automations = this.findByTenant(tenantId);
    const recentFailures = Array.from(this.logs.values())
      .flat()
      .filter(log => {
        const automation = this.automations.get(log.automationId);
        return automation?.tenantId === tenantId && 
               log.status === 'FAILED' &&
               log.createdAt.getTime() > Date.now() - 86400000; // Last 24h
      }).length;

    return {
      total: automations.length,
      enabled: automations.filter(a => a.enabled).length,
      totalExecutions: automations.reduce((acc, a) => acc + a.executionCount, 0),
      recentFailures
    };
  }

  clear(): void {
    for (const job of this.cronJobs.values()) {
      clearInterval(job);
    }
    this.automations.clear();
    this.logs.clear();
    this.byTenant.clear();
    this.byTrigger.clear();
    this.cronJobs.clear();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createFollowUpService(): FollowUpService {
  return new FollowUpService();
}

export function createAutomationService(): AutomationService {
  return new AutomationService();
}
