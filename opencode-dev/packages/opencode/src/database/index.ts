/**
 * Database connection module for PostgreSQL
 * Provides connection pooling and query utilities for SUATEC
 */

import { Log } from "../util/log"

const log = Log.create({ service: "database" })

// ==================== TIPOS ====================

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
  maxConnections?: number
}

export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
}

// ==================== CONFIGURAÇÃO ====================

// Configuração padrão (pode ser sobrescrita por variáveis de ambiente)
const defaultConfig: DatabaseConfig = {
  host: process.env.SUATEC_DB_HOST || "localhost",
  port: parseInt(process.env.SUATEC_DB_PORT || "5432"),
  database: process.env.SUATEC_DB_NAME || "suatec",
  user: process.env.SUATEC_DB_USER || "suatec",
  password: process.env.SUATEC_DB_PASSWORD || "suatec_secret_2024",
  ssl: process.env.SUATEC_DB_SSL === "true",
  maxConnections: parseInt(process.env.SUATEC_DB_MAX_CONNECTIONS || "10"),
}

// ==================== DATABASE CLIENT ====================

export namespace Database {
  let pool: any = null
  let config: DatabaseConfig = defaultConfig
  let isConnected = false
  let usePostgres = process.env.SUATEC_USE_POSTGRES === "true"

  /**
   * Configure database connection
   */
  export function configure(newConfig: Partial<DatabaseConfig>): void {
    config = { ...config, ...newConfig }
  }

  /**
   * Enable or disable PostgreSQL (fallback to JSON file)
   */
  export function setUsePostgres(use: boolean): void {
    usePostgres = use
  }

  /**
   * Check if PostgreSQL is enabled
   */
  export function isPostgresEnabled(): boolean {
    return usePostgres
  }

  /**
   * Initialize database connection pool
   */
  export async function connect(): Promise<boolean> {
    if (!usePostgres) {
      log.info("PostgreSQL disabled, using JSON file storage")
      return false
    }

    if (isConnected && pool) {
      return true
    }

    try {
      // Dynamic import to avoid loading pg when not using PostgreSQL
      const { Pool } = await import("pg")
      
      pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: config.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      })

      // Test connection
      const client = await pool.connect()
      await client.query("SELECT 1")
      client.release()

      isConnected = true
      log.info("Connected to PostgreSQL", {
        host: config.host,
        port: config.port,
        database: config.database,
      })

      return true
    } catch (err: any) {
      log.error("Failed to connect to PostgreSQL", { error: err.message })
      isConnected = false
      pool = null
      return false
    }
  }

  /**
   * Close database connection pool
   */
  export async function disconnect(): Promise<void> {
    if (pool) {
      await pool.end()
      pool = null
      isConnected = false
      log.info("Disconnected from PostgreSQL")
    }
  }

  /**
   * Check if database is connected
   */
  export function connected(): boolean {
    return isConnected && pool !== null
  }

  /**
   * Execute a query
   */
  export async function query<T = any>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!connected()) {
      throw new Error("Database not connected")
    }

    try {
      const result = await pool.query(sql, params)
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      }
    } catch (err: any) {
      log.error("Query failed", { sql: sql.substring(0, 100), error: err.message })
      throw err
    }
  }

  /**
   * Execute a query and return first row
   */
  export async function queryOne<T = any>(
    sql: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await query<T>(sql, params)
    return result.rows[0] ?? null
  }

  /**
   * Execute a query in a transaction
   */
  export async function transaction<T>(
    fn: (query: typeof Database.query) => Promise<T>
  ): Promise<T> {
    if (!connected()) {
      throw new Error("Database not connected")
    }

    const client = await pool.connect()
    
    try {
      await client.query("BEGIN")
      
      const transactionQuery = async <R = any>(
        sql: string,
        params?: any[]
      ): Promise<QueryResult<R>> => {
        const result = await client.query(sql, params)
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
        }
      }

      const result = await fn(transactionQuery as typeof Database.query)
      
      await client.query("COMMIT")
      return result
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Health check for the database
   */
  export async function healthCheck(): Promise<{
    connected: boolean
    latencyMs: number
    error?: string
  }> {
    if (!usePostgres) {
      return { connected: false, latencyMs: 0, error: "PostgreSQL disabled" }
    }

    const start = Date.now()
    
    try {
      if (!connected()) {
        await connect()
      }
      
      await query("SELECT 1")
      
      return {
        connected: true,
        latencyMs: Date.now() - start,
      }
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      }
    }
  }
}

export default Database
