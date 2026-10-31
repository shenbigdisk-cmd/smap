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

const parsedServices: ServiceDefinition[] = (rawConfig.services || []).map((srv: any) => ({
  ...srv,
  layers: (srv.layers || []).map((l: any) => ({
    ...l,
    capabilities: dataAdapterRegistry.resolveLayerCapabilities(l)
  }))
}))

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
