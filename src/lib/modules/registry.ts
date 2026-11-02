import type { Component } from 'svelte'
import type { WebGISModule, WebGISView } from '../types'
import { moduleManager } from './core/ModuleManager'
import {
  WorkflowsModuleDef,
  LayersModuleDef,
  QueryModuleDef,
  ResultsModuleDef,
  MeasureModuleDef,
  BufferModuleDef,
  MarkupModuleDef,
  BookmarksModuleDef,
  PrintModuleDef,
  ToolboxModuleDef,
  AiAssistantModuleDef
} from './definitions'

// Concrete module singletons inheriting from ModuleBase
export const workflowsModule = new WorkflowsModuleDef()
export const aiAssistantModule = new AiAssistantModuleDef()
export const layersModule = new LayersModuleDef()
export const queryModule = new QueryModuleDef()
export const resultsModule = new ResultsModuleDef()
export const measureModule = new MeasureModuleDef()
export const bufferModule = new BufferModuleDef()
export const markupModule = new MarkupModuleDef()
export const bookmarksModule = new BookmarksModuleDef()
export const printModule = new PrintModuleDef()
export const toolboxModule = new ToolboxModuleDef()

// Register all system modules with the ModuleManager
moduleManager.registerAll([
  workflowsModule,
  aiAssistantModule,
  layersModule,
  queryModule,
  resultsModule,
  measureModule,
  bufferModule,
  markupModule,
  bookmarksModule,
  printModule,
  toolboxModule
])

/**
 * Canonical initial configuration for all system WebGIS modules.
 * This is the single source of truth for module definitions and default ordering.
 */
export const INITIAL_MODULES: WebGISModule[] = [
  workflowsModule.toWebGISModule(),
  aiAssistantModule.toWebGISModule(),
  layersModule.toWebGISModule(),
  queryModule.toWebGISModule(),
  resultsModule.toWebGISModule(),
  measureModule.toWebGISModule(),
  bufferModule.toWebGISModule(),
  markupModule.toWebGISModule(),
  bookmarksModule.toWebGISModule(),
  printModule.toWebGISModule()
]

/**
 * Canonical initial configuration for all contributed views across all modules.
 */
export const INITIAL_VIEWS: WebGISView[] = moduleManager.getAllViews().map((v, idx) => ({
  id: v.id,
  moduleId: v.moduleId || v.id,
  name: v.name,
  shortTitle: v.shortTitle || v.name,
  description: v.description || '',
  category: (v.category || 'core') as any,
  icon: v.icon,
  placement: v.defaultPlacement,
  defaultPlacement: v.defaultPlacement,
  supportedPlacements: v.supportedPlacements,
  order: v.defaultOrder ?? idx * 10
}))

/**
 * Retrieve the active Svelte component for a module or view ID if already loaded and cached.
 */
export function getModuleComponent(id: string): Component | undefined {
  return moduleManager.getCachedComponent(id)
}

/**
 * Asynchronously load the Svelte component for a module or view ID on demand.
 */
export async function loadModuleComponent(id: string): Promise<Component> {
  return moduleManager.loadComponent(id)
}

/**
 * Retrieve the module definition metadata by ID.
 */
export function getModuleDefinition(id: string): WebGISModule | undefined {
  return moduleManager.getModuleDefinition(id) || INITIAL_MODULES.find((m) => m.id === id)
}

/**
 * Retrieve the view definition metadata by ID.
 */
export function getViewDefinition(id: string): WebGISView | undefined {
  return INITIAL_VIEWS.find((v) => v.id === id)
}

export { moduleManager }
