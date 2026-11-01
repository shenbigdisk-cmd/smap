import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { jsPDF } from 'jspdf'
import { formatCoordinates } from './geodesy'
import { MAP_CONFIG } from '../config/map.config'

import type { PaperSize, PageOrientation, PrintDpi, PrintFormat } from '../types'
export type { PaperSize, PageOrientation, PrintDpi, PrintFormat }

export interface PrintLegendItem {
  label: string
  color: string
  border?: string
  stroke?: string
  pattern?: string
  code?: string
}

export interface PrintLegendGroup {
  layerId: string
  title: string
  dynamic?: boolean
  items: PrintLegendItem[]
}

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
  dynamicLegend?: boolean
  legendGroups?: PrintLegendGroup[]
  legendItems?: PrintLegendItem[]
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

  // Create offscreen container with exact target dimensions
  // Using opacity 0 instead of visibility hidden so browser compositor executes WebGL rendering
  const offscreenContainer = document.createElement('div')
  offscreenContainer.style.width = `${targetWidth}px`
  offscreenContainer.style.height = `${targetHeight}px`
  offscreenContainer.style.position = 'fixed'
  offscreenContainer.style.left = '0'
  offscreenContainer.style.top = '0'
  offscreenContainer.style.zIndex = '-9999'
  offscreenContainer.style.opacity = '0'
  offscreenContainer.style.pointerEvents = 'none'
  document.body.appendChild(offscreenContainer)

  let offscreenMap: MapLibreMap | null = null

  try {
    const style = liveMap.getStyle()
    // Retain runtime GeoJSON data and raster tiles across sources
    if (style && style.sources) {
      for (const sourceId in style.sources) {
        const src = style.sources[sourceId]
        if (src && src.type === 'geojson') {
          const liveSource = liveMap.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
          if (liveSource) {
            const rawData = (liveSource as any)._data
            // MapLibre 5.x wraps data inside { geojson: FeatureCollection }
            if (rawData && rawData.geojson) {
              src.data = rawData.geojson
            } else if (rawData) {
              src.data = rawData
            } else if ((liveSource as any)._options?.data) {
              src.data = (liveSource as any)._options.data
            }
          }
        } else if (src && src.type === 'raster') {
          const liveSource = liveMap.getSource(sourceId) as maplibregl.RasterTileSource | undefined
          if (liveSource) {
            const liveTiles = (liveSource as any).tiles || (liveSource as any)._options?.tiles
            if (liveTiles && Array.isArray(liveTiles) && liveTiles.length > 0) {
              src.tiles = [...liveTiles]
            }
            src.tileSize = (liveSource as any).tileSize || (liveSource as any)._options?.tileSize || 512
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
    let isTimedOut = false
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        isTimedOut = true
        resolve()
      }, 6000)

      offscreenMap!.once('idle', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    if (isTimedOut) {
      throw new Error('Offscreen map timed out waiting for tiles')
    }

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
  if (config.showLegend) {
    let groups: PrintLegendGroup[] = []
    if (config.legendGroups && config.legendGroups.length > 0) {
      groups = config.legendGroups.filter((g) => g.items && g.items.length > 0)
    } else if (config.legendItems && config.legendItems.length > 0) {
      groups = [{ layerId: 'default', title: 'Planning Symbology', items: config.legendItems }]
    }

    if (groups.length > 0) {
      const MAX_ITEMS = 14
      interface FlattenedLegendItem {
        item: PrintLegendItem
        groupTitle?: string
      }
      const flattened: FlattenedLegendItem[] = []
      let totalAvailable = 0

      for (const g of groups) {
        totalAvailable += g.items.length
        for (let i = 0; i < g.items.length; i++) {
          if (flattened.length < MAX_ITEMS) {
            flattened.push({
              item: g.items[i],
              groupTitle: i === 0 && groups.length > 1 ? g.title : undefined
            })
          }
        }
      }

      const hasOverflow = totalAvailable > MAX_ITEMS
      const isMultiCol = flattened.length > 5
      const numCols = isMultiCol ? 2 : 1
      const colW = Math.round(155 * scaleRatio)
      const colGap = Math.round(10 * scaleRatio)
      const cardPad = Math.round(9 * scaleRatio)
      const cardW = isMultiCol ? colW * 2 + colGap + cardPad * 2 : colW + cardPad * 2

      const headerH = Math.round(18 * scaleRatio)
      const rowH = Math.round(15 * scaleRatio)
      const groupHeaderExtra = Math.round(12 * scaleRatio)

      const itemsPerCol = Math.ceil(flattened.length / numCols)
      const extraRows = flattened.filter((f) => f.groupTitle).length > 0 ? 1 : 0
      const overflowH = hasOverflow ? Math.round(13 * scaleRatio) : 0

      const cardH =
        cardPad * 2 + headerH + itemsPerCol * rowH + extraRows * groupHeaderExtra + overflowH
      const cardX = marginPx + Math.round(12 * scaleRatio)
      const cardY = mapY + mapHeightPx - cardH - Math.round(12 * scaleRatio)

      // Background Card
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillRect(cardX, cardY, cardW, cardH)
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.strokeRect(cardX, cardY, cardW, cardH)

      // Legend Header
      ctx.fillStyle = '#0f172a'
      ctx.font = `bold ${Math.round(9 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('MAP SYMBOLOGY', cardX + cardPad, cardY + cardPad + headerH / 2)

      // Dynamic Filter Badge
      if (config.dynamicLegend) {
        const badgeText = 'IN VIEW'
        ctx.font = `bold ${Math.round(6.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        const textW = ctx.measureText(badgeText).width
        const bw = textW + Math.round(8 * scaleRatio)
        const bh = Math.round(12 * scaleRatio)
        const bx = cardX + cardPad + Math.round(90 * scaleRatio)
        const by = cardY + cardPad + Math.round((headerH - bh) / 2)

        ctx.fillStyle = '#f1f5f9'
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        ctx.strokeRect(bx, by, bw, bh)

        ctx.fillStyle = '#475569'
        ctx.textAlign = 'center'
        ctx.fillText(badgeText, bx + bw / 2, by + bh / 2 + 0.5)
      }

      // Swatches
      const swatchSize = Math.round(10 * scaleRatio)
      const contentStartY = cardY + cardPad + headerH

      flattened.forEach((entry, idx) => {
        const colIdx = isMultiCol ? Math.floor(idx / itemsPerCol) : 0
        const rowIdx = isMultiCol ? idx % itemsPerCol : idx
        const itemX = cardX + cardPad + colIdx * (colW + colGap)
        const itemY = contentStartY + rowIdx * rowH + Math.round(2 * scaleRatio)

        // Swatch Fill
        ctx.fillStyle = entry.item.color || '#3b82f6'
        ctx.fillRect(itemX, itemY, swatchSize, swatchSize)

        // Swatch Pattern (Diagonal hatch for overlays)
        if (entry.item.pattern === 'diagonal') {
          ctx.save()
          ctx.beginPath()
          ctx.rect(itemX, itemY, swatchSize, swatchSize)
          ctx.clip()
          ctx.strokeStyle = entry.item.border || entry.item.stroke || 'rgba(0, 0, 0, 0.45)'
          ctx.lineWidth = Math.max(1, Math.round(1 * scaleRatio))
          const step = Math.round(3.5 * scaleRatio)
          for (let p = -swatchSize; p < swatchSize * 2; p += step) {
            ctx.beginPath()
            ctx.moveTo(itemX + p, itemY + swatchSize)
            ctx.lineTo(itemX + p + swatchSize, itemY)
            ctx.stroke()
          }
          ctx.restore()
        }

        // Swatch Border
        ctx.strokeStyle = entry.item.border || entry.item.stroke || '#94a3b8'
        ctx.lineWidth = 1
        ctx.strokeRect(itemX, itemY, swatchSize, swatchSize)

        // Label
        ctx.fillStyle = '#1e293b'
        ctx.font = `${Math.round(8 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'

        const labelX = itemX + swatchSize + Math.round(6 * scaleRatio)
        const maxLabelW = colW - swatchSize - Math.round(10 * scaleRatio)
        let displayLabel = entry.item.label
        if (ctx.measureText(displayLabel).width > maxLabelW) {
          while (displayLabel.length > 4 && ctx.measureText(displayLabel + '…').width > maxLabelW) {
            displayLabel = displayLabel.slice(0, -1)
          }
          displayLabel += '…'
        }
        ctx.fillText(displayLabel, labelX, itemY + swatchSize / 2)
      })

      // Overflow indicator
      if (hasOverflow) {
        ctx.fillStyle = '#64748b'
        ctx.font = `italic ${Math.round(7.5 * scaleRatio)}px -apple-system, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          `+${totalAvailable - MAX_ITEMS} more in view`,
          cardX + cardPad,
          cardY + cardH - overflowH / 2
        )
      }
    }
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
