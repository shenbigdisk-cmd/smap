import type { IModuleStorage } from './types'
import { persistenceEngine } from '../../services/persistence'

/**
 * Scoped persistent key-value storage implementation for individual WebGIS modules.
 * Delegates to centralized PersistenceEngine with automatic multi-tier storage
 * (localStorage synchronous cache + IndexedDB durability).
 */
export class ModuleStorage implements IModuleStorage {
  private moduleId: string

  constructor(moduleId: string) {
    this.moduleId = moduleId
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    return persistenceEngine.getModuleProp<T>(this.moduleId, key, defaultValue)
  }

  async set<T>(key: string, value: T): Promise<void> {
    persistenceEngine.setModuleProp<T>(this.moduleId, key, value)
  }

  async remove(key: string): Promise<void> {
    persistenceEngine.remove(persistenceEngine.getModuleKey(this.moduleId, key))
  }

  async clear(): Promise<void> {
    persistenceEngine.resetModuleState(this.moduleId)
  }
}
