export type LayoutMode = 'site' | 'application' | 'compact'

export type AppTheme =
  | 'light'
  | 'dark'
  | 'fluent-light'
  | 'fluent-dark'
  | 'github-light'
  | 'github-dark'
  | 'material-light'
  | 'material-dark'

export type MeasurementUnit = 'metric' | 'imperial'

export type CoordinateFormat = 'mga2020' | 'gda2020_latlng' | 'dd' | 'mga55' | 'dms'

export interface UserSettings {
  layout: LayoutMode
  theme: AppTheme
  unit: MeasurementUnit
  coordFormat: CoordinateFormat
  buildings3D: boolean
  animationSpeed: 'normal' | 'fast' | 'instant'
}

export type ModuleCategory = 'core' | 'analysis' | 'cartography' | 'output'

export interface WebGISModule {
  id: string
  name: string
  shortTitle: string
  description: string
  category: ModuleCategory
  isPinned: boolean
  isExpandedInToolbox: boolean
}

export type SurfaceMode = string

export type BasemapId = 'carto-light' | 'carto-voyager' | 'carto-dark' | 'esri-satellite'

export interface BasemapConfig {
  id: BasemapId
  name: string
  description: string
  styleUrl?: string
  rasterTiles?: string[]
  attribution: string
}

export type ZoneCategory =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'public'
  | 'rural'
  | 'special'

export interface PlanningZone {
  code: string
  name: string
  category: ZoneCategory
  fillColor: string
  strokeColor: string
  textColor: string
  ordinanceUrl: string
  schedule?: string
}

export interface PlanningOverlay {
  code: string
  name: string
  category: 'heritage' | 'bushfire' | 'flooding' | 'environment' | 'design'
  fillColor: string
  strokeColor: string
  ordinanceUrl: string
  schedule?: string
}

export interface ParcelFeature {
  id: string
  address: string
  lotPlan: string
  spi: string
  councilPropId: string
  lga: string
  lgaCode: string
  ward: string
  areaM2: number
  perimeterM: number
  zone: PlanningZone
  overlays: PlanningOverlay[]
  center: [number, number]
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export type LayerOperation =
  | 'query-attribute'
  | 'query-spatial'
  | 'buffer'
  | 'export'
  | 'identify'
  | 'table'
  | 'style'

export type LayerFormat =
  | 'geojson'
  | 'esri-feature'
  | 'esri-dynamic'
  | 'vector-tile'
  | 'wms'
  | 'wfs'
  | 'raster-xyz'

export type ServiceType =
  | 'esri-rest'
  | 'wms'
  | 'wfs'
  | 'ogc-api'
  | 'vector-tile'
  | 'geojson-static'
  | 'pmtiles'

export interface LayerFieldConfig {
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'select'
  options?: string[]
}

export interface LayerQueryConfig {
  displayField?: string
  outFields?: string[]
  fields?: LayerFieldConfig[]
}

export interface LayerCapabilities {
  identify: boolean
  queryAttribute: boolean
  querySpatial: boolean
  buffer: boolean
  export: boolean
  table: boolean
}

export interface LayerRenderingConfig {
  format: 'vector' | 'raster' | 'geojson'
  sourceId?: string
  maplibreSource?: any
  style: {
    type: 'fill' | 'line' | 'circle' | 'raster' | 'fill-extrusion'
    sourceLayer?: string
    paint?: Record<string, any>
    layout?: Record<string, any>
    filter?: any
  }
  minZoom?: number
  maxZoom?: number
}

export interface LayerDataConfig {
  adapter: 'esri-rest' | 'wfs' | 'wms' | 'ogc-api' | 'geojson-client' | 'mvt-client'
  url?: string
  serviceLayerId?: number | string
  primaryKey?: string
  displayField?: string
  titleTemplate?: string
  outFields?: string[]
  fields?: LayerFieldConfig[]
}

export interface ServiceLayer {
  id: string
  serviceId: string
  serviceLayerId?: number | string
  title: string
  category: 'planning' | 'overlays' | 'cadastre' | 'boundaries' | 'buildings' | string
  geometryType?: 'point' | 'line' | 'polygon'
  description?: string
  visible: boolean
  opacity: number
  color: string
  minZoom?: number
  maxZoom?: number
  rendering: LayerRenderingConfig
  data: LayerDataConfig
  capabilities: LayerCapabilities
  // Convenience & backward compatibility fields
  format?: LayerFormat
  url?: string
  type?: 'fill' | 'line' | 'circle' | 'fill-extrusion'
  operations?: LayerOperation[]
  queryConfig?: LayerQueryConfig
}

export type OperationalLayer = ServiceLayer

export interface ServiceDefinition {
  id: string
  name: string
  type: ServiceType
  url: string
  attribution?: string
  description?: string
  layers: ServiceLayer[]
}

export interface MapInteractionHandler {
  id: string
  moduleId: string
  cursor?: 'crosshair' | 'pointer' | 'cell' | 'grab' | 'default' | string
  hint?: string
  onClick?: (coord: [number, number], event?: any) => void
  onMouseMove?: (coord: [number, number], event?: any) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onDeactivate: () => void
}

export type QuerySpatialMode = 'bbox' | 'polygon' | 'radius' | 'viewport' | 'selected'

export interface AttributeFilterRule {
  field: string
  operator: '=' | '!=' | 'contains' | 'starts_with' | '>' | '<' | '>=' | '<='
  value: string | number
}

export interface SpatialFilterCriteria {
  mode: QuerySpatialMode
  geometry?: any
  center?: [number, number]
  radiusMeters?: number
}

export interface QueryDefinition {
  layerId: string
  attributeRules?: AttributeFilterRule[]
  attributeOperator?: 'AND' | 'OR'
  spatialCriteria?: SpatialFilterCriteria
  limit?: number
}

export interface QueryResultFeature {
  id: string | number
  layerId: string
  title: string
  subtitle?: string
  geometry: any
  properties: Record<string, any>
}

export interface QueryResultCollection {
  layerId: string
  layerTitle: string
  timestamp: number
  features: QueryResultFeature[]
  totalCount: number
}

export interface SearchSourceConfig {
  id: string
  name: string
  type: 'local-parcels' | 'esri-geocoder' | 'photon-osm' | 'wfs'
  url?: string
  enabled: boolean
}

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  category: 'address' | 'parcel' | 'spi' | 'lga' | 'zone'
  center: [number, number]
  zoom?: number
  parcelId?: string
}

export type MeasurementType = 'distance' | 'area' | 'coordinate'

export interface MeasurementState {
  type: MeasurementType | null
  points: [number, number][]
  totalDistanceMeters: number
  totalAreaM2: number
  lastCoordinate: [number, number] | null
  isFinished?: boolean
}

export interface MapBookmark {
  id: string
  name: string
  description: string
  center: [number, number]
  zoom: number
  pitch?: number
  bearing?: number
  isCustom?: boolean
}

export type MarkupTool =
  | 'point'
  | 'line'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'freehand'
  | 'select'

export interface MarkupItem {
  id: string
  type: MarkupTool
  coordinates: any
  label?: string
  color: string
  strokeWidth: number
}

export interface BufferState {
  active: boolean
  radiusMeters: number
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  } | null
}
