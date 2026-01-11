/**
 * Sistema modular de MCP (Model Context Protocol) Servers
 * @module lib/mcp
 */

import { spawn } from "child_process";

/**
 * Gerenciador de servidores MCP
 */
export class MCPServerManager {
  constructor() {
    this.servers = new Map();
  }

  /**
   * Registra um servidor MCP local
   * @param {string} name - Nome do servidor
   * @param {Object} config - Configuração do servidor
   */
  registerLocal(name, config) {
    if (!config.command || !Array.isArray(config.command)) {
      throw new Error(`Servidor MCP ${name} precisa de um comando válido`);
    }

    this.servers.set(name, {
      name,
      type: "local",
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      timeout: config.timeout || 5000,
      enabled: config.enabled !== false,
      process: null,
    });

    console.log(`✅ Servidor MCP registrado: ${name}`);
  }

  /**
   * Registra um servidor MCP remoto
   * @param {string} name - Nome do servidor
   * @param {Object} config - Configuração do servidor
   */
  registerRemote(name, config) {
    if (!config.url) {
      throw new Error(`Servidor MCP remoto ${name} precisa de uma URL`);
    }

    this.servers.set(name, {
      name,
      type: "remote",
      url: config.url,
      headers: config.headers || {},
      auth: config.auth || null,
      enabled: config.enabled !== false,
    });

    console.log(`✅ Servidor MCP remoto registrado: ${name}`);
  }

  /**
   * Inicia um servidor MCP local
   * @param {string} name - Nome do servidor
   * @returns {Promise<boolean>}
   */
  async startLocal(name) {
    const server = this.servers.get(name);

    if (!server) {
      throw new Error(`Servidor MCP não encontrado: ${name}`);
    }

    if (server.type !== "local") {
      throw new Error(`Servidor ${name} não é local`);
    }

    if (!server.enabled) {
      console.log(`⏸️ Servidor ${name} está desabilitado`);
      return false;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout ao iniciar servidor ${name}`));
      }, server.timeout);

      try {
        const process = spawn(server.command[0], [...server.command.slice(1), ...server.args], {
          env: { ...process.env, ...server.env },
          stdio: ["pipe", "pipe", "pipe"],
        });

        server.process = process;

        process.stdout.on("data", (data) => {
          console.log(`[${name}] ${data.toString()}`);
        });

        process.stderr.on("data", (data) => {
          console.error(`[${name}] ${data.toString()}`);
        });

        process.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        process.on("spawn", () => {
          clearTimeout(timeout);
          console.log(`🚀 Servidor MCP iniciado: ${name}`);
          resolve(true);
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Para um servidor MCP local
   * @param {string} name - Nome do servidor
   */
  stopLocal(name) {
    const server = this.servers.get(name);

    if (!server || server.type !== "local" || !server.process) {
      return;
    }

    server.process.kill();
    server.process = null;
    console.log(`🛑 Servidor MCP parado: ${name}`);
  }

  /**
   * Habilita um servidor
   * @param {string} name - Nome do servidor
   */
  enable(name) {
    const server = this.servers.get(name);
    if (server) {
      server.enabled = true;
      console.log(`✅ Servidor MCP habilitado: ${name}`);
    }
  }

  /**
   * Desabilita um servidor
   * @param {string} name - Nome do servidor
   */
  disable(name) {
    const server = this.servers.get(name);
    if (server) {
      server.enabled = false;
      if (server.type === "local" && server.process) {
        this.stopLocal(name);
      }
      console.log(`⏸️ Servidor MCP desabilitado: ${name}`);
    }
  }

  /**
   * Lista servidores MCP
   * @param {boolean} onlyEnabled - Retorna apenas servidores habilitados
   * @returns {Array}
   */
  list(onlyEnabled = false) {
    const servers = Array.from(this.servers.values());
    return onlyEnabled ? servers.filter((s) => s.enabled) : servers;
  }

  /**
   * Para todos os servidores locais
   */
  stopAll() {
    for (const [name, server] of this.servers) {
      if (server.type === "local" && server.process) {
        this.stopLocal(name);
      }
    }
  }
}

/**
 * Cria uma instância do gerenciador MCP
 * @returns {MCPServerManager}
 */
export function createMCPManager() {
  return new MCPServerManager();
}

// Instância global
export const globalMCPManager = createMCPManager();
