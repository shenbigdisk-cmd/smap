import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { jsPDF } from 'jspdf'
import { formatCoordinates } from './geodesy'
import { MAP_CONFIG } from '../config/map.config'

import type { PaperSize, PageOrientation, PrintDpi, PrintFormat } from '../types'
export type { PaperSize, PageOrientation, PrintDpi, PrintFormat }

export interface PrintConfig {
  title: string
  paperSize: PaperSize
  orientation: PageOrientation
  dpi: PrintDpi
  format: PrintFormat
  showScale: boolean
  showNorthArrow: boolean
  showCoordinates: boolean
  showLegend: boolean
  legendItems?: Array<{ label: string; color: string; border?: string }>
  padLeft?: number
}

// Paper dimensions in millimeters [width, height] in portrait orientation
export const PAPER_DIMENSIONS_MM: Record<PaperSize, [number, number]> = {
  a4: [210, 297],
  a3: [297, 420],
  a5: [148, 210],
  letter: [215.9, 279.4]
}

/**
 * Returns pixel dimensions for a given paper size, orientation and DPI.
 */
export function getPrintDimensions(
  paperSize: PaperSize,
  orientation: PageOrientation,
  dpi: PrintDpi
): { widthPx: number; heightPx: number; widthMm: number; heightMm: number; aspectRatio: number } {
  const [pW, pH] = PAPER_DIMENSIONS_MM[paperSize]
  const widthMm = orientation === 'landscape' ? pH : pW
  const heightMm = orientation === 'landscape' ? pW : pH

  const widthPx = Math.round((widthMm / 25.4) * dpi)
  const heightPx = Math.round((heightMm / 25.4) * dpi)
  const aspectRatio = widthPx / heightPx

  return { widthPx, heightPx, widthMm, heightMm, aspectRatio }
}

/**
 * Captures an offscreen high-resolution render of the active map using target pixel dimensions.
 * Gracefully falls back to live map canvas snapshot if offscreen WebGL times out or fails.
 */
async function captureHighResMapCanvas(
  liveMap: MapLibreMap,
  targetWidth: number,
  targetHeight: number,
  targetCenter: maplibregl.LngLat,
  padLeft: number = 0
): Promise<HTMLCanvasElement> {
  const liveCanvas = liveMap.getCanvas()

  // Create hidden offscreen container with exact target dimensions
  const offscreenContainer = document.createElement('div')
  offscreenContainer.style.width = `${targetWidth}px`
  offscreenContainer.style.height = `${targetHeight}px`
  offscreenContainer.style.position = 'fixed'
  offscreenContainer.style.left = '-99999px'
  offscreenContainer.style.top = '-99999px'
  offscreenContainer.style.visibility = 'hidden'
  offscreenContainer.style.pointerEvents = 'none'
  document.body.appendChild(offscreenContainer)

  let offscreenMap: MapLibreMap | null = null

  try {
    const style = liveMap.getStyle()
    // Retain runtime GeoJSON data across sources
    if (style && style.sources) {
      for (const sourceId in style.sources) {
        const src = style.sources[sourceId]
        if (src && src.type === 'geojson') {
          const liveSource = liveMap.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
          if (liveSource && (liveSource as any)._data) {
            src.data = (liveSource as any)._data
          }
        }
      }
    }

    const zoom = liveMap.getZoom()
    const bearing = liveMap.getBearing()
    const pitch = liveMap.getPitch()

    offscreenMap = new maplibregl.Map({
      container: offscreenContainer,
      style: style,
      center: targetCenter,
      zoom: zoom,
      bearing: bearing,
      pitch: pitch,
      interactive: false,
      preserveDrawingBuffer: true as any,
      fadeDuration: 0,
      pixelRatio: 1
    } as any)

    // Wait for map to be idle with a safety timeout
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve()
      }, 5000)

      offscreenMap!.once('idle', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const offscreenCanvas = offscreenMap.getCanvas()
    const output = document.createElement('canvas')
    output.width = targetWidth
    output.height = targetHeight
    const ctx = output.getContext('2d')
    if (ctx) {
      ctx.drawImage(offscreenCanvas, 0, 0, targetWidth, targetHeight)
    }
    return output
  } catch (err) {
    console.warn('Offscreen high-res render encountered an issue, falling back to live canvas snapshot:', err)
    const fallback = document.createElement('canvas')
    fallback.width = targetWidth
    fallback.height = targetHeight
    const ctx = fallback.getContext('2d')
    if (ctx) {
      // If sidepanel is open, draw the visible right-hand map region
      const containerW = liveMap.getContainer().clientWidth
      const scale = liveCanvas.width / containerW
      const srcX = padLeft * scale
      const srcW = liveCanvas.width - srcX
      ctx.drawImage(liveCanvas, srcX, 0, srcW, liveCanvas.height, 0, 0, targetWidth, targetHeight)
    }
    return fallback
  } finally {
    if (offscreenMap) {
      try {
        offscreenMap.remove()
      } catch {
        // ignore
      }
    }
    if (offscreenContainer.parentNode) {
      offscreenContainer.parentNode.removeChild(offscreenContainer)
    }
  }
}

/**
 * Calculates a round metric scale bar length and label.
 */
function calculateScaleBar(
  zoom: number,
  latitude: number,
  dpi: PrintDpi
): { barPx: number; label: string } {
  // Meters per pixel at given latitude and zoom level
  const latRad = (latitude * Math.PI) / 180
  const metersPerPixelAt96 = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom)
  const metersPerPixel = metersPerPixelAt96 * (96 / dpi)

  // Desired scale bar screen width around 1.5 - 2 inches (dpi * 1.5)
  const targetPx = dpi * 1.5
  const rawMeters = targetPx * metersPerPixel

  // Pick nice round interval
  const roundDistances = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
  let chosenMeters = roundDistances[0]
  for (const d of roundDistances) {
    if (d <= rawMeters) {
      chosenMeters = d
    } else {
      break
    }
  }

  const barPx = Math.round(chosenMeters / metersPerPixel)
  const label = chosenMeters >= 1000 ? `${chosenMeters / 1000} km` : `${chosenMeters} m`

  return { barPx, label }
}

/**
 * Main print / export execution function.
 * Produces a styled cartographic layout and saves as PDF, PNG, or JPEG.
 */
export async function executePrint(
  liveMap: MapLibreMap,
  config: PrintConfig
): Promise<void> {
  const { widthPx, heightPx, widthMm, heightMm } = getPrintDimensions(
    config.paperSize,
    config.orientation,
    config.dpi
  )

  // Calculate the center of the visible map area on screen.
  // When a sidepanel is open, the visible map area is the right-hand side.
  // This ensures the exported map matches the print preview framing box crosshair exactly.
  const container = liveMap.getContainer()
  const padLeft = config.padLeft || 0
  const visibleWidth = Math.max(100, container.clientWidth - padLeft)
  const visibleHeight = container.clientHeight

  const visibleCenterPx: [number, number] = [
    padLeft + visibleWidth / 2,
    visibleHeight / 2
  ]
  const visibleCenter = liveMap.unproject(visibleCenterPx)

  // Dimensions for cartographic border and header/footer banners
  const scaleRatio = config.dpi / 96
  const marginPx = Math.round(16 * scaleRatio)
  const bannerHeight = Math.round(48 * scaleRatio)
  const footerHeight = Math.round(32 * scaleRatio)

  // Map viewport dimensions inside the cartographic sheet
  const mapWidthPx = widthPx - marginPx * 2
  const mapHeightPx = heightPx - bannerHeight - footerHeight - marginPx * 2
  const bannerY = marginPx
  const mapY = bannerY + bannerHeight
  const footerY = mapY + mapHeightPx
  const totalSheetHeight = bannerHeight + mapHeightPx + footerHeight

  // 1. Capture Map Canvas centered on the visible map area
  const mapCanvas = await captureHighResMapCanvas(
    liveMap,
    mapWidthPx,
    mapHeightPx,
    visibleCenter,
    padLeft
  )

  // 2. Compose full cartographic sheet
  const printCanvas = document.createElement('canvas')
  printCanvas.width = widthPx
  printCanvas.height = heightPx
  const ctx = printCanvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context for print')

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, heightPx)

  // Header Banner Background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(marginPx, bannerY, mapWidthPx, bannerHeight)

  // Header Agency Badge
  const badgeWidth = Math.round(36 * scaleRatio)
  const badgeHeight = Math.round(24 * scaleRatio)
  const badgeX = marginPx + Math.round(12 * scaleRatio)
  const badgeY = bannerY + Math.round((bannerHeight - badgeHeight) / 2)
  ctx.fillStyle = '#0284c7'
  ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight)

  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(11 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VIC', badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)

  // Header Title
  const titleX = badgeX + badgeWidth + Math.round(12 * scaleRatio)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(15 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.fillText(config.title || 'VicPlan Spatial Extent', titleX, bannerY + Math.round(26 * scaleRatio))

  // Header Subtitle / Date
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${Math.round(9.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  const dateStr = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  ctx.fillText(
    `${MAP_CONFIG.agency || 'State Government of Victoria'} • Exported ${dateStr} • Scale 1:${Math.round(calculateScaleRatio(liveMap, config.dpi, visibleCenter.lat)).toLocaleString()}`,
    titleX,
    bannerY + Math.round(41 * scaleRatio)
  )

  // 3. Draw Map Canvas
  ctx.drawImage(mapCanvas, marginPx, mapY, mapWidthPx, mapHeightPx)

  // 4. North Arrow (Top-Right inside map frame)
  if (config.showNorthArrow) {
    const northSize = Math.round(28 * scaleRatio)
    const northX = marginPx + mapWidthPx - northSize - Math.round(12 * scaleRatio)
    const northY = mapY + Math.round(12 * scaleRatio)

    ctx.save()
    ctx.translate(northX + northSize / 2, northY + northSize / 2)
    ctx.rotate((-liveMap.getBearing() * Math.PI) / 180)

    // Semi-transparent background disc
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.beginPath()
    ctx.arc(0, 0, northSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1
    ctx.stroke()

    // Upward arrow
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.moveTo(0, -northSize * 0.38)
    ctx.lineTo(northSize * 0.22, northSize * 0.24)
    ctx.lineTo(0, northSize * 0.12)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#94a3b8'
    ctx.beginPath()
    ctx.moveTo(0, -northSize * 0.38)
    ctx.lineTo(-northSize * 0.22, northSize * 0.24)
    ctx.lineTo(0, northSize * 0.12)
    ctx.closePath()
    ctx.fill()

    // Letter 'N'
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(8 * scaleRatio)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('N', 0, -northSize * 0.46)

    ctx.restore()
  }

  // 5. Scale Bar (Bottom-Right inside map frame)
  if (config.showScale) {
    const { barPx, label } = calculateScaleBar(liveMap.getZoom(), visibleCenter.lat, config.dpi)

    const sbPadX = Math.round(8 * scaleRatio)
    const sbPadY = Math.round(6 * scaleRatio)
    const sbWidth = barPx + sbPadX * 2
    const sbHeight = Math.round(24 * scaleRatio)
    const sbX = marginPx + mapWidthPx - sbWidth - Math.round(12 * scaleRatio)
    const sbY = mapY + mapHeightPx - sbHeight - Math.round(12 * scaleRatio)

    // Background pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(sbX, sbY, sbWidth, sbHeight)
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.strokeRect(sbX, sbY, sbWidth, sbHeight)

    // Segmented bar
    const barX = sbX + sbPadX
    const barLineY = sbY + Math.round(14 * scaleRatio)
    const segH = Math.round(4 * scaleRatio)

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(barX, barLineY, barPx / 2, segH)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(barX + barPx / 2, barLineY, barPx / 2, segH)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barLineY, barPx, segH)

    // Label
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(8.5 * scaleRatio)}px monospace`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(label, sbX + sbWidth - sbPadX, sbY + Math.round(10 * scaleRatio))

    ctx.textAlign = 'left'
    ctx.fillText('0', barX, sbY + Math.round(10 * scaleRatio))
  }

  // 6. Optional Legend Card (Bottom-Left inside map frame)
  if (config.showLegend && config.legendItems && config.legendItems.length > 0) {
    const items = config.legendItems.slice(0, 8)
    const cardPad = Math.round(8 * scaleRatio)
    const rowH = Math.round(15 * scaleRatio)
    const cardW = Math.round(170 * scaleRatio)
    const cardH = cardPad * 2 + Math.round(14 * scaleRatio) + items.length * rowH
    const cardX = marginPx + Math.round(12 * scaleRatio)
    const cardY = mapY + mapHeightPx - cardH - Math.round(12 * scaleRatio)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
    ctx.fillRect(cardX, cardY, cardW, cardH)
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.strokeRect(cardX, cardY, cardW, cardH)

    // Legend Title
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(9 * scaleRatio)}px -apple-system, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('PLANNING SYMBOLOGY', cardX + cardPad, cardY + cardPad + Math.round(9 * scaleRatio))

    // Items
    items.forEach((item, idx) => {
      const iy = cardY + cardPad + Math.round(16 * scaleRatio) + idx * rowH
      const swatchSize = Math.round(10 * scaleRatio)

      ctx.fillStyle = item.color
      ctx.fillRect(cardX + cardPad, iy, swatchSize, swatchSize)
      if (item.border) {
        ctx.strokeStyle = item.border
        ctx.lineWidth = 1
        ctx.strokeRect(cardX + cardPad, iy, swatchSize, swatchSize)
      }

      ctx.fillStyle = '#334155'
      ctx.font = `${Math.round(8.5 * scaleRatio)}px -apple-system, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(item.label, cardX + cardPad + swatchSize + Math.round(6 * scaleRatio), iy + swatchSize / 2)
    })
  }

  // 7. Footer Bar Background & Text
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(marginPx, footerY, mapWidthPx, footerHeight)

  if (config.showCoordinates) {
    const coords = formatCoordinates(visibleCenter.lng, visibleCenter.lat)

    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(9 * scaleRatio)}px monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `Center: ${coords.latLng} | ${coords.mga2020}`,
      marginPx + Math.round(10 * scaleRatio),
      footerY + footerHeight / 2
    )

    ctx.textAlign = 'right'
    ctx.fillText(
      `Datum: ${coords.datum}`,
      marginPx + mapWidthPx - Math.round(10 * scaleRatio),
      footerY + footerHeight / 2
    )
  }

  // 8. Unified Outer Neatline & Dividing Lines (Zero Step, Zero Misalignment)
  const borderWidth = Math.max(1, Math.round(1.5 * scaleRatio))
  const borderColor = '#334155'
  const offset = borderWidth % 2 === 1 ? 0.5 : 0

  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderWidth

  // Unified outer border enclosing Header, Map, and Footer
  ctx.strokeRect(marginPx + offset, bannerY + offset, mapWidthPx, totalSheetHeight)

  // Horizontal divider between Header and Map
  ctx.beginPath()
  ctx.moveTo(marginPx, mapY + offset)
  ctx.lineTo(marginPx + mapWidthPx, mapY + offset)
  // Horizontal divider between Map and Footer
  ctx.moveTo(marginPx, footerY + offset)
  ctx.lineTo(marginPx + mapWidthPx, footerY + offset)
  ctx.stroke()

  // 9. Output generation & download
  const cleanTitle = (config.title || 'VicPlan-Map')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  const filename = `${cleanTitle}_${config.paperSize.toUpperCase()}_${config.orientation}`

  if (config.format === 'pdf') {
    const pdf = new jsPDF({
      orientation: config.orientation,
      unit: 'mm',
      format: config.paperSize
    })

    // Use lossless PNG embedding to prevent compression ringing and blur on lines/borders
    const imgData = printCanvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST')
    pdf.save(`${filename}.pdf`)
  } else if (config.format === 'png') {
    const dataUrl = printCanvas.toDataURL('image/png')
    triggerDownload(dataUrl, `${filename}.png`)
  } else if (config.format === 'jpeg') {
    const dataUrl = printCanvas.toDataURL('image/jpeg', 0.95)
    triggerDownload(dataUrl, `${filename}.jpg`)
  }
}

function calculateScaleRatio(map: MapLibreMap, dpi: PrintDpi, latitude?: number): number {
  const lat = latitude ?? map.getCenter().lat
  const latRad = (lat * Math.PI) / 180
  const metersPerPixelAt96 = (156543.03392 * Math.cos(latRad)) / Math.pow(2, map.getZoom())
  // 1 meter on map = (metersPerPixel * dpi / 0.0254) meters on paper
  // Scale ratio is ground distance / paper distance
  const groundDistancePerMeterOnPaper = (metersPerPixelAt96 * dpi) / 0.0254
  return Math.round(groundDistancePerMeterOnPaper)
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
}
