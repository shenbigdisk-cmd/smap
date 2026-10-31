import type { Component } from 'svelte'
import type { WebGISModule } from '../types'
import WorkflowsModule from './WorkflowsModule.svelte'
import LayersModule from './LayersModule.svelte'
import QueryModule from './QueryModule.svelte'
import ResultsModule from './ResultsModule.svelte'
import MeasureModule from './MeasureModule.svelte'
import BufferModule from './BufferModule.svelte'
import MarkupModule from './MarkupModule.svelte'
import BookmarksModule from './BookmarksModule.svelte'
import ExportModule from './ExportModule.svelte'
import ToolboxModule from './ToolboxModule.svelte'

/**
 * Canonical initial configuration for all system WebGIS modules.
 * This is the single source of truth for module definitions and default ordering.
 */
export const INITIAL_MODULES: WebGISModule[] = [
  {
    id: 'workflows',
    name: 'Workflows & Quick Tasks',
    shortTitle: 'Tasks',
    description: 'Initial navigation, statewide extent, and quick property jumps',
    category: 'core',
    isPinned: true,
    isExpandedInToolbox: false
  },
  {
    id: 'layers',
    name: 'Operational Layers & Legend',
    shortTitle: 'Layers',
    description: 'Layer visibility toggles, opacity sliders, and statutory planning legend',
    category: 'core',
    isPinned: true,
    isExpandedInToolbox: true
  },
  {
    id: 'query',
    name: 'Spatial & Attribute Query',
    shortTitle: 'Query',
    description: 'Search and filter features by SQL attribute rules or drawn geometry',
    category: 'analysis',
    isPinned: true,
    isExpandedInToolbox: true
  },
  {
    id: 'results',
    name: 'Selected Features & Details',
    shortTitle: 'Features',
    description: 'Inspect individual properties or browse and filter multi-record query results',
    category: 'core',
    isPinned: true,
    isExpandedInToolbox: true
  },
  {
    id: 'measure',
    name: 'Spatial Measurement Tools',
    shortTitle: 'Measure',
    description: 'Geodesic polyline distance, polygon area, and coordinate readout',
    category: 'analysis',
    isPinned: false,
    isExpandedInToolbox: true
  },
  {
    id: 'buffer',
    name: 'Spatial Buffer & Notices',
    shortTitle: 'Buffer',
    description: 'Circular geodesic notification buffer rings around land parcels',
    category: 'analysis',
    isPinned: false,
    isExpandedInToolbox: true
  },
  {
    id: 'markup',
    name: 'Spatial Markup & Sketch',
    shortTitle: 'Markup',
    description: 'Interactive annotations, pins, and polygon sketching with GeoJSON export',
    category: 'cartography',
    isPinned: false,
    isExpandedInToolbox: false
  },
  {
    id: 'bookmarks',
    name: 'Spatial Bookmarks & Extents',
    shortTitle: 'Bookmarks',
    description: 'Saved viewpoints and extents across Victoria planning precincts',
    category: 'cartography',
    isPinned: false,
    isExpandedInToolbox: false
  },
  {
    id: 'export',
    name: 'High-Res Map PNG Exporter',
    shortTitle: 'Export',
    description: 'Export map canvas as high-resolution PNG with scale and coordinates',
    category: 'output',
    isPinned: false,
    isExpandedInToolbox: false
  }
]

/**
 * Component mapping for all registered modules.
 */
export const MODULE_COMPONENTS: Record<string, Component> = {
  workflows: WorkflowsModule,
  layers: LayersModule,
  query: QueryModule,
  results: ResultsModule,
  measure: MeasureModule,
  buffer: BufferModule,
  markup: MarkupModule,
  bookmarks: BookmarksModule,
  export: ExportModule,
  toolbox: ToolboxModule
}

/**
 * Retrieve the active Svelte component for a module ID.
 */
export function getModuleComponent(id: string): Component | undefined {
  return MODULE_COMPONENTS[id]
}

/**
 * Retrieve the module definition metadata by ID.
 */
export function getModuleDefinition(id: string): WebGISModule | undefined {
  return INITIAL_MODULES.find((m) => m.id === id)
}
