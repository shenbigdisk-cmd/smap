import type {
  LayerCapabilities,
  LayerDataConfig,
  LayerRenderingConfig,
  LegendItem,
  ServiceDefinition,
  ServiceLayer
} from '../../types'
import { legendService, sampleColorFromBase64 } from '../legendService'
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
    const serviceId = config.id || this.generateDeterministicId(cleanUrl)
    const isEnabled = config.enabled !== false

    // If explicit layers are provided and autoDiscover is explicitly disabled, use declared layers
    if (config.layers && config.layers.length > 0 && config.autoDiscover === false) {
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

    // Auto-Discovery: Introspect /MapServer?f=json and /legend?f=json in parallel
    try {
      const [metaRes, legendRes] = await Promise.all([
        fetch(`${cleanUrl}?f=json`, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: 'application/json' }
        }),
        fetch(`${cleanUrl}/legend?f=json`, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: 'application/json' }
        }).catch(() => null)
      ])

      if (!metaRes.ok) {
        throw new Error(`HTTP ${metaRes.status}: ${metaRes.statusText}`)
      }

      const meta = await metaRes.json()
      if (meta.error) {
        throw new Error(meta.error.message || 'ArcGIS Service Error')
      }

      let legendLayers: any[] = []
      if (legendRes && legendRes.ok) {
        try {
          const legJson = await legendRes.json()
          if (Array.isArray(legJson.layers)) {
            legendLayers = legJson.layers
            legendService.cacheEsriLegend(cleanUrl, legJson.layers)
          }
        } catch {}
      }

      const isTileCache = Boolean(meta.singleFusedMapCache)
      const desc = (meta.serviceDescription || '').trim()
      const cleanDesc = desc.startsWith('{') || desc.length > 80 ? undefined : desc
      const rawTitle = config.name || meta.mapName || cleanDesc || this.inferServiceNameFromUrl(cleanUrl)
      const serviceName = this.cleanLayerTitle(rawTitle) || 'ArcGIS Service'
      const rawLayers = Array.isArray(meta.layers) ? meta.layers : []
      // Keep operational spatial layers (filter out pure composite/group folders)
      const operationalMetaLayers = rawLayers.filter(
        (ml: any) => !ml.subLayerIds || ml.subLayerIds.length === 0
      )

      const BOUNDARY_COLORS = [
        '#475569', '#6366f1', '#0ea5e9', '#0d9488', '#10b981',
        '#8b5cf6', '#d97706', '#f43f5e', '#3b82f6', '#14b8a6',
        '#e11d48', '#84cc16', '#a855f7', '#0284c7', '#64748b'
      ]

      const layers: ServiceLayer[] = await Promise.all(
        operationalMetaLayers.map(async (metaLayer: any, idx: number) => {
          const sublayerId = metaLayer.id !== undefined ? metaLayer.id : idx

          // Match official legend for this sublayer from MapServer /legend?f=json
          const legendMatch = legendLayers.find((l: any) => l.layerId === sublayerId)
          let layerLegendItems: LegendItem[] | undefined
          let realColor: string | undefined

          if (legendMatch && Array.isArray(legendMatch.legend) && legendMatch.legend.length > 0) {
            layerLegendItems = await Promise.all(
              legendMatch.legend.map(async (legItem: any) => {
                const dataUri = legItem.imageData
                  ? `data:${legItem.contentType || 'image/png'};base64,${legItem.imageData}`
                  : undefined
                const color = dataUri ? await sampleColorFromBase64(legItem.imageData, legItem.contentType) : undefined
                return {
                  label: legItem.label || metaLayer.name,
                  code: legItem.values?.[0] || legItem.label,
                  value: legItem.values?.[0] || legItem.label,
                  image: dataUri,
                  color: color || '#2563eb',
                  border: color || '#475569'
                }
              })
            )
            realColor = layerLegendItems[0]?.color
          }

          // Check if there is an explicit declared layer override for this sublayer
          const declaredMatch = (config.layers || []).find((l) => {
            if (l.serviceLayerId !== undefined) {
              return Number(l.serviceLayerId) === sublayerId
            }
            if (l.id) {
              return l.id === `${serviceId}-layer-${sublayerId}` || l.id === `layer-${sublayerId}`
            }
            return false
          })

          const layerId = declaredMatch?.id || `${serviceId}-layer-${sublayerId}`
          const geomType = declaredMatch?.geometryType || this.mapGeometryType(metaLayer.geometryType)
          const defaultColor = declaredMatch?.color || realColor || BOUNDARY_COLORS[sublayerId % BOUNDARY_COLORS.length]
          const isServiceVisible = config.visible !== false
          const isLayerDefaultVisible = declaredMatch?.visible ?? (
            isServiceVisible ? (declaredMatch?.defaultVisibility ?? Boolean(metaLayer.defaultVisibility)) : false
          )
          const layerTitle = declaredMatch?.title
            ? this.cleanLayerTitle(declaredMatch.title)
            : (this.cleanLayerTitle(metaLayer.name) || `Sublayer ${sublayerId}`)
          const isLayerEnabled = (declaredMatch?.enabled !== false) && isEnabled

          const rendering: LayerRenderingConfig = declaredMatch?.rendering || {
            format: isTileCache ? 'raster' : 'geojson',
            sourceId: `${layerId}-source`,
            style: {
              type: geomType === 'polygon' ? 'fill' : geomType === 'line' ? 'line' : 'circle',
              paint:
                geomType === 'polygon'
                  ? { 'fill-color': defaultColor, 'fill-opacity': declaredMatch?.opacity ?? (config.opacity ?? 0.6) }
                  : geomType === 'line'
                    ? { 'line-color': defaultColor, 'line-width': 2 }
                    : { 'circle-color': defaultColor, 'circle-radius': 5 }
            }
          }

          const data: LayerDataConfig = declaredMatch?.data || {
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
            table: true,
            ...(declaredMatch?.capabilities || {})
          }

          return {
            id: layerId,
            serviceId,
            serviceLayerId: sublayerId,
            title: layerTitle,
            category: declaredMatch?.category || config.category || (cleanUrl.toLowerCase().includes('boundary') ? 'boundaries' : 'planning'),
            geometryType: geomType,
            description: declaredMatch?.description || metaLayer.description || metaLayer.name,
            visible: isLayerDefaultVisible,
            defaultVisibility: declaredMatch?.defaultVisibility !== undefined ? declaredMatch.defaultVisibility : Boolean(metaLayer.defaultVisibility),
            enabled: isLayerEnabled,
            opacity: declaredMatch?.opacity ?? (config.opacity ?? 0.8),
            color: defaultColor,
            legend: declaredMatch?.legend || (layerLegendItems ? {
              title: layerTitle,
              dynamic: true,
              items: layerLegendItems
            } : undefined),
            render: declaredMatch?.render || {
              type: isTileCache ? 'esri_tile' : 'esri_export',
              url: isTileCache ? `${cleanUrl}/tile/{z}/{y}/{x}` : `${cleanUrl}/export`,
              layers: `show:${sublayerId}`,
              format: 'png32',
              transparent: true,
              tileSize: 512
            },
            feature_service: declaredMatch?.feature_service || {
              type: 'esri_rest',
              collection_url: `${cleanUrl}/${sublayerId}`,
              id_field: 'OBJECTID'
            },
            rendering,
            data,
            capabilities
          }
        })
      )

      // Include any declared layers that did not match any metaLayer ID
      for (const decl of config.layers || []) {
        const isIncluded = layers.some(
          (l) =>
            l.serviceLayerId !== undefined &&
            decl.serviceLayerId !== undefined &&
            Number(l.serviceLayerId) === Number(decl.serviceLayerId)
        )
        if (!isIncluded) {
          layers.push(this.normalizeDeclaredLayer(decl, serviceId, cleanUrl, layers.length, isEnabled))
        }
      }

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
      if (config.layers && config.layers.length > 0) {
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
          layers: config.layers.map((l, idx) =>
            this.normalizeDeclaredLayer(l, serviceId, cleanUrl, idx, true)
          )
        }
      }
      // Resilient fallback: Return error service definition instead of crashing
      return {
        id: serviceId,
        name: config.name || 'ArcGIS Service (Unavailable)',
        type: 'esri-rest',
        url: cleanUrl,
        enabled: false,
        visible: false,
        status: 'error',
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
      title: this.cleanLayerTitle(raw.title) || `Layer ${sublayerId}`,
      category: raw.category || 'planning',
      geometryType: geomType,
      description: raw.description,
      visible: raw.visible ?? (serviceEnabled ? (raw.defaultVisibility ?? true) : false),
      defaultVisibility: raw.defaultVisibility !== undefined ? raw.defaultVisibility : (raw.visible ?? true),
      enabled: (raw.enabled !== false) && serviceEnabled,
      opacity: raw.opacity ?? 0.8,
      color,
      legend: raw.legend,
      render: raw.render || {
        type: 'esri_export',
        url: `${cleanUrl}/export`,
        layers: `show:${sublayerId}`,
        format: 'png32',
        transparent: true,
        tileSize: 512
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
          transparent: true,
          tileSize: 512
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

  private cleanLayerTitle(rawTitle?: string): string {
    if (!rawTitle) return ''
    return rawTitle
      // Strip technical infrastructure tags in brackets like (Live ArcGIS), (Local Engine), (Vector Tiles), (LGA), (Parcels)
      .replace(/\s*\((?:Live ArcGIS|Local Engine|Vector Tiles|Parcels|LGA|Solid|Dash)\)\s*/gi, ' ')
      // For any remaining brackets/parentheses, keep the inner content if alphanumeric/year (e.g. (2020) -> 2020)
      .replace(/\s*[\(\[]([A-Za-z0-9\s\-]+)[\)\]]\s*/g, ' $1 ')
      // Clean any stray brackets or multiple spaces
      .replace(/[()\[\]]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  private generateDeterministicId(url: string): string {
    try {
      const parsed = new URL(url)
      const segments = parsed.pathname.split('/').filter(Boolean)
      const serviceIdx = segments.findIndex((s) => s.toLowerCase() === 'services')
      if (serviceIdx >= 0 && segments.length > serviceIdx + 1) {
        const relevant = segments.slice(serviceIdx + 1).filter((s) => !/^(MapServer|FeatureServer)$/i.test(s))
        return `service-${relevant.join('-').toLowerCase()}`
      }
      const last = segments.filter((s) => !/^(MapServer|FeatureServer)$/i.test(s)).pop()
      return `service-${(last || 'esri').toLowerCase()}`
    } catch {
      return `service-esri-${url.replace(/[^a-zA-Z0-9]/g, '-').slice(-16).toLowerCase()}`
    }
  }

  private inferServiceNameFromUrl(url: string): string {
    const segments = url.replace(/\/+$/, '').split('/').filter(Boolean)
    const last = segments.filter((s) => !/^(MapServer|FeatureServer)$/i.test(s)).pop() || 'ArcGIS Service'
    return last
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
