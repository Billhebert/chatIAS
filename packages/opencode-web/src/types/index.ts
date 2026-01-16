export interface Conversation {
  id: string
  name: string
  status: 'OPEN' | 'PENDING' | 'CLOSED'
  channel: string
  aiModelId?: string
  assignedAgentId?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
  createdAt: string
}

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  createdAt: string
  metadata?: {
    modelId?: string
    agentId?: string
    tokens?: number
    responseTime?: number
  }
}

export interface AIModel {
  id: string
  name: string
  provider: string
  modelId: string
  status: 'active' | 'inactive'
  temperature?: number
  maxTokens?: number
  capabilities?: string[]
}

export interface Agent {
  id: string
  name: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'busy'
  role: string
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export interface Company {
  id: string
  name: string
  legalName?: string
  document?: string
}

export interface Department {
  id: string
  name: string
  code?: string
  companyId?: string
}

export interface Integration {
  id: string
  name: string
  type: string
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  config?: Record<string, any>
}

export interface Template {
  id: string
  name: string
  description?: string
  category: string
  content: string
  variables?: string[]
  status: 'ACTIVE' | 'INACTIVE'
}

export interface Queue {
  id: string
  name: string
  channel: string
  priority: number
  agents: number
  waiting: number
  status: 'active' | 'paused' | 'closed'
}

export interface Broadcast {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed'
  channel: string
  totalRecipients: number
  sentCount: number
  content: string
}

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  status: 'active' | 'inactive'
}

export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  documents: number
  status: 'active' | 'inactive'
}

export interface AuditLog {
  id: string
  action: string
  resource: string
  userId: string
  userName: string
  status: 'success' | 'failure' | 'warning'
  createdAt: string
}
