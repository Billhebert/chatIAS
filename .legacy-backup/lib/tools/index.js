/**
 * Sistema modular de tools customizadas
 * @module lib/tools
 */

/**
 * Registry de tools customizadas
 */
export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.sources = new Map();
  }


  /**
   * Registra uma nova tool
   * @param {string} name - Nome da tool
   * @param {Object} tool - Configuração da tool
   */
  register(name, tool) {
    if (!tool.execute || typeof tool.execute !== "function") {
      throw new Error(`Tool ${name} deve ter um método execute()`);
    }

    this.tools.set(name, {
      name,
      description: tool.description || "",
      parameters: tool.parameters || {},
      execute: tool.execute,
      enabled: tool.enabled !== false,
      metadata: tool.metadata || {},
    });

    if (tool.source) {
      this.sources.set(name, tool.source);
    }

    console.log(`✅ Tool registrada: ${name}`);
  }


  /**
   * Remove uma tool do registry
   * @param {string} name - Nome da tool
   */
  unregister(name) {
    const removed = this.tools.delete(name);
    this.sources.delete(name);
    if (removed) {
      console.log(`🗑️ Tool removida: ${name}`);
    }
    return removed;
  }


  /**
   * Habilita uma tool
   * @param {string} name - Nome da tool
   */
  enable(name) {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = true;
      console.log(`✅ Tool habilitada: ${name}`);
    }
  }

  /**
   * Desabilita uma tool
   * @param {string} name - Nome da tool
   */
  disable(name) {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = false;
      console.log(`⏸️ Tool desabilitada: ${name}`);
    }
  }

  /**
   * Obtém uma tool
   * @param {string} name - Nome da tool
   * @returns {Object|null}
   */
  get(name) {
    return this.tools.get(name) || null;
  }

  getSource(name) {
    return this.sources.get(name) || null;
  }


  /**
   * Lista todas as tools
   * @param {boolean} onlyEnabled - Retorna apenas tools habilitadas
   * @returns {Array}
   */
  list(onlyEnabled = false) {
    const allTools = Array.from(this.tools.values()).map((tool) => ({
      ...tool,
      source: this.sources.get(tool.name) || tool.metadata?.source || "local",
    }));
    return onlyEnabled ? allTools.filter((t) => t.enabled) : allTools;
  }


  /**
   * Executa uma tool
   * @param {string} name - Nome da tool
   * @param {Object} params - Parâmetros da tool
   * @returns {Promise<any>}
   */
  async execute(name, params = {}) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool não encontrada: ${name}`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool desabilitada: ${name}`);
    }

    console.log(`🔧 Executando tool: ${name}`);
    return await tool.execute(params);
  }
}

/**
 * Cria uma instância do registry de tools
 * @returns {ToolRegistry}
 */
export function createToolRegistry() {
  return new ToolRegistry();
}

// Instância global
export const globalToolRegistry = createToolRegistry();
