import { mapStore } from '../stores/mapStore.svelte'
import { MAP_CONFIG } from '../config/map.config'
import type { BasemapId } from '../types'

/**
 * Parses URL hash synchronously at startup to prevent any initial 'zoom' or jumping animation.
 */
export function getInitialMapViewState(): {
  center: [number, number]
  zoom: number
  basemapId?: BasemapId
  parcelId?: string
} {
  if (typeof window === 'undefined') {
    return {
      center: MAP_CONFIG.initialView.center,
      zoom: MAP_CONFIG.initialView.zoom
    }
  }

  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) {
    return {
      center: MAP_CONFIG.initialView.center,
      zoom: MAP_CONFIG.initialView.zoom
    }
  }

  const params = new URLSearchParams(hash)
  let center: [number, number] = MAP_CONFIG.initialView.center
  let zoom: number = MAP_CONFIG.initialView.zoom

  const mapParam = params.get('map')
  if (mapParam) {
    const parts = mapParam.split('/')
    if (parts.length === 3) {
      const z = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      const lng = parseFloat(parts[2])
      if (!isNaN(z) && !isNaN(lat) && !isNaN(lng)) {
        center = [lng, lat]
        zoom = z
      }
    }
  }

  const basemapParam = params.get('basemap') as BasemapId | null
  const basemapId =
    basemapParam && ['carto-light', 'carto-voyager', 'carto-dark', 'esri-satellite'].includes(basemapParam)
      ? basemapParam
      : undefined

  const parcelId = params.get('parcel') || undefined

  return { center, zoom, basemapId, parcelId }
}

export function initUrlStateSync() {
  window.addEventListener('hashchange', handleHashChange)
}

function handleHashChange() {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return

  const params = new URLSearchParams(hash)
  const mapParam = params.get('map')
  if (mapParam && mapStore.map) {
    const parts = mapParam.split('/')
    if (parts.length === 3) {
      const zoom = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      const lng = parseFloat(parts[2])
      if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
        const curCenter = mapStore.map.getCenter()
        const curZoom = mapStore.map.getZoom()
        // Only jump if materially different to avoid loop
        if (
          Math.abs(curCenter.lat - lat) > 0.0001 ||
          Math.abs(curCenter.lng - lng) > 0.0001 ||
          Math.abs(curZoom - zoom) > 0.1
        ) {
          mapStore.map.jumpTo({ center: [lng, lat], zoom })
        }
      }
    }
  }

  const basemapParam = params.get('basemap') as BasemapId | null
  if (basemapParam && basemapParam !== mapStore.activeBasemapId) {
    mapStore.setBasemap(basemapParam)
  }

  const parcelParam = params.get('parcel')
  if (parcelParam && mapStore.selectedParcel?.id !== parcelParam) {
    mapStore.selectParcelById(parcelParam)
  }
}

let updateTimeout: number | undefined

export function updateUrlHash() {
  if (typeof window === 'undefined') return
  clearTimeout(updateTimeout)

  updateTimeout = window.setTimeout(() => {
    const coords = mapStore.cursorCoordinates
    const zoom = mapStore.currentZoom
    const basemap = mapStore.activeBasemapId
    const parcelId = mapStore.selectedParcel?.id

    const params = new URLSearchParams()
    if (mapStore.map) {
      const center = mapStore.map.getCenter()
      const z = mapStore.map.getZoom().toFixed(2)
      params.set('map', `${z}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`)
    } else {
      params.set('map', `${zoom}/${coords[1].toFixed(5)}/${coords[0].toFixed(5)}`)
    }

    params.set('basemap', basemap)
    if (parcelId) {
      params.set('parcel', parcelId)
    }

    const newHash = `#${params.toString()}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash)
    }
  }, 400)
}
