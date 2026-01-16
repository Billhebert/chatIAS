/**
 * System Loader - Bootstrap and Dependency Injection
 * 
 * Este é o "motor principal" que carrega todos os módulos dinamicamente.
 * Combina a abordagem JSON do projeto-SDK com modularidade do OpenCode.
 * Suporta nativamente multi-tenant com TenantRegistry.
 */

import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { 
  SystemConfig, 
  AgentConfig,
  ToolConfig, 
  McpProviderConfig,
  KnowledgeBaseConfig,
  Registry,
  ExecutionContext,
  ChatIASError
} from './types/index.js';

import { 
  BaseAgent, 
  BaseTool, 
  BaseMCP, 
  BaseKnowledgeBase 
} from './base/index.js';

import { 
  ToolSequenceExecutor 
} from './orchestration/index.js';

import { 
  ConfigurationManager, 
  configManager 
} from './config/index.js';

import { 
  Logger, 
  createLogger 
} from './observability/index.js';

import {
  TenantRegistry,
  Tenant,
  User,
  TenantSession,
  createTenantRegistry,
  PLAN_LIMITS,
  PLAN_FEATURES
} from './multi-tenant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * System Loader - Carrega tudo dinamicamente
 * 
 * Pense nisso como um "container de injeção de dependências"
 * que descobre e instancia todos os componentes automaticamente.
 * 
 * Suporta multi-tenant com TenantRegistry integrado.
 */
export class SystemLoader {
  private config: SystemConfig | null = null;
  private logger: Logger | null = null;
  private tenantRegistry: TenantRegistry | null = null;
  private currentTenant: Tenant | null = null;
  private currentUser: User | null = null;

  // Registries para armazenar instâncias
  private agentRegistry: Registry<BaseAgent> = new ComponentRegistry();
  private toolRegistry: Registry<BaseTool> = new ComponentRegistry();
  private mcpRegistry: Registry<BaseMCP> = new ComponentRegistry();
  private kbRegistry: Registry<BaseKnowledgeBase> = new ComponentRegistry();
  
  // Orquestradores especiais
  private toolSequenceExecutor: ToolSequenceExecutor;

  constructor() {
    this.toolSequenceExecutor = new ToolSequenceExecutor();
  }

  /**
   * Inicializa o sistema completo
   * 
   * Este é o método principal que ORQUESTRA tudo:
   * 1. Carrega configuração JSON
   * 2. Inicializa logging
   * 3. Inicializa sistema multi-tenant
   * 4. Carrega dinamicamente todos os componentes
   * 5. Conecta MCPs
   * 6. Inicializa Knowledge Bases
   * 7. Valida dependências cruzadas
   */
  async initialize(options: {
    configPath?: string;
    tenantId?: string;
    tenantSlug?: string;
    strict?: boolean;
    verbose?: boolean;
    enableMultiTenant?: boolean;
  } = {}): Promise<void> {
    try {
      console.log('🚀 [SystemLoader] Iniciando carregamento do sistema...');
      
      // 0️⃣ Inicializar sistema multi-tenant (se habilitado)
      if (options.enableMultiTenant !== false) {
        console.log('🏢 [SystemLoader] Inicializando sistema multi-tenant...');
        this.tenantRegistry = createTenantRegistry();
        
        // Se fornecido tenantId ou slug, carregar tenant
        if (options.tenantId || options.tenantSlug) {
          await this.loadTenant(options.tenantId, options.tenantSlug);
        }
      }

      // 1️⃣ Carregar configuração JSON (herança projeto-SDK)
      const configPath = options.configPath || join(__dirname, '../../config/system-config.json');
      
      if (existsSync(configPath)) {
        console.log('📋 [SystemLoader] Carregando configuração...');
        this.config = await configManager.loadConfig(
          configPath, 
          { 
            strict: options.strict || false,
            validateSchema: true 
          }
        );

        // 2️⃣ Inicializar sistema de logging
        console.log('📊 [SystemLoader] Inicializando observabilidade...');
        this.logger = createLogger(this.config.observability.logging);
        this.logger.system('Sistema ChatIAS 3.0 inicializando', {
          environment: this.config.system.environment,
          strict: this.config.system.strict,
          multiTenant: !!this.tenantRegistry
        });
      } else {
        // Se não tem config JSON, apenas inicializar logging básico
        this.logger = createLogger({
          enabled: true,
          level: 'info',
          transports: [{ type: 'console', enabled: true }]
        });
      }

      // 3️⃣ Carregar agentes dinamicamente
      if (this.config?.agents) {
        await this.loadAgents();
      }
      
      // 4️⃣ Carregar ferramentas dinamicamente
      if (this.config?.tools) {
        await this.loadTools();
      }
      
      // 5️⃣ Carregar MCP providers dinamicamente
      if (this.config?.mcp) {
        await this.loadMcpProviders();
      }
      
      // 6️⃣ Carregar Knowledge Bases dinamicamente
      if (this.config?.knowledgeBase) {
        await this.loadKnowledgeBases();
      }
      
       // 7️⃣ Carregar tool sequences
      if (this.config?.toolSequences) {
        await this.loadToolSequences();
      }
      
      // 1️⃣1️⃣ Validar dependências cruzadas
      if (this.config) {
        await this.validateCrossDependencies();
      }

      // 9️⃣ Conectar componentes
      await this.connectComponents();

      this.logger?.system('✅ Sistema carregado com sucesso', {
        agents: this.agentRegistry.size(),
        tools: this.toolRegistry.size(),
        mcps: this.mcpRegistry.size(),
        kbs: this.kbRegistry.size(),
        tenant: this.currentTenant?.name
      });

    } catch (error) {
      throw new ChatIASError(
        `Falha ao inicializar sistema: ${error.message}`,
        'SYSTEM_INIT_ERROR',
        'system',
        { options, originalError: error }
      );
    }
  }

  /**
   * Carregar tenant para contexto multi-tenant
   */
  private async loadTenant(tenantId?: string, tenantSlug?: string): Promise<void> {
    if (!this.tenantRegistry) return;

    let tenant: Tenant | undefined;

    if (tenantId) {
      tenant = this.tenantRegistry.getTenant(tenantId);
    } else if (tenantSlug) {
      tenant = this.tenantRegistry.getTenantBySlug(tenantSlug);
    }

    if (tenant) {
      this.currentTenant = tenant;
      this.logger?.system(`🏢 Tenant carregado: ${tenant.name} (${tenant.slug})`);
    } else if (tenantId || tenantSlug) {
      this.logger?.warn(`⚠️ Tenant não encontrado: ${tenantId || tenantSlug}`);
    }
  }

  /**
   * Criar um novo tenant (para uso multi-tenant)
   */
  async createTenant(data: {
    name: string;
    slug?: string;
    plan?: 'free' | 'starter' | 'professional' | 'enterprise';
  }): Promise<Tenant> {
    if (!this.tenantRegistry) {
      throw new ChatIASError(
        'Sistema multi-tenant não inicializado',
        'MULTI_TENANT_DISABLED',
        'system'
      );
    }

    const tenant = await this.tenantRegistry.createTenant({
      name: data.name,
      slug: data.slug,
      plan: data.plan || 'starter',
      limits: PLAN_LIMITS[data.plan || 'starter'],
      features: PLAN_FEATURES[data.plan || 'starter']
    });

    this.logger?.system(`🏢 Tenant criado: ${tenant.name} (${tenant.slug})`);
    return tenant;
  }

  /**
   * Criar usuário em tenant atual
   */
  async createUser(data: {
    email: string;
    name: string;
    role?: 'owner' | 'admin' | 'manager' | 'developer' | 'viewer';
  }): Promise<User> {
    if (!this.currentTenant || !this.tenantRegistry) {
      throw new ChatIASError(
        'Nenhum tenant ativo. Use initialize({ tenantSlug: "..." }) primeiro.',
        'NO_ACTIVE_TENANT',
        'system'
      );
    }

    const user = await this.tenantRegistry.createUser(this.currentTenant.id, {
      email: data.email,
      name: data.name,
      role: data.role || 'developer'
    });

    this.logger?.system(`👤 Usuário criado: ${user.name} (${user.email})`);
    return user;
  }

  /**
   * Carregar agente atual (do tenant multi-tenant)
   */
  getCurrentTenant(): Tenant | null {
    return this.currentTenant;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getTenantRegistry(): TenantRegistry | null {
    return this.tenantRegistry;
  }

  /**
   * Carrega agentes dinamicamente dos arquivos .js/.ts
   * 
   * O sistema escaneia a pasta src/agents/ e carrega tudo que encontrar.
   * Cada arquivo deve exportar uma classe que estende BaseAgent.
   */
  private async loadAgents(): Promise<void> {
    this.logger.system('🤖 [Carregar] Carregando agentes...');
    
    try {
      // Scannear pasta por arquivos de agentes
      const agentFiles = await this.scanComponentFiles('src/agents');
      
      for (const file of agentFiles) {
        try {
          // Importar dinamicamente o módulo
          const module = await import(file.path);
          
          // Verificar se exporta algo
          const agentClass = module.default || module[file.exportName];
          
          if (agentClass && typeof agentClass === 'function') {
            // Pegar configuração do JSON
            const agentConfig = (this.config!.agents as any)[file.id];
            
            if (agentConfig && agentConfig.enabled) {
              // Instanciar o agente
              const agent = new agentClass(agentConfig);
              await agent.initialize();
              
              // Registrar no registry
              this.agentRegistry.register(file.id, agent);
              
              this.logger.agent('Agente carregado', file.id, {
                action: 'loaded',
                class: file.exportName
              });
            }
          }
        } catch (error) {
          this.logger.error(`Falha ao carregar agente ${file.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar agentes: ${error.message}`);
    }
  }

  /**
   * Carrega ferramentas dinamicamente
   * 
   * Mesmo princípio dos agentes, mas para ferramentas.
   * Cada ferramenta estende BaseTool.
   */
  private async loadTools(): Promise<void> {
    this.logger.system('🛠️ [Carregar] Carregando ferramentas...');
    
    try {
      const toolFiles = await this.scanComponentFiles('src/tools');
      
      for (const file of toolFiles) {
        try {
          const module = await import(file.path);
          const toolClass = module.default || module[file.exportName];
          
          if (toolClass && typeof toolClass === 'function') {
            const toolConfig = (this.config!.tools as any)[file.id];
            
            if (toolConfig && toolConfig.enabled) {
              const tool = new toolClass(toolConfig);
              await tool.initialize();
              
              this.toolRegistry.register(file.id, tool);
              
              this.logger.tool('Ferramenta carregada', file.id, {
                action: 'loaded',
                class: file.exportName
              });
            }
          }
        } catch (error) {
          this.logger.error(`Falha ao carregar ferramenta ${file.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar ferramentas: ${error.message}`);
    }
  }

  /**
   * Carrega MCP providers dinamicamente
   */
  private async loadMcpProviders(): Promise<void> {
    this.logger.system('🔌 [Carregar] Carregando MCP providers...');
    
    try {
      const mcpFiles = await this.scanComponentFiles('src/mcp');
      
      for (const file of mcpFiles) {
        try {
          const module = await import(file.path);
          const mcpClass = module.default || module[file.exportName];
          
          if (mcpClass && typeof mcpClass === 'function') {
            const mcpConfig = (this.config!.mcp as any)[file.id];
            
            if (mcpConfig && mcpConfig.enabled) {
              const mcp = new mcpClass(mcpConfig);
              await mcp.connect();
              
              this.mcpRegistry.register(file.id, mcp);
              
              this.logger.mcp('MCP provider carregado', file.id, {
                action: 'loaded',
                class: file.exportName
              });
            }
          }
        } catch (error) {
          this.logger.error(`Falha ao carregar MCP ${file.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar MCPs: ${error.message}`);
    }
  }

  /**
   * Carrega Knowledge Bases dinamicamente
   */
  private async loadKnowledgeBases(): Promise<void> {
    this.logger.system('📚 [Carregar] Carregando Knowledge Bases...');
    
    try {
      const kbFiles = await this.scanComponentFiles('src/knowledge-base');
      
      for (const file of kbFiles) {
        try {
          const module = await import(file.path);
          const kbClass = module.default || module[file.exportName];
          
          if (kbClass && typeof kbClass === 'function') {
            const kbConfig = (this.config!.knowledgeBase as any)[file.id];
            
            const kb = new kbClass(kbConfig);
            await kb.initialize();
            
            this.kbRegistry.register(file.id, kb);
            
            this.logger.system('Knowledge Base carregada', {
              action: 'loaded',
              kb: file.id,
              class: file.exportName
            });
          }
        } catch (error) {
          this.logger.error(`Falha ao carregar KB ${file.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar Knowledge Bases: ${error.message}`);
    }
  }

  /**
   * Carrega tool sequences do JSON
   */
  private async loadToolSequences(): Promise<void> {
    this.logger.system('🔀 [Carregar] Carregando Tool Sequences...');
    
    try {
      for (const [sequenceId, sequenceConfig] of Object.entries(this.config!.toolSequences)) {
        this.toolSequenceExecutor.registerSequence(sequenceConfig);
        
        this.logger.tool('Tool Sequence carregada', sequenceId, {
          action: 'sequence_loaded',
          steps: sequenceConfig.steps?.length
        });
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar tool sequences: ${error.message}`);
    }
  }

  /**
   * Valida dependências cruzadas
   */
  private async validateCrossDependencies(): Promise<void> {
    this.logger.system('🔍 [Validar] Validando dependências cruzadas...');
    
    const issues: string[] = [];

    // Validar referências de agentes
    for (const [agentId, agent] of Object.entries(this.config!.agents)) {
      const agentConfig = agent as any;
      
      if (agentConfig.tools) {
        for (const toolRef of agentConfig.tools) {
          const toolId = typeof toolRef === 'string' ? toolRef : toolRef.id;
          if (!this.toolRegistry.get(toolId)) {
            issues.push(`Agente ${agentId} referencia tool desconhecido: ${toolId}`);
          }
        }
      }
    }

    // Validar referências de tool sequences
    for (const [sequenceId, sequenceConfig] of Object.entries(this.config!.toolSequences)) {
      if (sequenceConfig.steps) {
        for (const step of sequenceConfig.steps) {
          if (step.tool && !this.toolRegistry.get(step.tool)) {
            issues.push(`Sequence ${sequenceId} referencia tool desconhecido: ${step.tool}`);
          }
          if (step.mcp && !this.mcpRegistry.get(step.mcp)) {
            issues.push(`Sequence ${sequenceId} referencia MCP desconhecido: ${step.mcp}`);
          }
        }
      }
    }

    if (issues.length > 0) {
      throw new ChatIASError(
        `Dependências inválidas: ${issues.join('; ')}`,
        'DEPENDENCY_ERROR',
        'system',
        { issues }
      );
    }

    this.logger.system('✅ Dependências validadas com sucesso');
  }

  /**
   * Conecta componentes entre si
   */
  private async connectComponents(): Promise<void> {
    this.logger.system('🔗 [Conectar] Conectando componentes...');
    
    // Injetar dependências nos agentes
    const agentList = this.agentRegistry.list();
    for (const entry of agentList) {
      // Injetar tool registry no agente
      if ((entry.item as any).setToolRegistry) {
        (entry.item as any).setToolRegistry(this.toolRegistry);
      }
      
      // Injetar KB registry no agente  
      if ((entry.item as any).setKnowledgeBaseRegistry) {
        (entry.item as any).setKnowledgeBaseRegistry(this.kbRegistry);
      }
      
      // Injetar MCP registry no agente
      if ((entry.item as any).setMcpRegistry) {
        (entry.item as any).setMcpRegistry(this.mcpRegistry);
      }
    }
  }

  /**
   * Scaneia arquivos de componentes dinamicamente
   * 
   * Esta é a "mágica" da modularidade:
   * - Lê a pasta procurando arquivos .js/.ts
   * - Extrai o ID do nome do arquivo
   * - Determina o nome da exportação
   */
  private async scanComponentFiles(folder: string): Promise<Array<{
    id: string;
    path: string;
    exportName: string;
  }>> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const files = await fs.readdir(folder);
      const componentFiles: any[] = [];

      for (const file of files) {
        const filePath = path.join(folder, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile() && /\.(js|ts)$/.test(file)) {
          const id = file.replace(/\.(js|ts)$/, '');
          const exportName = this.pascalCase(id);
          
          componentFiles.push({
            id,
            path: `./${folder}/${file}`,
            exportName
          });
        }
      }

      return componentFiles;
    } catch (error: unknown) {
      this.logger?.error(`Erro ao escanear pasta ${folder}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Converte string para PascalCase
   */
  private pascalCase(str: string): string {
    return str
      .replace(/(?:^|[\s-_])+(.)/g, (_, char) => char.toUpperCase())
      .replace(/[\s-_]+/g, '');
  }

  /**
   * Executa um agente específico
   */
  async runAgent(agentId: string, input: any, context?: ExecutionContext): Promise<any> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new ChatIASError(
        `Agente não encontrado: ${agentId}`,
        'AGENT_NOT_FOUND',
        'agent'
      );
    }

    const executionContext = {
      requestId: context?.requestId || this.generateRequestId(),
      startTime: Date.now(),
      ...context
    };

    return await agent.execute(input, executionContext);
  }

  /**
   * Executa uma ferramenta específica
   */
  async runTool(toolId: string, action: string, params: any, context?: ExecutionContext): Promise<any> {
    const tool = this.toolRegistry.get(toolId);
    if (!tool) {
      throw new ChatIASError(
        `Ferramenta não encontrada: ${toolId}`,
        'TOOL_NOT_FOUND',
        'tool'
      );
    }

    const executionContext = {
      requestId: context?.requestId || this.generateRequestId(),
      startTime: Date.now(),
      ...context
    };

    return await tool.execute(action, params, executionContext);
  }

  /**
   * Executa uma tool sequence
   */
  async runToolSequence(sequenceId: string, input: any, context?: ExecutionContext): Promise<any> {
    const executionContext = {
      requestId: context?.requestId || this.generateRequestId(),
      startTime: Date.now(),
      ...context
    };

    return await this.toolSequenceExecutor.execute(
      sequenceId,
      input,
      executionContext,
      this.toolRegistry,
      this.mcpRegistry
    );
  }

  /**
   * Obtém informações do sistema
   */
  getSystemInfo() {
    return {
      version: this.config?.system.version || '3.0.0',
      name: this.config?.system.name || 'ChatIAS',
      environment: this.config?.system.environment || 'development',
      components: {
        agents: {
          total: this.agentRegistry.size(),
          loaded: this.agentRegistry.list().map(a => a.id)
        },
        tools: {
          total: this.toolRegistry.size(),
          loaded: this.toolRegistry.list().map(t => t.id)
        },
        mcps: {
          total: this.mcpRegistry.size(),
          loaded: this.mcpRegistry.list().map(m => m.id)
        },
        knowledgeBases: {
          total: this.kbRegistry.size(),
          loaded: this.kbRegistry.list().map(k => k.id)
        }
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * Destroy sistema e cleanup
   */
  async destroy(): Promise<void> {
    this.logger?.system('🔄 [Destroy] Desligando sistema...');

    // Destruir todos os componentes
    const destroyPromises: Promise<void>[] = [];

    for (const agent of this.agentRegistry.list()) {
      destroyPromises.push(agent.item.destroy());
    }

    for (const tool of this.toolRegistry.list()) {
      destroyPromises.push(tool.item.destroy());
    }

    for (const mcp of this.mcpRegistry.list()) {
      destroyPromises.push(mcp.item.disconnect());
    }

    for (const kb of this.kbRegistry.list()) {
      destroyPromises.push(kb.item.destroy());
    }

    await Promise.allSettled(destroyPromises);

    // Destruir logger
    this.logger?.destroy();

    // Limpar registries
    this.agentRegistry.clear();
    this.toolRegistry.clear();
    this.mcpRegistry.clear();
    this.kbRegistry.clear();
  }

  /**
   * Gera ID único para requisições
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Access aos registries
   */
  getAgentRegistry() { return this.agentRegistry; }
  getToolRegistry() { return this.toolRegistry; }
  getMcpRegistry() { return this.mcpRegistry; }
  getKnowledgeBaseRegistry() { return this.kbRegistry; }
  getToolSequenceExecutor() { return this.toolSequenceExecutor; }
  getConfig() { return this.config; }

  // Enterprise services - temporarily disabled for build
  /*
  private companyService: CompanyService | null = null;
  private departmentService: DepartmentService | null = null;
  private followUpService: FollowUpService | null = null;
  private automationService: AutomationService | null = null;
  private integrationService: IntegrationService | null = null;
  */

  /**
   * Carrega serviços enterprise do JSON config
   */
  /*
  private async loadEnterpriseServices(): Promise<void> {
    // Implementation temporarily disabled
  }
  */

  /**
   * Access aos serviços enterprise
   */
  /*
  getCompanyService(): CompanyService | null { return this.companyService; }
  getDepartmentService(): DepartmentService | null { return this.departmentService; }
  getFollowUpService(): FollowUpService | null { return this.followUpService; }
  getAutomationService(): AutomationService | null { return this.automationService; }
  getIntegrationService(): IntegrationService | null { return this.integrationService; }
  */
}

/**
 * Component Registry - Registry genérico para componentes
 * 
 * Implementa a interface Registry com methods padrão.
 */
class ComponentRegistry<T> implements Registry<T> {
  private components: Map<string, T> = new Map();

  register(id: string, component: T): void {
    this.components.set(id, component);
  }

  unregister(id: string): void {
    this.components.delete(id);
  }

  get(id: string): T | undefined {
    return this.components.get(id);
  }

  list(): Array<{ id: string; item: T }> {
    return Array.from(this.components.entries()).map(([id, item]) => ({
      id,
      item
    }));
  }

  size(): number {
    return this.components.size;
  }

  clear(): void {
    this.components.clear();
  }
}

/**
 * Função principal para criar o sistema
 * 
 * Esta é a função que será usada externamente:
 * 
 * ```typescript
 * import { createSystem } from '@chatias/core';
 * 
 * const system = await createSystem({
 *   configPath: './config/system.json'
 * });
 * 
 * await system.runAgent('code_analyzer', {
 *   code: 'const x = 10;',
 *   language: 'javascript'
 * });
 * ```
 */
export async function createSystem(options: {
  configPath?: string;
  strict?: boolean;
  verbose?: boolean;
  tenantId?: string;
  tenantSlug?: string;
  enableMultiTenant?: boolean;
}): Promise<SystemLoader> {
  const system = new SystemLoader();
  await system.initialize(options);
  return system;
}

// Export do tipo
export type { SystemLoader as ChatIASSystem };