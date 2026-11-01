<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte'
  import maplibregl, { type MapMouseEvent } from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import {
    TerraDraw,
    TerraDrawPointMode,
    TerraDrawLineStringMode,
    TerraDrawPolygonMode,
    TerraDrawRectangleMode,
    TerraDrawCircleMode,
    TerraDrawFreehandMode,
    TerraDrawSelectMode,
    TerraDrawModeUndoRedo,
    TerraDrawSessionUndoRedo,
    TerraDrawUndoRedoKeyboardShortcuts
  } from 'terra-draw'
  import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'
  import {
    BUILDINGS_3D_GEOJSON,
    LGA_BOUNDARIES_GEOJSON,
    OVERLAYS_GEOJSON,
    SAMPLE_PARCELS,
    ZONE_POLYGONS_GEOJSON
  } from '../data/sampleData'
  import { formatArea, formatCoordinates, formatDistance } from '../utils/geodesy'
  import { getInitialMapViewState, initUrlStateSync } from '../utils/urlState'
  import { moduleManager } from '../modules/registry'
  import IdentifyPopup from './IdentifyPopup.svelte'

  let mapContainer: HTMLDivElement | null = null
  let map: maplibregl.Map | null = null
  let drawInstance: TerraDraw | null = null

  let padLeft = $derived(
    mapStore.sidebarOpen
      ? (mapStore.settings.layout === 'site'
          ? 390
          : mapStore.settings.layout === 'application'
            ? 380
            : 404)
      : 0
  )

  onMount(() => {
    if (!mapContainer) return

    // 1. Read initial state synchronously so map starts IMMEDIATELY at target with no initial zoom jump
    const initialState = getInitialMapViewState()
    if (initialState.basemapId) {
      mapStore.activeBasemapId = initialState.basemapId
    }

    const initialBasemap = MAP_CONFIG.basemaps.find(
      (b) => b.id === mapStore.activeBasemapId
    )

    map = new maplibregl.Map({
      container: mapContainer,
      style: initialBasemap?.styleUrl || {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      center: initialState.center,
      zoom: initialState.zoom,
      pitch: initialState.pitch ?? (mapStore.is3dActive ? 55 : 0),
      bearing: initialState.bearing ?? (mapStore.is3dActive ? -18 : 0),
      maxPitch: mapStore.is3dActive ? 85 : 0,
      attributionControl: false,
      aroundCenter: false as any,
      dragRotate: mapStore.is3dActive as any,
      touchPitch: mapStore.is3dActive as any,
      preserveDrawingBuffer: true
    } as any)

    if (initialState.parcelId) {
      mapStore.selectParcelById(initialState.parcelId)
    }

    // Custom attribution control positioned in bottom-right
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    )

    // Metric Scale Bar
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left'
    )

    map.on('load', () => {
      if (!map) return
      mapStore.setMap(map)
      mapStore.setSyncServiceLayersCallback(() => setupServiceLayers())
      reapplyAllLayers()
      initOrReinitTerraDraw()
      initUrlStateSync()
    })

    // Style data & style.load re-load (e.g. when basemap changes)
    map.on('style.load', () => {
      reapplyAllLayers()
      initOrReinitTerraDraw()
    })

    map.on('styledata', () => {
      if (map && map.getStyle() && !map.getLayer('layer-parcels-fill')) {
        reapplyAllLayers()
      }
    })

    map.on('idle', () => {
      if (map && map.getStyle() && !map.getLayer('layer-parcels-fill')) {
        reapplyAllLayers()
      }
      mapStore.viewportVersion++
    })

    map.on('moveend', () => {
      mapStore.viewportVersion++
    })

    // Track Cursor Coordinates, Movement & Hover
    map.on('mousemove', (e: MapMouseEvent) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      mapStore.cursorCoordinates = coord
      if (map) {
        mapStore.currentZoom = parseFloat(map.getZoom().toFixed(1))
        if (mapStore.activeHandler) {
          if (mapStore.activeHandler.onMouseMove) {
            mapStore.activeHandler.onMouseMove(coord, e)
          }
          map.getCanvas().style.cursor = mapStore.activeHandler.cursor || 'crosshair'
        } else if (!mapStore.measurement.type && !mapStore.activeMarkupTool && !mapStore.activeQueryTool) {
          const hovered = map.getLayer('layer-parcels-fill') && mapStore.isLayerVisible('layer-parcels')
            ? map.queryRenderedFeatures(e.point, { layers: ['layer-parcels-fill'] })
            : []
          map.getCanvas().style.cursor = hovered.length > 0 ? 'pointer' : ''
        }

        // Live rubberband preview line during active measurement
        if (
          mapStore.measurement.type &&
          !mapStore.measurement.isFinished &&
          mapStore.measurement.points.length > 0
        ) {
          updateMeasurementData(coord)
        }
      }
    })

    // Double-click to complete measurement without zooming
    map.on('dblclick', (e: MapMouseEvent) => {
      if (mapStore.measurement.type && !mapStore.measurement.isFinished) {
        e.preventDefault()
        mapStore.finishMeasurement()
      }
    })

    map.on('moveend', () => {
      mapStore.saveMapExtent()
    })

    // Map Click Interaction
    map.on('click', (e: MapMouseEvent) => {
      mapStore.searchFocused = false
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat]

      // 1. Delegate to active registered interaction handler (Lifecycle Guardrail)
      if (mapStore.activeHandler?.onClick) {
        mapStore.activeHandler.onClick(coord, e)
        return
      }

      // 2. Legacy / fallback measurement handling
      if (mapStore.measurement.type) {
        mapStore.addMeasurementPoint(coord)
        return
      }

      // 3. Active markup or query sketch mode -> TerraDraw handles it, avoid parcel identification!
      if (mapStore.activeMarkupTool || mapStore.activeQueryTool) {
        return
      }

      // 4. Multi-Layer Identify across all visible operational layers
      mapStore.identifyAtCoordinate(coord, e.point)
    })

    // Window KeyDown Guardrail (Esc cancels current handler)
    window.addEventListener('keydown', handleGlobalKeyDown)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeyDown)
    if (drawInstance) {
      try {
        drawInstance.stop()
      } catch (e) {}
      drawInstance = null
      mapStore.setTerraDraw(null)
    }
    map?.remove()
  })

  function initOrReinitTerraDraw() {
    if (!map) return

    let existingSnapshot: any[] = []
    if (drawInstance) {
      try {
        const raw = drawInstance.getSnapshot() || []
        existingSnapshot = raw.filter((f: any) => {
          const p = f.properties || {}
          return !p.midPoint && !p.selectionPoint && !p.coordinatePoint && !p.snappingPoint
        })
        drawInstance.stop()
      } catch (err) {
        console.warn('Error stopping TerraDraw instance:', err)
      }
      drawInstance = null
    }

    try {
      const hexColor = (mapStore.markupColor.startsWith('#') ? mapStore.markupColor : '#dc2626') as `#${string}`
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPointMode({
            styles: {
              pointColor: hexColor,
              pointWidth: 6,
              pointOutlineColor: '#ffffff',
              pointOutlineWidth: 2
            }
          }),
          new TerraDrawLineStringMode({
            styles: {
              lineStringColor: hexColor,
              lineStringWidth: 3
            }
          }),
          new TerraDrawPolygonMode({
            styles: {
              fillColor: hexColor,
              fillOpacity: 0.35,
              outlineColor: hexColor,
              outlineWidth: 2
            }
          }),
          new TerraDrawRectangleMode({
            styles: {
              fillColor: hexColor,
              fillOpacity: 0.35,
              outlineColor: hexColor,
              outlineWidth: 2
            }
          }),
          new TerraDrawCircleMode({
            styles: {
              fillColor: hexColor,
              fillOpacity: 0.35,
              outlineColor: hexColor,
              outlineWidth: 2
            }
          }),
          new TerraDrawFreehandMode({
            styles: {
              fillColor: hexColor,
              fillOpacity: 0.35,
              outlineColor: hexColor,
              outlineWidth: 2
            }
          }),
          new TerraDrawSelectMode({
            flags: {
              point: { feature: { draggable: true } },
              polygon: {
                feature: {
                  draggable: true,
                  rotateable: true,
                  scaleable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true }
                }
              },
              linestring: {
                feature: {
                  draggable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true }
                }
              },
              rectangle: {
                feature: {
                  draggable: true,
                  rotateable: true,
                  scaleable: true,
                  coordinates: { draggable: true, resizable: 'center' }
                }
              },
              circle: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, resizable: 'center' }
                }
              },
              freehand: {
                feature: { draggable: true }
              }
            }
          })
        ],
        undoRedo: {
          modeLevel: new TerraDrawModeUndoRedo(),
          sessionLevel: new TerraDrawSessionUndoRedo(),
          keyboardShortcuts: new TerraDrawUndoRedoKeyboardShortcuts()
        }
      })

      draw.start()
      drawInstance = draw
      mapStore.setTerraDraw(draw)

      if (existingSnapshot.length > 0) {
        draw.addFeatures(existingSnapshot)
      }

      if (mapStore.activeMarkupTool) {
        const modeMap: Record<string, string> = {
          point: 'point',
          line: 'linestring',
          polygon: 'polygon',
          rectangle: 'rectangle',
          circle: 'circle',
          freehand: 'freehand',
          select: 'select'
        }
        const m = modeMap[mapStore.activeMarkupTool]
        if (m) {
          draw.setMode(m)
        }
      }
    } catch (err) {
      console.error('Failed to initialize TerraDraw:', err)
    }
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && mapStore.activeHandler) {
      mapStore.deactivateMapHandler()
      return
    }
    if (mapStore.activeHandler?.onKeyDown) {
      mapStore.activeHandler.onKeyDown(e)
    }

    // Contributed module shortcuts (disabled while editing text inputs)
    const target = e.target as HTMLElement | null
    const isEditing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    if (!isEditing) {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      for (const sc of moduleManager.getShortcuts()) {
        const key = sc.key.toLowerCase()
        if (key === 'ctrl+p' && isCtrlOrCmd && e.key.toLowerCase() === 'p') {
          e.preventDefault()
          sc.action(moduleManager.createContext('keyboard'))
          return
        }
      }
    }
  }

  function setupOperationalLayers() {
    if (!map || !map.getStyle()) return

    // 1. Planning Scheme Zones
    const zonesVis = mapStore.isLayerVisible('layer-zones') ? 'visible' : 'none'
    if (!map.getSource('zones-source')) {
      map.addSource('zones-source', {
        type: 'geojson',
        data: ZONE_POLYGONS_GEOJSON
      })
    }
    if (!map.getLayer('layer-zones-fill')) {
      map.addLayer({
        id: 'layer-zones-fill',
        type: 'fill',
        source: 'zones-source',
        layout: {
          visibility: zonesVis
        },
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.5
        }
      })
    }
    if (!map.getLayer('layer-zones-outline')) {
      map.addLayer({
        id: 'layer-zones-outline',
        type: 'line',
        source: 'zones-source',
        layout: {
          visibility: zonesVis
        },
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 1.5,
          'line-dasharray': [2, 1]
        }
      })
    }

    // 2. Cadastre Parcels
    const parcelsVis = mapStore.isLayerVisible('layer-parcels') ? 'visible' : 'none'
    const parcelsGeoJson = {
      type: 'FeatureCollection' as const,
      features: SAMPLE_PARCELS.map((p) => ({
        type: 'Feature' as const,
        properties: {
          id: p.id,
          address: p.address,
          spi: p.spi,
          lotPlan: p.lotPlan,
          zoneCode: p.zone.code
        },
        geometry: p.geometry
      }))
    }

    if (!map.getSource('parcels-source')) {
      map.addSource('parcels-source', {
        type: 'geojson',
        data: parcelsGeoJson
      })
    }
    if (!map.getLayer('layer-parcels-fill')) {
      map.addLayer({
        id: 'layer-parcels-fill',
        type: 'fill',
        source: 'parcels-source',
        layout: {
          visibility: parcelsVis
        },
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.15
        }
      })
    }
    if (!map.getLayer('layer-parcels-line')) {
      map.addLayer({
        id: 'layer-parcels-line',
        type: 'line',
        source: 'parcels-source',
        layout: {
          visibility: parcelsVis
        },
        paint: {
          'line-color': '#0369a1',
          'line-width': 2
        }
      })
    }

    // 3. Planning Scheme Overlays
    const overlaysVis = mapStore.isLayerVisible('layer-overlays') ? 'visible' : 'none'
    if (!map.getSource('overlays-source')) {
      map.addSource('overlays-source', {
        type: 'geojson',
        data: OVERLAYS_GEOJSON
      })
    }
    if (!map.getLayer('layer-overlays-fill')) {
      map.addLayer({
        id: 'layer-overlays-fill',
        type: 'fill',
        source: 'overlays-source',
        layout: {
          visibility: overlaysVis
        },
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.45
        }
      })
    }
    if (!map.getLayer('layer-overlays-line')) {
      map.addLayer({
        id: 'layer-overlays-line',
        type: 'line',
        source: 'overlays-source',
        layout: {
          visibility: overlaysVis
        },
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      })
    }

    // 4. Municipal Boundaries (LGA)
    const lgaVis = mapStore.isLayerVisible('layer-lga') ? 'visible' : 'none'
    if (!map.getSource('lga-source')) {
      map.addSource('lga-source', {
        type: 'geojson',
        data: LGA_BOUNDARIES_GEOJSON
      })
    }
    if (!map.getLayer('layer-lga-line')) {
      map.addLayer({
        id: 'layer-lga-line',
        type: 'line',
        source: 'lga-source',
        layout: {
          visibility: lgaVis
        },
        paint: {
          'line-color': '#64748b',
          'line-width': 2.5,
          'line-dasharray': [4, 2]
        }
      })
    }

    // 5. Selected / Current Feature Highlight Layer
    setupSelectionHighlightLayers()

    // 6. 3D Architectural Buildings Extrusion
    const b3dVis = mapStore.isLayerVisible('layer-buildings-3d') ? 'visible' : 'none'
    if (!map.getSource('buildings-3d-source')) {
      map.addSource('buildings-3d-source', {
        type: 'geojson',
        data: BUILDINGS_3D_GEOJSON
      })
    }
    if (!map.getLayer('layer-3d-buildings')) {
      map.addLayer({
        id: 'layer-3d-buildings',
        type: 'fill-extrusion',
        source: 'buildings-3d-source',
        layout: {
          visibility: b3dVis
        },
        paint: {
          'fill-extrusion-color': '#94a3b8',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.8
        }
      })
    }

    // 7. Public Transport Vector Tiles (Demonstrates MVT with Identify-only capability)
    const transportVis = mapStore.isLayerVisible('layer-transport') ? 'visible' : 'none'
    if (!map.getSource('transport-mvt-source')) {
      map.addSource('transport-mvt-source', {
        type: 'vector',
        tiles: ['https://basemaps.cartocdn.com/vectortiles/carto.streets/v1/{z}/{x}/{y}.mvt']
      })
    }
    if (!map.getLayer('layer-transport-line')) {
      map.addLayer({
        id: 'layer-transport-line',
        type: 'line',
        source: 'transport-mvt-source',
        'source-layer': 'transportation',
        layout: {
          visibility: transportVis
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 2
        }
      })
    }
  }

  function setupServiceLayers() {
    if (!map || !map.getStyle()) return

    const beforeId = map.getLayer('selected-parcel-casing')
      ? 'selected-parcel-casing'
      : map.getLayer('buffer-fill')
        ? 'buffer-fill'
        : undefined

    // 1. Group ArcGIS MapServer Dynamic Export layers by service / MapServer base URL
    const esriExportGroups = new Map<
      string,
      { baseUrl: string; serviceId?: string; layers: (typeof mapStore.layers)[number][] }
    >()
    const otherLayers: (typeof mapStore.layers)[number][] = []

    for (const layer of mapStore.layers) {
      if (!layer.render) continue

      if (layer.render.type === 'esri_export') {
        const rawUrl = layer.render.url || layer.url
        if (!rawUrl) continue
        const baseUrl = rawUrl.replace(/\/(export|\d+)\/?$/, '').replace(/\/+$/, '')
        const groupKey = layer.serviceId || baseUrl

        const existing = esriExportGroups.get(groupKey) || {
          baseUrl,
          serviceId: layer.serviceId,
          layers: []
        }
        existing.layers.push(layer)
        esriExportGroups.set(groupKey, existing)
      } else {
        otherLayers.push(layer)
      }
    }

    // Process merged Esri MapServer dynamic export groups
    for (const [groupKey, group] of esriExportGroups.entries()) {
      const sourceId = `src-esri-${groupKey}`
      const layerId = `layer-esri-${groupKey}`

      // Clean up legacy unmerged sublayer sources/layers if they exist
      for (const l of group.layers) {
        if (map.getLayer(l.id)) map.removeLayer(l.id)
        if (map.getSource(`src-${l.id}`)) map.removeSource(`src-${l.id}`)
      }

      // Check which sublayers are currently enabled AND visible
      const service = group.serviceId ? mapStore.services.find((s) => s.id === group.serviceId) : null
      const isServiceActive = service ? service.enabled !== false && service.visible !== false : true
      const visibleLayers = isServiceActive
        ? group.layers.filter((l) => l.enabled !== false && l.visible)
        : []

      if (visibleLayers.length > 0) {
        // Collect and sort unique sublayer IDs
        const sublayerIds: number[] = visibleLayers
          .map((l) => {
            if (l.serviceLayerId !== undefined) return Number(l.serviceLayerId)
            if (l.render?.sublayers && l.render.sublayers.length > 0) return Number(l.render.sublayers[0])
            const match = (l.url || '').match(/\/MapServer\/(\d+)/i)
            return match ? parseInt(match[1], 10) : 0
          })
          .filter((id, index, self) => self.indexOf(id) === index)
          .sort((a, b) => a - b)

        const layersParam = `show:${sublayerIds.join(',')}`
        // 512x512 tile size for crisp rendering and 4x fewer network requests
        const tileUrl = `${group.baseUrl}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&dpi=96&format=png32&transparent=true&f=image&layers=${layersParam}`

        const opacity =
          service?.opacity ?? Math.max(...visibleLayers.map((l) => l.opacity ?? 0.85))

        const existingSource = map.getSource(sourceId) as maplibregl.RasterTileSource | undefined
        if (!existingSource) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 512,
            minzoom: 0,
            maxzoom: 22
          })
        } else if ((existingSource as any).tiles?.[0] !== tileUrl) {
          existingSource.setTiles([tileUrl])
        }

        if (!map.getLayer(layerId)) {
          map.addLayer(
            {
              id: layerId,
              type: 'raster',
              source: sourceId,
              paint: {
                'raster-opacity': opacity
              },
              layout: {
                visibility: 'visible'
              }
            },
            beforeId
          )
        } else {
          map.setLayoutProperty(layerId, 'visibility', 'visible')
          map.setPaintProperty(layerId, 'raster-opacity', opacity)
        }
      } else {
        // No sublayers active in this service - hide the merged layer
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none')
        }
      }
    }

    // Process non-esri_export layers (esri_tile, wms, wmts, vector_tile)
    for (const layer of otherLayers) {
      if (!layer.render) continue
      const render = layer.render
      const sourceId = `src-${layer.id}`

      // 2. ArcGIS Cached Tile Service (esri_tile)
      if (render.type === 'esri_tile') {
        const rawUrl = render.url || layer.url
        if (!rawUrl) continue
        const tileUrl = rawUrl.includes('{z}')
          ? rawUrl
          : `${rawUrl.replace(/\/+$/, '')}/tile/{z}/{y}/{x}`

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 512,
            minzoom: render.minzoom ?? 0,
            maxzoom: render.maxzoom ?? 22
          })
        }

        if (!map.getLayer(layer.id)) {
          map.addLayer(
            {
              id: layer.id,
              type: 'raster',
              source: sourceId,
              paint: {
                'raster-opacity': layer.opacity ?? 0.8
              },
              layout: {
                visibility: layer.enabled !== false && layer.visible ? 'visible' : 'none'
              }
            },
            beforeId
          )
        } else {
          map.setLayoutProperty(
            layer.id,
            'visibility',
            layer.enabled !== false && layer.visible ? 'visible' : 'none'
          )
          map.setPaintProperty(layer.id, 'raster-opacity', layer.opacity ?? 0.8)
        }
      }
      // 3. Standard WMS
      else if (render.type === 'wms') {
        const rawUrl = render.url || layer.url
        if (!rawUrl) continue

        const wmsLayers = render.layers
          ? Array.isArray(render.layers)
            ? render.layers.join(',')
            : render.layers
          : ''
        const delim = rawUrl.includes('?') ? '&' : '?'
        const tileUrl = `${rawUrl}${delim}service=WMS&request=GetMap&layers=${encodeURIComponent(wmsLayers)}&styles=&format=image/png&transparent=true&version=1.3.0&width=512&height=512&crs=EPSG:3857&bbox={bbox-epsg-3857}`

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 512,
            minzoom: render.minzoom ?? 0,
            maxzoom: render.maxzoom ?? 22
          })
        }

        if (!map.getLayer(layer.id)) {
          map.addLayer(
            {
              id: layer.id,
              type: 'raster',
              source: sourceId,
              paint: {
                'raster-opacity': layer.opacity ?? 0.8
              },
              layout: {
                visibility: layer.enabled !== false && layer.visible ? 'visible' : 'none'
              }
            },
            beforeId
          )
        } else {
          map.setLayoutProperty(
            layer.id,
            'visibility',
            layer.enabled !== false && layer.visible ? 'visible' : 'none'
          )
          map.setPaintProperty(layer.id, 'raster-opacity', layer.opacity ?? 0.8)
        }
      }
      // 4. WMTS or Raster Tile
      else if (render.type === 'wmts' || render.type === 'raster_tile') {
        const rawUrl = render.url || layer.url
        if (!rawUrl) continue

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [rawUrl],
            tileSize: 512,
            minzoom: render.minzoom ?? 0,
            maxzoom: render.maxzoom ?? 22
          })
        }

        if (!map.getLayer(layer.id)) {
          map.addLayer(
            {
              id: layer.id,
              type: 'raster',
              source: sourceId,
              paint: {
                'raster-opacity': layer.opacity ?? 0.8
              },
              layout: {
                visibility: layer.enabled !== false && layer.visible ? 'visible' : 'none'
              }
            },
            beforeId
          )
        } else {
          map.setLayoutProperty(
            layer.id,
            'visibility',
            layer.enabled !== false && layer.visible ? 'visible' : 'none'
          )
          map.setPaintProperty(layer.id, 'raster-opacity', layer.opacity ?? 0.8)
        }
      }
      // 5. Vector Tile
      else if (render.type === 'vector_tile') {
        const rawUrl = render.url || layer.url
        if (!rawUrl) continue

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'vector',
            tiles: [rawUrl]
          })
        }

        if (!map.getLayer(layer.id)) {
          if (layer.geometryType === 'polygon') {
            map.addLayer(
              {
                id: layer.id,
                type: 'fill',
                source: sourceId,
                'source-layer': render.source_layer || layer.id,
                paint: {
                  'fill-color': layer.color || '#0284c7',
                  'fill-opacity': (layer.opacity ?? 0.8) * 0.4
                },
                layout: {
                  visibility: layer.enabled !== false && layer.visible ? 'visible' : 'none'
                }
              },
              beforeId
            )
          } else {
            map.addLayer(
              {
                id: layer.id,
                type: 'line',
                source: sourceId,
                'source-layer': render.source_layer || layer.id,
                paint: {
                  'line-color': layer.color || '#0284c7',
                  'line-width': 2,
                  'line-opacity': layer.opacity ?? 0.8
                },
                layout: {
                  visibility: layer.enabled !== false && layer.visible ? 'visible' : 'none'
                }
              },
              beforeId
            )
          }
        }
      }
    }
  }

  function syncAllActiveData() {
    if (!map || !map.getStyle()) return

    // 1. Re-sync selection highlight for currently identified/selected feature
    const feat = mapStore.currentHighlightedFeature
    const selectedSrc = map.getSource('selected-parcel-source') as maplibregl.GeoJSONSource
    if (selectedSrc) {
      selectedSrc.setData({
        type: 'FeatureCollection',
        features: feat?.geometry
          ? [
              {
                type: 'Feature',
                properties: { id: feat.id, ...(feat.properties || {}) },
                geometry: feat.geometry
              }
            ]
          : []
      })
      ensureSelectionLayersOnTop()
    }

    // 2. Re-sync buffer
    const buf = mapStore.bufferState
    const bufSrc = map.getSource('buffer-source') as maplibregl.GeoJSONSource
    if (bufSrc) {
      bufSrc.setData({
        type: 'FeatureCollection',
        features: buf.active && buf.geometry
          ? [
              {
                type: 'Feature',
                properties: { radius: buf.radiusMeters },
                geometry: buf.geometry
              }
            ]
          : []
      })
    }

    // 3. Re-sync measurement
    updateMeasurementData()
  }

  function reapplyAllLayers() {
    if (!map || !map.getStyle()) return
    setupOperationalLayers()
    setupServiceLayers()
    setupMeasurementLayers()
    setupBufferLayer()
    setupQueryResultsLayers()
    setupSelectionHighlightLayers()
    ensureSelectionLayersOnTop()
    syncAllActiveData()
    mapStore.syncAllOperationalLayers()
  }

  function setupSelectionHighlightLayers() {
    if (!map || !map.getStyle()) return

    if (!map.getSource('selected-parcel-source')) {
      map.addSource('selected-parcel-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
    }

    if (!map.getLayer('selected-parcel-fill')) {
      map.addLayer({
        id: 'selected-parcel-fill',
        type: 'fill',
        source: 'selected-parcel-source',
        filter: ['in', '$type', 'Polygon'],
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.22
        }
      })
    }

    // Outer casing halo for sharp visibility on any background
    if (!map.getLayer('selected-parcel-casing')) {
      map.addLayer({
        id: 'selected-parcel-casing',
        type: 'line',
        source: 'selected-parcel-source',
        filter: ['in', '$type', 'Polygon', 'LineString'],
        paint: {
          'line-color': '#ffffff',
          'line-width': 5.5,
          'line-opacity': 0.9
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        }
      })
    }

    // High-contrast primary outline
    if (!map.getLayer('selected-parcel-outline')) {
      map.addLayer({
        id: 'selected-parcel-outline',
        type: 'line',
        source: 'selected-parcel-source',
        filter: ['in', '$type', 'Polygon', 'LineString'],
        paint: {
          'line-color': '#0284c7',
          'line-width': 3.5
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        }
      })
    }

    // Point highlight for point geometries
    if (!map.getLayer('selected-parcel-point')) {
      map.addLayer({
        id: 'selected-parcel-point',
        type: 'circle',
        source: 'selected-parcel-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#0284c7',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      })
    }
  }

  function ensureSelectionLayersOnTop() {
    if (!map || !map.getStyle()) return
    const ids = [
      'selected-parcel-fill',
      'selected-parcel-casing',
      'selected-parcel-outline',
      'selected-parcel-point'
    ]
    for (const id of ids) {
      if (map.getLayer(id)) {
        map.moveLayer(id)
      }
    }
  }

  function setupBufferLayer() {
    if (!map || !map.getStyle()) return
    if (!map.getSource('buffer-source')) {
      map.addSource('buffer-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
    }
    if (!map.getLayer('buffer-fill')) {
      map.addLayer({
        id: 'buffer-fill',
        type: 'fill',
        source: 'buffer-source',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.16
        }
      })
    }
    if (!map.getLayer('buffer-line')) {
      map.addLayer({
        id: 'buffer-line',
        type: 'line',
        source: 'buffer-source',
        paint: {
          'line-color': '#0284c7',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      })
    }
  }

  function setupMeasurementLayers() {
    if (!map || !map.getStyle()) return

    if (!map.getSource('measure-source')) {
      map.addSource('measure-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
    }

    if (!map.getLayer('measure-polygon-fill')) {
      map.addLayer({
        id: 'measure-polygon-fill',
        type: 'fill',
        source: 'measure-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#ec4899',
          'fill-opacity': [
            'case',
            ['==', ['get', 'preview'], true],
            0.15,
            0.28
          ]
        }
      })
    }

    // Solid line for confirmed edges
    if (!map.getLayer('measure-line')) {
      map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure-source',
        filter: ['all', ['in', '$type', 'LineString', 'Polygon'], ['!=', 'preview', true]],
        paint: {
          'line-color': '#db2777',
          'line-width': 2.5
        }
      })
    }

    // Dashed helper line for cursor rubberband preview
    if (!map.getLayer('measure-preview-line')) {
      map.addLayer({
        id: 'measure-preview-line',
        type: 'line',
        source: 'measure-source',
        filter: ['all', ['in', '$type', 'LineString', 'Polygon'], ['==', 'preview', true]],
        paint: {
          'line-color': '#ec4899',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      })
    }

    // Point vertices
    if (!map.getLayer('measure-points')) {
      map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'measure-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'preview'], true],
            4,
            5.5
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'preview'], true],
            '#f472b6',
            '#be185d'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })
    }
  }

  function setupQueryResultsLayers() {
    if (!map || !map.getStyle()) return

    if (!map.getSource('query-results-source')) {
      map.addSource('query-results-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
    }

    if (!map.getLayer('query-results-fill')) {
      map.addLayer({
        id: 'query-results-fill',
        type: 'fill',
        source: 'query-results-source',
        filter: ['in', '$type', 'Polygon'],
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.35
        }
      })
    }

    if (!map.getLayer('query-results-line')) {
      map.addLayer({
        id: 'query-results-line',
        type: 'line',
        source: 'query-results-source',
        paint: {
          'line-color': '#0891b2',
          'line-width': 2.5,
          'line-dasharray': [4, 2]
        }
      })
    }

    if (!map.getLayer('query-results-circle')) {
      map.addLayer({
        id: 'query-results-circle',
        type: 'circle',
        source: 'query-results-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#06b6d4',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })
    }
  }

  // Synchronize dynamic service layers when layers or services change
  $effect(() => {
    const layers = mapStore.layers
    const services = mapStore.services
    if (!map || !map.getStyle()) return
    setupServiceLayers()
    for (const l of layers) {
      mapStore.updateMapLayerVisibility(l)
      mapStore.updateMapLayerOpacity(l)
    }
  })

  // Update selection highlight when currentHighlightedFeature changes
  $effect(() => {
    const feat = mapStore.currentHighlightedFeature
    if (!map || !map.getStyle()) return
    const src = map.getSource('selected-parcel-source') as maplibregl.GeoJSONSource
    if (!src) return

    if (feat && feat.geometry) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: feat.id, ...(feat.properties || {}) },
            geometry: feat.geometry
          }
        ]
      })
      ensureSelectionLayersOnTop()
    } else {
      src.setData({
        type: 'FeatureCollection',
        features: []
      })
    }
  })

  // Update query results highlight layer & fit bounds
  $effect(() => {
    const qr = mapStore.queryResults
    if (!map || !map.getStyle()) return
    const src = map.getSource('query-results-source') as maplibregl.GeoJSONSource
    if (!src) return

    if (qr && qr.features.length > 0) {
      src.setData({
        type: 'FeatureCollection',
        features: qr.features.map((f) => ({
          type: 'Feature',
          id: f.id,
          properties: f.properties,
          geometry: f.geometry
        }))
      })

      // Calculate bounding box and fit bounds to zoom into results
      let minx = 180, miny = 90, maxx = -180, maxy = -90
      let hasValidCoords = false

      const processCoord = (lng: number, lat: number) => {
        if (!isNaN(lng) && !isNaN(lat)) {
          minx = Math.min(minx, lng)
          maxx = Math.max(maxx, lng)
          miny = Math.min(miny, lat)
          maxy = Math.max(maxy, lat)
          hasValidCoords = true
        }
      }

      for (const feat of qr.features) {
        if (!feat.geometry) continue
        if (feat.geometry.type === 'Polygon') {
          for (const ring of feat.geometry.coordinates) {
            for (const pt of ring) processCoord(pt[0], pt[1])
          }
        } else if (feat.geometry.type === 'MultiPolygon') {
          for (const poly of feat.geometry.coordinates) {
            for (const ring of poly) {
              for (const pt of ring) processCoord(pt[0], pt[1])
            }
          }
        } else if (feat.geometry.type === 'Point') {
          processCoord(feat.geometry.coordinates[0], feat.geometry.coordinates[1])
        }
      }

      if (hasValidCoords && minx < maxx && miny < maxy) {
        const fitPad = mapStore.isMobile
          ? {
              top: 70,
              bottom: mapStore.mobileSheetState !== 'closed' ? 240 : 80,
              left: 20,
              right: 20
            }
          : { top: 60, bottom: 60, left: untrack(() => padLeft) + 40, right: 60 }

        map.fitBounds(
          [
            [minx, miny],
            [maxx, maxy]
          ],
          {
            padding: fitPad,
            maxZoom: 17,
            duration: 1000
          }
        )
      }
    } else {
      src.setData({
        type: 'FeatureCollection',
        features: []
      })
    }
  })

  // Update buffer ring when bufferState changes
  $effect(() => {
    const buf = mapStore.bufferState
    if (!map || !map.getStyle()) return
    const src = map.getSource('buffer-source') as maplibregl.GeoJSONSource
    if (!src) return

    if (buf.active && buf.geometry) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { radius: buf.radiusMeters },
            geometry: buf.geometry
          }
        ]
      })
    } else {
      src.setData({
        type: 'FeatureCollection',
        features: []
      })
    }
  })

  function updateMeasurementData(cursor?: [number, number]) {
    if (!map || !map.getStyle()) return
    const src = map.getSource('measure-source') as maplibregl.GeoJSONSource
    if (!src) return

    const m = mapStore.measurement
    const features: any[] = []

    if (m.points.length > 0) {
      // Confirmed point vertices
      m.points.forEach((pt, idx) => {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: { index: idx, preview: false }
        })
      })

      const cur = !m.isFinished && cursor ? cursor : null

      if (m.type === 'distance') {
        if (m.points.length >= 2) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: m.points },
            properties: { preview: false }
          })
        }
        if (cur) {
          const lastPt = m.points[m.points.length - 1]
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [lastPt, cur] },
            properties: { preview: true }
          })
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: cur },
            properties: { preview: true }
          })
        }
      } else if (m.type === 'area') {
        if (m.isFinished) {
          if (m.points.length >= 3) {
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[...m.points, m.points[0]]]
              },
              properties: { preview: false }
            })
            features.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [...m.points, m.points[0]]
              },
              properties: { preview: false }
            })
          }
        } else {
          // Dynamic drawing mode
          if (m.points.length === 1 && cur) {
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [m.points[0], cur] },
              properties: { preview: true }
            })
          } else if (m.points.length === 2) {
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: m.points },
              properties: { preview: false }
            })
            if (cur) {
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[m.points[0], m.points[1], cur, m.points[0]]]
                },
                properties: { preview: true }
              })
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [m.points[1], cur, m.points[0]]
                },
                properties: { preview: true }
              })
            }
          } else if (m.points.length >= 3) {
            if (cur) {
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[...m.points, cur, m.points[0]]]
                },
                properties: { preview: true }
              })
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: m.points
                },
                properties: { preview: false }
              })
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [m.points[m.points.length - 1], cur, m.points[0]]
                },
                properties: { preview: true }
              })
            } else {
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[...m.points, m.points[0]]]
                },
                properties: { preview: false }
              })
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [...m.points, m.points[0]]
                },
                properties: { preview: false }
              })
            }
          }
          if (cur) {
            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: cur },
              properties: { preview: true }
            })
          }
        }
      }
    }

    src.setData({
      type: 'FeatureCollection',
      features
    })
  }

  // Keep double-click zoom disabled during measurement
  $effect(() => {
    if (!map) return
    const isMeasuring = mapStore.measurement.type && !mapStore.measurement.isFinished
    if (isMeasuring) {
      map.doubleClickZoom.disable()
    } else {
      map.doubleClickZoom.enable()
    }
  })

  // Update measurement layers when measurement state changes
  $effect(() => {
    const m = mapStore.measurement
    updateMeasurementData(
      m.type && !m.isFinished && m.points.length > 0 && mapStore.cursorCoordinates
        ? mapStore.cursorCoordinates
        : undefined
    )

    if (mapContainer && map) {
      map.getCanvas().style.cursor =
        m.type && !m.isFinished ? 'crosshair' : (mapStore.activeMarkupTool || mapStore.activeQueryTool) ? 'crosshair' : ''
    }
  })

</script>

<div
  class="map-wrapper"
  class:mobile-mode={mapStore.isMobile}
  class:sheet-open={mapStore.isMobile && mapStore.mobileSheetState !== 'closed'}
  style="--pad-left: {padLeft}px;"
>
  <div bind:this={mapContainer} class="map-container"></div>

  <!-- Print Framing Box Overlay (Active when user has framing active in Print module OR hovering on map print button) -->
  {#if mapStore.isPrintPreviewActive}
    <div
      class="print-frame-overlay"
      style="--aspect-ratio: {mapStore.printAspectRatio};"
    >
      <div class="print-frame-box">
        <div class="print-frame-crosshair"></div>
        <div class="print-frame-tag">
          {mapStore.printSettings.paperSize.toUpperCase()} {mapStore.printSettings.orientation}
        </div>
      </div>
    </div>
  {/if}

  <!-- Interactive Identify Popup Pane -->
  <IdentifyPopup />

  <!-- Floating Map Navigation Tools -->
  <div
    class="map-tools-floating"
    class:compact-layout={mapStore.settings.layout === 'compact' && !mapStore.isMobile}
    class:mobile-layout={mapStore.isMobile}
    class:sheet-half={mapStore.isMobile && mapStore.mobileSheetState === 'half'}
    class:sheet-full={mapStore.isMobile && mapStore.mobileSheetState === 'full'}
  >
    <button class="map-btn" onclick={() => mapStore.zoomIn()} aria-label="Zoom in" title="Zoom in">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    <button class="map-btn" onclick={() => mapStore.zoomOut()} aria-label="Zoom out" title="Zoom out">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    <button class="map-btn" onclick={() => mapStore.resetBearing()} aria-label="Reset North orientation" title="Reset North orientation">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
      </svg>
    </button>
    <button class="map-btn" onclick={() => mapStore.zoomToVictoriaExtent()} aria-label="Zoom to Victoria statewide extent" title="Zoom to Victoria statewide extent">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </button>
    <button
      type="button"
      class="map-btn"
      class:loading={mapStore.isQuickPrinting}
      disabled={mapStore.isQuickPrinting}
      onclick={() => mapStore.executeQuickPrint()}
      onmouseenter={() => (mapStore.printHoverActive = true)}
      onmouseleave={() => (mapStore.printHoverActive = false)}
      aria-label={`Print map (${mapStore.printSettings.paperSize.toUpperCase()} ${mapStore.printSettings.orientation})`}
      title={`Print map (${mapStore.printSettings.paperSize.toUpperCase()} ${mapStore.printSettings.orientation} • ${mapStore.printSettings.format.toUpperCase()})`}
    >
      {#if mapStore.isQuickPrinting}
        <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
      {:else}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
      {/if}
    </button>
    <button
      class="map-btn"
      class:active={mapStore.is3dActive}
      onclick={() => mapStore.toggle3D()}
      aria-label={mapStore.is3dActive ? 'Switch to 2D view (lock rotation and tilt)' : 'Switch to 3D view (enable rotation and tilt)'}
      title={mapStore.is3dActive ? 'Switch to 2D view (lock rotation and tilt)' : 'Switch to 3D view (enable rotation and tilt)'}
    >
      <span class="btn-3d-text">{mapStore.is3dActive ? '2D' : '3D'}</span>
    </button>
  </div>

  <!-- Active Measurement Indicator banner when measuring -->
  {#if mapStore.measurement.type}
    <div class="measure-active-banner" class:mobile-layout={mapStore.isMobile}>
      <div class="measure-banner-content">
        <span class="banner-pulse" class:finished={mapStore.measurement.isFinished}></span>
        <span class="banner-text">
          {#if mapStore.measurement.isFinished}
            {mapStore.measurement.type.toUpperCase()} MEASURED
            {#if mapStore.measurement.type === 'distance'}
              : {formatDistance(mapStore.measurement.totalDistanceMeters)}
            {:else if mapStore.measurement.type === 'area'}
              : {formatArea(mapStore.measurement.totalAreaM2)}
            {/if}
          {:else}
            Measuring {mapStore.measurement.type.toUpperCase()}: Click points on map. Double-click to finish.
          {/if}
        </span>
        <div class="banner-btn-group">
          {#if !mapStore.measurement.isFinished && ((mapStore.measurement.type === 'distance' && mapStore.measurement.points.length >= 2) || (mapStore.measurement.type === 'area' && mapStore.measurement.points.length >= 3))}
            <button
              type="button"
              class="banner-finish-btn"
              onclick={() => mapStore.finishMeasurement()}
            >
              Finish
            </button>
          {/if}
          <button
            type="button"
            class="banner-finish-btn cancel"
            onclick={() => mapStore.setMeasurementMode(null)}
          >
            {mapStore.measurement.isFinished ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Active Markup Indicator banner when sketching -->
  {#if mapStore.activeMarkupTool}
    <div class="measure-active-banner" class:mobile-layout={mapStore.isMobile}>
      <div class="measure-banner-content markup">
        <span class="banner-pulse markup"></span>
        <span class="banner-text">
          {#if mapStore.activeMarkupTool === 'point'}
            Pin: Click map to place markers
          {:else if mapStore.activeMarkupTool === 'line'}
            Line: Click map to add vertices. Double-click or Enter to finish
          {:else if mapStore.activeMarkupTool === 'polygon'}
            Polygon: Click map to add corners. Double-click or close ring to finish
          {:else if mapStore.activeMarkupTool === 'rectangle'}
            Rectangle: Click and drag on map to sketch rectangle
          {:else if mapStore.activeMarkupTool === 'circle'}
            Circle: Click and drag on map to sketch circle
          {:else if mapStore.activeMarkupTool === 'freehand'}
            Freehand: Click and drag freehand to draw shape
          {:else if mapStore.activeMarkupTool === 'select'}
            Edit Mode: Click feature to select. Drag handles to reshape
          {/if}
        </span>
        <div class="banner-btn-group">
          <button
            type="button"
            class="banner-undo-btn"
            title="Undo last action (Ctrl+Z)"
            disabled={!mapStore.canUndoMarkup}
            onclick={() => mapStore.undoMarkup()}
          >
            Undo
          </button>
          <button
            type="button"
            class="banner-undo-btn"
            title="Redo action (Ctrl+Shift+Z)"
            disabled={!mapStore.canRedoMarkup}
            onclick={() => mapStore.redoMarkup()}
          >
            Redo
          </button>
          <button
            type="button"
            class="banner-finish-btn cancel"
            title="Done / Exit tool (Esc)"
            onclick={() => mapStore.setMarkupTool(null)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Floating Precision Coordinates & Zoom Pill (bottom-left, alongside scale bar) -->
  <div
    class="map-coord-pill"
    aria-hidden="true"
    title="GDA2020 / MGA Zone 55 Coordinate Readout"
  >
    <span class="coord-txt">
      {mapStore.formattedCursorCoord}
    </span>
    <span class="coord-divider">·</span>
    <span class="zoom-txt">Z{mapStore.currentZoom}</span>
  </div>
</div>

<style>
  .map-wrapper {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  .map-tools-floating {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    z-index: 30;
  }

  .map-tools-floating.compact-layout {
    top: 68px;
  }

  .map-tools-floating.mobile-layout {
    top: auto;
    bottom: calc(68px + env(safe-area-inset-bottom, 0px));
    right: 12px;
    z-index: 25;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, visibility 0.2s ease;
  }

  .map-tools-floating.mobile-layout.sheet-half {
    transform: translateY(-48vh);
  }

  .map-tools-floating.mobile-layout.sheet-full {
    transform: translateY(-48vh);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .map-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-main);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }

  .map-btn:last-child {
    border-bottom: none;
  }

  .map-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--accent-primary);
  }

  .map-btn.active {
    background-color: var(--bg-active);
    color: var(--accent-primary);
  }

  .btn-3d-text {
    font-size: 11px;
    font-weight: 800;
  }

  .measure-active-banner {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    pointer-events: auto;
    transition: top 0.2s ease;
  }

  .measure-active-banner.mobile-layout {
    top: calc(58px + env(safe-area-inset-top, 10px));
    width: calc(100% - 24px);
    max-width: 360px;
    z-index: 25;
  }

  .measure-active-banner.mobile-layout .measure-banner-content {
    justify-content: space-between;
    width: 100%;
  }

  .measure-banner-content {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: #0f172a;
    color: #ffffff;
    padding: 6px 14px;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    font-size: 12px;
    font-weight: 600;
  }

  .measure-banner-content.markup {
    background-color: #1e293b;
    border: 1px solid #38bdf8;
  }

  .banner-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #ec4899;
  }

  .banner-pulse.finished {
    background-color: #22c55e;
  }

  .banner-pulse.markup {
    background-color: #38bdf8;
  }

  .banner-finish-btn {
    background-color: #db2777;
    color: #ffffff;
    border: none;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .banner-btn-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .banner-undo-btn {
    background-color: rgba(255, 255, 255, 0.15);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.12s;
  }

  .banner-undo-btn:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.25);
  }

  .banner-undo-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .banner-finish-btn.cancel {
    background-color: #475569;
  }

  .banner-finish-btn.cancel:hover {
    background-color: #64748b;
  }

  :global(.maplibregl-ctrl-bottom-left) {
    transform: translateX(var(--pad-left, 0px));
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 25;
    pointer-events: none;
  }

  :global(.maplibregl-ctrl-bottom-left .maplibregl-ctrl) {
    pointer-events: auto;
  }

  :global(.maplibregl-ctrl-scale) {
    background-color: var(--bg-card) !important;
    color: var(--text-main) !important;
    border: 1px solid var(--border-color) !important;
    border-top: none !important;
    border-radius: 0 0 3px 3px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    font-variant-numeric: tabular-nums !important;
    padding: 2px 6px !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
    line-height: 1.2 !important;
    margin: 0 0 10px 10px !important;
  }

  .map-coord-pill {
    position: absolute;
    bottom: 10px;
    left: 115px;
    z-index: 25;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    user-select: none;
    transform: translateX(var(--pad-left, 0px));
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .coord-divider {
    opacity: 0.5;
  }

  .zoom-txt {
    font-weight: 600;
    color: var(--text-main);
  }

  :global(.map-wrapper.mobile-mode .maplibregl-ctrl-bottom-left) {
    bottom: calc(58px + env(safe-area-inset-bottom, 0px));
    left: 4px;
    transition: opacity 0.2s ease, transform 0.28s ease;
  }

  :global(.map-wrapper.mobile-mode .maplibregl-ctrl-bottom-right) {
    bottom: calc(60px + env(safe-area-inset-bottom, 0px));
    right: 52px;
    transition: opacity 0.2s ease, transform 0.28s ease;
  }

  :global(.map-wrapper.mobile-mode.sheet-open .maplibregl-ctrl-bottom-left),
  :global(.map-wrapper.mobile-mode.sheet-open .maplibregl-ctrl-bottom-right) {
    opacity: 0;
    pointer-events: none;
  }

  .map-tools-floating.mobile-layout .map-btn {
    width: 32px;
    height: 30px;
  }

  @media (max-width: 768px) {
    .map-coord-pill {
      display: none !important;
    }
  }

  /* Print Framing Box Overlay */
  .print-frame-overlay {
    position: absolute;
    left: var(--pad-left, 0px);
    top: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .print-frame-box {
    position: relative;
    width: min(85%, calc(85vh * var(--aspect-ratio, 1.414)));
    aspect-ratio: var(--aspect-ratio, 1.414);
    max-height: 85%;
    border: 2px dashed rgba(2, 132, 199, 0.8);
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.22);
    border-radius: 2px;
  }

  .print-frame-crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 16px;
    transform: translate(-50%, -50%);
  }

  .print-frame-crosshair::before,
  .print-frame-crosshair::after {
    content: '';
    position: absolute;
    background-color: rgba(2, 132, 199, 0.65);
  }

  .print-frame-crosshair::before {
    top: 0;
    bottom: 0;
    left: 7.5px;
    width: 1px;
  }

  .print-frame-crosshair::after {
    left: 0;
    right: 0;
    top: 7.5px;
    height: 1px;
  }

  .print-frame-tag {
    position: absolute;
    top: 6px;
    left: 6px;
    font-size: 10px;
    font-weight: 700;
    background-color: rgba(2, 132, 199, 0.9);
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .spin-icon {
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
