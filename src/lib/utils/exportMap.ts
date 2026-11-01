import type { Map as MapLibreMap } from 'maplibre-gl'
import { formatCoordinates } from './geodesy'
import type { QueryResultFeature } from '../types'

/**
 * Builds an ArcGIS MapServer /export URL with standard Esri parameters
 */
export function buildEsriExportUrl(
  baseUrl: string,
  options: {
    sublayerIds?: number[]
    bbox: [number, number, number, number] // [minx, miny, maxx, maxy] in EPSG:4326 or EPSG:3857
    width: number
    height: number
    dpi?: number
    format?: string
    transparent?: boolean
    bboxSR?: string
    imageSR?: string
  }
): string {
  const cleanBase = baseUrl.replace(/\/(export|\d+)\/?$/, '').replace(/\/+$/, '')
  const url = new URL(`${cleanBase}/export`)

  url.searchParams.set('bbox', options.bbox.join(','))
  url.searchParams.set('bboxSR', options.bboxSR || '4326')
  url.searchParams.set('imageSR', options.imageSR || '4326')
  url.searchParams.set('size', `${options.width},${options.height}`)
  url.searchParams.set('dpi', String(options.dpi || 96))
  url.searchParams.set('format', options.format || 'png32')
  url.searchParams.set('transparent', String(options.transparent !== false))
  url.searchParams.set('f', 'image')

  if (options.sublayerIds && options.sublayerIds.length > 0) {
    url.searchParams.set('layers', `show:${options.sublayerIds.join(',')}`)
  }

  return url.toString()
}

/**
 * Downloads a high-resolution map image directly from an ArcGIS MapServer /export endpoint
 */
export async function exportEsriServiceImage(
  baseUrl: string,
  options: {
    serviceName?: string
    sublayerIds?: number[]
    bbox: [number, number, number, number]
    width?: number
    height?: number
    dpi?: number
  }
): Promise<void> {
  const width = options.width || 1920
  const height = options.height || 1080
  const dpi = options.dpi || 150

  const exportUrl = buildEsriExportUrl(baseUrl, {
    sublayerIds: options.sublayerIds,
    bbox: options.bbox,
    width,
    height,
    dpi,
    format: 'png32',
    transparent: true,
    bboxSR: '4326',
    imageSR: '4326'
  })

  const res = await fetch(exportUrl)
  if (!res.ok) {
    throw new Error(`Esri export image failed with HTTP ${res.status}: ${res.statusText}`)
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const cleanName = (options.serviceName || 'ArcGIS-Export').replace(/[^a-zA-Z0-9_-]/g, '_')
  link.download = `${cleanName}-${dpi}dpi-${Date.now()}.png`
  link.href = blobUrl
  link.click()
  URL.revokeObjectURL(blobUrl)
}

/**
 * Exports QueryResultFeature list to standard GeoJSON FeatureCollection file
 */
export function exportFeaturesToGeoJson(
  features: QueryResultFeature[],
  filenamePrefix = 'features'
): void {
  if (!features || features.length === 0) return

  const featureCollection = {
    type: 'FeatureCollection',
    features: features.map((f, idx) => ({
      type: 'Feature',
      id: f.id || idx,
      geometry: f.geometry || null,
      properties: {
        _layerId: f.layerId,
        _layerTitle: f.layerTitle,
        _title: f.title,
        ...(f.properties || {})
      }
    }))
  }

  const jsonString = JSON.stringify(featureCollection, null, 2)
  const blob = new Blob([jsonString], { type: 'application/geo+json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${Date.now()}.geojson`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Exports QueryResultFeature list to CSV
 */
export function exportFeaturesToCsv(
  features: QueryResultFeature[],
  filenamePrefix = 'features'
): void {
  if (!features || features.length === 0) return

  const keys = Array.from(new Set(features.flatMap((f) => Object.keys(f.properties || {}))))
  const header = ['Title', 'Layer', ...keys].join(',')
  const rows = features.map((f) => {
    const line = [
      `"${String(f.title).replace(/"/g, '""')}"`,
      `"${String(f.layerTitle || f.layerId).replace(/"/g, '""')}"`,
      ...keys.map((k) => {
        const val = f.properties?.[k]
        if (val === undefined || val === null) return '""'
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
        return `"${String(val).replace(/"/g, '""')}"`
      })
    ]
    return line.join(',')
  })

  const csvContent = [header, ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Exports the active MapLibre GL map canvas to a styled high-resolution PNG image
 * complete with VicPlan title block, scale bar, timestamp, and coordinate readout.
 */
export async function exportMapToPng(
  map: MapLibreMap,
  title = 'VicPlan Planning Scheme Spatial Extent'
): Promise<void> {
  const mapCanvas = map.getCanvas()

  // Create an export canvas with top banner and bottom metadata bar
  const exportCanvas = document.createElement('canvas')
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) return

  const bannerHeight = 56
  const footerHeight = 36
  exportCanvas.width = mapCanvas.width
  exportCanvas.height = mapCanvas.height + bannerHeight + footerHeight

  // 1. Draw Header Banner
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, exportCanvas.width, bannerHeight)

  ctx.fillStyle = '#0284c7'
  ctx.fillRect(16, 14, 38, 26)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText('VIC', 24, 31)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText(title, 66, 30)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '11px sans-serif'
  const dateStr = new Date().toLocaleString('en-AU')
  ctx.fillText(`State Government of Victoria • Exported ${dateStr}`, 66, 46)

  // 2. Draw Map Canvas
  ctx.drawImage(mapCanvas, 0, bannerHeight)

  // 3. Draw Footer Bar
  const footerY = bannerHeight + mapCanvas.height
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, footerY, exportCanvas.width, footerHeight)

  const center = map.getCenter()
  const coords = formatCoordinates(center.lng, center.lat)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '11px monospace'
  ctx.fillText(`Center: ${coords.latLng} | ${coords.mga55}`, 16, footerY + 22)

  const zoomStr = `Zoom Level: ${map.getZoom().toFixed(1)}`
  const textWidth = ctx.measureText(zoomStr).width
  ctx.fillText(zoomStr, exportCanvas.width - textWidth - 16, footerY + 22)

  // 4. Trigger browser download
  const dataUrl = exportCanvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.download = `VicPlan-Map-${Date.now()}.png`
  link.href = dataUrl
  link.click()
}
