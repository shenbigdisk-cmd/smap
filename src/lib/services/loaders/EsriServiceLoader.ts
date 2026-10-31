import type {
  LayerCapabilities,
  LayerDataConfig,
  LayerRenderingConfig,
  ServiceDefinition,
  ServiceLayer
} from '../../types'
import type { IServiceLoader, RawLayerConfig, RawServiceConfig } from './types'

/**
 * Normalizes ArcGIS REST MapServer and FeatureServer services into OmniLayer definitions.
 */
export class EsriServiceLoader implements IServiceLoader {
  canHandle(config: RawServiceConfig): boolean {
    const type = (config.type || '').toLowerCase()
    const url = (config.url || '').toLowerCase()
    return (
      type === 'esri-rest' ||
      type === 'esri' ||
      type === 'arcgis' ||
      url.includes('/mapserver') ||
      url.includes('/featureserver')
    )
  }

  async load(config: RawServiceConfig): Promise<ServiceDefinition> {
    const cleanUrl = config.url.replace(/\/+$/, '')
    const serviceId = config.id || `esri-${Math.random().toString(36).substring(2, 9)}`
    const isEnabled = config.enabled !== false

    // FAST KILL: If disabled in config, skip all network requests immediately
    if (!isEnabled) {
      return {
        id: serviceId,
        name: config.name || 'ArcGIS Service (Disabled)',
        type: 'esri-rest',
        url: cleanUrl,
        enabled: false,
        visible: false,
        status: 'offline',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        attribution: config.attribution,
        layers: (config.layers || []).map((l, idx) => this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, false))
      }
    }

    // If explicit layers are provided and autoDiscover is not requested, use declared layers
    if (config.layers && config.layers.length > 0 && !config.autoDiscover) {
      return {
        id: serviceId,
        name: config.name || 'ArcGIS Service',
        type: 'esri-rest',
        url: cleanUrl,
        enabled: true,
        visible: config.visible ?? true,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        attribution: config.attribution,
        layers: config.layers.map((l, idx) => this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, true))
      }
    }

    // Auto-Discovery: Introspect /MapServer?f=json with 4s circuit-breaker timeout
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const res = await fetch(`${cleanUrl}?f=json`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      }).finally(() => clearTimeout(timeoutId))

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const meta = await res.json()
      if (meta.error) {
        throw new Error(meta.error.message || 'ArcGIS Service Error')
      }

      const isTileCache = Boolean(meta.singleFusedMapCache)
      const serviceName = config.name || meta.serviceDescription || meta.mapName || 'ArcGIS Service'
      const rawLayers = Array.isArray(meta.layers) ? meta.layers : []

      const layers: ServiceLayer[] = rawLayers.map((metaLayer: any, idx: number) => {
        const sublayerId = metaLayer.id !== undefined ? metaLayer.id : idx
        const layerId = `${serviceId}-layer-${sublayerId}`
        const geomType = this.mapGeometryType(metaLayer.geometryType)

        const defaultColor = '#2563eb'
        const isLayerVisible = metaLayer.defaultVisibility !== false

        const rendering: LayerRenderingConfig = {
          format: isTileCache ? 'raster' : 'geojson',
          sourceId: `${layerId}-source`,
          style: {
            type: geomType === 'polygon' ? 'fill' : geomType === 'line' ? 'line' : 'circle',
            paint:
              geomType === 'polygon'
                ? { 'fill-color': defaultColor, 'fill-opacity': 0.6 }
                : geomType === 'line'
                  ? { 'line-color': defaultColor, 'line-width': 2 }
                  : { 'circle-color': defaultColor, 'circle-radius': 5 }
          }
        }

        const data: LayerDataConfig = {
          adapter: 'esri-rest',
          url: `${cleanUrl}/${sublayerId}`,
          serviceLayerId: sublayerId,
          primaryKey: 'OBJECTID',
          displayField: 'name'
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
          serviceLayerId: sublayerId,
          title: metaLayer.name || `Sublayer ${sublayerId}`,
          category: 'planning',
          geometryType: geomType,
          description: metaLayer.description || metaLayer.name,
          visible: isLayerVisible,
          enabled: true,
          opacity: 0.8,
          color: defaultColor,
          render: {
            type: isTileCache ? 'esri_tile' : 'esri_export',
            url: isTileCache ? `${cleanUrl}/tile/{z}/{y}/{x}` : `${cleanUrl}/export`,
            layers: `show:${sublayerId}`,
            format: 'png32',
            transparent: true
          },
          feature_service: {
            type: 'esri_rest',
            collection_url: `${cleanUrl}/${sublayerId}`,
            id_field: 'OBJECTID'
          },
          rendering,
          data,
          capabilities
        }
      })

      return {
        id: serviceId,
        name: serviceName,
        type: 'esri-rest',
        url: cleanUrl,
        enabled: true,
        visible: config.visible ?? true,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description || meta.description,
        attribution: config.attribution || meta.copyrightText,
        layers: layers.length > 0 ? layers : this.createFallbackLayer(serviceId, cleanUrl)
      }
    } catch (err: any) {
      console.warn(`[EsriServiceLoader] Could not introspect '${cleanUrl}':`, err?.message)
      // Resilient fallback: Return offline service definition instead of crashing
      return {
        id: serviceId,
        name: config.name || 'ArcGIS Service (Unavailable)',
        type: 'esri-rest',
        url: cleanUrl,
        enabled: false,
        visible: false,
        status: 'offline',
        error: err?.message || 'Server timeout or network error',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        layers: this.createFallbackLayer(serviceId, cleanUrl)
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
    const sublayerId = raw.serviceLayerId ?? index
    const layerId = raw.id || `${serviceId}-layer-${sublayerId}`
    const geomType = raw.geometryType || 'polygon'
    const color = raw.color || '#2563eb'

    const rendering: LayerRenderingConfig = raw.rendering || {
      format: 'geojson',
      sourceId: `${layerId}-source`,
      style: {
        type: geomType === 'polygon' ? 'fill' : geomType === 'line' ? 'line' : 'circle',
        paint: { 'fill-color': color, 'fill-opacity': raw.opacity ?? 0.6 }
      }
    }

    const data: LayerDataConfig = raw.data || {
      adapter: 'esri-rest',
      url: `${cleanUrl}/${sublayerId}`,
      serviceLayerId: sublayerId,
      primaryKey: 'OBJECTID'
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
      serviceLayerId: sublayerId,
      title: raw.title || `Layer ${sublayerId}`,
      category: raw.category || 'planning',
      geometryType: geomType,
      description: raw.description,
      visible: raw.visible ?? true,
      enabled: (raw.enabled !== false) && serviceEnabled,
      opacity: raw.opacity ?? 0.8,
      color,
      render: raw.render || {
        type: 'esri_export',
        url: `${cleanUrl}/export`,
        layers: `show:${sublayerId}`,
        format: 'png32',
        transparent: true
      },
      feature_service: raw.feature_service || {
        type: 'esri_rest',
        collection_url: `${cleanUrl}/${sublayerId}`,
        id_field: 'OBJECTID'
      },
      rendering,
      data,
      capabilities
    }
  }

  private createFallbackLayer(serviceId: string, url: string): ServiceLayer[] {
    return [
      {
        id: `${serviceId}-fallback`,
        serviceId,
        serviceLayerId: 0,
        title: 'ArcGIS Root Layer',
        category: 'planning',
        geometryType: 'polygon',
        visible: false,
        enabled: false,
        opacity: 0.8,
        color: '#2563eb',
        render: {
          type: 'esri_export',
          url: `${url}/export`,
          layers: 'show:0',
          format: 'png32',
          transparent: true
        },
        feature_service: {
          type: 'esri_rest',
          collection_url: `${url}/0`,
          id_field: 'OBJECTID'
        },
        rendering: {
          format: 'geojson',
          sourceId: `${serviceId}-fallback-source`,
          style: { type: 'fill', paint: { 'fill-color': '#2563eb' } }
        },
        data: {
          adapter: 'esri-rest',
          url: `${url}/0`
        },
        capabilities: {
          identify: 'server',
          query: true,
          queryAttribute: true,
          querySpatial: true,
          buffer: true,
          export: true,
          table: true
        }
      }
    ]
  }

  private mapGeometryType(esriType?: string): 'point' | 'line' | 'polygon' {
    if (!esriType) return 'polygon'
    const lower = esriType.toLowerCase()
    if (lower.includes('point')) return 'point'
    if (lower.includes('line') || lower.includes('path') || lower.includes('poly')) {
      if (lower.includes('polyline')) return 'line'
    }
    return 'polygon'
  }
}
