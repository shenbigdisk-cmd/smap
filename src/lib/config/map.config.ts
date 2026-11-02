import rawFallbackConfig from '../../config/config.json'
import type {
  BasemapConfig,
  OperationalLayer,
  SearchSourceConfig,
  ServiceDefinition,
  WebGISModule
} from '../types'
import { dataAdapterRegistry } from '../services/adapters/DataAdapterRegistry'
import { serviceLoaderRegistry } from '../services/loaders/ServiceLoaderRegistry'

export interface CoordinateConfig {
  system: string
  datum: string
  projection: string
  defaultZone: number
  transformation: string
  labels: {
    projected: string
    geographic: string
    datum: string
  }
}

export interface AppConfig {
  title: string
  subtitle: string
  agency: string
  initialView: {
    center: [number, number] // [lng, lat]
    zoom: number
    pitch: number
    bearing: number
  }
  extentVictoria: {
    bbox: [[number, number], [number, number]]
  }
  coordinates?: CoordinateConfig
  basemaps: BasemapConfig[]
  defaultBasemapId: string
  services: ServiceDefinition[]
  operationalLayers: OperationalLayer[]
  modules?: string[] | (Partial<WebGISModule> & { id: string; enabled?: boolean })[]
  search?: {
    sources: SearchSourceConfig[]
  }
}

export function createRasterBasemapStyle(tiles: string[], attribution: string = '') {
  return {
    version: 8 as const,
    sources: {
      'raster-tiles': {
        type: 'raster' as const,
        tiles,
        tileSize: 256,
        attribution
      }
    },
    layers: [
      {
        id: 'raster-layer',
        type: 'raster' as const,
        source: 'raster-tiles',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  }
}

export function normalizeBasemaps(rawBasemaps: any[]): BasemapConfig[] {
  return (rawBasemaps || []).map((b: any, idx: number) => {
    const nameLower = (b.name || '').toLowerCase().trim()
    const autoId = b.id || (
      nameLower === 'light' ? 'carto-light' :
      nameLower === 'voyager' ? 'carto-voyager' :
      nameLower === 'dark' ? 'carto-dark' :
      nameLower === 'satellite' ? 'esri-satellite' :
      nameLower.replace(/[^a-z0-9]+/g, '-') || `basemap-${idx}`
    )
    const isUrl = typeof b.style === 'string' && (b.style.startsWith('http://') || b.style.startsWith('https://') || b.style.endsWith('.json'))
    const styleUrl = b.styleUrl || (isUrl ? b.style : undefined)
    const tiles = b.tiles || b.rasterTiles
    return {
      id: autoId,
      name: b.name || `Basemap ${idx + 1}`,
      type: b.type || (tiles ? 'raster' : 'vector'),
      style: b.style,
      styleUrl,
      thumbnail: b.thumbnail || `/thumbnails/${autoId}.png`,
      tiles,
      rasterTiles: tiles,
      description: b.description || b.name,
      attribution: b.attribution || ''
    }
  })
}

function parseServicesSync(rawServices: any[]): ServiceDefinition[] {
  return (rawServices || []).map((srv: any) => {
    const isEnabled = srv.enabled !== false
    const isAnyVisible = (srv.layers || []).some((l: any) => l.visible !== false)

    return {
      ...srv,
      enabled: isEnabled,
      visible: srv.visible !== undefined ? srv.visible : isAnyVisible,
      status: 'ready',
      opacity: srv.opacity !== undefined ? srv.opacity : 0.8,
      layers: (srv.layers || []).map((l: any) => {
        const layerEnabled = isEnabled && l.enabled !== false
        const capabilities = dataAdapterRegistry.resolveLayerCapabilities(l)

        const render = l.render || {
          type: l.rendering?.format === 'raster' ? 'raster_tile' : l.format === 'esri-feature' ? 'esri_export' : 'geojson',
          url: l.url || srv.url,
          minzoom: l.minZoom,
          maxzoom: l.maxZoom,
          format: l.format,
          paint: l.rendering?.style?.paint,
          layout: l.rendering?.style?.layout
        }

        const feature_service = l.feature_service || (l.data ? {
          type: l.data.adapter === 'esri-rest' ? 'esri_rest' : l.data.adapter === 'ogc-api' ? 'ogc_features' : l.data.adapter === 'wfs' ? 'wfs' : 'geojson_local',
          collection_url: l.data.url || srv.url,
          id_field: l.data.primaryKey,
          display_field: l.data.displayField,
          queryable_fields: (l.data.fields || []).map((f: any) => f.key)
        } : undefined)

        return {
          ...l,
          enabled: layerEnabled,
          render,
          feature_service,
          capabilities
        }
      })
    }
  })
}

const initialServices = parseServicesSync(rawFallbackConfig.services || [])
const initialLayers = initialServices.flatMap((s) => s.layers)
const initialBasemaps = normalizeBasemaps(rawFallbackConfig.basemaps || [])

export const MAP_CONFIG: AppConfig = {
  title: (rawFallbackConfig as any).title || (rawFallbackConfig as any).app?.title || 'VicPlan Spatial Engine',
  subtitle: (rawFallbackConfig as any).subtitle || (rawFallbackConfig as any).app?.subtitle || 'Planning Schemes & Cadastral Cadastre Platform',
  agency: (rawFallbackConfig as any).agency || (rawFallbackConfig as any).app?.agency || 'Department of Transport and Planning Victoria',
  initialView: rawFallbackConfig.initialView as AppConfig['initialView'],
  extentVictoria: rawFallbackConfig.extentVictoria as AppConfig['extentVictoria'],
  coordinates: rawFallbackConfig.coordinates as unknown as CoordinateConfig,
  basemaps: initialBasemaps,
  defaultBasemapId: initialBasemaps[0]?.id || 'carto-light',
  services: initialServices,
  operationalLayers: initialLayers,
  modules: (rawFallbackConfig as any).modules,
  search: (rawFallbackConfig as any).search
}

/**
 * Loads the application configuration dynamically via HTTP from /config.json (in public/ folder).
 * Resolves all services asynchronously via ServiceLoaderRegistry, auto-discovering remote MapServers
 * and auto-populating sublayers at runtime without requiring manual layer definitions in config.
 */
export async function loadAppConfig(configUrl: string = '/config.json'): Promise<AppConfig> {
  let raw: any = null

  try {
    const res = await fetch(configUrl, { cache: 'no-cache' })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    raw = await res.json()
  } catch (err) {
    console.warn(`[loadAppConfig] Could not fetch '${configUrl}', using fallback config:`, err)
    raw = rawFallbackConfig
  }

  // Auto-discover and normalize all services in parallel via protocol loaders
  const services = await serviceLoaderRegistry.loadAll(raw.services || [])
  const operationalLayers = services.flatMap((s) => s.layers)
  const basemaps = normalizeBasemaps(raw.basemaps || MAP_CONFIG.basemaps)
  const defaultBasemapId = basemaps[0]?.id || 'carto-light'

  const updated: AppConfig = {
    title: raw.title || raw.app?.title || MAP_CONFIG.title,
    subtitle: raw.subtitle || raw.app?.subtitle || MAP_CONFIG.subtitle,
    agency: raw.agency || raw.app?.agency || MAP_CONFIG.agency,
    initialView: raw.initialView || MAP_CONFIG.initialView,
    extentVictoria: raw.extentVictoria || MAP_CONFIG.extentVictoria,
    coordinates: raw.coordinates || MAP_CONFIG.coordinates,
    basemaps,
    defaultBasemapId,
    services,
    operationalLayers,
    modules: raw.modules || MAP_CONFIG.modules,
    search: raw.search || MAP_CONFIG.search
  }

  // Mutate in-place so all static module references to MAP_CONFIG stay in sync
  Object.assign(MAP_CONFIG, updated)
  return MAP_CONFIG
}
