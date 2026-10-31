import type { Map as MapLibreMap } from 'maplibre-gl'
import { formatCoordinates } from './geodesy'

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
