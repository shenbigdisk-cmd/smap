import type { Component } from 'svelte'
import type { MapInteractionHandler, WebGISModule } from '../../types'
import { persistenceEngine } from '../../services/persistence'
import type {
  EventListener,
  IWebGISModule,
  ModuleContributionPoints,
  ModuleContext,
  ModuleManifest,
  ModuleStatus,
  ModuleViewDescriptor,
  ViewPlacement
} from './types'

/**
 * Abstract Base Class for WebGIS modules.
 * Standardizes lifecycle, async loading, dependency management, resources, and contribution points.
 * All built-in and future extension modules should inherit from ModuleBase.
 */
export abstract class ModuleBase implements IWebGISModule {
  abstract readonly manifest: ModuleManifest
  abstract readonly contributions: ModuleContributionPoints

  protected context: ModuleContext | null = null
  private _status: ModuleStatus = 'registered'
  private _error: Error | null = null
  private cleanupFunctions: Array<() => void> = []

  /**
   * Current lifecycle status of the module.
   */
  get status(): ModuleStatus {
    return this._status
  }

  /**
   * Error details if the module encountered an issue during lifecycle operations.
   */
  get error(): Error | null {
    return this._error
  }

  /**
   * Hook for asynchronous preloading (dynamic libraries, WebWorkers, WASM, schemas).
   * Default implementation resolves immediately; override in subclasses with heavy dependencies.
   */
  async load(): Promise<void> {
    // Default: no-op, ready immediately
  }

  /**
   * Asynchronously load and return the Svelte UI Component for this module.
   * Enables Vite code-splitting via dynamic import().
   */
  abstract loadComponent(): Promise<Component>

  /**
   * Contributed views declared by this module.
   * By default, returns a single synthesized view reflecting the module's manifest and contributions.
   * Subclasses can override this getter to provide multiple views with distinct placements.
   */
  get views(): readonly ModuleViewDescriptor[] {
    const isPinned = this.contributions.rail?.defaultPinned ?? false
    return [
      {
        id: this.manifest.id,
        moduleId: this.manifest.id,
        name: this.manifest.name,
        shortTitle: this.manifest.shortTitle,
        description: this.manifest.description,
        category: this.manifest.category,
        icon: this.manifest.icon,
        defaultPlacement: (isPinned ? 'sidepanel' : 'toolbox') as ViewPlacement,
        supportedPlacements: ['sidepanel', 'toolbox'],
        defaultOrder: this.contributions.rail?.order ?? this.contributions.toolbox?.order ?? 50,
        loadComponent: () => this.loadComponent()
      }
    ]
  }

  /**
   * Retrieve all views contributed by this module.
   */
  getViews(): readonly ModuleViewDescriptor[] {
    return this.views
  }

  /**
   * Asynchronously load a specific view's Svelte UI component.
   */
  async loadViewComponent(viewId: string): Promise<Component> {
    const view = this.getViews().find((v) => v.id === viewId)
    if (view && view.loadComponent) {
      return view.loadComponent()
    }
    return this.loadComponent()
  }

  /**
   * Primary asynchronous initialization hook for module subclasses.
   * Guaranteed to execute strictly AFTER all declared dependencies have completed their init().
   * Subclasses can override this method to perform startup routines, subscribe to events,
   * initialize local databases, or fetch metadata.
   */
  async init(_context: ModuleContext): Promise<void> {
    // Default implementation resolves immediately
  }

  /**
   * Framework lifecycle orchestrator: Called by ModuleManager in topological dependency order.
   * Manages status transitions ('initializing' -> 'ready' | 'error') and delegates to init().
   */
  async initialize(context: ModuleContext): Promise<void> {
    this.context = context
    this._status = 'initializing'
    this._error = null
    try {
      await this.init(context)
      this._status = 'ready'
    } catch (err: any) {
      this._status = 'error'
      this._error = err instanceof Error ? err : new Error(String(err))
      console.error(`[${this.manifest.id}] Initialization failed:`, err)
      throw err
    }
  }

  /**
   * Lifecycle hook: Called when the module is activated (opened in rail, tab, or toolbox).
   */
  async activate(): Promise<void> {
    this._status = 'active'
  }

  /**
   * Lifecycle hook: Called when the module is deactivated (user closes panel or switches tab).
   * Automatically deactivates any active map interaction handler owned by this module.
   */
  async deactivate(): Promise<void> {
    if (this.context) {
      this.context.deactivateMapHandler(this.manifest.id)
    }
    this._status = 'ready'
  }

  /**
   * Lifecycle hook: Called when the module is torn down or unregistered.
   * Cleans up all event subscriptions, temporary resources, and memory references.
   */
  async destroy(): Promise<void> {
    for (const cleanup of this.cleanupFunctions) {
      try {
        cleanup()
      } catch (err) {
        console.error(`[${this.manifest.id}] Error in cleanup function:`, err)
      }
    }
    this.cleanupFunctions = []
    if (this.context) {
      this.context.deactivateMapHandler(this.manifest.id)
    }
    this.context = null
    this._status = 'unregistered'
  }

  /**
   * Execute a contributed action by name.
   */
  async executeAction(name: string, ...args: unknown[]): Promise<unknown> {
    const action = this.contributions.actions?.[name]
    if (!action) {
      throw new Error(`Action '${name}' is not registered on module '${this.manifest.id}'`)
    }
    if (!this.context) {
      throw new Error(`Cannot execute action '${name}': module '${this.manifest.id}' is not initialized`)
    }
    return action(this.context, ...args)
  }

  /**
   * Convert to backward-compatible WebGISModule object for existing store and layout components.
   */
  toWebGISModule(): WebGISModule {
    const views = this.getViews().map((v, idx) => ({
      id: v.id,
      moduleId: v.moduleId || this.manifest.id,
      name: v.name,
      shortTitle: v.shortTitle || v.name,
      description: v.description || this.manifest.description,
      category: (v.category || this.manifest.category) as any,
      icon: v.icon || this.manifest.icon,
      placement: v.defaultPlacement,
      defaultPlacement: v.defaultPlacement,
      supportedPlacements: v.supportedPlacements,
      order: v.defaultOrder ?? idx * 10
    }))

    const hasPinnedView = views.some((v) => v.placement === 'sidepanel')

    return {
      id: this.manifest.id,
      name: this.manifest.name,
      shortTitle: this.manifest.shortTitle,
      description: this.manifest.description,
      category: this.manifest.category as any,
      isPinned: hasPinnedView || (this.contributions.rail?.defaultPinned ?? false),
      isExpandedInToolbox: this.contributions.toolbox?.defaultExpanded ?? false,
      views
    }
  }

  // --- Protected Convenience Helpers ---

  /**
   * Subscribe to an event on the decoupled event bus with auto-cleanup on destroy.
   */
  protected on<T = unknown>(event: string, listener: EventListener<T>): () => void {
    if (!this.context) {
      throw new Error(`Module '${this.manifest.id}' cannot subscribe before initialize()`)
    }
    const unsub = this.context.events.on<T>(event, listener)
    this.cleanupFunctions.push(unsub)
    return unsub
  }

  /**
   * Emit an event across the application event bus.
   */
  protected emit<T = unknown>(event: string, payload: T): void {
    this.context?.events.emit(event, payload)
  }

  /**
   * Register a map pointer/drawing handler on the active map canvas.
   */
  protected registerHandler(handler: MapInteractionHandler): void {
    this.context?.registerMapHandler(handler)
  }

  /**
   * Deactivate this module's active map pointer/drawing handler.
   */
  protected deactivateHandler(): void {
    this.context?.deactivateMapHandler(this.manifest.id)
  }

  /**
   * Read a value from scoped persistent storage.
   */
  protected async getStorage<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    return this.context?.storage.get<T>(key, defaultValue) ?? defaultValue
  }

  /**
   * Write a value to scoped persistent storage.
   */
  protected async setStorage<T>(key: string, value: T): Promise<void> {
    return this.context?.storage.set<T>(key, value)
  }

  /**
   * Creates an auto-persisting reactive state proxy for this module.
   * Any property read returns the saved or default value.
   * Any property mutation automatically triggers debounced centralized persistence.
   * Module authors write zero storage boilerplate!
   */
  protected createPersistedState<T extends Record<string, any>>(defaults: T): T {
    return persistenceEngine.createModulePersistedState(this.manifest.id, defaults)
  }

  /**
   * Synchronously retrieve a persisted property for this module.
   */
  protected getPersisted<T>(key: string, defaultValue?: T): T {
    return persistenceEngine.getModuleProp<T>(this.manifest.id, key, defaultValue)
  }

  /**
   * Set a persisted property for this module with debounced central persistence.
   */
  protected setPersisted<T>(key: string, value: T, immediate = false): void {
    persistenceEngine.setModuleProp<T>(this.manifest.id, key, value, immediate)
  }

  /**
   * Reset this module's persisted state back to defaults.
   */
  protected resetPersistedState(): void {
    persistenceEngine.resetModuleState(this.manifest.id)
  }

  /**
   * Set internal error state.
   */
  protected setError(err: Error | null): void {
    this._error = err
    if (err) {
      this._status = 'error'
    }
  }
}
