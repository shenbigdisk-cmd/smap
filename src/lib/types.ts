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

export type IdentifyDisplayMode = 'auto' | 'popup' | 'panel'

export interface UserSettings {
  layout: LayoutMode
  theme: AppTheme
  unit: MeasurementUnit
  coordFormat: CoordinateFormat
  buildings3D: boolean
  animationSpeed: 'normal' | 'fast' | 'instant'
  identifyDisplayMode?: IdentifyDisplayMode
}

export type ModuleCategory = 'core' | 'analysis' | 'cartography' | 'output' | 'custom'

export type ViewPlacement = 'sidepanel' | 'toolbox'

export interface WebGISView {
  id: string
  moduleId: string
  name: string
  shortTitle: string
  description: string
  category: ModuleCategory
  icon?: string
  placement: ViewPlacement
  defaultPlacement: ViewPlacement
  supportedPlacements?: readonly ViewPlacement[]
  order: number
}

export interface WebGISModule {
  id: string
  name: string
  shortTitle: string
  description: string
  category: ModuleCategory
  isPinned: boolean
  isExpandedInToolbox: boolean
  views?: WebGISView[]
}

export type SurfaceMode = string

export type BasemapId = 'carto-light' | 'carto-voyager' | 'carto-dark' | 'esri-satellite'

export interface BasemapConfig {
  id: BasemapId | string
  name: string
  description?: string
  styleUrl?: string
  style?: any
  type?: 'vector' | 'raster'
  tiles?: string[]
  rasterTiles?: string[]
  thumbnail?: string
  attribution?: string
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
  | 'wmts'
  | 'wfs'
  | 'ogc-api'
  | 'vector-tile'
  | 'geojson-static'
  | 'pmtiles'

// --- OmniLayer Specification: Dual-Channel Spatial Architecture (DCSA) ---

export type LayerRenderType =
  | 'pmtiles'
  | 'vector_tile'
  | 'raster_tile'
  | 'wms'
  | 'wmts'
  | 'esri_export'
  | 'esri_tile'
  | 'geojson'

export interface LayerRenderDescriptor {
  type: LayerRenderType
  url: string
  source_layer?: string
  layers?: string | number
  sublayers?: number[]
  format?: string
  transparent?: boolean
  tileSize?: number
  minzoom?: number
  maxzoom?: number
  paint?: Record<string, any>
  layout?: Record<string, any>
}

export type FeatureServiceType =
  | 'ogc_features'
  | 'wfs'
  | 'esri_rest'
  | 'geojson_local'

export interface FeatureServiceDescriptor {
  type: FeatureServiceType
  collection_url: string
  url?: string
  id_field?: string
  display_field?: string
  queryable_fields?: string[]
  fields?: LayerFieldConfig[]
}

export interface LayerCapabilitiesMatrix {
  identify: 'server' | 'client' | boolean
  query: boolean
  buffer: boolean
  export: boolean
  table: boolean
  queryAttribute?: boolean
  querySpatial?: boolean
}

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
  identify: boolean | 'server' | 'client'
  queryAttribute: boolean
  querySpatial: boolean
  buffer: boolean
  export: boolean
  table: boolean
  query?: boolean
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

export interface LegendItem {
  id?: string
  label: string
  code?: string
  color: string
  stroke?: string
  border?: string
  pattern?: string
  image?: string
  value?: any
  property?: string
}

export interface LayerLegendConfig {
  title?: string
  dynamic?: boolean // When true, only show legend items for features currently visible in the map viewport
  property?: string // Attribute property key used to match legend items (e.g. 'code', 'zoneCode')
  items: LegendItem[]
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
  defaultVisibility?: boolean
  enabled?: boolean
  opacity: number
  color: string
  minZoom?: number
  maxZoom?: number
  rendering: LayerRenderingConfig
  data: LayerDataConfig
  capabilities: LayerCapabilities
  legend?: LayerLegendConfig
  // OmniLayer Dual-Channel Specification
  render?: LayerRenderDescriptor
  feature_service?: FeatureServiceDescriptor
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
  category?: string
  attribution?: string
  description?: string
  visible: boolean
  defaultVisibility?: boolean
  enabled?: boolean
  status?: 'ready' | 'loading' | 'error'
  error?: string
  autoDiscover?: boolean
  opacity: number
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
  layerTitle?: string
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
  coordinate?: [number, number]
  source?: 'identify' | 'query'
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
  category: 'address' | 'parcel' | 'spi' | 'lga' | 'zone' | 'coordinate' | 'place' | string
  center: [number, number]
  zoom?: number
  parcelId?: string
  extent?: [number, number, number, number]
  sourceId?: string
  sourceName?: string
  score?: number
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

export type PaperSize = 'a4' | 'a3' | 'a5' | 'letter'
export type PageOrientation = 'landscape' | 'portrait'
export type PrintDpi = 96 | 150 | 300
export type PrintFormat = 'pdf' | 'png' | 'jpeg'

export interface UserPrintSettings {
  paperSize: PaperSize
  orientation: PageOrientation
  dpi: PrintDpi
  format: PrintFormat
  showScale: boolean
  showNorthArrow: boolean
  showCoordinates: boolean
  showLegend: boolean
  showPrintFrame: boolean
}
