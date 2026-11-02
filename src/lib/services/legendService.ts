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
 * Extracts base URL for an ArcGIS MapServer service from an operational layer
 */
export function getEsriMapServerBaseUrl(layer: OperationalLayer): string | null {
  const url = layer.render?.url || layer.data?.url || layer.feature_service?.collection_url || ''
  if (url.includes('/MapServer')) {
    return `${url.split('/MapServer')[0]}/MapServer`
  }
  return null
}

/**
 * Computes the geographic bounding box [xmin, ymin, xmax, ymax] from map or pixel viewportBox
 */
export function getMapBbox(
  map: MapLibreMap,
  viewportBox?: [[number, number], [number, number]]
): [number, number, number, number] {
  if (viewportBox) {
    const p1 = map.unproject(viewportBox[0])
    const p2 = map.unproject(viewportBox[1])
    return [
      Math.min(p1.lng, p2.lng),
      Math.min(p1.lat, p2.lat),
      Math.max(p1.lng, p2.lng),
      Math.max(p1.lat, p2.lat)
    ]
  }
  const bounds = map.getBounds()
  return [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth()
  ]
}

/**
 * Samples the representative RGB color from an Esri legend base64 PNG image
 */
export async function sampleColorFromBase64(base64: string, contentType = 'image/png'): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '#2563eb'
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const w = img.naturalWidth || img.width || 20
        const h = img.naturalHeight || img.height || 20
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve('#2563eb')
          return
        }
        ctx.drawImage(img, 0, 0)
        // 1. Check center pixel
        const cx = Math.floor(w / 2)
        const cy = Math.floor(h / 2)
        const center = ctx.getImageData(cx, cy, 1, 1).data
        if (center[3] > 40) {
          resolve(`rgb(${center[0]}, ${center[1]}, ${center[2]})`)
          return
        }
        // 2. Center transparent: find first visible pixel (for hollow boundary line symbols)
        const imgData = ctx.getImageData(0, 0, w, h).data
        for (let i = 0; i < imgData.length; i += 4) {
          if (imgData[i + 3] > 40) {
            resolve(`rgb(${imgData[i]}, ${imgData[i + 1]}, ${imgData[i + 2]})`)
            return
          }
        }
        resolve('#2563eb')
      } catch {
        resolve('#2563eb')
      }
    }
    img.onerror = () => resolve('#2563eb')
    img.src = `data:${contentType};base64,${base64}`
  })
}

/**
 * Service for resolving symbology legends based on layer-level configuration
 * (default in-view for dynamic vector & MapServer layers).
 */
class LegendService {
  private esriLegendCache = new Map<string, any[]>()
  public inViewCache = new Map<string, Set<number>>()
  private inFlightFetches = new Map<string, Promise<Set<number>>>()
  private onInViewUpdatedCallbacks: Array<() => void> = []
  private lastKnownLayerItems = new Map<string, LegendItem[]>()
  private cachedActiveGroups: LayerLegendGroup[] = []

  /**
   * Register a listener notified whenever an in-view query resolves
   */
  onInViewUpdated(cb: () => void): () => void {
    this.onInViewUpdatedCallbacks.push(cb)
    return () => {
      this.onInViewUpdatedCallbacks = this.onInViewUpdatedCallbacks.filter((c) => c !== cb)
    }
  }

  private notifyInViewUpdated(): void {
    for (const cb of this.onInViewUpdatedCallbacks) {
      try {
        cb()
      } catch (err) {
        console.warn('[LegendService] onInViewUpdated callback error:', err)
      }
    }
  }

  cacheEsriLegend(serviceBaseUrl: string, layers: any[]): void {
    const cleanUrl = serviceBaseUrl.replace(/\/+$/, '')
    this.esriLegendCache.set(cleanUrl, layers)
  }

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
   * Queries ArcGIS MapServer identify with an envelope bounding box
   * to determine which sublayers actually have features in the given extent.
   */
  async queryEsriInViewSublayers(
    baseUrl: string,
    bbox: [number, number, number, number],
    activeSublayerIds?: number[]
  ): Promise<Set<number>> {
    const bboxKey = bbox.map((v) => v.toFixed(3)).join(',')
    const cacheKey = `${baseUrl}#${bboxKey}`

    if (this.inViewCache.has(cacheKey)) {
      return this.inViewCache.get(cacheKey)!
    }

    if (this.inFlightFetches.has(cacheKey)) {
      return this.inFlightFetches.get(cacheKey)!
    }

    const [xmin, ymin, xmax, ymax] = bbox
    const geom = JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } })
    const layersParam =
      activeSublayerIds && activeSublayerIds.length > 0
        ? `visible:${[...activeSublayerIds].sort((a, b) => a - b).join(',')}`
        : 'visible'
    const url = `${baseUrl}/identify?geometry=${encodeURIComponent(geom)}&geometryType=esriGeometryEnvelope&sr=4326&layers=${layersParam}&tolerance=0&mapExtent=${xmin},${ymin},${xmax},${ymax}&imageDisplay=800,600,96&returnGeometry=false&f=json`

    const promise = (async () => {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!res.ok) {
          const fallback = new Set(activeSublayerIds || [])
          this.inViewCache.set(cacheKey, fallback)
          return fallback
        }
        const data = await res.json()
        const present = new Set<number>()
        if (Array.isArray(data.results)) {
          for (const item of data.results) {
            if (item.layerId !== undefined && item.layerId !== null) {
              present.add(Number(item.layerId))
            }
          }
        }
        this.inViewCache.set(cacheKey, present)
        this.notifyInViewUpdated()
        return present
      } catch (err) {
        console.warn(`[LegendService] In-view envelope identify failed for ${baseUrl}:`, err)
        const fallback = new Set(activeSublayerIds || [])
        this.inViewCache.set(cacheKey, fallback)
        return fallback
      } finally {
        this.inFlightFetches.delete(cacheKey)
      }
    })()

    this.inFlightFetches.set(cacheKey, promise)
    return promise
  }

  /**
   * Returns the legend items for a layer.
   * Dynamically filters to items visible in the map/print viewport when config.dynamic is true.
   */
  getVisibleLegendItems(
    layer: OperationalLayer,
    map: MapLibreMap | null,
    viewportBox?: [[number, number], [number, number]],
    isLayerVisible?: (layer: OperationalLayer) => boolean
  ): LegendItem[] {
    const config = this.resolveLayerLegendConfig(layer)
    if (!config || config.items.length === 0) {
      this.lastKnownLayerItems.delete(layer.id)
      return []
    }

    // If layer itself is hidden or disabled, clear previous items and return 0
    if (isLayerVisible ? !isLayerVisible(layer) : (layer.enabled === false || !layer.visible)) {
      this.lastKnownLayerItems.delete(layer.id)
      return []
    }

    // If dynamic is disabled or map not loaded, return complete list
    if (!config.dynamic || !map || !map.getStyle()) {
      this.lastKnownLayerItems.set(layer.id, config.items)
      return config.items
    }

    // If layer zoom limits exist, verify current map zoom is within visibility range
    const currentZoom = map.getZoom()
    if (layer.minZoom !== undefined && currentZoom < layer.minZoom) {
      this.lastKnownLayerItems.delete(layer.id)
      return []
    }
    if (layer.maxZoom !== undefined && currentZoom > layer.maxZoom) {
      this.lastKnownLayerItems.delete(layer.id)
      return []
    }
    if (layer.render?.minzoom !== undefined && currentZoom < layer.render.minzoom) {
      this.lastKnownLayerItems.delete(layer.id)
      return []
    }
    if (layer.render?.maxzoom !== undefined && currentZoom > layer.render.maxzoom) {
      this.lastKnownLayerItems.delete(layer.id)
      return []
    }

    // 1. ArcGIS MapServer Dynamic In-View Check
    const mapServerUrl = getEsriMapServerBaseUrl(layer)
    if (mapServerUrl && layer.serviceLayerId !== undefined) {
      const bbox = getMapBbox(map, viewportBox)
      const bboxKey = bbox.map((v) => v.toFixed(3)).join(',')
      const subId = Number(layer.serviceLayerId)
      const cacheKey = `${mapServerUrl}#${bboxKey}`

      if (this.inViewCache.has(cacheKey)) {
        const cachedSet = this.inViewCache.get(cacheKey)!
        if (!cachedSet.has(subId)) {
          this.lastKnownLayerItems.set(layer.id, [])
          return [] // Sublayer has no features in current viewport/extent
        }
        this.lastKnownLayerItems.set(layer.id, config.items)
        return config.items
      }

      // If not yet in cache, schedule in-view identify in background
      this.queryEsriInViewSublayers(mapServerUrl, bbox)
      // Anti-flicker: Never clear previous legends while awaiting query results!
      // Fallback to previous known items, or full config items if initial
      const prev = this.lastKnownLayerItems.get(layer.id)
      return prev !== undefined ? prev : config.items
    }

    // Raster tile sources (WMS, WMTS, raster_tile) without client-side vector geometries.
    const isRaster =
      layer.render?.type === 'esri_tile' ||
      layer.render?.type === 'raster_tile' ||
      layer.render?.type === 'wms' ||
      layer.render?.type === 'wmts' ||
      layer.rendering?.format === 'raster'

    if (isRaster) {
      this.lastKnownLayerItems.set(layer.id, config.items)
      return config.items
    }

    // 2. Client-side Vector Layers In-View Check (via MapLibre queryRenderedFeatures)
    const candidateLayerIds = [
      layer.id,
      `${layer.id}-fill`,
      `${layer.id}-line`,
      `${layer.id}-outline`,
      `${layer.id}-circle`,
      layer.rendering?.sourceId ? `${layer.rendering.sourceId}-fill` : '',
      layer.rendering?.sourceId ? `${layer.rendering.sourceId}-line` : '',
      layer.serviceId ? `layer-esri-${layer.serviceId}` : ''
    ].filter(Boolean)
    const activeLayerIds = candidateLayerIds.filter((id) => Boolean(map.getLayer(id)))

    // If layers are not mounted on canvas, dynamic legend returns empty (no features on screen)
    if (activeLayerIds.length === 0) {
      const res = config.dynamic ? [] : config.items
      this.lastKnownLayerItems.set(layer.id, res)
      return res
    }

    try {
      // Query features actually rendered within current viewport bounds (or print box)
      const rendered = viewportBox
        ? map.queryRenderedFeatures(viewportBox, { layers: activeLayerIds })
        : map.queryRenderedFeatures({ layers: activeLayerIds })

      if (!rendered || rendered.length === 0) {
        // Anti-flicker: If map is currently animating/moving, retain previous items
        if ((map as any).isMoving && (map as any).isMoving()) {
          const prev = this.lastKnownLayerItems.get(layer.id)
          if (prev) return prev
        }
        this.lastKnownLayerItems.set(layer.id, [])
        return []
      }

      const visibleCodes = new Set<string>()

      for (const feat of rendered) {
        const props = feat.properties || {}
        for (const [k, v] of Object.entries(props)) {
          if (v !== undefined && v !== null) {
            visibleCodes.add(String(v).toUpperCase().trim())
          }
        }
      }

      // Filter legend items to only those visible on screen / print area
      const filtered = config.items.filter((item) => {
        const targetVal = String(item.value ?? item.code ?? '').toUpperCase().trim()
        const targetLabel = String(item.label || '').toUpperCase().trim()
        return (targetVal && visibleCodes.has(targetVal)) || (targetLabel && visibleCodes.has(targetLabel))
      })
      this.lastKnownLayerItems.set(layer.id, filtered)
      return filtered
    } catch (err) {
      console.warn(`[LegendService] Failed to query rendered features for ${layer.id}:`, err)
      const prev = this.lastKnownLayerItems.get(layer.id)
      return prev ?? []
    }
  }

  /**
   * Returns a legend group for an individual layer
   */
  getLayerLegendGroup(
    layer: OperationalLayer,
    map: MapLibreMap | null,
    viewportBox?: [[number, number], [number, number]],
    isLayerVisible?: (layer: OperationalLayer) => boolean
  ): LayerLegendGroup | null {
    if (isLayerVisible ? !isLayerVisible(layer) : (layer.enabled === false || !layer.visible)) {
      return null
    }

    const config = this.resolveLayerLegendConfig(layer)
    if (!config || config.items.length === 0) return null

    const visibleItems = this.getVisibleLegendItems(layer, map, viewportBox, isLayerVisible)
    return {
      layerId: layer.id,
      title: config.title || layer.title,
      dynamic: Boolean(config.dynamic),
      totalItemsCount: config.items.length,
      items: visibleItems
    }
  }

  /**
   * Returns all active legend groups for visible layers.
   * Dynamically filters out layers and symbols not present in current viewport.
   */
  getAllActiveLegendGroups(
    layers: OperationalLayer[],
    map: MapLibreMap | null,
    viewportBox?: [[number, number], [number, number]],
    isLayerVisible?: (layer: OperationalLayer) => boolean
  ): LayerLegendGroup[] {
    const groups: LayerLegendGroup[] = []

    // Proactively batch identify queries for any visible MapServer services
    if (map && map.getStyle()) {
      const bbox = getMapBbox(map, viewportBox)
      const bboxKey = bbox.map((v) => v.toFixed(3)).join(',')
      const serviceMap = new Map<string, number[]>()

      for (const layer of layers) {
        if (isLayerVisible ? !isLayerVisible(layer) : (layer.enabled === false || !layer.visible)) {
          continue
        }
        const sUrl = getEsriMapServerBaseUrl(layer)
        if (sUrl && layer.serviceLayerId !== undefined) {
          if (!serviceMap.has(sUrl)) serviceMap.set(sUrl, [])
          serviceMap.get(sUrl)!.push(Number(layer.serviceLayerId))
        }
      }

      for (const [sUrl, subIds] of serviceMap.entries()) {
        const cacheKey = `${sUrl}#${bboxKey}`
        if (!this.inViewCache.has(cacheKey) && !this.inFlightFetches.has(cacheKey)) {
          this.queryEsriInViewSublayers(sUrl, bbox, subIds)
        }
      }
    }

    for (const layer of layers) {
      if (isLayerVisible ? !isLayerVisible(layer) : (layer.enabled === false || !layer.visible)) {
        this.lastKnownLayerItems.delete(layer.id)
        continue
      }

      const config = this.resolveLayerLegendConfig(layer)
      if (!config || config.items.length === 0) continue

      const visibleItems = this.getVisibleLegendItems(layer, map, viewportBox, isLayerVisible)
      if (visibleItems.length > 0) {
        groups.push({
          layerId: layer.id,
          title: config.title || layer.title,
          dynamic: Boolean(config.dynamic),
          totalItemsCount: config.items.length,
          items: visibleItems
        })
      }
    }

    // Anti-flicker: If the new groups are identical in content to cached groups,
    // maintain exact reference equality to prevent Svelte reactivity churn & DOM re-rendering.
    if (this.areLegendGroupsEqual(groups, this.cachedActiveGroups)) {
      return this.cachedActiveGroups
    }

    this.cachedActiveGroups = groups
    return groups
  }

  private areLegendGroupsEqual(a: LayerLegendGroup[], b: LayerLegendGroup[]): boolean {
    if (a === b) return true
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const ga = a[i]
      const gb = b[i]
      if (ga.layerId !== gb.layerId || ga.title !== gb.title) return false
      if (ga.items.length !== gb.items.length) return false
      for (let j = 0; j < ga.items.length; j++) {
        const ia = ga.items[j]
        const ib = gb.items[j]
        if (
          ia.label !== ib.label ||
          ia.color !== ib.color ||
          ia.image !== ib.image ||
          ia.code !== ib.code ||
          ia.pattern !== ib.pattern
        ) {
          return false
        }
      }
    }
    return true
  }

  /**
   * Asynchronously returns all active legend groups, awaiting any in-flight
   * in-view spatial queries (ideal for Print and Export).
   */
  async getAllActiveLegendGroupsAsync(
    layers: OperationalLayer[],
    map: MapLibreMap | null,
    viewportBox?: [[number, number], [number, number]],
    isLayerVisible?: (layer: OperationalLayer) => boolean
  ): Promise<LayerLegendGroup[]> {
    if (map && map.getStyle()) {
      const bbox = getMapBbox(map, viewportBox)
      const serviceMap = new Map<string, number[]>()

      for (const layer of layers) {
        if (isLayerVisible ? !isLayerVisible(layer) : (layer.enabled === false || !layer.visible)) {
          continue
        }
        const sUrl = getEsriMapServerBaseUrl(layer)
        if (sUrl && layer.serviceLayerId !== undefined) {
          if (!serviceMap.has(sUrl)) serviceMap.set(sUrl, [])
          serviceMap.get(sUrl)!.push(Number(layer.serviceLayerId))
        }
      }

      await Promise.all(
        Array.from(serviceMap.entries()).map(([url, ids]) =>
          this.queryEsriInViewSublayers(url, bbox, ids)
        )
      )
    }

    return this.getAllActiveLegendGroups(layers, map, viewportBox, isLayerVisible)
  }

  /**
   * Resolves or synthesizes legend config for a layer (default in-view for dynamic symbology)
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
        dynamic: layer.legend.dynamic !== false, // default in view, whenever legend is requested
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
            dynamic: layer.legend?.dynamic !== false,
            property: 'label',
            items: match.legend.map((item: any) => {
              const dataUri = item.imageData
                ? `data:${item.contentType || 'image/png'};base64,${item.imageData}`
                : undefined
              return {
                label: item.label || match.layerName || layer.title,
                image: dataUri,
                color: layer.color || '#2563eb',
                border: layer.color || '#475569',
                code: item.values?.[0] || item.label,
                value: item.values?.[0] || item.label
              }
            })
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
