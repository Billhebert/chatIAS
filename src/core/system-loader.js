/**
 * SystemLoader - Bootstrap do sistema
 *
 * Lê o system-config.json e monta todo o sistema dinamicamente:
 * - Valida configuração
 * - Carrega e instancia agents, tools, knowledge bases e MCP providers
 * - Conecta todas as dependências
 * - Retorna sistema pronto para uso
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import EventEmitter from 'events';
import { validateConfigCompleteStrict, loadAndValidateConfig } from './config-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converte path para file:// URL (compatível com Windows)
 */
function pathToImportURL(filepath) {
  return pathToFileURL(filepath).href;
}

/**
 * Registry genérico para gerenciar componentes
 */
class ComponentRegistry extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.components = new Map();
  }

  register(id, component) {
    this.components.set(id, component);
    this.emit('registered', { id, component });
  }

  unregister(id) {
    const component = this.components.get(id);
    this.components.delete(id);
    this.emit('unregistered', { id, component });
    return component;
  }

  get(id) {
    return this.components.get(id);
  }

  has(id) {
    return this.components.has(id);
  }

  list(filter = null) {
    const components = Array.from(this.components.values());

    if (!filter) {
      return components;
    }

    return components.filter(filter);
  }

  listEnabled() {
    return this.list(c => c.enabled);
  }

  async execute(id, ...args) {
    const component = this.get(id);
    if (!component) {
      throw new Error(`${this.name} not found: ${id}`);
    }

    if (!component.enabled) {
      throw new Error(`${this.name} is disabled: ${id}`);
    }

    if (typeof component.run === 'function') {
      return await component.run(...args);
    } else if (typeof component.execute === 'function') {
      return await component.execute(...args);
    }

    throw new Error(`${this.name} ${id} has no run or execute method`);
  }

  clear() {
    this.components.clear();
    this.emit('cleared');
  }

  size() {
    return this.components.size;
  }
}

/**
 * AgentFactory - Cria agentes dinamicamente
 */
class AgentFactory {
  constructor() {
    this.classes = new Map();
  }

  registerClass(className, classConstructor) {
    this.classes.set(className, classConstructor);
  }

  async create(className, config) {
    const ClassConstructor = this.classes.get(className);
    if (!ClassConstructor) {
      throw new Error(`Agent class not found: ${className}`);
    }

    return new ClassConstructor(config);
  }
}

/**
 * SystemLoader - Carrega e inicializa o sistema
 */
export class SystemLoader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      configPath: options.configPath || path.join(process.cwd(), 'config', 'system-config.json'),
      basePath: options.basePath || process.cwd(),
      strictValidation: options.strictValidation !== false,
      autoInit: options.autoInit !== false,
      ...options
    };

    // Configuration
    this.config = null;

    // Registries
    this.agentRegistry = new ComponentRegistry('Agent');
    this.toolRegistry = new ComponentRegistry('Tool');
    this.knowledgeBaseRegistry = new ComponentRegistry('KnowledgeBase');
    this.mcpRegistry = new ComponentRegistry('MCP');

    // Factories
    this.agentFactory = new AgentFactory();

    // State
    this.initialized = false;
    this.loading = false;

    // SDK Controller (se fornecido externamente)
    this.sdkController = options.sdkController || null;

    // Logs
    this.logs = [];
  }

  /**
   * Log interno
   */
  log(message, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    this.logs.push(entry);
    this.emit('log', entry);

    if (this.options.verbose) {
      console.log(`[SystemLoader] [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Carrega configuração
   */
  async loadConfig() {
    this.log('Loading configuration...');

    const result = loadAndValidateConfig(
      this.options.configPath,
      this.options.strictValidation
    );

    if (!result.valid) {
      const errorMsg = result.errors.map(e => e.message).join('\n');
      throw new Error(`Configuration validation failed:\n${errorMsg}`);
    }

    this.config = result.config;
    this.log(`Configuration loaded successfully: ${this.config.system.name} v${this.config.system.version}`);
    this.emit('config-loaded', this.config);

    return this.config;
  }

  /**
   * Carrega tools
   */
  async loadTools() {
    this.log('Loading tools...');

    const toolsConfig = this.config.tools || {};
    const toolsDir = path.join(this.options.basePath, 'src', 'tools');

    for (const [toolId, toolConfig] of Object.entries(toolsConfig)) {
      try {
        // Importa classe da tool
        const toolPath = path.join(toolsDir, toolConfig.file);

        if (!fs.existsSync(toolPath)) {
          this.log(`Tool file not found: ${toolPath}`, 'warn');
          continue;
        }

        const toolModule = await import(pathToImportURL(toolPath));
        const ToolClass = toolModule[toolConfig.class] || toolModule.default;

        if (!ToolClass) {
          throw new Error(`Tool class not exported: ${toolConfig.class} in ${toolConfig.file}`);
        }

        // Instancia tool
        const tool = new ToolClass(toolConfig);

        // Inicializa
        await tool.initialize();

        // Registra
        this.toolRegistry.register(toolId, tool);

        this.log(`Loaded tool: ${toolId} (${toolConfig.class})`);
      } catch (error) {
        this.log(`Failed to load tool ${toolId}: ${error.message}`, 'error');
        if (this.options.strictValidation) {
          throw error;
        }
      }
    }

    this.log(`Tools loaded: ${this.toolRegistry.size()}`);
    this.emit('tools-loaded', this.toolRegistry.list());
  }

  /**
   * Carrega knowledge bases
   */
  async loadKnowledgeBases() {
    this.log('Loading knowledge bases...');

    const kbConfig = this.config.knowledgeBase || {};
    const kbDir = path.join(this.options.basePath, 'src', 'knowledge-base');

    for (const [kbId, kbCfg] of Object.entries(kbConfig)) {
      try {
        // Importa classe da KB
        const kbPath = path.join(kbDir, kbCfg.file);

        if (!fs.existsSync(kbPath)) {
          this.log(`Knowledge base file not found: ${kbPath}`, 'warn');
          continue;
        }

        const kbModule = await import(pathToImportURL(kbPath));
        const KBClass = kbModule[kbCfg.class] || kbModule.default;

        if (!KBClass) {
          throw new Error(`Knowledge base class not exported: ${kbCfg.class} in ${kbCfg.file}`);
        }

        // Instancia KB
        const kb = new KBClass(kbCfg);

        // Inicializa
        await kb.initialize();

        // Registra
        this.knowledgeBaseRegistry.register(kbId, kb);

        this.log(`Loaded knowledge base: ${kbId} (${kbCfg.class})`);
      } catch (error) {
        this.log(`Failed to load knowledge base ${kbId}: ${error.message}`, 'error');
        if (this.options.strictValidation) {
          throw error;
        }
      }
    }

    this.log(`Knowledge bases loaded: ${this.knowledgeBaseRegistry.size()}`);
    this.emit('kb-loaded', this.knowledgeBaseRegistry.list());
  }

  /**
   * Carrega MCP providers
   */
  async loadMCPProviders() {
    this.log('Loading MCP providers...');

    const mcpConfig = this.config.mcp || {};
    const mcpDir = path.join(this.options.basePath, 'src', 'mcp');

    for (const [mcpId, mcpCfg] of Object.entries(mcpConfig)) {
      try {
        // Importa classe do MCP
        const mcpPath = path.join(mcpDir, mcpCfg.file);

        if (!fs.existsSync(mcpPath)) {
          this.log(`MCP provider file not found: ${mcpPath}`, 'warn');
          continue;
        }

        const mcpModule = await import(pathToImportURL(mcpPath));
        const MCPClass = mcpModule[mcpCfg.class] || mcpModule.default;

        if (!MCPClass) {
          throw new Error(`MCP provider class not exported: ${mcpCfg.class} in ${mcpCfg.file}`);
        }

        // Instancia MCP
        const mcp = new MCPClass(mcpCfg);

        // Inicializa (passa registry para fallback)
        await mcp.initialize({ mcpRegistry: this.mcpRegistry });

        // Registra
        this.mcpRegistry.register(mcpId, mcp);

        this.log(`Loaded MCP provider: ${mcpId} (${mcpCfg.class}) [${mcpCfg.type}]`);
      } catch (error) {
        this.log(`Failed to load MCP provider ${mcpId}: ${error.message}`, 'error');
        // MCP não é crítico, continua sem strict
      }
    }

    this.log(`MCP providers loaded: ${this.mcpRegistry.size()}`);
    this.emit('mcp-loaded', this.mcpRegistry.list());
  }

  /**
   * Registra classes de agentes
   */
  async registerAgentClasses() {
    this.log('Registering agent classes...');

    const agentsConfig = this.config.agents || {};
    const agentsDir = path.join(this.options.basePath, 'src', 'agents');

    for (const [agentId, agentConfig] of Object.entries(agentsConfig)) {
      try {
        // Importa classe do agente
        const agentPath = path.join(agentsDir, agentConfig.file);

        if (!fs.existsSync(agentPath)) {
          this.log(`Agent file not found: ${agentPath}`, 'warn');
          continue;
        }

        const agentModule = await import(pathToImportURL(agentPath));
        const AgentClass = agentModule[agentConfig.class] || agentModule.default;

        if (!AgentClass) {
          throw new Error(`Agent class not exported: ${agentConfig.class} in ${agentConfig.file}`);
        }

        // Registra classe na factory
        this.agentFactory.registerClass(agentConfig.class, AgentClass);

        // Registra subagent classes
        if (agentConfig.subagents) {
          for (const subagentConfig of agentConfig.subagents) {
            const SubagentClass = agentModule[subagentConfig.class];
            if (SubagentClass) {
              this.agentFactory.registerClass(subagentConfig.class, SubagentClass);
              this.log(`Registered subagent class: ${subagentConfig.class}`);
            }
          }
        }

        this.log(`Registered agent class: ${agentConfig.class}`);
      } catch (error) {
        this.log(`Failed to register agent class ${agentId}: ${error.message}`, 'error');
        if (this.options.strictValidation) {
          throw error;
        }
      }
    }

    this.log('Agent classes registered');
    this.emit('agent-classes-registered');
  }

  /**
   * Carrega agentes
   */
  async loadAgents() {
    this.log('Loading agents...');

    const agentsConfig = this.config.agents || {};

    // Contexto para inicialização
    const context = {
      toolRegistry: this.toolRegistry,
      knowledgeBaseRegistry: this.knowledgeBaseRegistry,
      mcpRegistry: this.mcpRegistry,
      agentFactory: this.agentFactory,
      sdkController: this.sdkController
    };

    for (const [agentId, agentConfig] of Object.entries(agentsConfig)) {
      try {
        // Cria agente
        const agent = await this.agentFactory.create(agentConfig.class, agentConfig);

        // Inicializa agente (carrega tools, KB, subagents, etc)
        await agent.initialize(context);

        // Registra
        this.agentRegistry.register(agentId, agent);

        this.log(`Loaded agent: ${agentId} (${agentConfig.class})`);
      } catch (error) {
        this.log(`Failed to load agent ${agentId}: ${error.message}`, 'error');
        if (this.options.strictValidation) {
          throw error;
        }
      }
    }

    this.log(`Agents loaded: ${this.agentRegistry.size()}`);
    this.emit('agents-loaded', this.agentRegistry.list());
  }

  /**
   * Inicializa sistema completo
   */
  async initialize() {
    if (this.initialized) {
      this.log('System already initialized');
      return this;
    }

    if (this.loading) {
      throw new Error('System is already loading');
    }

    this.loading = true;
    this.log('Initializing system...');
    this.emit('initializing');

    try {
      // 1. Carrega configuração
      await this.loadConfig();

      // 2. Carrega tools (primeiro, pois são usados por agentes)
      await this.loadTools();

      // 3. Carrega knowledge bases
      await this.loadKnowledgeBases();

      // 4. Carrega MCP providers
      await this.loadMCPProviders();

      // 5. Registra classes de agentes
      await this.registerAgentClasses();

      // 6. Carrega agentes (último, pois dependem de tudo)
      await this.loadAgents();

      this.initialized = true;
      this.loading = false;

      this.log('System initialized successfully');
      this.emit('initialized', this.getSystemInfo());

      return this;
    } catch (error) {
      this.loading = false;
      this.log(`System initialization failed: ${error.message}`, 'error');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Recarrega configuração (hot reload)
   */
  async reload() {
    if (!this.config.system.hotReload) {
      throw new Error('Hot reload is disabled in configuration');
    }

    this.log('Reloading system...');
    this.emit('reloading');

    // Destrói componentes atuais
    await this.destroy();

    // Reinicializa
    await this.initialize();

    this.log('System reloaded successfully');
    this.emit('reloaded');
  }

  /**
   * Destrói sistema
   */
  async destroy() {
    this.log('Destroying system...');
    this.emit('destroying');

    // Destrói agentes
    for (const agent of this.agentRegistry.list()) {
      try {
        await agent.destroy();
      } catch (error) {
        this.log(`Error destroying agent ${agent.id}: ${error.message}`, 'error');
      }
    }
    this.agentRegistry.clear();

    // Destrói tools
    for (const tool of this.toolRegistry.list()) {
      try {
        await tool.destroy();
      } catch (error) {
        this.log(`Error destroying tool ${tool.id}: ${error.message}`, 'error');
      }
    }
    this.toolRegistry.clear();

    // Destrói KBs
    for (const kb of this.knowledgeBaseRegistry.list()) {
      try {
        await kb.destroy();
      } catch (error) {
        this.log(`Error destroying KB ${kb.id}: ${error.message}`, 'error');
      }
    }
    this.knowledgeBaseRegistry.clear();

    // Destrói MCPs
    for (const mcp of this.mcpRegistry.list()) {
      try {
        await mcp.destroy();
      } catch (error) {
        this.log(`Error destroying MCP ${mcp.id}: ${error.message}`, 'error');
      }
    }
    this.mcpRegistry.clear();

    this.initialized = false;
    this.log('System destroyed');
    this.emit('destroyed');
  }

  /**
   * Obtém informações do sistema
   */
  getSystemInfo() {
    return {
      name: this.config?.system?.name || 'Unknown',
      version: this.config?.system?.version || 'Unknown',
      environment: this.config?.system?.environment || 'Unknown',
      initialized: this.initialized,
      agents: {
        total: this.agentRegistry.size(),
        enabled: this.agentRegistry.listEnabled().length,
        list: this.agentRegistry.list().map(a => a.getInfo())
      },
      tools: {
        total: this.toolRegistry.size(),
        enabled: this.toolRegistry.listEnabled().length,
        list: this.toolRegistry.list().map(t => t.getInfo())
      },
      knowledgeBases: {
        total: this.knowledgeBaseRegistry.size(),
        enabled: this.knowledgeBaseRegistry.listEnabled().length,
        list: this.knowledgeBaseRegistry.list().map(kb => kb.getInfo())
      },
      mcpProviders: {
        total: this.mcpRegistry.size(),
        enabled: this.mcpRegistry.listEnabled().length,
        connected: this.mcpRegistry.list(m => m.connected).length,
        list: this.mcpRegistry.list().map(m => m.getInfo())
      }
    };
  }

  /**
   * Executa um agente
   */
  async runAgent(agentId, input) {
    return await this.agentRegistry.execute(agentId, input);
  }

  /**
   * Executa uma tool
   */
  async runTool(toolId, params, actionId = null) {
    return await this.toolRegistry.execute(toolId, params, actionId);
  }

  /**
   * Consulta knowledge base
   */
  async queryKnowledgeBase(kbId, query) {
    const kb = this.knowledgeBaseRegistry.get(kbId);
    if (!kb) {
      throw new Error(`Knowledge base not found: ${kbId}`);
    }
    return await kb.query(query);
  }

  /**
   * Usa MCP provider
   */
  async useMCP(mcpId, action, params) {
    return await this.mcpRegistry.execute(mcpId, action, params);
  }

  /**
   * Obtém logs
   */
  getLogs() {
    return this.logs;
  }
}

/**
 * Factory function para facilitar uso
 */
export async function createSystem(options = {}) {
  const loader = new SystemLoader(options);

  if (options.autoInit !== false) {
    await loader.initialize();
  }

  return loader;
}

export default SystemLoader;
