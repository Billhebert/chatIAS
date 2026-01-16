/**
 * Main export file for ChatIAS Core 3.0
 * 
 * This is the unified core combining the best of projeto-SDK and OpenCode:
 * - Enterprise governance and orchestration from projeto-SDK
 * - Modern TypeScript and tooling from OpenCode
 * - Circuit breakers, tool sequences, and advanced observability
 * - Native multi-tenant support with tenant isolation
 * - Complete enterprise services (Company, Department, FollowUp, Automation, Integration)
 */

// Types
export * from './types/index.js';

// Enterprise Types (Companies, Departments, Follow-ups, Automations)
export * from './enterprise.js';

// Enterprise Services (Native Implementation)
export * from './services/index.js';

// Base Classes
export { BaseAgent, BaseTool, BaseMCP, BaseKnowledgeBase } from './base/index.js';

// System Loader & Core
export { SystemLoader, createSystem } from './system-loader.js';

// Multi-Tenant System
export * from './multi-tenant.js';

// Orchestration
export { 
  ToolSequenceExecutor, 
  WorkflowBuilder, 
  createWorkflow 
} from './orchestration/index.js';

// Configuration
export { 
  ConfigurationManager, 
  ConfigurationBuilder, 
  createConfiguration,
  configManager 
} from './config/index.js';

// Observability
export { 
  Logger, 
  MetricsCollector, 
  EventTracker,
  createLogger,
  createMetricsCollector,
  createEventTracker
} from './observability/index.js';