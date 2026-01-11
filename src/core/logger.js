/**
 * Logger System - Sistema de logs centralizado com categorias e níveis
 */

import { EventEmitter } from 'events';

class Logger extends EventEmitter {
  constructor() {
    super();
    this.logs = [];
    this.maxLogs = 10000; // Mantém últimos 10k logs em memória
    this.stats = {
      info: 0,
      success: 0,
      warn: 0,
      error: 0,
      debug: 0
    };
  }

  /**
   * Cria entrada de log
   */
  _createEntry(level, category, message, data = null, requestId = null) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      requestId
    };

    this.logs.push(entry);
    this.stats[level]++;

    // Remove logs antigos se ultrapassar limite
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emite evento para listeners (ex: SSE)
    this.emit('log', entry);

    return entry;
  }

  /**
   * Formata e imprime log no console
   */
  _print(entry) {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[90m'    // Gray
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';

    const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`;
    const category = `[${entry.category}]`;
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    
    console.log(`${prefix} ${category} ${entry.message}${dataStr}`);
  }

  /**
   * Logs informativos
   */
  info(category, message, data = null, requestId = null) {
    const entry = this._createEntry('info', category, message, data, requestId);
    this._print(entry);
    return entry;
  }

  /**
   * Logs de sucesso
   */
  success(category, message, data = null, requestId = null) {
    const entry = this._createEntry('success', category, message, data, requestId);
    this._print(entry);
    return entry;
  }

  /**
   * Logs de aviso
   */
  warn(category, message, data = null, requestId = null) {
    const entry = this._createEntry('warn', category, message, data, requestId);
    this._print(entry);
    return entry;
  }

  /**
   * Logs de erro
   */
  error(category, message, data = null, requestId = null) {
    const entry = this._createEntry('error', category, message, data, requestId);
    this._print(entry);
    return entry;
  }

  /**
   * Logs de debug
   */
  debug(category, message, data = null, requestId = null) {
    if (process.env.DEBUG) {
      const entry = this._createEntry('debug', category, message, data, requestId);
      this._print(entry);
      return entry;
    }
  }

  /**
   * Logs de request HTTP
   */
  request(method, path, body, requestId) {
    const bodyStr = body && Object.keys(body).length > 0 
      ? JSON.stringify(body).substring(0, 100) 
      : null;
    
    return this.info('request', `${method} ${path}`, 
      bodyStr ? { body: bodyStr } : null, 
      requestId
    );
  }

  /**
   * Logs de response HTTP
   */
  response(status, duration, requestId) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'success';
    return this[level]('response', `Status ${status} in ${duration}ms`, 
      { status, duration }, 
      requestId
    );
  }

  /**
   * Obtém logs com filtros
   */
  getLogs(options = {}) {
    const {
      limit = 100,
      level = null,
      category = null,
      requestId = null
    } = options;

    let filtered = [...this.logs];

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }

    if (requestId) {
      filtered = filtered.filter(log => log.requestId === requestId);
    }

    // Retorna os mais recentes
    return filtered.slice(-limit).reverse();
  }

  /**
   * Obtém logs de uma request específica
   */
  getRequestLogs(requestId) {
    return this.logs.filter(log => log.requestId === requestId);
  }

  /**
   * Estatísticas de logs
   */
  getStats() {
    return {
      total: this.logs.length,
      ...this.stats,
      oldestLog: this.logs[0]?.timestamp || null,
      newestLog: this.logs[this.logs.length - 1]?.timestamp || null
    };
  }

  /**
   * Limpa todos os logs
   */
  clear() {
    this.logs = [];
    this.stats = {
      info: 0,
      success: 0,
      warn: 0,
      error: 0,
      debug: 0
    };
  }
}

// Instância singleton
export const logger = new Logger();
