import rawConfig from '../../config/app.config.json'
import type { BasemapConfig, OperationalLayer, SearchSourceConfig, WebGISModule } from '../types'

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
  operationalLayers: OperationalLayer[]
  modules?: (Partial<WebGISModule> & { id: string; enabled?: boolean })[]
  search?: {
    sources: SearchSourceConfig[]
  }
}

export const MAP_CONFIG: AppConfig = {
  title: rawConfig.app.title,
  subtitle: rawConfig.app.subtitle,
  agency: rawConfig.app.agency,
  initialView: rawConfig.initialView as AppConfig['initialView'],
  extentVictoria: rawConfig.extentVictoria as AppConfig['extentVictoria'],
  coordinates: rawConfig.coordinates as CoordinateConfig,
  basemaps: rawConfig.basemaps as BasemapConfig[],
  defaultBasemapId: rawConfig.defaultBasemapId,
  operationalLayers: rawConfig.layers as unknown as OperationalLayer[],
  modules: rawConfig.modules as any,
  search: rawConfig.search as any
}
