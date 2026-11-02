import type {
  FeatureServiceDescriptor,
  LayerCapabilities,
  LayerRenderDescriptor,
  ServiceDefinition,
  ServiceLayer,
  ServiceType
} from '../../types'

/**
 * Raw service configuration input from app.config.json or runtime user entry.
 */
export interface RawServiceConfig {
  id?: string
  name?: string
  type: ServiceType | string
  url: string
  enabled?: boolean
  visible?: boolean
  defaultVisibility?: boolean
  opacity?: number
  description?: string
  attribution?: string
  category?: string
  autoDiscover?: boolean
  layers?: RawLayerConfig[]
}

/**
 * Raw layer configuration input.
 */
export interface RawLayerConfig {
  id?: string
  serviceId?: string
  serviceLayerId?: number | string
  title?: string
  category?: string
  geometryType?: 'point' | 'line' | 'polygon'
  description?: string
  enabled?: boolean
  visible?: boolean
  defaultVisibility?: boolean
  opacity?: number
  color?: string
  minZoom?: number
  maxZoom?: number
  // OmniLayer Spec Channel
  render?: LayerRenderDescriptor
  feature_service?: FeatureServiceDescriptor
  capabilities?: Partial<LayerCapabilities>
  legend?: any
  // Backward compatibility legacy fields
  rendering?: any
  data?: any
  format?: any
}

/**
 * Common contract for pluggable protocol loaders.
 */
export interface IServiceLoader {
  /**
   * Determine whether this loader handles the given service configuration or URL.
   */
  canHandle(config: RawServiceConfig): boolean

  /**
   * Introspect remote server endpoints (or local schema) and normalize into
   * the canonical ServiceDefinition with OmniLayer specifications.
   */
  load(config: RawServiceConfig): Promise<ServiceDefinition>
}
