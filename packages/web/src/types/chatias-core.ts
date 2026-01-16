// Stub types for @chatias/core to allow frontend build

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
  departmentId?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export const PLAN_LIMITS = {
  free: { agents: 2, apiCalls: 1000, storage: 100 },
  starter: { agents: 5, apiCalls: 10000, storage: 1000 },
  professional: { agents: 20, apiCalls: 100000, storage: 10000 },
  enterprise: { agents: -1, apiCalls: -1, storage: -1 }
};

export class TenantRegistry {
  createTenant(data: { name: string; slug?: string; plan?: TenantPlan }) {
    return {
      id: `tenant_${Date.now()}`,
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
      plan: data.plan || 'starter',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  getTenant(id: string) { return null; }
  getTenantBySlug(slug: string) { return null; }
  listTenants() { return []; }
}
