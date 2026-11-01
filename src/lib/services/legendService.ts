import type { Map as MapLibreMap } from 'maplibre-gl'
import type { LegendItem, OperationalLayer } from '../types'
import { PLANNING_OVERLAYS, PLANNING_ZONES } from '../data/sampleData'

export interface LayerLegendGroup {
  layerId: string
  title: string
  dynamic: boolean
  totalItemsCount: number
  items: LegendItem[]
}

/**
 * Service for resolving symbology legends with viewport-filtered dynamic legend capability.
 */
class LegendService {
  private esriLegendCache = new Map<string, any[]>()

  /**
   * Fetches and caches ArcGIS REST /legend?f=json metadata for a service
   */
  async loadEsriLegend(serviceBaseUrl: string): Promise<void> {
    const cleanUrl = serviceBaseUrl.replace(/\/+$/, '')
    if (this.esriLegendCache.has(cleanUrl)) return

    try {
      const res = await fetch(`${cleanUrl}/legend?f=json`, {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.layers)) {
        this.esriLegendCache.set(cleanUrl, data.layers)
      }
    } catch (err) {
      console.warn(`[LegendService] Could not fetch Esri legend from ${cleanUrl}:`, err)
    }
  }

  /**
   * Returns the legend items for a layer.
   * If `layer.legend.dynamic` is true (and forceAll is false), only returns items
   * for features currently visible within the map viewport or specified viewport box.
   */
  getVisibleLegendItems(
    layer: OperationalLayer,
    map: MapLibreMap | null,
    forceAll = false,
    viewportBox?: [[number, number], [number, number]]
  ): LegendItem[] {
    const config = this.resolveLayerLegendConfig(layer)
    if (!config || config.items.length === 0) return []

    // If dynamic is disabled or user forces showing all items, return complete list
    if (!config.dynamic || forceAll || !map || !map.getStyle()) {
      return config.items
    }

    // If layer itself is hidden, return 0 items in view
    if (layer.enabled === false || !layer.visible) {
      return []
    }

    // Raster tile sources (WMS, WMTS, Esri export raster) do not have client-side vector geometries.
    // Return complete configured items rather than empty set.
    const isRaster =
      layer.render?.type === 'esri_export' ||
      layer.render?.type === 'esri_tile' ||
      layer.render?.type === 'raster_tile' ||
      layer.render?.type === 'wms' ||
      layer.render?.type === 'wmts' ||
      layer.rendering?.format === 'raster'

    if (isRaster) {
      return config.items
    }

    // Determine MapLibre layer IDs associated with this operational layer
    const candidateLayerIds = [
      layer.id,
      `${layer.id}-fill`,
      `${layer.id}-line`,
      `${layer.id}-outline`,
      `${layer.id}-circle`
    ]
    const activeLayerIds = candidateLayerIds.filter((id) => Boolean(map.getLayer(id)))

    // If layers are not yet mounted or not on canvas, fallback to all items
    if (activeLayerIds.length === 0) {
      return config.items
    }

    try {
      // Query features actually rendered within current viewport bounds (or print box)
      const rendered = viewportBox
        ? map.queryRenderedFeatures(viewportBox, { layers: activeLayerIds })
        : map.queryRenderedFeatures({ layers: activeLayerIds })

      if (!rendered || rendered.length === 0) {
        return []
      }

      const propKey = config.property || 'code'
      const visibleCodes = new Set<string>()

      for (const feat of rendered) {
        const props = feat.properties || {}
        const val =
          props[propKey] ??
          props.code ??
          props.zoneCode ??
          props.overlayType ??
          props.CATEGORY ??
          props.LGA_NAME ??
          props.name
        if (val !== undefined && val !== null) {
          visibleCodes.add(String(val).toUpperCase().trim())
        }
      }

      // Filter legend items to only those visible on screen
      return config.items.filter((item) => {
        const target = String(item.value ?? item.code ?? item.label).toUpperCase().trim()
        return visibleCodes.has(target)
      })
    } catch (err) {
      console.warn(`[LegendService] Failed to query rendered features for ${layer.id}:`, err)
      return config.items
    }
  }

  /**
   * Returns a legend group for an individual layer
   */
  getLayerLegendGroup(
    layer: OperationalLayer,
    map: MapLibreMap | null,
    forceAll = false,
    viewportBox?: [[number, number], [number, number]]
  ): LayerLegendGroup | null {
    const config = this.resolveLayerLegendConfig(layer)
    if (!config || config.items.length === 0) return null

    const visibleItems = this.getVisibleLegendItems(layer, map, forceAll, viewportBox)
    return {
      layerId: layer.id,
      title: config.title || layer.title,
      dynamic: Boolean(config.dynamic),
      totalItemsCount: config.items.length,
      items: visibleItems
    }
  }

  /**
   * Returns all active legend groups for visible layers
   */
  getAllActiveLegendGroups(
    layers: OperationalLayer[],
    map: MapLibreMap | null,
    forceAll = false,
    viewportBox?: [[number, number], [number, number]]
  ): LayerLegendGroup[] {
    const groups: LayerLegendGroup[] = []

    for (const layer of layers) {
      if (layer.enabled === false || !layer.visible) continue

      const config = this.resolveLayerLegendConfig(layer)
      if (!config || config.items.length === 0) continue

      const visibleItems = this.getVisibleLegendItems(layer, map, forceAll, viewportBox)
      // Only include groups that have items or show dynamic status
      if (visibleItems.length > 0 || config.dynamic) {
        groups.push({
          layerId: layer.id,
          title: config.title || layer.title,
          dynamic: Boolean(config.dynamic),
          totalItemsCount: config.items.length,
          items: visibleItems
        })
      }
    }

    return groups
  }

  /**
   * Resolves or synthesizes legend config for a layer if not explicitly declared
   */
  resolveLayerLegendConfig(layer: OperationalLayer): {
    title: string
    dynamic: boolean
    property: string
    items: LegendItem[]
  } | null {
    if (layer.legend && layer.legend.items.length > 0) {
      return {
        title: layer.legend.title || layer.title,
        dynamic: layer.legend.dynamic ?? false,
        property: layer.legend.property || 'code',
        items: layer.legend.items
      }
    }

    // Default synthesis for built-in layers if not explicitly defined in config
    if (layer.id === 'layer-zones') {
      return {
        title: 'Planning Scheme Zones',
        dynamic: true,
        property: 'code',
        items: Object.values(PLANNING_ZONES).map((z) => ({
          code: z.code,
          label: `${z.code} - ${z.name}`,
          color: z.fillColor,
          stroke: z.strokeColor,
          border: z.strokeColor,
          value: z.code
        }))
      }
    }

    if (layer.id === 'layer-overlays') {
      return {
        title: 'Planning Overlays',
        dynamic: true,
        property: 'code',
        items: Object.values(PLANNING_OVERLAYS).map((o) => ({
          code: o.code,
          label: `${o.code} - ${o.name}`,
          color: o.fillColor,
          stroke: o.strokeColor,
          border: o.strokeColor,
          pattern: 'diagonal',
          value: o.code
        }))
      }
    }

    if (layer.id === 'layer-parcels') {
      return {
        title: 'Cadastral Parcels',
        dynamic: false,
        property: 'type',
        items: [
          {
            label: 'Property Parcel Boundary',
            color: '#334155',
            stroke: '#334155',
            border: '#334155'
          }
        ]
      }
    }

    // Check Esri legend cache if available
    const serviceUrl = layer.render?.url || layer.data?.url
    if (serviceUrl && serviceUrl.includes('/MapServer')) {
      const baseUrl = `${serviceUrl.split('/MapServer')[0]}/MapServer`
      if (this.esriLegendCache.has(baseUrl)) {
        const cachedLayers = this.esriLegendCache.get(baseUrl) || []
        const subId = Number(layer.serviceLayerId ?? 0)
        const match = cachedLayers.find((l: any) => l.layerId === subId)
        if (match && Array.isArray(match.legend) && match.legend.length > 0) {
          return {
            title: match.layerName || layer.title,
            dynamic: false,
            property: 'label',
            items: match.legend.map((item: any) => ({
              label: item.label || match.layerName,
              color: layer.color || '#2563eb',
              border: '#475569',
              code: item.values?.[0] || item.label,
              value: item.values?.[0] || item.label
            }))
          }
        }
      }
    }

    if (layer.color) {
      return {
        title: layer.title,
        dynamic: false,
        property: 'id',
        items: [
          {
            label: layer.title,
            color: layer.color,
            stroke: layer.color,
            border: layer.color
          }
        ]
      }
    }

    return null
  }
}

export const legendService = new LegendService()
