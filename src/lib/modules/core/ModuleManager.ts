import type { Component } from 'svelte'
import type { MapInteractionHandler, WebGISModule } from '../../types'
import { EventBus } from './EventBus'
import { ModuleStorage } from './ModuleStorage'
import { ModuleBase } from './ModuleBase'
import { persistenceEngine } from '../../services/persistence'
import type {
  IEventBus,
  MapToolContribution,
  ModuleContext,
  ModuleViewDescriptor,
  ShortcutContribution
} from './types'

/**
 * Context provider options passed during manager initialization.
 */
export interface ContextProviderOptions {
  getMap: () => any
  registerMapHandler: (handler: MapInteractionHandler) => void
  deactivateMapHandler: (callerModuleId?: string) => void
  notify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  store?: unknown
}

/**
 * Singleton Module Manager.
 * Orchestrates module registration, dependency resolution, lifecycle hooks,
 * async component loading, and contribution points.
 */
export class ModuleManager {
  private static instance: ModuleManager | null = null

  private modules: Map<string, ModuleBase> = new Map()
  private views: Map<string, ModuleViewDescriptor> = new Map()
  private componentCache: Map<string, Component> = new Map()
  private initialized = false
  private activeModuleId: string | null = null
  private eventBus: IEventBus = new EventBus()
  private contextOptions: ContextProviderOptions | null = null

  private constructor() {}

  /**
   * Singleton accessor.
   */
  static getInstance(): ModuleManager {
    if (!ModuleManager.instance) {
      ModuleManager.instance = new ModuleManager()
    }
    return ModuleManager.instance
  }

  /**
   * Application-wide event bus.
   */
  get events(): IEventBus {
    return this.eventBus
  }

  /**
   * Register a single module instance.
   */
  register(module: ModuleBase): this {
    const id = module.manifest.id
    if (this.modules.has(id)) {
      console.warn(`[ModuleManager] Module with id '${id}' is already registered. Overwriting.`)
    }
    this.modules.set(id, module)

    if (module.manifest.persistence) {
      persistenceEngine.registerModuleSchema(id, module.manifest.persistence)
    }

    // Register all views contributed by the module
    const views = module.getViews()
    for (const view of views) {
      const normalizedView: ModuleViewDescriptor = {
        ...view,
        moduleId: view.moduleId || id
      }
      this.views.set(view.id, normalizedView)
    }

    this.eventBus.emit('module:registered', { id, module, views })
    return this
  }

  /**
   * Register multiple module instances.
   */
  registerAll(modules: ModuleBase[]): this {
    for (const mod of modules) {
      this.register(mod)
    }
    return this
  }

  /**
   * Retrieve a module by its identifier.
   */
  getModule<T extends ModuleBase = ModuleBase>(id: string): T | undefined {
    return this.modules.get(id) as T | undefined
  }

  /**
   * Check if a module is registered.
   */
  hasModule(id: string): boolean {
    return this.modules.has(id)
  }

  /**
   * Retrieve all registered modules.
   */
  getAllModules(): ModuleBase[] {
    return Array.from(this.modules.values())
  }

  /**
   * Retrieve a view descriptor by view ID.
   */
  getView(viewId: string): ModuleViewDescriptor | undefined {
    return this.views.get(viewId)
  }

  /**
   * Check if a view is registered.
   */
  hasView(viewId: string): boolean {
    return this.views.has(viewId)
  }

  /**
   * Retrieve all registered views across all modules.
   */
  getAllViews(): ModuleViewDescriptor[] {
    return Array.from(this.views.values())
  }

  /**
   * Retrieve all views contributed by a specific module ID.
   */
  getViewsForModule(moduleId: string): ModuleViewDescriptor[] {
    return Array.from(this.views.values()).filter((v) => v.moduleId === moduleId)
  }

  /**
   * Construct an isolated execution context for a module.
   */
  createContext(moduleId: string): ModuleContext {
    return {
      get map() {
        return ModuleManager.instance?.contextOptions?.getMap() ?? null
      },
      events: this.eventBus,
      storage: new ModuleStorage(moduleId),
      registerMapHandler: (handler: MapInteractionHandler) => {
        this.contextOptions?.registerMapHandler(handler)
      },
      deactivateMapHandler: (callerId?: string) => {
        this.contextOptions?.deactivateMapHandler(callerId ?? moduleId)
      },
      notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => {
        if (this.contextOptions?.notify) {
          this.contextOptions.notify(message, type)
        } else {
          console.log(`[Notification ${type || 'info'}]: ${message}`)
        }
      },
      getModule: <T>(id: string) => {
        return this.getModule(id) as unknown as T | undefined
      },
      store: this.contextOptions?.store
    }
  }

  /**
   * Initialize all registered modules in strict topological dependency order.
   * If module B depends on module A, module A will initialize first, and module B
   * will wait for module A's async init() to finish before running its own init().
   */
  async initialize(options: ContextProviderOptions): Promise<void> {
    this.contextOptions = options
    this.initialized = true

    const sorted = this.resolveDependencyOrder()

    console.info(
      `[ModuleManager] Initializing ${sorted.length} modules in dependency order: ` +
        sorted.map((m) => m.manifest.id).join(' -> ')
    )

    for (const mod of sorted) {
      const id = mod.manifest.id
      const deps = mod.manifest.dependencies || []

      // Verify all declared dependencies completed successfully
      const failedDep = deps.find((depId) => {
        const depMod = this.modules.get(depId)
        return !depMod || depMod.status !== 'ready'
      })

      if (failedDep) {
        console.error(
          `[ModuleManager] Skipping initialization of module '${id}': required dependency '${failedDep}' is not ready.`
        )
        continue
      }

      try {
        const ctx = this.createContext(id)
        this.eventBus.emit('module:initializing', { id })
        await mod.initialize(ctx)
        this.eventBus.emit('module:initialized', { id, module: mod })
      } catch (err) {
        console.error(`[ModuleManager] Failed to initialize module '${id}':`, err)
        this.eventBus.emit('module:error', { id, error: err })
      }
    }
  }

  /**
   * Check if a specific module has finished initializing and is in 'ready' or 'active' state.
   */
  isModuleReady(id: string): boolean {
    const mod = this.modules.get(id)
    return mod?.status === 'ready' || mod?.status === 'active'
  }

  /**
   * Wait asynchronously for a specific module to become ready.
   */
  async whenReady(id: string): Promise<ModuleBase> {
    const mod = this.modules.get(id)
    if (!mod) {
      throw new Error(`[ModuleManager] Module '${id}' is not registered`)
    }
    if (mod.status === 'ready' || mod.status === 'active') {
      return mod
    }
    if (mod.status === 'error') {
      throw mod.error || new Error(`[ModuleManager] Module '${id}' encountered an error`)
    }

    return new Promise((resolve, reject) => {
      const unsub = this.eventBus.on('module:initialized', (payload: any) => {
        if (payload?.id === id) {
          unsub()
          resolve(mod)
        }
      })
      const unsubErr = this.eventBus.on('module:error', (payload: any) => {
        if (payload?.id === id) {
          unsubErr()
          reject(payload.error || new Error(`Module '${id}' failed to initialize`))
        }
      })
    })
  }

  /**
   * Topologically sort modules based on declared dependencies.
   */
  private resolveDependencyOrder(): ModuleBase[] {
    const sorted: ModuleBase[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (mod: ModuleBase) => {
      const id = mod.manifest.id
      if (visiting.has(id)) {
        console.warn(`[ModuleManager] Circular dependency detected involving module '${id}'!`)
        return
      }
      if (!visited.has(id)) {
        visiting.add(id)
        const deps = mod.manifest.dependencies || []
        for (const depId of deps) {
          const depMod = this.modules.get(depId)
          if (!depMod) {
            console.warn(`[ModuleManager] Module '${id}' requires missing dependency '${depId}'`)
          } else {
            visit(depMod)
          }
        }
        visiting.delete(id)
        visited.add(id)
        sorted.push(mod)
      }
    }

    for (const mod of this.modules.values()) {
      visit(mod)
    }

    return sorted
  }

  /**
   * Asynchronously load and cache a module or view's Svelte UI component.
   */
  async loadComponent(id: string): Promise<Component> {
    const cached = this.componentCache.get(id)
    if (cached) return cached

    // 1. Check if ID matches a registered View
    const view = this.views.get(id)
    if (view) {
      const parentModule = this.modules.get(view.moduleId || id)
      if (parentModule) {
        await parentModule.load()
      }
      let component: Component
      if (view.loadComponent) {
        component = await view.loadComponent()
      } else if (parentModule) {
        component = await parentModule.loadViewComponent(id)
      } else {
        throw new Error(`[ModuleManager] View '${id}' has no component loader and parent module is missing`)
      }
      this.componentCache.set(id, component)
      return component
    }

    // 2. Check if ID matches a registered Module
    const mod = this.modules.get(id)
    if (mod) {
      // Ensure any preloading (dependencies, WASM, assets) completes
      await mod.load()
      const component = await mod.loadComponent()
      this.componentCache.set(id, component)
      return component
    }

    throw new Error(`[ModuleManager] Cannot load component: neither module nor view '${id}' is registered`)
  }

  /**
   * Asynchronously load a specific view's Svelte component.
   */
  async loadViewComponent(viewId: string): Promise<Component> {
    return this.loadComponent(viewId)
  }

  /**
   * Synchronously get the cached component, if already loaded.
   */
  getCachedComponent(id: string): Component | undefined {
    return this.componentCache.get(id)
  }

  /**
   * Pre-seed a component into cache (used for synchronously available components).
   */
  setCachedComponent(id: string, component: Component): void {
    this.componentCache.set(id, component)
  }

  /**
   * Activate a module (or a module owning a view) by ID. Deactivates any currently active module first.
   */
  async activateModule(id: string): Promise<void> {
    const view = this.views.get(id)
    const moduleId = view?.moduleId || id

    if (this.activeModuleId === moduleId) return

    // Deactivate current active module
    if (this.activeModuleId) {
      await this.deactivateModule(this.activeModuleId)
    }

    const mod = this.modules.get(moduleId)
    if (mod) {
      try {
        await mod.load()
        await mod.activate()
        this.activeModuleId = moduleId
        this.eventBus.emit('module:activated', { id: moduleId, viewId: id })
      } catch (err) {
        console.error(`[ModuleManager] Failed to activate module '${moduleId}':`, err)
      }
    }
  }

  /**
   * Deactivate a module by ID.
   */
  async deactivateModule(id: string): Promise<void> {
    const mod = this.modules.get(id)
    if (mod && mod.status === 'active') {
      try {
        await mod.deactivate()
        if (this.activeModuleId === id) {
          this.activeModuleId = null
        }
        this.eventBus.emit('module:deactivated', { id })
      } catch (err) {
        console.error(`[ModuleManager] Failed to deactivate module '${id}':`, err)
      }
    }
  }

  /**
   * Execute an action on a module.
   */
  async executeAction(moduleId: string, actionName: string, ...args: unknown[]): Promise<unknown> {
    const mod = this.modules.get(moduleId)
    if (!mod) {
      throw new Error(`[ModuleManager] Module '${moduleId}' not found`)
    }
    return mod.executeAction(actionName, ...args)
  }

  // --- Contribution Query Methods ---

  /**
   * Get all modules contributing to the Navigation Rail.
   */
  getRailModules(): ModuleBase[] {
    return Array.from(this.modules.values())
      .filter((m) => m.contributions.rail !== undefined)
      .sort((a, b) => (a.contributions.rail?.order ?? 999) - (b.contributions.rail?.order ?? 999))
  }

  /**
   * Get all modules contributing to the Toolbox accordion.
   */
  getToolboxModules(): ModuleBase[] {
    return Array.from(this.modules.values())
      .filter((m) => m.contributions.toolbox !== undefined)
      .sort((a, b) => (a.contributions.toolbox?.order ?? 999) - (b.contributions.toolbox?.order ?? 999))
  }

  /**
   * Get all floating map tools contributed across all registered modules.
   */
  getMapToolContributions(): MapToolContribution[] {
    const result: MapToolContribution[] = []
    for (const mod of this.modules.values()) {
      if (mod.contributions.mapTools) {
        result.push(...mod.contributions.mapTools)
      }
    }
    return result.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  }

  /**
   * Get all keyboard shortcuts contributed across all registered modules.
   */
  getShortcuts(): ShortcutContribution[] {
    const result: ShortcutContribution[] = []
    for (const mod of this.modules.values()) {
      if (mod.contributions.shortcuts) {
        result.push(...mod.contributions.shortcuts)
      }
    }
    return result
  }

  /**
   * Export backward-compatible WebGISModule array.
   */
  toWebGISModules(): WebGISModule[] {
    return Array.from(this.modules.values()).map((m) => m.toWebGISModule())
  }

  /**
   * Export backward-compatible WebGISModule definition by ID.
   */
  getModuleDefinition(id: string): WebGISModule | undefined {
    return this.modules.get(id)?.toWebGISModule()
  }
}

/**
 * Global singleton module manager instance.
 */
export const moduleManager = ModuleManager.getInstance()
