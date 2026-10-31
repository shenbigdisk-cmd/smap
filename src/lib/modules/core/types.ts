import type { Component } from 'svelte'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapInteractionHandler, ModuleCategory, ViewPlacement, WebGISModule, WebGISView } from '../../types'
import type { ModulePersistenceSchema } from '../../services/persistence/types'

/**
 * Unique identifier for a WebGIS module.
 */
export type ModuleId = string

export type { ModuleCategory, ViewPlacement, WebGISView, ModulePersistenceSchema }

/**
 * UI Container placement type.
 * - 'sidepanel': Displayed as a primary connected tab in the sidebar rail.
 * - 'toolbox': Displayed as an expandable tool accordion inside the Toolbox tab.
 */
export interface ModuleViewDescriptor {
  /** Unique view identifier (e.g. 'measure', 'export', 'print') */
  readonly id: string

  /** ID of parent module that owns and coordinates this view */
  readonly moduleId?: string

  /** Human-readable view title */
  readonly name: string

  /** Short label for compact tabs and the left rail */
  readonly shortTitle?: string

  /** Concise description of view utility */
  readonly description?: string

  /** Category for grouping and ordering */
  readonly category?: ModuleCategory

  /** Canonical icon identifier */
  readonly icon?: string

  /** Recommended default container placement */
  readonly defaultPlacement: ViewPlacement

  /** Allowable container placements */
  readonly supportedPlacements?: readonly ViewPlacement[]

  /** Relative default order within the slot */
  readonly defaultOrder?: number

  /** Lazily loads and returns the Svelte UI component for this view */
  readonly loadComponent?: () => Promise<Component>
}

/**
 * Operational lifecycle status of a module.
 */
export type ModuleStatus =
  | 'unregistered'
  | 'registered'
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'active'
  | 'error'

/**
 * Metadata descriptor declaring module identity, dependencies, and resources.
 */
export interface ModuleManifest {
  /** Unique module identifier (e.g. 'print', 'measure', 'layers') */
  readonly id: ModuleId

  /** Human-readable title displayed in headers and dialogs */
  readonly name: string

  /** Short label for compact tabs and the left rail */
  readonly shortTitle: string

  /** Concise description of module utility (GEMINI.md: no narrative bloat) */
  readonly description: string

  /** Category for toolbox grouping and ordering */
  readonly category: ModuleCategory

  /** Canonical icon identifier (or SVG symbol reference) */
  readonly icon?: string

  /** Semantic version string (e.g. '1.0.0') */
  readonly version?: string

  /** Author or publishing entity */
  readonly author?: string

  /** IDs of other modules that must be initialized before this module */
  readonly dependencies?: readonly ModuleId[]

  /** Declarative state persistence schema. Module specifies properties to auto-persist */
  readonly persistence?: ModulePersistenceSchema

  /** Declared resources or assets needed by this module */
  readonly resources?: readonly ModuleResourceDescriptor[]
}

/**
 * Resource descriptor for module-owned assets, schemas, or data endpoints.
 */
export interface ModuleResourceDescriptor {
  readonly id: string
  readonly type: 'layer' | 'style' | 'schema' | 'dataset' | 'worker'
  readonly uri?: string
  readonly metadata?: Record<string, unknown>
}

/**
 * Contribution point: floating map canvas button.
 */
export interface MapToolContribution {
  readonly id: string
  readonly title: string | (() => string)
  readonly icon: string
  readonly position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  readonly order?: number
  readonly isActive?: () => boolean
  readonly isLoading?: () => boolean
  readonly onClick: (context: ModuleContext) => void | Promise<void>
  readonly onHover?: (context: ModuleContext, isHovering: boolean) => void
}

/**
 * Contribution point: keyboard shortcut.
 */
export interface ShortcutContribution {
  /** Key combination (e.g. 'ctrl+p', 'escape', 'm') */
  readonly key: string
  readonly description: string
  readonly action: (context: ModuleContext) => void | Promise<void>
}

/**
 * Contribution points exposed by a module to UI surfaces.
 */
export interface ModuleContributionPoints {
  /** Contribution to the primary Navigation Rail / Tabs */
  readonly rail?: {
    readonly defaultPinned: boolean
    readonly order?: number
    readonly badge?: () => string | number | null
  }

  /** Contribution to the expandable Toolbox accordion */
  readonly toolbox?: {
    readonly defaultExpanded?: boolean
    readonly order?: number
    readonly keywords?: readonly string[]
  }

  /** Contribution of floating buttons on the map canvas */
  readonly mapTools?: readonly MapToolContribution[]

  /** Contribution of global or module-scoped keyboard shortcuts */
  readonly shortcuts?: readonly ShortcutContribution[]

  /** Contributed programmatic actions executable by other modules or workflows */
  readonly actions?: Record<string, (context: ModuleContext, ...args: unknown[]) => unknown>
}

/**
 * Scoped persistence storage for a module, isolating key namespaces.
 */
export interface IModuleStorage {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Strongly-typed event listener function.
 */
export type EventListener<T = unknown> = (payload: T) => void | Promise<void>

/**
 * Decoupled event bus interface for inter-module pub/sub communication.
 */
export interface IEventBus {
  on<T = unknown>(event: string, listener: EventListener<T>): () => void
  once<T = unknown>(event: string, listener: EventListener<T>): () => void
  off<T = unknown>(event: string, listener: EventListener<T>): void
  emit<T = unknown>(event: string, payload: T): void
}

/**
 * Execution context provided to a module upon initialization.
 * Gives controlled access to map services, event bus, scoped storage, and UI notifications.
 */
export interface ModuleContext {
  /** Current MapLibre GL map instance, or null if map canvas is initializing */
  readonly map: MapLibreMap | null

  /** Decoupled application event bus */
  readonly events: IEventBus

  /** Scoped, isolated persistent key-value storage */
  readonly storage: IModuleStorage

  /** Register an active map interaction handler (pointer, click, drawing mode) */
  registerMapHandler(handler: MapInteractionHandler): void

  /** Deactivate an active map interaction handler */
  deactivateMapHandler(callerModuleId?: string): void

  /** Display a system feedback notification / toast */
  notify(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void

  /** Query public API or instance of another initialized module */
  getModule<T>(id: ModuleId): T | undefined

  /** Central reactive map state reference */
  readonly store: unknown
}

/**
 * Standard WebGIS Module contract.
 * Every functional module in the application adheres to this contract.
 */
export interface IWebGISModule {
  /** Static module metadata and manifest */
  readonly manifest: ModuleManifest

  /** UI and map contribution points */
  readonly contributions: ModuleContributionPoints

  /** UI views provided by this module (defaults to single manifest-based view if omitted) */
  readonly views?: readonly ModuleViewDescriptor[]

  /** Returns all views contributed by this module */
  getViews(): readonly ModuleViewDescriptor[]

  /** Current lifecycle status */
  readonly status: ModuleStatus

  /** Error state if initialization or activation failed */
  readonly error: Error | null

  /**
   * Asynchronous preload hook for dynamic code splitting or heavy assets.
   * Called before component render or on-demand initialization.
   */
  load(): Promise<void>

  /**
   * Lazily loads and returns the module's root or default Svelte UI component.
   */
  loadComponent(): Promise<Component>

  /**
   * Lazily loads and returns a specific view's Svelte UI component.
   */
  loadViewComponent?(viewId: string): Promise<Component>

  /**
   * Primary asynchronous initialization lifecycle hook.
   * Executed strictly in dependency order; dependents wait for all dependencies to finish init().
   */
  init?(context: ModuleContext): Promise<void>

  /**
   * Lifecycle: Invoked once when module is registered and context is available.
   * Performs dependency verification, storage initialization, and event registration.
   */
  initialize(context: ModuleContext): Promise<void>

  /**
   * Lifecycle: Invoked when the module is activated (e.g. tab selected, drawer opened).
   */
  activate(): Promise<void> | void

  /**
   * Lifecycle: Invoked when the module is deactivated (e.g. user switches tabs).
   * Must clean up temporary layers, drawing cursors, or active map handlers.
   */
  deactivate(): Promise<void> | void

  /**
   * Lifecycle: Invoked when the module is torn down or unregistered.
   * Must release all event listeners, clear caches, and remove map layers.
   */
  destroy(): Promise<void> | void

  /**
   * Execute a contributed action by name.
   */
  executeAction(name: string, ...args: unknown[]): Promise<unknown>

  /**
   * Returns backward-compatible WebGISModule metadata object.
   */
  toWebGISModule(): WebGISModule
}
