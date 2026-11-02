import type {
  LayerCapabilities,
  LayerDataConfig,
  LayerRenderingConfig,
  ServiceDefinition,
  ServiceLayer
} from '../../types'
import type { IServiceLoader, RawLayerConfig, RawServiceConfig } from './types'

/**
 * Normalizes PMTiles archives and hybrid Vector Tile services into OmniLayers.
 */
export class PmtilesLoader implements IServiceLoader {
  canHandle(config: RawServiceConfig): boolean {
    const type = (config.type || '').toLowerCase()
    const url = (config.url || '').toLowerCase()
    const hasPmtilesLayer = (config.layers || []).some((l) => l.render?.type === 'pmtiles')
    return (
      type === 'pmtiles' ||
      type === 'vector-tile' ||
      type === 'mvt' ||
      url.endsWith('.pmtiles') ||
      url.includes('{z}/{x}/{y}') ||
      hasPmtilesLayer
    )
  }

  async load(config: RawServiceConfig): Promise<ServiceDefinition> {
    const serviceId = config.id || `pmtiles-${Math.random().toString(36).substring(2, 9)}`
    const isEnabled = config.enabled !== false
    const rawLayers =
      config.layers && config.layers.length > 0
        ? config.layers
        : [{ id: `${serviceId}-layer-0`, title: config.name || 'Vector Tile Layer' }]

    const layers: ServiceLayer[] = rawLayers.map((raw, idx) => {
      const layerId = raw.id || `${serviceId}-layer-${idx}`
      const color = raw.color || '#3b82f6'

      const render = raw.render || {
        type: 'pmtiles',
        url: config.url,
        source_layer: 'default',
        minzoom: raw.minZoom ?? 5,
        maxzoom: raw.maxZoom ?? 16
      }

      const rendering: LayerRenderingConfig = raw.rendering || {
        format: 'vector',
        sourceId: `${layerId}-pmtiles-source`,
        style: {
          type: 'fill',
          sourceLayer: render.source_layer || 'default',
          paint: render.paint || {
            'fill-color': color,
            'fill-opacity': raw.opacity ?? 0.6
          }
        }
      }

      const data: LayerDataConfig = raw.data || {
        adapter: raw.feature_service?.type === 'esri_rest' ? 'esri-rest' : raw.feature_service?.type === 'ogc_features' ? 'ogc-api' : 'mvt-client',
        url: raw.feature_service?.collection_url || config.url,
        primaryKey: raw.feature_service?.id_field || 'id'
      }

      const capabilities: LayerCapabilities = {
        identify: raw.capabilities?.identify ?? (raw.feature_service ? 'server' : 'client'),
        query: raw.capabilities?.query ?? Boolean(raw.feature_service),
        queryAttribute: raw.capabilities?.queryAttribute ?? Boolean(raw.feature_service),
        querySpatial: raw.capabilities?.querySpatial ?? Boolean(raw.feature_service),
        buffer: raw.capabilities?.buffer ?? Boolean(raw.feature_service),
        export: raw.capabilities?.export ?? Boolean(raw.feature_service),
        table: raw.capabilities?.table ?? Boolean(raw.feature_service)
      }

      return {
        id: layerId,
        serviceId,
        serviceLayerId: raw.serviceLayerId ?? idx,
        title: raw.title || `PMTiles Layer ${idx + 1}`,
        category: raw.category || 'planning',
        geometryType: raw.geometryType || 'polygon',
        description: raw.description,
        visible: raw.visible ?? true,
        enabled: (raw.enabled !== false) && isEnabled,
        opacity: raw.opacity ?? 0.8,
        color,
        render,
        feature_service: raw.feature_service,
        rendering,
        data,
        capabilities
      }
    })

    return {
      id: serviceId,
      name: config.name || 'PMTiles Archive',
      type: 'pmtiles',
      url: config.url,
      enabled: isEnabled,
      visible: config.visible ?? true,
      status: 'ready',
      opacity: config.opacity ?? 0.8,
      description: config.description,
      attribution: config.attribution,
      layers
    }
  }
}
