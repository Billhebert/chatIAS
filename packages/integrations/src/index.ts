/**
 * Export all integrations
 */

// Evolution integration
export { 
  EvolutionIntegration, 
  createEvolutionIntegration,
  evolutionToolConfig,
  type EvolutionIntegrationConfig 
} from './evolution/evolution.js';

// RD Station integration
export { 
  RDStationIntegration, 
  createRDStationIntegration,
  rdStationToolConfig,
  type RDStationIntegrationConfig 
} from './rdstation/rdstation.js';

// Confirm8 integration
export { 
  Confirm8Integration, 
  createConfirm8Integration,
  confirm8ToolConfig,
  type Confirm8IntegrationConfig 
} from './confirm8/confirm8.js';