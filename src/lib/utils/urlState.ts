import { MAP_CONFIG } from '../config/map.config'
import type { BasemapId } from '../types'

/**
 * Manages initial view state loading from local storage / IndexedDB.
 * URL coordinates and basemaps have been removed per user preference.
 */

export function getInitialMapViewState(): {
  center: [number, number]
  zoom: number
  pitch?: number
  bearing?: number
  basemapId?: BasemapId
  parcelId?: string
} {
  // Clear any legacy hash from URL if present
  if (typeof window !== 'undefined' && window.location.hash) {
    if (window.location.hash.includes('map=') || window.location.hash.includes('basemap=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  let center: [number, number] = MAP_CONFIG.initialView.center
  let zoom: number = MAP_CONFIG.initialView.zoom
  let pitch: number = MAP_CONFIG.initialView.pitch || 0
  let bearing: number = MAP_CONFIG.initialView.bearing || 0
  let basemapId: BasemapId | undefined = undefined

  if (typeof localStorage !== 'undefined') {
    try {
      // 1. Restore map extent
      const savedExtent = localStorage.getItem('smap_last_extent')
      if (savedExtent) {
        const parsed = JSON.parse(savedExtent)
        if (Array.isArray(parsed.center) && typeof parsed.zoom === 'number') {
          center = parsed.center
          zoom = parsed.zoom
          pitch = parsed.pitch ?? pitch
          bearing = parsed.bearing ?? bearing
        }
      }

      // 2. Restore basemap
      const savedBasemap = localStorage.getItem('smap_last_basemap') as BasemapId | null
      if (
        savedBasemap &&
        ['carto-light', 'carto-voyager', 'carto-dark', 'esri-satellite'].includes(savedBasemap)
      ) {
        basemapId = savedBasemap
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  return { center, zoom, pitch, bearing, basemapId }
}

export function initUrlStateSync() {
  // Clean URL hash on initialization
  if (typeof window !== 'undefined' && window.location.hash) {
    if (window.location.hash.includes('map=') || window.location.hash.includes('basemap=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }
}

export function updateUrlHash() {
  // No-op: URL tracking for coordinates and basemap removed per user preference
}
