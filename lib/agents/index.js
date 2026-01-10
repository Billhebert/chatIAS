/**
 * Sistema modular de agentes
 * @module lib/agents
 */

/**
 * Gerenciador de agentes
 */
export class AgentManager {
  constructor() {
    this.agents = new Map();
  }

  /**
   * Registra um agente
   * @param {string} name - Nome do agente
   * @param {Object} config - Configuração do agente
   */
  register(name, config) {
    this.agents.set(name, {
      name,
      description: config.description || "",
      mode: config.mode || "subagent", // "primary", "subagent", "all"
      model: config.model || null,
      temperature: config.temperature || 0.7,
      maxSteps: config.maxSteps || 30,
      tools: config.tools || { "*": true },
      permission: config.permission || {},
      prompt: config.prompt || "",
      enabled: config.enabled !== false,
      hidden: config.hidden || false,
    });

    console.log(`✅ Agente registrado: ${name} (${config.mode})`);
  }

  /**
   * Remove um agente
   * @param {string} name - Nome do agente
   */
  unregister(name) {
    const removed = this.agents.delete(name);
    if (removed) {
      console.log(`🗑️ Agente removido: ${name}`);
    }
    return removed;
  }

  /**
   * Habilita um agente
   * @param {string} name - Nome do agente
   */
  enable(name) {
    const agent = this.agents.get(name);
    if (agent) {
      agent.enabled = true;
      console.log(`✅ Agente habilitado: ${name}`);
    }
  }

  /**
   * Desabilita um agente
   * @param {string} name - Nome do agente
   */
  disable(name) {
    const agent = this.agents.get(name);
    if (agent) {
      agent.enabled = false;
      console.log(`⏸️ Agente desabilitado: ${name}`);
    }
  }

  /**
   * Obtém um agente
   * @param {string} name - Nome do agente
   * @returns {Object|null}
   */
  get(name) {
    return this.agents.get(name) || null;
  }

  /**
   * Lista agentes
   * @param {Object} filters - Filtros (mode, enabled)
   * @returns {Array}
   */
  list(filters = {}) {
    let agents = Array.from(this.agents.values());

    if (filters.mode) {
      agents = agents.filter((a) => a.mode === filters.mode || a.mode === "all");
    }

    if (filters.enabled !== undefined) {
      agents = agents.filter((a) => a.enabled === filters.enabled);
    }

    if (filters.hidden === false) {
      agents = agents.filter((a) => !a.hidden);
    }

    return agents;
  }

  /**
   * Lista agentes primários
   * @returns {Array}
   */
  listPrimary() {
    return this.list({ mode: "primary", enabled: true });
  }

  /**
   * Lista subagentes
   * @returns {Array}
   */
  listSubagents() {
    return this.list({ mode: "subagent", enabled: true, hidden: false });
  }

  /**
   * Configura ferramentas de um agente
   * @param {string} name - Nome do agente
   * @param {Object} tools - Configuração de ferramentas
   */
  setTools(name, tools) {
    const agent = this.agents.get(name);
    if (agent) {
      agent.tools = { ...agent.tools, ...tools };
      console.log(`🔧 Ferramentas atualizadas para agente: ${name}`);
    }
  }

  /**
   * Configura permissões de um agente
   * @param {string} name - Nome do agente
   * @param {Object} permissions - Configuração de permissões
   */
  setPermissions(name, permissions) {
    const agent = this.agents.get(name);
    if (agent) {
      agent.permission = { ...agent.permission, ...permissions };
      console.log(`🔐 Permissões atualizadas para agente: ${name}`);
    }
  }
}

/**
 * Cria uma instância do gerenciador de agentes
 * @returns {AgentManager}
 */
export function createAgentManager() {
  return new AgentManager();
}

// Instância global
export const globalAgentManager = createAgentManager();
