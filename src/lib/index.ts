// Framework Exports
export * from './types'
export { mapStore } from './stores/mapStore.svelte'
export { MAP_CONFIG } from './config/map.config'
export {
  PLANNING_ZONES,
  PLANNING_OVERLAYS,
  SAMPLE_PARCELS,
  DEFAULT_BOOKMARKS,
  SEARCH_INDEX,
  BUILDINGS_3D_GEOJSON
} from './data/sampleData'

// Spatial Utilities
export {
  calculateDistanceMeters,
  calculatePathLengthMeters,
  calculatePolygonAreaM2,
  formatDistance,
  formatArea,
  formatCoordinates
} from './utils/geodesy'
export { createPointBufferPolygon } from './utils/buffer'
export { exportMapToPng } from './utils/exportMap'
export { initUrlStateSync, updateUrlHash } from './utils/urlState'
export { localDbGet, localDbSet, localDbDelete } from './services/localDb'
export * from './services/persistence'

// Reusable Components
export { default as Header } from './components/Header.svelte'
export { default as Sidebar } from './components/Sidebar.svelte'
export { default as MapCanvas } from './components/MapCanvas.svelte'
export { default as BasemapSelector } from './components/BasemapSelector.svelte'
export { default as ReportModal } from './components/ReportModal.svelte'
export { default as SettingsModal } from './components/SettingsModal.svelte'
export { default as UserAvatarMenu } from './components/UserAvatarMenu.svelte'
export { default as CompactFloatingBar } from './components/CompactFloatingBar.svelte'
export { default as CompactPanel } from './components/CompactPanel.svelte'

// Enterprise Application Layout Components
export { default as ActionBar } from './components/ActionBar.svelte'
export { default as ActionPanel } from './components/ActionPanel.svelte'
export { default as ApplicationMapSearch } from './components/ApplicationMapSearch.svelte'
export { default as MobileLayout } from './components/MobileLayout.svelte'

// Modular WebGIS Registry & Modules (One Module is One File)
export * from './modules'
