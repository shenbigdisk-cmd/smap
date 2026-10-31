import { localDbDelete, localDbGet, localDbSet } from '../localDb'
import type { AppWorkspaceSnapshot, ModulePersistenceSchema, PersistencePropertyConfig } from './types'

/**
 * Centralized State Persistence Engine.
 * 
 * Provides an app-level unified persist/restore mechanism so that modules
 * and core stores never need to write ad-hoc storage or lifecycle code.
 * Modules simply specify what properties/config they need persisted.
 *
 * Key Capabilities:
 * 1. Synchronous Hydration (T=0): In-memory cache loaded instantly from localStorage
 *    before components render, completely eliminating layout & layer visual flicker.
 * 2. Multi-tier Durability: Synchronous localStorage write + asynchronous IndexedDB persistence.
 * 3. Transparent Reactive State: Automatically wraps module state in a Proxy that debounces
 *    and saves mutations without requiring save/load method boilerplate.
 * 4. Cross-tab Synchronization: Automatically listens to storage events to sync tabs.
 * 5. Universal Workspace Snapshot: One-click export/import for backups and presets.
 */
export class PersistenceEngine {
  private static instance: PersistenceEngine | null = null

  private memoryCache = new Map<string, any>()
  private saveTimers = new Map<string, number>()
  private subscribers = new Map<string, Set<(value: any) => void>>()
  private schemas = new Map<string, ModulePersistenceSchema>()

  static getInstance(): PersistenceEngine {
    if (!PersistenceEngine.instance) {
      PersistenceEngine.instance = new PersistenceEngine()
    }
    return PersistenceEngine.instance
  }

  constructor() {
    this.hydrateSync()
    this.initStorageListener()
  }

  /**
   * Synchronously hydrate all `smap` keys from localStorage into in-memory cache at T=0.
   */
  public hydrateSync(): void {
    if (typeof localStorage === 'undefined') return
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('smap_') || key.startsWith('smap:'))) {
          const raw = localStorage.getItem(key)
          if (raw !== null) {
            try {
              this.memoryCache.set(key, JSON.parse(raw))
            } catch {
              this.memoryCache.set(key, raw)
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PersistenceEngine] Synchronous hydration warning:', err)
    }
  }

  /**
   * Listen for storage events from other browser tabs to synchronize state reactively.
   */
  private initStorageListener(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('storage', (e) => {
      if (!e.key || (!e.key.startsWith('smap_') && !e.key.startsWith('smap:'))) return
      let newVal: any = undefined
      if (e.newValue !== null) {
        try {
          newVal = JSON.parse(e.newValue)
        } catch {
          newVal = e.newValue
        }
      }
      if (newVal === undefined) {
        this.memoryCache.delete(e.key)
      } else {
        this.memoryCache.set(e.key, newVal)
      }
      this.notifySubscribers(e.key, newVal)
    })
  }

  /**
   * Synchronously retrieve a value by key.
   */
  get<T>(key: string, defaultValue?: T): T {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        try {
          const parsed = JSON.parse(raw)
          this.memoryCache.set(key, parsed)
          return parsed as T
        } catch {
          this.memoryCache.set(key, raw)
          return raw as unknown as T
        }
      }
    }
    return defaultValue as T
  }

  /**
   * Asynchronously retrieve a value from IndexedDB fallback if missing from cache.
   */
  async getDurable<T>(key: string, defaultValue?: T): Promise<T> {
    const mem = this.get<T>(key)
    if (mem !== undefined) return mem

    try {
      const dbVal = await localDbGet<T>(key)
      if (dbVal !== undefined) {
        this.memoryCache.set(key, dbVal)
        return dbVal
      }
    } catch {}

    return defaultValue as T
  }

  /**
   * Persist a value by key.
   * Updates in-memory cache immediately, schedules debounced localStorage and IndexedDB write.
   */
  set<T>(key: string, value: T, immediate = false, debounceMs = 250): void {
    this.memoryCache.set(key, value)
    this.notifySubscribers(key, value)

    if (immediate) {
      const existing = this.saveTimers.get(key)
      if (existing) {
        clearTimeout(existing)
        this.saveTimers.delete(key)
      }
      this.commitToDisk(key, value)
    } else {
      const existing = this.saveTimers.get(key)
      if (existing) clearTimeout(existing)
      const timer = window.setTimeout(() => {
        this.saveTimers.delete(key)
        this.commitToDisk(key, value)
      }, debounceMs)
      this.saveTimers.set(key, timer)
    }
  }

  private commitToDisk<T>(key: string, value: T): void {
    try {
      if (typeof localStorage !== 'undefined') {
        if (value === undefined) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, JSON.stringify(value))
        }
      }
    } catch (err) {
      console.warn(`[PersistenceEngine] Failed to write key '${key}' to localStorage:`, err)
    }

    try {
      if (value === undefined) {
        localDbDelete(key).catch(() => {})
      } else {
        localDbSet(key, value).catch(() => {})
      }
    } catch {}
  }

  /**
   * Remove a persisted key.
   */
  remove(key: string): void {
    this.memoryCache.delete(key)
    const existing = this.saveTimers.get(key)
    if (existing) {
      clearTimeout(existing)
      this.saveTimers.delete(key)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
    localDbDelete(key).catch(() => {})
    this.notifySubscribers(key, undefined)
  }

  /**
   * Subscribe to value changes for a specific key (local mutations and cross-tab storage events).
   */
  subscribe<T>(key: string, callback: (value: T) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }
    const set = this.subscribers.get(key)!
    set.add(callback as any)
    return () => {
      set.delete(callback as any)
      if (set.size === 0) this.subscribers.delete(key)
    }
  }

  private notifySubscribers(key: string, value: any): void {
    const set = this.subscribers.get(key)
    if (set) {
      for (const cb of set) {
        try {
          cb(value)
        } catch (e) {
          console.error(`[PersistenceEngine] Subscriber error for key '${key}':`, e)
        }
      }
    }
  }

  // =========================================================================
  // Module Scoped Persistence API
  // =========================================================================

  /**
   * Canonical key for a module's composite state or sub-property.
   */
  getModuleKey(moduleId: string, propKey?: string): string {
    return propKey ? `smap:mod:${moduleId}:${propKey}` : `smap:mod:${moduleId}`
  }

  /**
   * Register a module's persistence schema with default values.
   */
  registerModuleSchema(moduleId: string, schema: ModulePersistenceSchema): void {
    this.schemas.set(moduleId, schema)
  }

  /**
   * Synchronously retrieve a module's entire composite persisted state.
   */
  getModuleState<T extends Record<string, any>>(moduleId: string, defaults: T): T {
    const key = this.getModuleKey(moduleId)
    const saved = this.get<Partial<T>>(key)
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return { ...defaults, ...saved }
    }
    return { ...defaults }
  }

  /**
   * Save a module's entire composite persisted state.
   */
  setModuleState<T extends Record<string, any>>(moduleId: string, state: T, immediate = false): void {
    const key = this.getModuleKey(moduleId)
    this.set(key, state, immediate)
  }

  /**
   * Get an individual persisted property for a module.
   */
  getModuleProp<T>(moduleId: string, propKey: string, defaultValue?: T): T {
    // 1. Check composite module state object
    const moduleStateKey = this.getModuleKey(moduleId)
    const composite = this.get<Record<string, any>>(moduleStateKey)
    if (composite && propKey in composite) {
      return composite[propKey] as T
    }

    // 2. Check individual namespaced property key
    const propKeyFull = this.getModuleKey(moduleId, propKey)
    return this.get<T>(propKeyFull, defaultValue)
  }

  /**
   * Set an individual persisted property for a module.
   */
  setModuleProp<T>(moduleId: string, propKey: string, value: T, immediate = false): void {
    // Also update composite state for coherence
    const moduleStateKey = this.getModuleKey(moduleId)
    const composite = this.get<Record<string, any>>(moduleStateKey) || {}
    composite[propKey] = value
    this.set(moduleStateKey, composite, immediate)

    // And set specific prop key
    const propKeyFull = this.getModuleKey(moduleId, propKey)
    this.set(propKeyFull, value, immediate)
  }

  /**
   * Creates an auto-persisting reactive state proxy for a module.
   * Any property read returns the persisted or default value.
   * Any property mutation automatically triggers debounced centralized persistence.
   * Module authors write ZERO save or load boilerplate!
   */
  createModulePersistedState<T extends Record<string, any>>(moduleId: string, defaults: T): T {
    const initial = this.getModuleState(moduleId, defaults)
    const current = { ...initial }
    const engine = this

    const proxy = new Proxy(current, {
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver)
      },
      set(target, prop, value, receiver) {
        const res = Reflect.set(target, prop, value, receiver)
        if (typeof prop === 'string') {
          engine.setModuleState(moduleId, target)
        }
        return res
      }
    })

    return proxy as T
  }

  /**
   * Reset a specific module's persisted state back to defaults.
   */
  resetModuleState(moduleId: string): void {
    const prefix = `smap:mod:${moduleId}`
    this.remove(prefix)
    if (typeof localStorage !== 'undefined') {
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) toRemove.push(k)
      }
      for (const k of toRemove) this.remove(k)
    }
  }

  // =========================================================================
  // Application Workspace Snapshot Export / Import
  // =========================================================================

  /**
   * Generate a complete JSON export of all application & module state.
   */
  exportSnapshot(): AppWorkspaceSnapshot {
    const appData: Record<string, any> = {}
    const modData: Record<string, Record<string, any>> = {}

    for (const [key, val] of this.memoryCache.entries()) {
      if (key.startsWith('smap:mod:')) {
        const parts = key.split(':')
        const modId = parts[2]
        if (!modData[modId]) modData[modId] = {}
        if (parts.length === 3) {
          modData[modId] = { ...modData[modId], ...val }
        } else {
          modData[modId][parts[3]] = val
        }
      } else if (key.startsWith('smap_') || key.startsWith('smap:app:')) {
        appData[key] = val
      }
    }

    return {
      version: 1,
      timestamp: Date.now(),
      appName: 'VicPlan smap',
      app: appData,
      modules: modData
    }
  }

  /**
   * Import a workspace snapshot, restoring app and module settings instantly.
   */
  importSnapshot(snapshot: AppWorkspaceSnapshot): void {
    if (!snapshot || !snapshot.app) {
      throw new Error('Invalid workspace snapshot format')
    }

    // Restore app-level keys
    for (const [key, val] of Object.entries(snapshot.app)) {
      this.set(key, val, true)
    }

    // Restore module states
    if (snapshot.modules) {
      for (const [modId, state] of Object.entries(snapshot.modules)) {
        this.setModuleState(modId, state, true)
      }
    }
  }

  /**
   * Clear all persisted state across the entire application and all modules.
   */
  clearAll(): void {
    this.memoryCache.clear()
    this.saveTimers.forEach((timer) => clearTimeout(timer))
    this.saveTimers.clear()

    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('smap_') || k.startsWith('smap:'))) {
          keysToRemove.push(k)
        }
      }
      for (const k of keysToRemove) localStorage.removeItem(k)
    }

    this.subscribers.forEach((set) => {
      for (const cb of set) {
        try { cb(undefined) } catch {}
      }
    })
  }
}

export const persistenceEngine = PersistenceEngine.getInstance()
