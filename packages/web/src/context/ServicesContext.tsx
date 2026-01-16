import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Company {
  id: string;
  name: string;
  document?: string;
  documentType?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  settings?: {
    timezone?: string;
    currency?: string;
    language?: string;
  };
  metadata?: Record<string, any>;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  companyId?: string;
  settings?: Record<string, any>;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

type FollowUpType = 'TASK' | 'MEETING' | 'CALL' | 'EMAIL' | 'DEADLINE';
type FollowUpPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface FollowUp {
  id: string;
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  dueDate?: Date;
  assigneeId?: string;
  companyId?: string;
  departmentId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

type AutomationTriggerType = 'SCHEDULE' | 'EVENT' | 'WEBHOOK' | 'MANUAL' | 'CONDITION_MET';

interface AutomationTrigger {
  type: AutomationTriggerType;
  config: Record<string, any>;
}

interface AutomationAction {
  type: string;
  config: Record<string, any>;
  order: number;
}

interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  actions: AutomationAction[];
  settings?: {
    maxExecutions?: number;
    executionWindow?: string;
  };
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Integration {
  id: string;
  name: string;
  type: 'EVOLUTION' | 'RDSTATION' | 'CONFIRM8' | 'WEBHOOK';
  description?: string;
  enabled: boolean;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
  lastConnectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ServicesContextType {
  companies: Company[];
  departments: Department[];
  followUps: FollowUp[];
  automations: Automation[];
  integrations: Integration[];
  loading: boolean;
  error: string | null;
  refreshCompanies: () => Promise<void>;
  refreshDepartments: () => Promise<void>;
  refreshFollowUps: () => Promise<void>;
  refreshAutomations: () => Promise<void>;
  refreshIntegrations: () => Promise<void>;
  createCompany: (data: Partial<Company>) => Promise<Company>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<Company>;
  deleteCompany: (id: string) => Promise<void>;
  createDepartment: (data: Partial<Department>) => Promise<Department>;
  updateDepartment: (id: string, data: Partial<Department>) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;
  createFollowUp: (data: Partial<FollowUp>) => Promise<FollowUp>;
  updateFollowUp: (id: string, data: Partial<FollowUp>) => Promise<FollowUp>;
  deleteFollowUp: (id: string) => Promise<void>;
  createAutomation: (data: Partial<Automation>) => Promise<Automation>;
  updateAutomation: (id: string, data: Partial<Automation>) => Promise<Automation>;
  deleteAutomation: (id: string) => Promise<void>;
  toggleAutomation: (id: string) => Promise<Automation>;
  createIntegration: (data: Partial<Integration>) => Promise<Integration>;
  updateIntegration: (id: string, data: Partial<Integration>) => Promise<Integration>;
  deleteIntegration: (id: string) => Promise<void>;
  testIntegration: (id: string) => Promise<{ success: boolean; message: string }>;
}

const ServicesContext = createContext<ServicesContextType | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = '/api';

  const refreshCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/companies`);
      const data = await res.json();
      setCompanies(data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  };

  const refreshDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/departments`);
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const refreshFollowUps = async () => {
    try {
      const res = await fetch(`${API_BASE}/followups`);
      const data = await res.json();
      setFollowUps(data);
    } catch (err) {
      console.error('Failed to fetch follow-ups:', err);
    }
  };

  const refreshAutomations = async () => {
    try {
      const res = await fetch(`${API_BASE}/automations`);
      const data = await res.json();
      setAutomations(data);
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    }
  };

  const refreshIntegrations = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations`);
      const data = await res.json();
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  };

  const createCompany = async (data: Partial<Company>): Promise<Company> => {
    const res = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const company = await res.json();
    setCompanies(prev => [...prev, company]);
    return company;
  };

  const updateCompany = async (id: string, data: Partial<Company>): Promise<Company> => {
    const res = await fetch(`${API_BASE}/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const company = await res.json();
    setCompanies(prev => prev.map(c => c.id === id ? company : c));
    return company;
  };

  const deleteCompany = async (id: string) => {
    await fetch(`${API_BASE}/companies/${id}`, { method: 'DELETE' });
    setCompanies(prev => prev.filter(c => c.id !== id));
  };

  const createDepartment = async (data: Partial<Department>): Promise<Department> => {
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const department = await res.json();
    setDepartments(prev => [...prev, department]);
    return department;
  };

  const updateDepartment = async (id: string, data: Partial<Department>): Promise<Department> => {
    const res = await fetch(`${API_BASE}/departments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const department = await res.json();
    setDepartments(prev => prev.map(d => d.id === id ? department : d));
    return department;
  };

  const deleteDepartment = async (id: string) => {
    await fetch(`${API_BASE}/departments/${id}`, { method: 'DELETE' });
    setDepartments(prev => prev.filter(d => d.id !== id));
  };

  const createFollowUp = async (data: Partial<FollowUp>): Promise<FollowUp> => {
    const res = await fetch(`${API_BASE}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const followUp = await res.json();
    setFollowUps(prev => [...prev, followUp]);
    return followUp;
  };

  const updateFollowUp = async (id: string, data: Partial<FollowUp>): Promise<FollowUp> => {
    const res = await fetch(`${API_BASE}/followups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const followUp = await res.json();
    setFollowUps(prev => prev.map(f => f.id === id ? followUp : f));
    return followUp;
  };

  const deleteFollowUp = async (id: string) => {
    await fetch(`${API_BASE}/followups/${id}`, { method: 'DELETE' });
    setFollowUps(prev => prev.filter(f => f.id !== id));
  };

  const createAutomation = async (data: Partial<Automation>): Promise<Automation> => {
    const res = await fetch(`${API_BASE}/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const automation = await res.json();
    setAutomations(prev => [...prev, automation]);
    return automation;
  };

  const updateAutomation = async (id: string, data: Partial<Automation>): Promise<Automation> => {
    const res = await fetch(`${API_BASE}/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const automation = await res.json();
    setAutomations(prev => prev.map(a => a.id === id ? automation : a));
    return automation;
  };

  const deleteAutomation = async (id: string) => {
    await fetch(`${API_BASE}/automations/${id}`, { method: 'DELETE' });
    setAutomations(prev => prev.filter(a => a.id !== id));
  };

  const toggleAutomation = async (id: string): Promise<Automation> => {
    const automation = automations.find(a => a.id === id);
    const res = await fetch(`${API_BASE}/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !automation?.enabled })
    });
    const updated = await res.json();
    setAutomations(prev => prev.map(a => a.id === id ? updated : a));
    return updated;
  };

  const createIntegration = async (data: Partial<Integration>): Promise<Integration> => {
    const res = await fetch(`${API_BASE}/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const integration = await res.json();
    setIntegrations(prev => [...prev, integration]);
    return integration;
  };

  const updateIntegration = async (id: string, data: Partial<Integration>): Promise<Integration> => {
    const res = await fetch(`${API_BASE}/integrations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const integration = await res.json();
    setIntegrations(prev => prev.map(i => i.id === id ? integration : i));
    return integration;
  };

  const deleteIntegration = async (id: string) => {
    await fetch(`${API_BASE}/integrations/${id}`, { method: 'DELETE' });
    setIntegrations(prev => prev.filter(i => i.id !== id));
  };

  const testIntegration = async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/integrations/${id}/test`, { method: 'POST' });
    return res.json();
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        refreshCompanies(),
        refreshDepartments(),
        refreshFollowUps(),
        refreshAutomations(),
        refreshIntegrations()
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);

  return (
    <ServicesContext.Provider value={{
      companies,
      departments,
      followUps,
      automations,
      integrations,
      loading,
      error,
      refreshCompanies,
      refreshDepartments,
      refreshFollowUps,
      refreshAutomations,
      refreshIntegrations,
      createCompany,
      updateCompany,
      deleteCompany,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      createFollowUp,
      updateFollowUp,
      deleteFollowUp,
      createAutomation,
      updateAutomation,
      deleteAutomation,
      toggleAutomation,
      createIntegration,
      updateIntegration,
      deleteIntegration,
      testIntegration
    }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}
