/**
 * Centralized State Persistence Specifications.
 * Standardizes app-level and module-level state persistence, synchronous hydration at T=0,
 * debounced storage synchronization, and backup export/import.
 */

export interface PersistencePropertyConfig<T = any> {
  /** Default value if not previously saved */
  default: T
  /** Whether the property should be hydrated synchronously at startup (defaults to true) */
  sync?: boolean
  /** Schema version for migration */
  version?: number
  /** Optional migration function when schema version increments */
  migrate?: (oldValue: any, oldVersion: number) => T
}

/**
 * Declarative persistence configuration for a WebGIS module.
 * Modules specify which properties they need persisted without implementing custom storage logic.
 */
export interface ModulePersistenceSchema {
  /** Map of property keys to their persistence configuration or default value */
  readonly properties?: Record<string, PersistencePropertyConfig<any> | any>
}

/**
 * Universal application snapshot for full workspace backups and project exports.
 */
export interface AppWorkspaceSnapshot {
  version: number
  timestamp: number
  appName: string
  app: Record<string, any>
  modules: Record<string, Record<string, any>>
}
