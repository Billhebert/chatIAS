/**
 * Services Export for ChatIAS 3.0
 * 
 * Native enterprise services implementation:
 * - CompanyService
 * - DepartmentService
 * - FollowUpService
 * - AutomationService
 * - IntegrationService
 */

export {
  // Company Service
  CompanyService,
  Company,
  CompanySettings,
  Address,
  BusinessHours,
  DaySchedule,
  CompanyStatus,
  CreateCompanyInput,
  UpdateCompanyInput,
  createCompanyService,
  
  // Department Service
  DepartmentService,
  Department,
  DepartmentSettings,
  DepartmentStatus,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  createDepartmentService,
  
  // FollowUp Service
  FollowUpService,
  FollowUp,
  UserSummary,
  FollowUpType,
  FollowUpPriority,
  FollowUpStatus,
  CreateFollowUpInput,
  UpdateFollowUpInput,
  createFollowUpService,
  
  // Automation Service
  AutomationService,
  Automation,
  AutomationCondition,
  AutomationAction,
  AutomationLog,
  AutomationTrigger,
  AutomationActionType,
  AutomationExecutor,
  CreateAutomationInput,
  createAutomationService,
  
  // Integration Service
  IntegrationService,
  IntegrationConfig,
  IntegrationCredentials,
  IntegrationTestResult,
  IntegrationHealthCheck,
  IntegrationType,
  IntegrationStatus,
  CreateIntegrationInput,
  IntegrationApiClient,
  createIntegrationService
} from './company-department.js';

export {
  createCompanyService as createCompanyServiceV2,
  createDepartmentService as createDepartmentServiceV2
} from './company-department.js';

export {
  createFollowUpService as createFollowUpServiceV2,
  createAutomationService as createAutomationServiceV2
} from './followup-automation.js';

export {
  createIntegrationService as createIntegrationServiceV2
} from './integration.js';
