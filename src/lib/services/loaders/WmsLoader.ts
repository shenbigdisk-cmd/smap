import type {
  LayerCapabilities,
  LayerDataConfig,
  LayerRenderingConfig,
  ServiceDefinition,
  ServiceLayer
} from '../../types'
import type { IServiceLoader, RawLayerConfig, RawServiceConfig } from './types'

/**
 * Normalizes OGC WMS (Web Map Service) and WMTS endpoints into OmniLayers.
 */
export class WmsLoader implements IServiceLoader {
  canHandle(config: RawServiceConfig): boolean {
    const type = (config.type || '').toLowerCase()
    const url = (config.url || '').toLowerCase()
    return type === 'wms' || type === 'wmts' || url.includes('service=wms') || url.includes('/wms')
  }

  async load(config: RawServiceConfig): Promise<ServiceDefinition> {
    const cleanUrl = config.url.replace(/\/+$/, '')
    const serviceId = config.id || `wms-${Math.random().toString(36).substring(2, 9)}`
    const isEnabled = config.enabled !== false
    const isWmts = (config.type || '').toLowerCase() === 'wmts'

    if (!isEnabled) {
      return {
        id: serviceId,
        name: config.name || 'WMS Service (Disabled)',
        type: isWmts ? 'wmts' : 'wms',
        url: cleanUrl,
        enabled: false,
        visible: false,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        layers: (config.layers || []).map((l, idx) => this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, false, isWmts))
      }
    }

    // Use declared layers if available
    if (config.layers && config.layers.length > 0) {
      return {
        id: serviceId,
        name: config.name || (isWmts ? 'WMTS Service' : 'WMS Service'),
        type: isWmts ? 'wmts' : 'wms',
        url: cleanUrl,
        enabled: true,
        visible: config.visible ?? true,
        status: 'ready',
        opacity: config.opacity ?? 0.8,
        description: config.description,
        layers: config.layers.map((l, idx) => this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, true, isWmts))
      }
    }

    // Default placeholder for standalone WMS URL
    const defaultLayer = this.createDefaultWmsLayer(serviceId, cleanUrl, config.name || 'WMS Map Layer', isWmts)
    return {
      id: serviceId,
      name: config.name || (isWmts ? 'WMTS Service' : 'WMS Service'),
      type: isWmts ? 'wmts' : 'wms',
      url: cleanUrl,
      enabled: true,
      visible: config.visible ?? true,
      status: 'ready',
      opacity: config.opacity ?? 0.8,
      layers: [defaultLayer]
    }
  }

  private normalizeDeclaredLayer(
    raw: RawLayerConfig,
    serviceId: string,
    cleanUrl: string,
    index: number,
    serviceEnabled: boolean,
    isWmts: boolean
  ): ServiceLayer {
    const layerId = raw.id || `${serviceId}-layer-${index}`
    const sublayerName = (raw.serviceLayerId as string) || (raw.render?.layers as string) || `layer_${index}`

    const rendering: LayerRenderingConfig = raw.rendering || {
      format: 'raster',
      sourceId: `${layerId}-source`,
      style: {
        type: 'raster',
        paint: { 'raster-opacity': raw.opacity ?? 0.8 }
      }
    }

    const data: LayerDataConfig = raw.data || {
      adapter: 'wms',
      url: cleanUrl,
      serviceLayerId: sublayerName
    }

    const capabilities: LayerCapabilities = {
      identify: 'server',
      query: false,
      queryAttribute: false,
      querySpatial: false,
      buffer: false,
      export: false,
      table: false,
      ...(raw.capabilities || {})
    }

    return {
      id: layerId,
      serviceId,
      serviceLayerId: sublayerName,
      title: raw.title || `WMS Layer ${index + 1}`,
      category: raw.category || 'planning',
      geometryType: 'polygon',
      description: raw.description,
      visible: raw.visible ?? true,
      enabled: (raw.enabled !== false) && serviceEnabled,
      opacity: raw.opacity ?? 0.8,
      color: raw.color || '#6366f1',
      render: raw.render || {
        type: isWmts ? 'wmts' : 'wms',
        url: cleanUrl,
        layers: sublayerName,
        format: 'image/png',
        transparent: true
      },
      feature_service: raw.feature_service,
      rendering,
      data,
      capabilities
    }
  }

  private createDefaultWmsLayer(serviceId: string, cleanUrl: string, title: string, isWmts: boolean): ServiceLayer {
    return {
      id: `${serviceId}-root`,
      serviceId,
      serviceLayerId: 0,
      title,
      category: 'planning',
      geometryType: 'polygon',
      visible: true,
      enabled: true,
      opacity: 0.8,
      color: '#6366f1',
      render: {
        type: isWmts ? 'wmts' : 'wms',
        url: cleanUrl,
        format: 'image/png',
        transparent: true
      },
      rendering: {
        format: 'raster',
        sourceId: `${serviceId}-root-source`,
        style: {
          type: 'raster',
          paint: { 'raster-opacity': 0.8 }
        }
      },
      data: {
        adapter: 'wms',
        url: cleanUrl
      },
      capabilities: {
        identify: 'server',
        query: false,
        queryAttribute: false,
        querySpatial: false,
        buffer: false,
        export: false,
        table: false
      }
    }
  }
}
