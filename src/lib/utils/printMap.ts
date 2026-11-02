import type { Map as MapLibreMap } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { jsPDF } from 'jspdf'
import { formatCoordinates, latLngToMGA2020 } from './geodesy'
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
  image?: string
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
  const [pW, pH] = PAPER_DIMENSIONS_MM[paperSize] || [210, 297]
  const widthMm = orientation === 'landscape' ? pH : pW
  const heightMm = orientation === 'landscape' ? pW : pH

  const widthPx = Math.round((widthMm / 25.4) * dpi)
  const heightPx = Math.round((heightMm / 25.4) * dpi)
  const aspectRatio = widthPx / heightPx

  return { widthPx, heightPx, widthMm, heightMm, aspectRatio }
}

export interface PrintLayoutGeometry {
  widthPx: number
  heightPx: number
  scaleRatio: number
  marginPx: number
  orientation: PageOrientation
  // Map Frame
  mapX: number
  mapY: number
  mapWidthPx: number
  mapHeightPx: number
  mapAspectRatio: number
  // Landscape Side Section
  sideX?: number
  sideY?: number
  sideWidthPx?: number
  sideHeightPx?: number
  // Portrait Header & Bottom Section
  headerX?: number
  headerY?: number
  headerWidthPx?: number
  headerHeightPx?: number
  bottomX?: number
  bottomY?: number
  bottomWidthPx?: number
  bottomHeightPx?: number
}

/**
 * Computes exact cartographic layout geometry for Landscape (with dedicated side section)
 * and Portrait (with big separated bottom info & legend section).
 */
export function getPrintLayoutGeometry(
  paperSize: PaperSize,
  orientation: PageOrientation,
  dpi: PrintDpi,
  showLegend: boolean = true
): PrintLayoutGeometry {
  const { widthPx, heightPx } = getPrintDimensions(paperSize, orientation, dpi)
  const scaleRatio = dpi / 96
  const marginPx = Math.round(14 * scaleRatio)
  const totalW = widthPx - marginPx * 2
  const totalH = heightPx - marginPx * 2

  if (orientation === 'landscape') {
    // Landscape: Dedicated Right-Hand Side Section (~14% of page width) for Info & Legend
    const sideWidthPx = Math.round(totalW * 0.14)
    const mapWidthPx = totalW - sideWidthPx
    const mapHeightPx = totalH
    const mapX = marginPx
    const mapY = marginPx
    const sideX = marginPx + mapWidthPx
    const sideY = marginPx

    return {
      widthPx,
      heightPx,
      scaleRatio,
      marginPx,
      orientation,
      mapX,
      mapY,
      mapWidthPx,
      mapHeightPx,
      mapAspectRatio: mapWidthPx / mapHeightPx,
      sideX,
      sideY,
      sideWidthPx,
      sideHeightPx: totalH
    }
  } else {
    // Portrait: Top Header Banner, Map in Middle, Separated Bottom Info & Legend Section (~15% height)
    const headerHeightPx = Math.round(44 * scaleRatio)
    const bottomHeightPx = Math.round(totalH * 0.15)
    const mapWidthPx = totalW
    const mapHeightPx = totalH - headerHeightPx - bottomHeightPx
    const mapX = marginPx
    const mapY = marginPx + headerHeightPx

    return {
      widthPx,
      heightPx,
      scaleRatio,
      marginPx,
      orientation,
      mapX,
      mapY,
      mapWidthPx,
      mapHeightPx,
      mapAspectRatio: mapWidthPx / mapHeightPx,
      headerX: marginPx,
      headerY: marginPx,
      headerWidthPx: totalW,
      headerHeightPx,
      bottomX: marginPx,
      bottomY: mapY + mapHeightPx,
      bottomWidthPx: totalW,
      bottomHeightPx
    }
  }
}

/**
 * Captures an offscreen high-resolution render of the active map matching the target
 * pixel dimensions and exact zoom required by the framing box.
 */
async function captureHighResMapCanvas(
  liveMap: MapLibreMap,
  targetWidth: number,
  targetHeight: number,
  targetCenter: maplibregl.LngLat,
  targetZoom: number,
  fallbackCrop?: { srcX: number; srcY: number; srcW: number; srcH: number }
): Promise<HTMLCanvasElement> {
  const liveCanvas = liveMap.getCanvas()

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
    if (style && style.sources) {
      for (const sourceId in style.sources) {
        const src = style.sources[sourceId]
        if (src && src.type === 'geojson') {
          const liveSource = liveMap.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
          if (liveSource) {
            const rawData = (liveSource as any)._data
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

    const bearing = liveMap.getBearing()
    const pitch = liveMap.getPitch()

    offscreenMap = new maplibregl.Map({
      container: offscreenContainer,
      style: style,
      center: targetCenter,
      zoom: targetZoom,
      bearing: bearing,
      pitch: pitch,
      interactive: false,
      preserveDrawingBuffer: true as any,
      fadeDuration: 0,
      pixelRatio: 1
    } as any)

    let isTimedOut = false
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        isTimedOut = true
        resolve()
      }, 7000)

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
    console.warn('Offscreen high-res render issue, falling back to cropped live canvas snapshot:', err)
    const fallback = document.createElement('canvas')
    fallback.width = targetWidth
    fallback.height = targetHeight
    const ctx = fallback.getContext('2d')
    if (ctx && fallbackCrop) {
      ctx.drawImage(
        liveCanvas,
        fallbackCrop.srcX,
        fallbackCrop.srcY,
        fallbackCrop.srcW,
        fallbackCrop.srcH,
        0,
        0,
        targetWidth,
        targetHeight
      )
    } else if (ctx) {
      ctx.drawImage(liveCanvas, 0, 0, targetWidth, targetHeight)
    }
    return fallback
  } finally {
    if (offscreenMap) {
      try {
        offscreenMap.remove()
      } catch {}
    }
    if (offscreenContainer.parentNode) {
      offscreenContainer.parentNode.removeChild(offscreenContainer)
    }
  }
}

/**
 * Calculates a round metric scale bar length and label, constrained by optional maxBarPx.
 */
function calculateScaleBar(
  zoom: number,
  latitude: number,
  dpi: PrintDpi,
  maxBarPx?: number
): { barPx: number; label: string } {
  const latRad = (latitude * Math.PI) / 180
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom)

  const defaultTargetPx = (dpi / 96) * 100
  const targetPx = maxBarPx ? Math.min(defaultTargetPx, maxBarPx) : defaultTargetPx
  const rawMeters = targetPx * metersPerPixel

  const roundDistances = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000
  ]
  let chosenMeters = roundDistances[0]
  for (const d of roundDistances) {
    if (d <= rawMeters) {
      chosenMeters = d
    } else {
      break
    }
  }

  // Fallback step-down if barPx exceeds maxBarPx
  let barPx = Math.round(chosenMeters / metersPerPixel)
  if (maxBarPx && barPx > maxBarPx) {
    const curIdx = roundDistances.indexOf(chosenMeters)
    for (let i = curIdx - 1; i >= 0; i--) {
      chosenMeters = roundDistances[i]
      barPx = Math.round(chosenMeters / metersPerPixel)
      if (barPx <= maxBarPx) break
    }
  }

  const label = chosenMeters >= 1000 ? `${chosenMeters / 1000} km` : `${chosenMeters} m`
  return { barPx, label }
}

function calculateScaleRatio(map: MapLibreMap, dpi: PrintDpi, latitude?: number, printZoom?: number): number {
  const lat = latitude ?? map.getCenter().lat
  const latRad = (lat * Math.PI) / 180
  const zoom = printZoom ?? map.getZoom()
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom)
  const groundDistancePerMeterOnPaper = (metersPerPixel * dpi) / 0.0254
  return Math.round(groundDistancePerMeterOnPaper)
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
}

/**
 * Main print / export execution function.
 * Produces an exact cartographic layout honoring the on-screen preview box extent.
 */
export async function executePrint(
  liveMap: MapLibreMap,
  config: PrintConfig
): Promise<void> {
  const { widthMm, heightMm } = getPrintDimensions(
    config.paperSize,
    config.orientation,
    config.dpi
  )

  const geom = getPrintLayoutGeometry(
    config.paperSize,
    config.orientation,
    config.dpi,
    config.showLegend
  )

  // 1. Calculate on-screen preview box dimensions and center to honor extent exactly
  const container = liveMap.getContainer()
  const containerRect = container.getBoundingClientRect()
  const padLeft = config.padLeft || 0
  const availWidth = Math.max(100, container.clientWidth - padLeft)
  const availHeight = container.clientHeight
  let boxCenterX = padLeft + availWidth / 2
  let boxCenterY = availHeight / 2

  const maxBoxW = availWidth * 0.85
  const maxBoxH = availHeight * 0.85
  let previewBoxW = maxBoxW
  let previewBoxH = maxBoxW / geom.mapAspectRatio
  if (previewBoxH > maxBoxH) {
    previewBoxH = maxBoxH
    previewBoxW = maxBoxH * geom.mapAspectRatio
  }

  // Check if .print-frame-box element is rendered in DOM for exact pixel alignment
  const frameEl = document.querySelector('.print-frame-box')
  if (frameEl) {
    const r = frameEl.getBoundingClientRect()
    if (r.width > 50 && r.height > 50) {
      previewBoxW = r.width
      previewBoxH = r.height
      // Translate viewport client coordinates to container-relative pixel coordinates
      boxCenterX = (r.left - containerRect.left) + r.width / 2
      boxCenterY = (r.top - containerRect.top) + r.height / 2
    }
  }

  const visibleCenter = liveMap.unproject([boxCenterX, boxCenterY])

  // Exact zoom calculation: offscreen map width is geom.mapWidthPx, on-screen preview box width is previewBoxW
  const zoomOffset = Math.log2(geom.mapWidthPx / previewBoxW)
  const printZoom = liveMap.getZoom() + zoomOffset

  // Calculate live canvas crop bounds for graceful fallback
  const liveCanvas = liveMap.getCanvas()
  const canvasScale = liveCanvas.width / container.clientWidth
  const fallbackCrop = {
    srcX: Math.max(0, (boxCenterX - previewBoxW / 2) * canvasScale),
    srcY: Math.max(0, (boxCenterY - previewBoxH / 2) * canvasScale),
    srcW: Math.min(liveCanvas.width, previewBoxW * canvasScale),
    srcH: Math.min(liveCanvas.height, previewBoxH * canvasScale)
  }

  // 2. Capture Map Canvas centered on the visible preview frame at exact printZoom
  const mapCanvas = await captureHighResMapCanvas(
    liveMap,
    geom.mapWidthPx,
    geom.mapHeightPx,
    visibleCenter,
    printZoom,
    fallbackCrop
  )

  // 3. Prepare legend items and pre-load images
  let groups: PrintLegendGroup[] = []
  if (config.legendGroups && config.legendGroups.length > 0) {
    groups = config.legendGroups.filter((g) => g.items && g.items.length > 0)
  } else if (config.legendItems && config.legendItems.length > 0) {
    groups = [{ layerId: 'default', title: 'Planning Symbology', items: config.legendItems }]
  }

  const flattened: PrintLegendItem[] = []
  for (const g of groups) {
    for (const item of g.items) {
      flattened.push(item)
    }
  }

  const imageMap = new Map<string, HTMLImageElement>()
  const imgPromises = flattened
    .filter((it) => Boolean(it.image))
    .map(
      (it) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            imageMap.set(it.image!, img)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = it.image!
        })
    )
  await Promise.all(imgPromises)

  // 4. Compose full cartographic sheet
  const printCanvas = document.createElement('canvas')
  printCanvas.width = geom.widthPx
  printCanvas.height = geom.heightPx
  const ctx = printCanvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context for print')

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, geom.widthPx, geom.heightPx)

  const scaleRatio = geom.scaleRatio

  // 5. Render Layout according to Orientation
  if (
    geom.orientation === 'landscape' &&
    geom.sideX !== undefined &&
    geom.sideY !== undefined &&
    geom.sideWidthPx !== undefined &&
    geom.sideHeightPx !== undefined
  ) {
    // =========================================================================
    // LANDSCAPE: Clean Map on Left, Dedicated Side Section on Right
    // =========================================================================

    // A. Draw Map on the Left
    ctx.drawImage(mapCanvas, geom.mapX, geom.mapY, geom.mapWidthPx, geom.mapHeightPx)

    // B. Draw Side Section Background on the Right
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(geom.sideX, geom.sideY, geom.sideWidthPx, geom.sideHeightPx)

    // Vertical neatline divider between Map and Side Section
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scaleRatio))
    ctx.beginPath()
    ctx.moveTo(geom.sideX, geom.sideY)
    ctx.lineTo(geom.sideX, geom.sideY + geom.sideHeightPx)
    ctx.stroke()

    // C. Side Section Content
    const sidePad = Math.round(10 * scaleRatio)
    const contentW = geom.sideWidthPx - sidePad * 2
    let curY = geom.sideY + sidePad

    // Agency Badge & Brand
    const badgeW = Math.round(24 * scaleRatio)
    const badgeH = Math.round(15 * scaleRatio)
    ctx.fillStyle = '#0284c7'
    ctx.fillRect(geom.sideX + sidePad, curY, badgeW, badgeH)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(8 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('VIC', geom.sideX + sidePad + badgeW / 2, curY + badgeH / 2)

    let agencyText = MAP_CONFIG.agency || 'State Government'
    const maxAgencyW = contentW - badgeW - Math.round(6 * scaleRatio)
    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(7.5 * scaleRatio)}px -apple-system, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    if (ctx.measureText(agencyText).width > maxAgencyW) {
      while (agencyText.length > 3 && ctx.measureText(agencyText + '…').width > maxAgencyW) {
        agencyText = agencyText.slice(0, -1)
      }
      agencyText += '…'
    }
    ctx.fillText(agencyText, geom.sideX + sidePad + badgeW + Math.round(6 * scaleRatio), curY + badgeH / 2)
    curY += badgeH + Math.round(6 * scaleRatio)

    // Title text (Allow up to 2 lines wrapping for long addresses)
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(9.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const titleWords = (config.title || 'VicPlan Spatial Extent').split(' ')
    const titleLines: string[] = []
    let currentLine = ''
    for (const word of titleWords) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      if (ctx.measureText(testLine).width <= contentW) {
        currentLine = testLine
      } else {
        if (currentLine) titleLines.push(currentLine)
        currentLine = word
      }
      if (titleLines.length >= 2) break
    }
    if (currentLine && titleLines.length < 2) titleLines.push(currentLine)
    if (titleLines.length === 0) titleLines.push('VicPlan Map')

    if (titleLines.length === 2 && ctx.measureText(titleLines[1]).width > contentW) {
      while (titleLines[1].length > 3 && ctx.measureText(titleLines[1] + '…').width > contentW) {
        titleLines[1] = titleLines[1].slice(0, -1)
      }
      titleLines[1] += '…'
    }

    for (const line of titleLines) {
      ctx.fillText(line, geom.sideX + sidePad, curY)
      curY += Math.round(13 * scaleRatio)
    }
    curY += Math.round(2 * scaleRatio)

    // Subtitle Date
    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(7 * scaleRatio)}px -apple-system, sans-serif`
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    ctx.fillText(dateStr, geom.sideX + sidePad, curY)
    curY += Math.round(10 * scaleRatio)

    // Divider
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(geom.sideX + sidePad, curY)
    ctx.lineTo(geom.sideX + geom.sideWidthPx - sidePad, curY)
    ctx.stroke()
    curY += Math.round(8 * scaleRatio)

    // Cartographic Tools Block (Scale Ratio, Scale Bar, North Arrow)
    if (config.showScale || config.showNorthArrow) {
      const toolBoxH = Math.round(36 * scaleRatio)

      // Scale Ratio
      ctx.fillStyle = '#0f172a'
      ctx.font = `bold ${Math.round(7.5 * scaleRatio)}px monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(
        `Scale 1:${Math.round(calculateScaleRatio(liveMap, config.dpi, visibleCenter.lat, printZoom)).toLocaleString()}`,
        geom.sideX + sidePad,
        curY
      )

      if (config.showScale) {
        const nSize = config.showNorthArrow ? Math.round(18 * scaleRatio) : 0
        const maxBarPx = config.showNorthArrow
          ? Math.max(24 * scaleRatio, contentW - nSize - Math.round(14 * scaleRatio))
          : contentW - Math.round(8 * scaleRatio)
        const { barPx, label } = calculateScaleBar(printZoom, visibleCenter.lat, config.dpi, maxBarPx)
        const sbBarY = curY + Math.round(13 * scaleRatio)
        const segH = Math.round(3 * scaleRatio)

        ctx.fillStyle = '#0f172a'
        ctx.fillRect(geom.sideX + sidePad, sbBarY, barPx / 2, segH)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(geom.sideX + sidePad + barPx / 2, sbBarY, barPx / 2, segH)
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 1
        ctx.strokeRect(geom.sideX + sidePad, sbBarY, barPx, segH)

        ctx.fillStyle = '#475569'
        ctx.font = `${Math.round(6.5 * scaleRatio)}px monospace`
        ctx.fillText(`0`, geom.sideX + sidePad, sbBarY + segH + Math.round(2 * scaleRatio))
        ctx.textAlign = 'right'
        ctx.fillText(label, geom.sideX + sidePad + barPx, sbBarY + segH + Math.round(2 * scaleRatio))
      }

      if (config.showNorthArrow) {
        const nSize = Math.round(18 * scaleRatio)
        const nX = geom.sideX + geom.sideWidthPx - sidePad - nSize / 2
        const nY = curY + nSize / 2 + Math.round(4 * scaleRatio)
        ctx.save()
        ctx.translate(nX, nY)
        ctx.rotate((-liveMap.getBearing() * Math.PI) / 180)
        ctx.fillStyle = '#0f172a'
        ctx.beginPath()
        ctx.moveTo(0, -nSize * 0.45)
        ctx.lineTo(nSize * 0.25, nSize * 0.35)
        ctx.lineTo(0, nSize * 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#94a3b8'
        ctx.beginPath()
        ctx.moveTo(0, -nSize * 0.45)
        ctx.lineTo(-nSize * 0.25, nSize * 0.35)
        ctx.lineTo(0, nSize * 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      curY += toolBoxH + Math.round(4 * scaleRatio)
      ctx.strokeStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.moveTo(geom.sideX + sidePad, curY)
      ctx.lineTo(geom.sideX + geom.sideWidthPx - sidePad, curY)
      ctx.stroke()
      curY += Math.round(8 * scaleRatio)
    }

    // Symbology Legend Section
    const footerH = Math.round(54 * scaleRatio)
    const legMaxY = geom.sideY + geom.sideHeightPx - footerH - Math.round(6 * scaleRatio)

    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(8.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('MAP SYMBOLOGY', geom.sideX + sidePad, curY)
    curY += Math.round(14 * scaleRatio)

    if (config.showLegend && flattened.length > 0) {
      const swatchSize = Math.round(9 * scaleRatio)
      const itemRowH = Math.round(15 * scaleRatio)
      const colW = contentW

      for (let i = 0; i < flattened.length; i++) {
        const item = flattened[i]
        const itY = curY + i * itemRowH

        const hasMoreAfter = i < flattened.length - 1
        if (hasMoreAfter && itY + itemRowH * 2 > legMaxY) {
          ctx.fillStyle = '#64748b'
          ctx.font = `italic ${Math.round(7 * scaleRatio)}px sans-serif`
          ctx.fillText(`+${flattened.length - i} more in extent`, geom.sideX + sidePad, itY + swatchSize / 2)
          break
        } else if (itY + itemRowH > legMaxY) {
          break
        }

        const itX = geom.sideX + sidePad
        const swatchImg = item.image ? imageMap.get(item.image) : null
        if (swatchImg) {
          ctx.drawImage(swatchImg, itX, itY + Math.round(1 * scaleRatio), swatchSize, swatchSize)
        } else {
          ctx.fillStyle = item.color || '#3b82f6'
          ctx.fillRect(itX, itY + Math.round(1 * scaleRatio), swatchSize, swatchSize)
          ctx.strokeStyle = item.border || item.stroke || '#94a3b8'
          ctx.lineWidth = 1
          ctx.strokeRect(itX, itY + Math.round(1 * scaleRatio), swatchSize, swatchSize)
        }

        ctx.fillStyle = '#1e293b'
        ctx.font = `${Math.round(7.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const labelX = itX + swatchSize + Math.round(5 * scaleRatio)
        const maxTextW = colW - swatchSize - Math.round(6 * scaleRatio)
        let displayLabel = item.label
        if (ctx.measureText(displayLabel).width > maxTextW) {
          while (displayLabel.length > 4 && ctx.measureText(displayLabel + '…').width > maxTextW) {
            displayLabel = displayLabel.slice(0, -1)
          }
          displayLabel += '…'
        }
        ctx.fillText(displayLabel, labelX, itY + 1 + swatchSize / 2)
      }
    } else {
      ctx.fillStyle = '#94a3b8'
      ctx.font = `italic ${Math.round(7.5 * scaleRatio)}px sans-serif`
      const emptyNote = config.showLegend ? 'No active symbology in extent' : 'Symbology omitted'
      ctx.fillText(emptyNote, geom.sideX + sidePad, curY)
    }

    // Bottom Metadata & Coordinates Block
    const botY = geom.sideY + geom.sideHeightPx - footerH
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(geom.sideX + sidePad, botY)
    ctx.lineTo(geom.sideX + geom.sideWidthPx - sidePad, botY)
    ctx.stroke()

    if (config.showCoordinates) {
      const { easting, northing } = latLngToMGA2020(visibleCenter.lng, visibleCenter.lat, 55)
      const latStr = `${Math.abs(visibleCenter.lat).toFixed(5)}° ${visibleCenter.lat < 0 ? 'S' : 'N'}`
      const lngStr = `${Math.abs(visibleCenter.lng).toFixed(5)}° ${visibleCenter.lng < 0 ? 'W' : 'E'}`

      ctx.fillStyle = '#475569'
      ctx.font = `${Math.round(6.5 * scaleRatio)}px monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`${latStr}, ${lngStr}`, geom.sideX + sidePad, botY + Math.round(6 * scaleRatio))
      ctx.fillText(`E ${Math.round(easting).toLocaleString()}  N ${Math.round(northing).toLocaleString()}`, geom.sideX + sidePad, botY + Math.round(17 * scaleRatio))
      ctx.fillText(`MGA2020 Zone 55 • GDA2020`, geom.sideX + sidePad, botY + Math.round(28 * scaleRatio))
      ctx.fillStyle = '#94a3b8'
      ctx.font = `${Math.round(6.5 * scaleRatio)}px -apple-system, sans-serif`
      ctx.fillText(`© State Government of Victoria`, geom.sideX + sidePad, botY + Math.round(40 * scaleRatio))
    }

  } else if (
    geom.orientation === 'portrait' &&
    geom.headerX !== undefined &&
    geom.headerY !== undefined &&
    geom.headerWidthPx !== undefined &&
    geom.headerHeightPx !== undefined &&
    geom.bottomX !== undefined &&
    geom.bottomY !== undefined &&
    geom.bottomWidthPx !== undefined &&
    geom.bottomHeightPx !== undefined
  ) {
    // =========================================================================
    // PORTRAIT: Top Header Banner, Middle Map, Big Separated Bottom Section
    // =========================================================================

    // A. Top Header Banner
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(geom.headerX!, geom.headerY, geom.headerWidthPx!, geom.headerHeightPx!)

    // Header Agency Badge
    const badgeW = Math.round(36 * scaleRatio)
    const badgeH = Math.round(24 * scaleRatio)
    const badgeX = geom.headerX! + Math.round(12 * scaleRatio)
    const badgeY = geom.headerY + Math.round((geom.headerHeightPx! - badgeH) / 2)
    ctx.fillStyle = '#0284c7'
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(11 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('VIC', badgeX + badgeW / 2, badgeY + badgeH / 2)

    // Header Title
    const titleX = badgeX + badgeW + Math.round(12 * scaleRatio)
    const maxTitleW = geom.headerWidthPx! - titleX - Math.round(16 * scaleRatio)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(13 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    let displayTitle = config.title || 'VicPlan Spatial Extent'
    if (ctx.measureText(displayTitle).width > maxTitleW) {
      while (displayTitle.length > 4 && ctx.measureText(displayTitle + '…').width > maxTitleW) {
        displayTitle = displayTitle.slice(0, -1)
      }
      displayTitle += '…'
    }
    ctx.fillText(displayTitle, titleX, geom.headerY + Math.round(23 * scaleRatio))

    // Header Subtitle / Date / Scale
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${Math.round(8.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const scaleRatioStr = Math.round(calculateScaleRatio(liveMap, config.dpi, visibleCenter.lat, printZoom)).toLocaleString()
    let subText = `${MAP_CONFIG.agency || 'State Government of Victoria'} • Exported ${dateStr} • Scale 1:${scaleRatioStr}`
    if (ctx.measureText(subText).width > maxTitleW) {
      subText = `${MAP_CONFIG.agency || 'VicPlan'} • ${dateStr} • 1:${scaleRatioStr}`
    }
    if (ctx.measureText(subText).width > maxTitleW) {
      while (subText.length > 4 && ctx.measureText(subText + '…').width > maxTitleW) {
        subText = subText.slice(0, -1)
      }
      subText += '…'
    }
    ctx.fillText(subText, titleX, geom.headerY + Math.round(37 * scaleRatio))

    // B. Draw Map Canvas in Middle
    ctx.drawImage(mapCanvas, geom.mapX, geom.mapY, geom.mapWidthPx, geom.mapHeightPx)

    // North arrow in top-right of map
    if (config.showNorthArrow) {
      const northSize = Math.round(28 * scaleRatio)
      const northX = geom.mapX + geom.mapWidthPx - northSize - Math.round(12 * scaleRatio)
      const northY = geom.mapY + Math.round(12 * scaleRatio)
      ctx.save()
      ctx.translate(northX + northSize / 2, northY + northSize / 2)
      ctx.rotate((-liveMap.getBearing() * Math.PI) / 180)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
      ctx.beginPath()
      ctx.arc(0, 0, northSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1
      ctx.stroke()
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
      ctx.restore()
    }

    // Scale bar in bottom-right inside map frame
    if (config.showScale) {
      const maxBarW = Math.round(geom.mapWidthPx * 0.32)
      const { barPx, label } = calculateScaleBar(printZoom, visibleCenter.lat, config.dpi, maxBarW)
      const sbPadX = Math.round(8 * scaleRatio)
      const sbPadY = Math.round(6 * scaleRatio)
      const sbWidth = barPx + sbPadX * 2
      const sbHeight = Math.round(24 * scaleRatio)
      const sbX = geom.mapX + geom.mapWidthPx - sbWidth - Math.round(12 * scaleRatio)
      const sbY = geom.mapY + geom.mapHeightPx - sbHeight - Math.round(12 * scaleRatio)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.fillRect(sbX, sbY, sbWidth, sbHeight)
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.strokeRect(sbX, sbY, sbWidth, sbHeight)

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

      ctx.fillStyle = '#0f172a'
      ctx.font = `bold ${Math.round(8.5 * scaleRatio)}px monospace`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, sbX + sbWidth - sbPadX, sbY + Math.round(10 * scaleRatio))
      ctx.textAlign = 'left'
      ctx.fillText('0', barX, sbY + Math.round(10 * scaleRatio))
    }

    // C. Separated Bottom Info & Legend Section
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(geom.bottomX!, geom.bottomY, geom.bottomWidthPx!, geom.bottomHeightPx!)

    // Horizontal divider between Map and Bottom Section
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scaleRatio))
    ctx.beginPath()
    ctx.moveTo(geom.bottomX!, geom.bottomY)
    ctx.lineTo(geom.bottomX! + geom.bottomWidthPx!, geom.bottomY)
    ctx.stroke()

    // Inside Bottom Section: Left 68% for Symbology, Right 32% for Coordinates & Metadata
    const botPad = Math.round(10 * scaleRatio)
    const legSectionW = Math.round((geom.bottomWidthPx! - botPad * 3) * 0.68)
    const infoSectionW = geom.bottomWidthPx! - botPad * 3 - legSectionW
    const infoX = geom.bottomX! + botPad + legSectionW + botPad

    // Vertical divider between Symbology and Info
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(infoX - botPad / 2, geom.bottomY + botPad)
    ctx.lineTo(infoX - botPad / 2, geom.bottomY + geom.bottomHeightPx! - botPad)
    ctx.stroke()

    // Symbology Title
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(8.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('MAP SYMBOLOGY', geom.bottomX! + botPad, geom.bottomY + botPad)

    // Swatches Grid
    const swatchStartY = geom.bottomY + botPad + Math.round(14 * scaleRatio)
    const legMaxY = geom.bottomY + geom.bottomHeightPx! - botPad

    if (config.showLegend && flattened.length > 0) {
      const numCols = 3
      const colW = Math.floor((legSectionW - Math.round(12 * scaleRatio)) / numCols)
      const colGap = Math.round(6 * scaleRatio)
      const itemRowH = Math.round(15 * scaleRatio)
      const swatchSize = Math.round(10 * scaleRatio)

      for (let i = 0; i < flattened.length; i++) {
        const item = flattened[i]
        const col = i % numCols
        const row = Math.floor(i / numCols)
        const itY = swatchStartY + row * itemRowH

        const hasMoreAfter = i < flattened.length - 1
        if (hasMoreAfter && itY + itemRowH * 2 > legMaxY) {
          ctx.fillStyle = '#64748b'
          ctx.font = `italic ${Math.round(7 * scaleRatio)}px sans-serif`
          ctx.fillText(`+${flattened.length - i} more items`, geom.bottomX! + botPad + col * (colW + colGap), itY + swatchSize / 2)
          break
        } else if (itY + itemRowH > legMaxY) {
          break
        }

        const itX = geom.bottomX! + botPad + col * (colW + colGap)
        const swatchImg = item.image ? imageMap.get(item.image) : null
        if (swatchImg) {
          ctx.drawImage(swatchImg, itX, itY + Math.round(1 * scaleRatio), swatchSize, swatchSize)
        } else {
          ctx.fillStyle = item.color || '#3b82f6'
          ctx.fillRect(itX, itY + Math.round(1 * scaleRatio), swatchSize, swatchSize)
          ctx.strokeStyle = item.border || item.stroke || '#94a3b8'
          ctx.lineWidth = 1
          ctx.strokeRect(itX, itY + Math.round(1 * scaleRatio), swatchSize, swatchSize)
        }

        ctx.fillStyle = '#1e293b'
        ctx.font = `${Math.round(7.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const labelX = itX + swatchSize + Math.round(5 * scaleRatio)
        const maxTextW = colW - swatchSize - Math.round(6 * scaleRatio)
        let displayLabel = item.label
        if (ctx.measureText(displayLabel).width > maxTextW) {
          while (displayLabel.length > 4 && ctx.measureText(displayLabel + '…').width > maxTextW) {
            displayLabel = displayLabel.slice(0, -1)
          }
          displayLabel += '…'
        }
        ctx.fillText(displayLabel, labelX, itY + 1 + swatchSize / 2)
      }
    } else {
      ctx.fillStyle = '#94a3b8'
      ctx.font = `italic ${Math.round(7.5 * scaleRatio)}px sans-serif`
      const emptyNote = config.showLegend ? 'No active layer symbology in extent' : 'Symbology omitted'
      ctx.fillText(emptyNote, geom.bottomX! + botPad, swatchStartY)
    }

    // Right Metadata Column inside Bottom Section
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${Math.round(8.5 * scaleRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('COORDINATES & REFERENCE', infoX, geom.bottomY + botPad)

    let infoCurY = geom.bottomY + botPad + Math.round(14 * scaleRatio)
    if (config.showCoordinates) {
      const { easting, northing } = latLngToMGA2020(visibleCenter.lng, visibleCenter.lat, 55)
      const latStr = `${Math.abs(visibleCenter.lat).toFixed(5)}° ${visibleCenter.lat < 0 ? 'S' : 'N'}`
      const lngStr = `${Math.abs(visibleCenter.lng).toFixed(5)}° ${visibleCenter.lng < 0 ? 'W' : 'E'}`

      ctx.fillStyle = '#475569'
      ctx.font = `${Math.round(7 * scaleRatio)}px monospace`
      ctx.fillText(`Center: ${latStr}, ${lngStr}`, infoX, infoCurY)
      infoCurY += Math.round(13 * scaleRatio)
      ctx.fillText(`MGA2020: E ${Math.round(easting).toLocaleString()}, N ${Math.round(northing).toLocaleString()}`, infoX, infoCurY)
      infoCurY += Math.round(13 * scaleRatio)
      ctx.fillText(`Zone 55 • Datum: GDA2020`, infoX, infoCurY)
      infoCurY += Math.round(13 * scaleRatio)
    }

    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(7 * scaleRatio)}px -apple-system, sans-serif`
    ctx.fillText('Planning scheme data © State of Victoria', infoX, infoCurY)
  }

  // 6. Unified Outer Neatline Border Enclosing Sheet
  const borderWidth = Math.max(1, Math.round(1.5 * scaleRatio))
  const borderColor = '#334155'
  const offset = borderWidth % 2 === 1 ? 0.5 : 0

  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderWidth

  const totalW = geom.widthPx - geom.marginPx * 2
  const totalH = geom.heightPx - geom.marginPx * 2
  ctx.strokeRect(geom.marginPx + offset, geom.marginPx + offset, totalW, totalH)

  // 7. Output generation & download
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
