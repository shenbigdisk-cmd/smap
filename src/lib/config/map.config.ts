import rawConfig from '../../config/app.config.json'
import type {
  BasemapConfig,
  OperationalLayer,
  SearchSourceConfig,
  ServiceDefinition,
  WebGISModule
} from '../types'
import { dataAdapterRegistry } from '../services/adapters/DataAdapterRegistry'

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
  modules?: (Partial<WebGISModule> & { id: string; enabled?: boolean })[]
  search?: {
    sources: SearchSourceConfig[]
  }
}

const parsedServices: ServiceDefinition[] = (rawConfig.services || []).map((srv: any) => {
  const isEnabled = srv.enabled !== false
  const isAnyVisible = (srv.layers || []).some((l: any) => l.visible !== false)

  return {
    ...srv,
    enabled: isEnabled,
    visible: srv.visible !== undefined ? srv.visible : isAnyVisible,
    status: isEnabled ? 'ready' : 'offline',
    opacity: srv.opacity !== undefined ? srv.opacity : 0.8,
    layers: (srv.layers || []).map((l: any) => {
      const layerEnabled = isEnabled && l.enabled !== false
      const capabilities = dataAdapterRegistry.resolveLayerCapabilities(l)

      // Dual-channel OmniLayer normalization: synthesize render if not explicitly declared
      const render = l.render || {
        type: l.rendering?.format === 'raster' ? 'raster_tile' : l.format === 'esri-feature' ? 'esri_export' : 'geojson',
        url: l.url || srv.url,
        minzoom: l.minZoom,
        maxzoom: l.maxZoom,
        format: l.format,
        paint: l.rendering?.style?.paint,
        layout: l.rendering?.style?.layout
      }

      // Dual-channel OmniLayer normalization: synthesize feature_service if not explicitly declared
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

// Auto-derive all layers from services, with fallback to legacy flat layers
const allLayers: OperationalLayer[] =
  parsedServices.length > 0
    ? parsedServices.flatMap((s) => s.layers)
    : (rawConfig.layers as any[]).map((l) => ({
        ...l,
        capabilities: dataAdapterRegistry.resolveLayerCapabilities(l)
      }))

export const MAP_CONFIG: AppConfig = {
  title: rawConfig.app.title,
  subtitle: rawConfig.app.subtitle,
  agency: rawConfig.app.agency,
  initialView: rawConfig.initialView as AppConfig['initialView'],
  extentVictoria: rawConfig.extentVictoria as AppConfig['extentVictoria'],
  coordinates: rawConfig.coordinates as CoordinateConfig,
  basemaps: rawConfig.basemaps as BasemapConfig[],
  defaultBasemapId: rawConfig.defaultBasemapId,
  services: parsedServices,
  operationalLayers: allLayers,
  modules: rawConfig.modules as any,
  search: rawConfig.search as any
}
