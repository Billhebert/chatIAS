/**
 * Configuration System with JSON Schema Validation
 * 
 * This module provides hybrid configuration system combining:
 * - Declarative JSON configuration (from projeto-SDK)
 * - Code-based configuration (from OpenCode)
 * - JSON Schema validation
 * - Hot reload capabilities
 */

import { readFileSync, existsSync, watch } from 'fs';
import { resolve } from 'path';
import { Ajv } from 'ajv';
import { addFormats } from 'ajv-formats';
import { 
  SystemConfig, 
  ValidationError, 
  ConfigurationError,
  Registry 
} from '../types/index.js';

/**
 * System Configuration Manager
 * 
 * This is the central configuration system that powers ChatIAS 3.0,
 * combining the best of both approaches from the original projects.
 */
export class ConfigurationManager {
  private ajv: Ajv;
  private schema: any;
  private config: SystemConfig | null = null;
  private watchers: Map<string, Function> = new Map();
  private lastModified: Map<string, number> = new Map();

  constructor() {
    // Initialize AJV with formats
    this.ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(this.ajv);
  }

  /**
   * Load and validate configuration from file
   */
  async loadConfig(configPath: string, options: { strict?: boolean; validateSchema?: boolean } = {}): Promise<SystemConfig> {
    const { strict = true, validateSchema = true } = options;

    try {
      // Check if file exists
      if (!existsSync(configPath)) {
        throw new ConfigurationError(`Configuration file not found: ${configPath}`);
      }

      // Load raw configuration
      const configText = readFileSync(configPath, 'utf-8');
      const rawConfig = JSON.parse(configText);

      // Validate against schema if enabled
      if (validateSchema) {
        await this.validateConfig(rawConfig);
      }

      // Apply defaults and process configuration
      this.config = this.processConfiguration(rawConfig);

      // Setup file watching for hot reload
      this.setupWatcher(configPath);

      return this.config;

    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to load configuration: ${error.message}`,
        { configPath, originalError: error }
      );
    }
  }

  /**
   * Load configuration schema
   */
  async loadSchema(schemaPath: string): Promise<void> {
    try {
      if (!existsSync(schemaPath)) {
        throw new ConfigurationError(`Schema file not found: ${schemaPath}`);
      }

      const schemaText = readFileSync(schemaPath, 'utf-8');
      this.schema = JSON.parse(schemaText);
      this.ajv.addSchema(this.schema);

    } catch (error) {
      throw new ConfigurationError(
        `Failed to load schema: ${error.message}`,
        { schemaPath, originalError: error }
      );
    }
  }

  /**
   * Validate configuration against loaded schema
   */
  async validateConfig(config: any): Promise<void> {
    if (!this.schema) {
      throw new ConfigurationError('Schema not loaded. Call loadSchema() first.');
    }

    const validate = this.ajv.compile(this.schema);
    const valid = validate(config);

    if (!valid) {
      const errors = validate.errors || [];
      const errorDetails = errors.map(err => {
        const path = err.instancePath || 'root';
        const message = err.message || 'Unknown error';
        return `${path}: ${message}`;
      }).join(', ');

      throw new ValidationError(
        `Configuration validation failed: ${errorDetails}`,
        { errors, config }
      );
    }
  }

  /**
   * Validate specific section of configuration
   */
  validateSection(section: string, data: any): void {
    const sectionSchema = this.schema?.properties?.[section];
    if (!sectionSchema) {
      throw new ConfigurationError(`Unknown configuration section: ${section}`);
    }

    const validate = this.ajv.compile(sectionSchema);
    const valid = validate(data);

    if (!valid) {
      const errors = validate.errors || [];
      const errorDetails = errors.map(err => {
        const path = err.instancePath || 'root';
        const message = err.message || 'Unknown error';
        return `${path}: ${message}`;
      }).join(', ');

      throw new ValidationError(
        `Section '${section}' validation failed: ${errorDetails}`,
        { section, errors, data }
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SystemConfig | null {
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  getSection<T extends keyof SystemConfig>(section: T): SystemConfig[T] | null {
    return this.config?.[section] || null;
  }

  /**
   * Update configuration section
   */
  updateSection<T extends keyof SystemConfig>(section: T, data: Partial<SystemConfig[T]>): void {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded');
    }

    // Validate the section data
    this.validateSection(section, data);

    // Update the configuration
    this.config[section] = { ...this.config[section], ...data };

    // Emit change event
    this.notifyWatchers(section, this.config[section]);
  }

  /**
   * Add configuration change watcher
   */
  watch(section: string, callback: (data: any) => void): () => void {
    const watchers = this.watchers.get(section) || [];
    watchers.push(callback);
    this.watchers.set(section, watchers);

    // Return unsubscribe function
    return () => {
      const currentWatchers = this.watchers.get(section) || [];
      const index = currentWatchers.indexOf(callback);
      if (index > -1) {
        currentWatchers.splice(index, 1);
        this.watchers.set(section, currentWatchers);
      }
    };
  }

  /**
   * Export current configuration
   */
  exportConfig(format: 'json' | 'yaml' = 'json'): string {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded');
    }

    if (format === 'json') {
      return JSON.stringify(this.config, null, 2);
    }

    // YAML export could be added here
    throw new ConfigurationError(`Export format '${format}' not supported`);
  }

  /**
   * Merge additional configuration (for code-based extensions)
   */
  mergeExtensions(extensions: Partial<SystemConfig>): void {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded');
    }

    // Deep merge the extensions
    this.config = this.deepMerge(this.config, extensions);

    // Validate the merged configuration
    this.validateConfig(this.config);
  }

  /**
   * Setup file watcher for hot reload
   */
  private setupWatcher(configPath: string): void {
    if (!this.config?.system.hotReload) {
      return;
    }

    try {
      const watcher = watch(configPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce rapid changes
          setTimeout(() => {
            this.reloadConfig(configPath);
          }, 100);
        }
      });

      // Store watcher for cleanup
      this.watchers.set('__file_watcher__', watcher);

    } catch (error) {
      console.warn(`Failed to setup configuration watcher: ${error.message}`);
    }
  }

  /**
   * Reload configuration from file
   */
  private async reloadConfig(configPath: string): Promise<void> {
    try {
      const stats = readFileSync(configPath, 'utf-8');
      const newConfig = JSON.parse(stats);

      // Validate new configuration
      await this.validateConfig(newConfig);

      // Process and apply
      const processedConfig = this.processConfiguration(newConfig);
      const oldConfig = this.config;

      this.config = processedConfig;

      // Notify watchers of all sections that changed
      this.detectChanges(oldConfig!, processedConfig);

      console.log('[Config] Configuration reloaded successfully');

    } catch (error) {
      console.error(`[Config] Failed to reload configuration: ${error.message}`);
    }
  }

  /**
   * Detect and notify changes between configurations
   */
  private detectChanges(oldConfig: SystemConfig, newConfig: SystemConfig): void {
    const sections = [
      'system', 
      'routing', 
      'middleware', 
      'events', 
      'companies',
      'departments', 
      'accessLevels',
      'followUps',
      'automations',
      'integrations',
      'agents', 
      'tools', 
      'knowledgeBase', 
      'mcp', 
      'governance', 
      'observability'
    ] as const;

    for (const section of sections) {
      if (JSON.stringify(oldConfig[section]) !== JSON.stringify(newConfig[section])) {
        this.notifyWatchers(section, newConfig[section]);
      }
    }
  }

  /**
   * Notify all watchers of a section
   */
  private notifyWatchers(section: string, data: any): void {
    const watchers = this.watchers.get(section) || [];
    watchers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[Config] Watcher error for section '${section}': ${error.message}`);
      }
    });
  }

  /**
   * Process and normalize configuration
   */
  private processConfiguration(rawConfig: any): SystemConfig {
    // Apply defaults
    const config = this.applyDefaults(rawConfig);

    // Normalize values
    this.normalizeConfiguration(config);

    // Validate cross-references
    this.validateCrossReferences(config);

    return config as SystemConfig;
  }

  /**
   * Apply default values to configuration
   */
  private applyDefaults(config: any): any {
    return {
      // System defaults
      system: {
        name: 'ChatIAS',
        version: '3.0.0',
        environment: 'development',
        strict: false,
        hotReload: true,
        multiTenant: {
          enabled: true,
          defaultPlan: 'professional',
          allowTenantCreation: true
        },
        ...config.system
      },

      // Routing defaults
      routing: {
        intelligent: true,
        strategies: [],
        ...config.routing
      },

      // Middleware defaults
      middleware: {
        chain: [],
        ...config.middleware
      },

      // Events defaults
      events: {
        enabled: true,
        eventBus: 'local',
        config: {},
        ...config.events
      },

      // Enterprise features defaults
      companies: config.companies || {},
      departments: config.departments || {},
      accessLevels: config.accessLevels || {},
      followUps: config.followUps || {},
      automations: config.automations || {},
      integrations: config.integrations || {},

      // Core features
      toolSequences: config.toolSequences || {},
      agents: config.agents || {},
      tools: config.tools || {},
      knowledgeBase: config.knowledgeBase || {},
      mcp: config.mcp || {},

      // Governance defaults
      governance: {
        validation: {
          enabled: true,
          onLoad: true,
          strict: false,
          failFast: false
        },
        permissions: {
          agents: {
            maxConcurrent: 10,
            timeout: 30000
          }
        },
        audit: {
          enabled: false,
          logFile: './logs/audit.log',
          trackActions: []
        }
      },

      // Observability defaults
      observability: {
        logging: {
          enabled: true,
          level: 'info',
          transports: [
            {
              type: 'console',
              enabled: true,
              format: 'colored'
            }
          ]
        },
        metrics: {
          enabled: false,
          backend: 'memory'
        }
      },

      // Merge with provided config
      ...config
    };
  }

  /**
   * Normalize configuration values
   */
  private normalizeConfiguration(config: any): void {
    // Normalize environment string
    if (config.system.environment) {
      config.system.environment = config.system.environment.toLowerCase();
    }

    // Normalize log levels
    if (config.observability?.logging?.level) {
      config.observability.logging.level = config.observability.logging.level.toLowerCase();
    }

    // Ensure arrays exist
    ['routing.strategies', 'middleware.chain', 'events.trackActions'].forEach(path => {
      const parts = path.split('.');
      let current = config;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      if (!current[parts[parts.length - 1]]) {
        current[parts[parts.length - 1]] = [];
      }
    });
  }

  /**
   * Validate cross-references between configuration sections
   */
  private validateCrossReferences(config: any): void {
    // Validate agent tool references
    for (const [agentId, agent] of Object.entries(config.agents || {})) {
      const agentConfig = agent as any;
      
      if (agentConfig.tools) {
        for (const toolRef of agentConfig.tools) {
          const toolId = typeof toolRef === 'string' ? toolRef : toolRef.id;
          if (!config.tools?.[toolId]) {
            throw new ValidationError(
              `Agent '${agentId}' references unknown tool '${toolId}'`,
              { agentId, toolId }
            );
          }
        }
      }

      if (agentConfig.knowledgeBase) {
        for (const kbRef of agentConfig.knowledgeBase) {
          const kbId = typeof kbRef === 'string' ? kbRef : kbRef.id;
          if (!config.knowledgeBase?.[kbId]) {
            throw new ValidationError(
              `Agent '${agentId}' references unknown knowledge base '${kbId}'`,
              { agentId, kbId }
            );
          }
        }
      }

      if (agentConfig.mcp?.optional) {
        for (const mcpRef of agentConfig.mcp.optional) {
          if (!config.mcp?.[mcpRef]) {
            throw new ValidationError(
              `Agent '${agentId}' references unknown MCP provider '${mcpRef}'`,
              { agentId, mcpRef }
            );
          }
        }
      }
    }

    // Validate tool sequences
    for (const [seqId, sequence] of Object.entries(config.toolSequences || {})) {
      const seqConfig = sequence as any;
      
      if (seqConfig.steps) {
        for (const step of seqConfig.steps) {
          if (step.tool && !config.tools?.[step.tool]) {
            throw new ValidationError(
              `Tool sequence '${seqId}' references unknown tool '${step.tool}'`,
              { sequenceId: seqId, toolId: step.tool }
            );
          }
          if (step.mcp && !config.mcp?.[step.mcp]) {
            throw new ValidationError(
              `Tool sequence '${seqId}' references unknown MCP '${step.mcp}'`,
              { sequenceId: seqId, mcpId: step.mcp }
            );
          }
          if (step.fallbackMCP && !config.mcp?.[step.fallbackMCP]) {
            throw new ValidationError(
              `Tool sequence '${seqId}' references unknown fallback MCP '${step.fallbackMCP}'`,
              { sequenceId: seqId, mcpId: step.fallbackMCP }
            );
          }
        }
      }
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Close file watchers
    const fileWatcher = this.watchers.get('__file_watcher__');
    if (fileWatcher && typeof fileWatcher.close === 'function') {
      fileWatcher.close();
    }

    // Clear all watchers
    this.watchers.clear();
    this.lastModified.clear();
  }
}

/**
 * Configuration Builder - Fluent interface for building configurations
 * 
 * This provides a programmatic way to build configurations
 * that can be merged with JSON configurations.
 */
export class ConfigurationBuilder {
  private config: Partial<SystemConfig> = {};

  system(system: Partial<SystemConfig['system']>): ConfigurationBuilder {
    this.config.system = { ...this.config.system, ...system };
    return this;
  }

  routing(routing: Partial<SystemConfig['routing']>): ConfigurationBuilder {
    this.config.routing = { ...this.config.routing, ...routing };
    return this;
  }

  middleware(middleware: Partial<SystemConfig['middleware']>): ConfigurationBuilder {
    this.config.middleware = { ...this.config.middleware, ...middleware };
    return this;
  }

  events(events: Partial<SystemConfig['events']>): ConfigurationBuilder {
    this.config.events = { ...this.config.events, ...events };
    return this;
  }

  agent(id: string, config: any): ConfigurationBuilder {
    this.config.agents = {
      ...this.config.agents,
      [id]: config
    };
    return this;
  }

  tool(id: string, config: any): ConfigurationBuilder {
    this.config.tools = {
      ...this.config.tools,
      [id]: config
    };
    return this;
  }

  mcp(id: string, config: any): ConfigurationBuilder {
    this.config.mcp = {
      ...this.config.mcp,
      [id]: config
    };
    return this;
  }

  toolSequence(id: string, config: any): ConfigurationBuilder {
    this.config.toolSequences = {
      ...this.config.toolSequences,
      [id]: config
    };
    return this;
  }

  knowledgeBase(id: string, config: any): ConfigurationBuilder {
    this.config.knowledgeBase = {
      ...this.config.knowledgeBase,
      [id]: config
    };
    return this;
  }

  governance(governance: Partial<SystemConfig['governance']>): ConfigurationBuilder {
    this.config.governance = { ...this.config.governance, ...governance };
    return this;
  }

  observability(observability: Partial<SystemConfig['observability']>): ConfigurationBuilder {
    this.config.observability = { ...this.config.observability, ...observability };
    return this;
  }

  build(): Partial<SystemConfig> {
    return this.config;
  }
}

/**
 * Utility function to create configuration builders
 */
export function createConfiguration(): ConfigurationBuilder {
  return new ConfigurationBuilder();
}

// Global configuration manager instance
export const configManager = new ConfigurationManager();