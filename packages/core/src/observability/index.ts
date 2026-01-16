/**
 * Observability System with Advanced Logging and Metrics
 * 
 * This module provides enterprise-grade observability combining:
 * - Structured logging from projeto-SDK
 * - Modern metrics collection
 * - Event tracking and auditing
 * - Performance monitoring
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'eventemitter3';
import { 
  SystemConfig,
  LogTransport,
  SystemEvent,
  Registry,
  ExecutionContext
} from '../types/index.js';

/**
 * Logger Class - Enterprise-grade structured logging
 */
export class Logger extends EventEmitter {
  private transports: Map<string, LogTransportInstance> = new Map();
  private config: SystemConfig['observability']['logging'];
  private logBuffer: LogEntry[] = [];
  private bufferSize = 1000;
  private flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(config: SystemConfig['observability']['logging']) {
    super();
    this.config = config;
    this.setupTransports();
    this.startAutoFlush();
  }

  /**
   * Log a message with structured data
   */
  log(level: LogLevel, message: string, metadata?: any): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: metadata || {},
      requestId: metadata?.requestId,
      category: metadata?.category || 'app',
      source: metadata?.source || 'system'
    };

    this.addEntry(entry);
  }

  /**
   * Convenience methods
   */
  debug(message: string, metadata?: any): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.log('error', message, metadata);
  }

  /**
   * Specialized logging methods
   */
  request(method: string, path: string, body: any, requestId: string): void {
    this.info('HTTP Request', {
      category: 'request',
      method,
      path,
      body: this.sanitizeBody(body),
      requestId
    });
  }

  response(statusCode: number, duration: number, requestId: string): void {
    this.info('HTTP Response', {
      category: 'response',
      statusCode,
      duration,
      requestId
    });
  }

  agent(agentId: string, action: string, metadata?: any): void {
    this.info(`Agent ${action}`, {
      category: 'agent',
      agentId,
      action,
      ...metadata
    });
  }

  tool(toolId: string, action: string, metadata?: any): void {
    this.info(`Tool ${action}`, {
      category: 'tool',
      toolId,
      action,
      ...metadata
    });
  }

  mcp(mcpId: string, action: string, metadata?: any): void {
    this.info(`MCP ${action}`, {
      category: 'mcp',
      mcpId,
      action,
      ...metadata
    });
  }

  system(message: string, metadata?: any): void {
    this.info(message, {
      category: 'system',
      ...metadata
    });
  }

  /**
   * Get recent logs with filtering
   */
  getLogs(options: { 
    level?: LogLevel; 
    category?: string; 
    limit?: number;
    since?: Date;
  } = {}): LogEntry[] {
    let filtered = [...this.logBuffer];

    // Apply filters
    if (options.level) {
      const levelWeight = this.getLevelWeight(options.level);
      filtered = filtered.filter(entry => 
        this.getLevelWeight(entry.level) >= levelWeight
      );
    }

    if (options.category) {
      filtered = filtered.filter(entry => entry.category === options.category);
    }

    if (options.since) {
      const sinceTime = options.since.toISOString();
      filtered = filtered.filter(entry => entry.timestamp >= sinceTime);
    }

    // Sort by timestamp (newest first) and limit
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const limit = options.limit || 100;
    return filtered.slice(0, limit);
  }

  /**
   * Get logger statistics
   */
  getStats(): LoggerStats {
    const stats: LoggerStats = {
      totalLogs: this.logBuffer.length,
      byLevel: {},
      byCategory: {},
      transports: Array.from(this.transports.keys()),
      memoryUsage: process.memoryUsage()
    };

    // Count by level and category
    for (const entry of this.logBuffer) {
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear log buffer
   */
  clear(): void {
    this.logBuffer = [];
    this.emit('logs:cleared');
  }

  /**
   * Flush logs to all transports
   */
  flush(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    for (const transport of this.transports.values()) {
      try {
        transport.write(entries);
      } catch (error) {
        console.error(`Failed to write to transport ${transport.name}: ${error.message}`);
      }
    }

    this.emit('logs:flushed', { count: entries.length });
  }

  /**
   * Destroy logger and cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flush();
    this.transports.clear();
    this.removeAllListeners();
  }

  // Private methods

  private setupTransports(): void {
    for (const transportConfig of this.config.transports) {
      if (!transportConfig.enabled) {
        continue;
      }

      const transport = this.createTransport(transportConfig);
      if (transport) {
        this.transports.set(transportConfig.type, transport);
      }
    }
  }

  private createTransport(config: LogTransport): LogTransportInstance | null {
    switch (config.type) {
      case 'console':
        return new ConsoleTransport(config);
      
      case 'file':
        return new FileTransport(config);
      
      default:
        console.warn(`Unknown transport type: ${config.type}`);
        return null;
    }
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private addEntry(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Maintain buffer size
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.bufferSize);
    }

    // Emit for real-time streaming
    this.emit('log', entry);
  }

  private isEnabled(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configIndex = levels.indexOf(this.config.level);
    const messageIndex = levels.indexOf(level);
    
    return messageIndex >= configIndex;
  }

  private getLevelWeight(level: LogLevel): number {
    const weights = { debug: 0, info: 1, warn: 2, error: 3 };
    return weights[level] || 0;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    // Remove sensitive fields
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Metrics Collector - Performance and usage metrics
 */
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Record a counter metric
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.enabled) return;

    const key = this.makeKey(name, tags);
    const counter = this.counters.get(key) || new Counter(name, tags);
    counter.increment(value);
    this.counters.set(key, counter);
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled) return;

    const key = this.makeKey(name, tags);
    const gauge = this.gauges.get(key) || new Gauge(name, tags);
    gauge.set(value);
    this.gauges.set(key, gauge);
  }

  /**
   * Record a histogram metric
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled) return;

    const key = this.makeKey(name, tags);
    const histogram = this.histograms.get(key) || new Histogram(name, tags);
    histogram.observe(value);
    this.histograms.set(key, histogram);
  }

  /**
   * Record execution time
   */
  timer(name: string, tags?: Record<string, string>): Timer {
    if (!this.enabled) {
      return new NoOpTimer();
    }

    const key = this.makeKey(name, tags);
    const histogram = this.histograms.get(key) || new Histogram(name, tags);
    this.histograms.set(key, histogram);
    
    return new Timer(histogram);
  }

  /**
   * Get all metrics
   */
  getMetrics(): MetricsSnapshot {
    return {
      counters: Array.from(this.counters.values()).map(c => c.getValue()),
      gauges: Array.from(this.gauges.values()).map(g => g.getValue()),
      histograms: Array.from(this.histograms.values()).map(h => h.getValue()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private makeKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    
    const tagPairs = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${name}{${tagPairs}}`;
  }
}

/**
 * Event Tracker - System event tracking and auditing
 */
export class EventTracker extends EventEmitter implements Registry<SystemEvent> {
  private events: Map<string, SystemEvent[]> = new Map();
  private maxEventsPerType = 1000;
  private auditFile?: string;

  constructor(auditFile?: string) {
    super();
    this.auditFile = auditFile;
  }

  register(id: string, event: SystemEvent): void {
    const events = this.events.get(event.type) || [];
    events.push(event);
    
    // Maintain size limit
    if (events.length > this.maxEventsPerType) {
      events.shift();
    }
    
    this.events.set(event.type, events);
    this.emit('event', event);

    // Write to audit file if configured
    if (this.auditFile && this.shouldAudit(event)) {
      this.writeToAudit(event);
    }
  }

  unregister(id: string): void {
    // Not implemented for events (they're immutable once registered)
  }

  get(id: string): SystemEvent | undefined {
    const events = this.events.get(id);
    return events ? events[events.length - 1] : undefined;
  }

  list(): Array<{ id: string; item: SystemEvent }> {
    const result: Array<{ id: string; item: SystemEvent }> = [];
    
    for (const [type, events] of this.events) {
      for (const event of events) {
        result.push({ id: `${type}_${event.timestamp}`, item: event });
      }
    }

    return result;
  }

  size(): number {
    return Array.from(this.events.values())
      .reduce((total, events) => total + events.length, 0);
  }

  clear(): void {
    this.events.clear();
    this.emit('events:cleared');
  }

  /**
   * Get events by type with filtering
   */
  getEvents(type: string, options: { since?: Date; limit?: number } = {}): SystemEvent[] {
    let events = this.events.get(type) || [];

    if (options.since) {
      const sinceTime = options.since.toISOString();
      events = events.filter(event => event.timestamp >= sinceTime);
    }

    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private shouldAudit(event: SystemEvent): boolean {
    // Implement audit logic based on governance config
    const auditableActions = [
      'agent.execute',
      'tool.execute', 
      'mcp.query',
      'config.reload',
      'user.login',
      'user.logout'
    ];

    return auditableActions.includes(event.type);
  }

  private writeToAudit(event: SystemEvent): void {
    if (!this.auditFile) return;

    try {
      const auditEntry = {
        timestamp: event.timestamp,
        type: event.type,
        source: event.source,
        requestId: event.requestId,
        data: event.data
      };

      const auditLine = JSON.stringify(auditEntry) + '\n';
      appendFileSync(this.auditFile, auditLine, 'utf-8');
    } catch (error) {
      console.error(`Failed to write audit entry: ${error.message}`);
    }
  }
}

// Supporting Classes

class ConsoleTransport implements LogTransportInstance {
  name = 'console';
  private config: LogTransport;
  private colors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[36m',   // blue  
    warn: '\x1b[33m',   // yellow
    error: '\x1b[31m'   // red
  };
  private reset = '\x1b[0m';

  constructor(config: LogTransport) {
    this.config = config;
  }

  write(entries: LogEntry[]): void {
    const format = this.config.format || 'simple';
    
    for (const entry of entries) {
      const color = this.colors[entry.level];
      const timestamp = entry.timestamp.substring(11, 19); // HH:mm:ss.sss
      
      if (format === 'colored') {
        console.log(
          `${color}[${timestamp}] ${entry.level.toUpperCase()}${this.reset} [${entry.category}] ${entry.message}`,
          entry.metadata
        );
      } else {
        console.log(
          `[${timestamp}] ${entry.level.toUpperCase()} [${entry.category}] ${entry.message}`,
          entry.metadata
        );
      }
    }
  }
}

class FileTransport implements LogTransportInstance {
  name = 'file';
  private config: LogTransport;
  private filePath: string;

  constructor(config: LogTransport) {
    this.config = config;
    
    if (!config.location) {
      throw new Error('File transport requires location');
    }
    
    this.filePath = config.location;
    
    // Ensure directory exists
    const dir = join(this.filePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  write(entries: LogEntry[]): void {
    const lines = entries.map(entry => 
      JSON.stringify(entry) + '\n'
    ).join('');
    
    try {
      appendFileSync(this.filePath, lines, 'utf-8');
      
      // Check file size and rotate if necessary
      this.rotateIfNeeded();
      
    } catch (error) {
      console.error(`Failed to write to file ${this.filePath}: ${error.message}`);
    }
  }

  private rotateIfNeeded(): void {
    try {
      const stats = existsSync(this.filePath) ? 
        require('fs').statSync(this.filePath) : null;
      
      const maxSize = this.parseSize(this.config.maxSize || '10mb');
      
      if (stats && stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = this.filePath.replace(/(\.[^.]+)$/, `.rotated-${timestamp}$1`);
        require('fs').renameSync(this.filePath, rotatedPath);
      }
    } catch (error) {
      console.error(`Failed to rotate log file: ${error.message}`);
    }
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    const multipliers = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    return value * multipliers[unit as keyof typeof multipliers];
  }
}

class Counter {
  constructor(
    private name: string,
    private tags?: Record<string, string>,
    private value: number = 0
  ) {}

  increment(amount: number = 1): void {
    this.value += amount;
  }

  getValue() {
    return {
      name: this.name,
      tags: this.tags,
      value: this.value,
      type: 'counter'
    };
  }
}

class Gauge {
  constructor(
    private name: string,
    private tags?: Record<string, string>,
    private value: number = 0
  ) {}

  set(value: number): void {
    this.value = value;
  }

  getValue() {
    return {
      name: this.name,
      tags: this.tags,
      value: this.value,
      type: 'gauge'
    };
  }
}

class Histogram {
  private values: number[] = [];
  private count: number = 0;
  private sum: number = 0;

  constructor(
    private name: string,
    private tags?: Record<string, string>
  ) {}

  observe(value: number): void {
    this.values.push(value);
    this.count++;
    this.sum += value;
  }

  getValue() {
    const sorted = [...this.values].sort((a, b) => a - b);
    
    return {
      name: this.name,
      tags: this.tags,
      count: this.count,
      sum: this.sum,
      min: sorted.length > 0 ? sorted[0] : 0,
      max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      mean: this.count > 0 ? this.sum / this.count : 0,
      type: 'histogram'
    };
  }
}

class Timer {
  private startTime: number;

  constructor(private histogram: Histogram) {
    this.startTime = Date.now();
  }

  stop(): number {
    const duration = Date.now() - this.startTime;
    this.histogram.observe(duration);
    return duration;
  }
}

class NoOpTimer {
  stop(): number {
    return 0;
  }
}

// Types
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata: any;
  requestId?: string;
  category: string;
  source: string;
}

interface LogTransportInstance {
  name: string;
  write(entries: LogEntry[]): void;
}

interface LoggerStats {
  totalLogs: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  transports: string[];
  memoryUsage: NodeJS.MemoryUsage;
}

interface Metric {
  name: string;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

interface Counter extends Metric {
  increment(amount?: number): void;
  getValue(): Metric;
}

interface Gauge extends Metric {
  set(value: number): void;
  getValue(): Metric;
}

interface Histogram extends Metric {
  observe(value: number): void;
  getValue(): Metric & {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
  };
}

interface MetricsSnapshot {
  counters: Metric[];
  gauges: Metric[];
  histograms: (Metric & {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
  })[];
  timestamp: string;
}

// Export instances
export function createLogger(config: SystemConfig['observability']['logging']): Logger {
  return new Logger(config);
}

export function createMetricsCollector(enabled: boolean = true): MetricsCollector {
  return new MetricsCollector(enabled);
}

export function createEventTracker(auditFile?: string): EventTracker {
  return new EventTracker(auditFile);
}