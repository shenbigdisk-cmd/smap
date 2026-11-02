import type {
  LayerCapabilities,
  LayerDataConfig,
  LayerRenderingConfig,
  ServiceDefinition,
  ServiceLayer
} from '../../types'
import type { IServiceLoader, RawLayerConfig, RawServiceConfig } from './types'

/**
 * Normalizes client-side GeoJSON, local cache, and static spatial services into OmniLayers.
 */
export class GeoJsonLoader implements IServiceLoader {
  canHandle(config: RawServiceConfig): boolean {
    const type = (config.type || '').toLowerCase()
    const url = (config.url || '').toLowerCase()
    return type === 'geojson-static' || type === 'geojson' || url.startsWith('local://') || url.endsWith('.geojson') || url.endsWith('.json')
  }

  async load(config: RawServiceConfig): Promise<ServiceDefinition> {
    const serviceId = config.id || `local-${Math.random().toString(36).substring(2, 9)}`
    const isEnabled = config.enabled !== false
    const rawLayers =
      config.layers && config.layers.length > 0
        ? config.layers
        : [{ id: `${serviceId}-layer-0`, title: config.name || 'GeoJSON Layer' }]

    const layers: ServiceLayer[] = rawLayers.map((raw, idx) => {
      const layerId = raw.id || `${serviceId}-layer-${idx}`
      const geomType = raw.geometryType || 'polygon'
      const color = raw.color || '#3b82f6'

      const rendering: LayerRenderingConfig = raw.rendering || {
        format: 'geojson',
        sourceId: `${layerId}-source`,
        style: {
          type: geomType === 'polygon' ? 'fill' : geomType === 'line' ? 'line' : 'circle',
          paint: {
            'fill-color': color,
            'fill-opacity': raw.opacity ?? 0.6
          }
        }
      }

      const data: LayerDataConfig = raw.data || {
        adapter: 'geojson-client',
        primaryKey: 'id',
        displayField: 'name'
      }

      const capabilities: LayerCapabilities = {
        identify: 'client',
        query: true,
        queryAttribute: true,
        querySpatial: true,
        buffer: true,
        export: true,
        table: true,
        ...(raw.capabilities || {})
      }

      return {
        id: layerId,
        serviceId,
        serviceLayerId: raw.serviceLayerId ?? idx,
        title: raw.title || `Layer ${idx + 1}`,
        category: raw.category || 'planning',
        geometryType: geomType,
        description: raw.description,
        visible: raw.visible ?? true,
        enabled: (raw.enabled !== false) && isEnabled,
        opacity: raw.opacity ?? 0.8,
        color,
        render: raw.render || {
          type: 'geojson',
          url: config.url
        },
        feature_service: raw.feature_service || {
          type: 'geojson_local',
          collection_url: config.url,
          id_field: 'id'
        },
        rendering,
        data,
        capabilities
      }
    })

    return {
      id: serviceId,
      name: config.name || 'Local GeoJSON Service',
      type: 'geojson-static',
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
