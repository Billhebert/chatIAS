/**
 * Enterprise Services for ChatIAS 3.0
 * 
 * Native implementation of enterprise features:
 * - Company Management
 * - Department Management  
 * - Follow-Up Management
 * - Automation Engine
 * - Integration Management
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// COMPANY SERVICE
// ============================================================================

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  legalName?: string;
  document?: string;
  documentType: 'CNPJ' | 'CPF' | 'PASSPORT' | 'OTHER';
  website?: string;
  email?: string;
  phone?: string;
  address?: Address;
  logo?: string;
  settings: CompanySettings;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface CompanySettings {
  defaultCurrency?: string;
  defaultTimezone?: string;
  businessHours?: BusinessHours;
  customFields?: Record<string, any>;
}

export interface BusinessHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  start?: string;
  end?: string;
}

export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface CreateCompanyInput {
  name: string;
  legalName?: string;
  document?: string;
  documentType?: 'CNPJ' | 'CPF' | 'PASSPORT' | 'OTHER';
  website?: string;
  email?: string;
  phone?: string;
  address?: Address;
  logo?: string;
  settings?: Partial<CompanySettings>;
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
  status?: CompanyStatus;
}

export class CompanyService extends EventEmitter {
  private companies: Map<string, Company> = new Map();
  private byTenant: Map<string, Set<string>> = new Map();
  private byDocument: Map<string, string> = new Map(); // document -> companyId

  constructor() {
    super();
  }

  async create(tenantId: string, input: CreateCompanyInput): Promise<Company> {
    const id = uuidv4();
    const now = new Date();

    const company: Company = {
      id,
      tenantId,
      name: input.name,
      legalName: input.legalName,
      document: input.document,
      documentType: input.documentType || 'OTHER',
      website: input.website,
      email: input.email,
      phone: input.phone,
      address: input.address,
      logo: input.logo,
      settings: {
        defaultCurrency: input.settings?.defaultCurrency || 'BRL',
        defaultTimezone: input.settings?.defaultTimezone || 'UTC',
        ...input.settings
      },
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    this.companies.set(id, company);
    
    // Index by tenant
    if (!this.byTenant.has(tenantId)) {
      this.byTenant.set(tenantId, new Set());
    }
    this.byTenant.get(tenantId)!.add(id);

    // Index by document
    if (input.document) {
      this.byDocument.set(input.document, id);
    }

    this.emit('company:created', { company });
    return company;
  }

  async findById(id: string): Promise<Company | null> {
    return this.companies.get(id) || null;
  }

  async findByTenant(tenantId: string): Promise<Company[]> {
    const companyIds = this.byTenant.get(tenantId);
    if (!companyIds) return [];
    
    return Array.from(companyIds)
      .map(id => this.companies.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findByDocument(document: string): Promise<Company | null> {
    const companyId = this.byDocument.get(document);
    if (!companyId) return null;
    return this.companies.get(companyId) || null;
  }

  async update(id: string, input: UpdateCompanyInput): Promise<Company> {
    const company = this.companies.get(id);
    if (!company) {
      throw new Error(`Company not found: ${id}`);
    }

    const updated: Company = {
      ...company,
      ...input,
      settings: { ...company.settings, ...input.settings },
      updatedAt: new Date()
    };

    this.companies.set(id, updated);

    // Update document index
    if (input.document && input.document !== company.document) {
      this.byDocument.delete(company.document!);
      this.byDocument.set(input.document, id);
    }

    this.emit('company:updated', { company: updated, changes: input });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const company = this.companies.get(id);
    if (!company) {
      throw new Error(`Company not found: ${id}`);
    }

    this.companies.delete(id);
    this.byTenant.get(company.tenantId)?.delete(id);
    if (company.document) {
      this.byDocument.delete(company.document);
    }

    this.emit('company:deleted', { companyId: id });
  }

  async suspend(id: string, reason?: string): Promise<Company> {
    return this.update(id, { 
      status: 'SUSPENDED',
      settings: { 
        customFields: { suspensionReason: reason, suspendedAt: new Date().toISOString() } 
      } 
    });
  }

  async activate(id: string): Promise<Company> {
    return this.update(id, { 
      status: 'ACTIVE',
      settings: { customFields: { suspendedAt: null, suspensionReason: null } } 
    });
  }

  getStatistics(tenantId: string): {
    total: number;
    active: number;
    suspended: number;
  } {
    const companies = this.findByTenant(tenantId);
    return {
      total: companies.length,
      active: companies.filter(c => c.status === 'ACTIVE').length,
      suspended: companies.filter(c => c.status === 'SUSPENDED').length
    };
  }

  clear(): void {
    this.companies.clear();
    this.byTenant.clear();
    this.byDocument.clear();
  }
}

// ============================================================================
// DEPARTMENT SERVICE
// ============================================================================

export interface Department {
  id: string;
  tenantId: string;
  companyId?: string;
  name: string;
  code?: string;
  parentId?: string;
  parent?: Department;
  children?: Department[];
  description?: string;
  managerId?: string;
  settings: DepartmentSettings;
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentSettings {
  budget?: number;
  costCenter?: string;
  customFields?: Record<string, any>;
}

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  parentId?: string;
  companyId?: string;
  description?: string;
  managerId?: string;
  settings?: Partial<DepartmentSettings>;
}

export interface UpdateDepartmentInput extends Partial<CreateDepartmentInput> {
  status?: DepartmentStatus;
}

export class DepartmentService extends EventEmitter {
  private departments: Map<string, Department> = new Map();
  private byTenant: Map<string, Set<string>> = new Map();
  private byCompany: Map<string, Set<string>> = new Map();

  constructor() {
    super();
  }

  async create(tenantId: string, input: CreateDepartmentInput): Promise<Department> {
    const id = uuidv4();
    const now = new Date();

    // Validate parent exists
    if (input.parentId) {
      const parent = this.departments.get(input.parentId);
      if (!parent) {
        throw new Error(`Parent department not found: ${input.parentId}`);
      }
    }

    const department: Department = {
      id,
      tenantId,
      companyId: input.companyId,
      name: input.name,
      code: input.code,
      parentId: input.parentId,
      description: input.description,
      managerId: input.managerId,
      settings: {
        budget: input.settings?.budget,
        costCenter: input.settings?.costCenter,
        ...input.settings
      },
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    this.departments.set(id, department);
    
    // Index by tenant
    if (!this.byTenant.has(tenantId)) {
      this.byTenant.set(tenantId, new Set());
    }
    this.byTenant.get(tenantId)!.add(id);

    // Index by company
    if (input.companyId) {
      if (!this.byCompany.has(input.companyId)) {
        this.byCompany.set(input.companyId, new Set());
      }
      this.byCompany.get(input.companyId)!.add(id);
    }

    // Update parent's children
    if (input.parentId) {
      const parent = this.departments.get(input.parentId)!;
      parent.children = [...(parent.children || []), department];
    }

    this.emit('department:created', { department });
    return department;
  }

  async findById(id: string): Promise<Department | null> {
    return this.departments.get(id) || null;
  }

  async findByTenant(tenantId: string): Promise<Department[]> {
    const deptIds = this.byTenant.get(tenantId);
    if (!deptIds) return [];
    
    return Array.from(deptIds)
      .map(id => this.departments.get(id)!)
      .filter(Boolean);
  }

  async findByCompany(companyId: string): Promise<Department[]> {
    const deptIds = this.byCompany.get(companyId);
    if (!deptIds) return [];
    
    return Array.from(deptIds)
      .map(id => this.departments.get(id)!)
      .filter(Boolean);
  }

  async getTree(tenantId: string): Promise<Department[]> {
    const all = await this.findByTenant(tenantId);
    
    const buildTree = (parentId: string | undefined): Department[] => {
      return all
        .filter(d => d.parentId === parentId)
        .map(d => ({
          ...d,
          children: buildTree(d.id)
        }));
    };

    return buildTree(undefined);
  }

  async update(id: string, input: UpdateDepartmentInput): Promise<Department> {
    const department = this.departments.get(id);
    if (!department) {
      throw new Error(`Department not found: ${id}`);
    }

    // If changing parent, update old and new parent
    if (input.parentId && input.parentId !== department.parentId) {
      const oldParent = department.parent;
      if (oldParent) {
        oldParent.children = oldParent.children?.filter(c => c.id !== id);
      }
      
      const newParent = this.departments.get(input.parentId);
      if (newParent) {
        newParent.children = [...(newParent.children || []), { ...department, parentId: input.parentId }];
      }
    }

    const updated: Department = {
      ...department,
      ...input,
      settings: { ...department.settings, ...input.settings },
      updatedAt: new Date()
    };

    this.departments.set(id, updated);

    // Update company index
    if (input.companyId && input.companyId !== department.companyId) {
      this.byCompany.get(department.companyId!)?.delete(id);
      if (!this.byCompany.has(input.companyId)) {
        this.byCompany.set(input.companyId, new Set());
      }
      this.byCompany.get(input.companyId)!.add(id);
    }

    this.emit('department:updated', { department: updated, changes: input });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const department = this.departments.get(id);
    if (!department) {
      throw new Error(`Department not found: ${id}`);
    }

    // Delete all children recursively
    const children = department.children || [];
    for (const child of children) {
      await this.delete(child.id);
    }

    // Remove from parent
    if (department.parentId) {
      const parent = this.departments.get(department.parentId);
      if (parent) {
        parent.children = parent.children?.filter(c => c.id !== id);
      }
    }

    this.departments.delete(id);
    this.byTenant.get(department.tenantId)?.delete(id);
    if (department.companyId) {
      this.byCompany.get(department.companyId)?.delete(id);
    }

    this.emit('department:deleted', { departmentId: id });
  }

  clear(): void {
    this.departments.clear();
    this.byTenant.clear();
    this.byCompany.clear();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createCompanyService(): CompanyService {
  return new CompanyService();
}

export function createDepartmentService(): DepartmentService {
  return new DepartmentService();
}
