import type {
  LayerCapabilities,
  LayerDataConfig,
  LayerRenderingConfig,
  ServiceDefinition,
  ServiceLayer
} from '../../types'
import type { IServiceLoader, RawLayerConfig, RawServiceConfig } from './types'

/**
 * Normalizes OGC API - Features services (pg_featureserv, ldproxy, GeoServer OGC API) into OmniLayers.
 */
export class OgcFeaturesLoader implements IServiceLoader {
  canHandle(config: RawServiceConfig): boolean {
    const type = (config.type || '').toLowerCase()
    const url = (config.url || '').toLowerCase()
    return type === 'ogc-features' || type === 'ogc-api' || type === 'ogc' || url.includes('/collections')
  }

  async load(config: RawServiceConfig): Promise<ServiceDefinition> {
    const cleanUrl = config.url.replace(/\/+$/, '')
    const serviceId = config.id || `ogc-${Math.random().toString(36).substring(2, 9)}`
    const isEnabled = config.enabled !== false

    if (!isEnabled) {
      return {
        id: serviceId,
        name: config.name || 'OGC API Features (Disabled)',
        type: 'ogc-api',
        url: cleanUrl,
        enabled: false,
        visible: false,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        layers: (config.layers || []).map((l, idx) => this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, false))
      }
    }

    if (config.layers && config.layers.length > 0 && !config.autoDiscover) {
      return {
        id: serviceId,
        name: config.name || 'OGC Features Service',
        type: 'ogc-api',
        url: cleanUrl,
        enabled: true,
        visible: config.visible ?? true,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        layers: config.layers.map((l, idx) => this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, true))
      }
    }

    // Auto-Discovery: Introspect /collections endpoint
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const collectionsUrl = cleanUrl.endsWith('/collections') ? cleanUrl : `${cleanUrl}/collections`
      const res = await fetch(collectionsUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      }).finally(() => clearTimeout(timeoutId))

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const meta = await res.json()
      const rawCollections = Array.isArray(meta.collections) ? meta.collections : []

      const layers: ServiceLayer[] = rawCollections.map((col: any, idx: number) => {
        const colId = col.id || `col-${idx}`
        const layerId = `${serviceId}-${colId}`
        const color = '#10b981'

        const collectionItemUrl = `${cleanUrl}/collections/${colId}/items`

        const rendering: LayerRenderingConfig = {
          format: 'geojson',
          sourceId: `${layerId}-source`,
          style: {
            type: 'fill',
            paint: { 'fill-color': color, 'fill-opacity': 0.6 }
          }
        }

        const data: LayerDataConfig = {
          adapter: 'ogc-api',
          url: collectionItemUrl,
          primaryKey: 'id',
          displayField: col.titleField || 'title'
        }

        const capabilities: LayerCapabilities = {
          identify: 'server',
          query: true,
          queryAttribute: true,
          querySpatial: true,
          buffer: true,
          export: true,
          table: true
        }

        return {
          id: layerId,
          serviceId,
          serviceLayerId: colId,
          title: col.title || colId,
          category: 'planning',
          geometryType: 'polygon',
          description: col.description,
          visible: true,
          enabled: true,
          opacity: 0.8,
          color,
          render: {
            type: 'geojson',
            url: collectionItemUrl
          },
          feature_service: {
            type: 'ogc_features',
            collection_url: `${cleanUrl}/collections/${colId}`,
            id_field: 'id'
          },
          rendering,
          data,
          capabilities
        }
      })

      return {
        id: serviceId,
        name: config.name || meta.title || 'OGC Features Service',
        type: 'ogc-api',
        url: cleanUrl,
        enabled: true,
        visible: config.visible ?? true,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description || meta.description,
        layers
      }
    } catch (err: any) {
      console.warn(`[OgcFeaturesLoader] Failed to introspect '${cleanUrl}':`, err?.message)
      return {
        id: serviceId,
        name: config.name || 'OGC Features Service (Unavailable)',
        type: 'ogc-api',
        url: cleanUrl,
        enabled: false,
        visible: false,
        status: 'error',
        error: err?.message || 'Server timeout or network error',
        opacity: config.opacity ?? 0.8,
        layers: []
      }
    }
  }

  private normalizeDeclaredLayer(
    raw: RawLayerConfig,
    serviceId: string,
    cleanUrl: string,
    index: number,
    serviceEnabled: boolean
  ): ServiceLayer {
    const layerId = raw.id || `${serviceId}-layer-${index}`
    const colId = raw.serviceLayerId ?? raw.id ?? `col-${index}`
    const color = raw.color || '#10b981'

    const rendering: LayerRenderingConfig = raw.rendering || {
      format: 'geojson',
      sourceId: `${layerId}-source`,
      style: {
        type: 'fill',
        paint: { 'fill-color': color, 'fill-opacity': raw.opacity ?? 0.6 }
      }
    }

    const data: LayerDataConfig = raw.data || {
      adapter: 'ogc-api',
      url: `${cleanUrl}/collections/${colId}/items`,
      primaryKey: 'id'
    }

    const capabilities: LayerCapabilities = {
      identify: 'server',
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
      serviceLayerId: colId,
      title: raw.title || `Layer ${index + 1}`,
      category: raw.category || 'planning',
      geometryType: raw.geometryType || 'polygon',
      description: raw.description,
      visible: raw.visible ?? true,
      enabled: (raw.enabled !== false) && serviceEnabled,
      opacity: raw.opacity ?? 0.8,
      color,
      render: raw.render || {
        type: 'geojson',
        url: `${cleanUrl}/collections/${colId}/items`
      },
      feature_service: raw.feature_service || {
        type: 'ogc_features',
        collection_url: `${cleanUrl}/collections/${colId}`,
        id_field: 'id'
      },
      rendering,
      data,
      capabilities
    }
  }
}
