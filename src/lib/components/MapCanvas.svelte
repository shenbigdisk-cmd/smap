<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
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
  import { formatCoordinates } from '../utils/geodesy'
  import { getInitialMapViewState, initUrlStateSync, updateUrlHash } from '../utils/urlState'

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
      pitch: mapStore.is3dActive ? 55 : 0,
      bearing: mapStore.is3dActive ? -18 : 0,
      maxPitch: mapStore.is3dActive ? 85 : 0,
      attributionControl: false,
      aroundCenter: false as any,
      dragRotate: mapStore.is3dActive as any,
      touchPitch: mapStore.is3dActive as any
    })

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
        } else if (!mapStore.measurement.type && !mapStore.activeMarkupTool) {
          const hovered = map.getLayer('layer-parcels-fill')
            ? map.queryRenderedFeatures(e.point, { layers: ['layer-parcels-fill'] })
            : []
          map.getCanvas().style.cursor = hovered.length > 0 ? 'pointer' : ''
        }
      }
    })

    map.on('moveend', () => {
      updateUrlHash()
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

      // 3. Active markup sketch mode -> TerraDraw handles it, avoid parcel identification!
      if (mapStore.activeMarkupTool) {
        return
      }

      // 4. Query parcels layer under cursor
      if (!map) return
      if (!map.getLayer('layer-parcels-fill')) return
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['layer-parcels-fill']
      })

      if (features.length > 0 && features[0].properties) {
        const id = features[0].properties.id
        mapStore.selectParcelById(id)
      }
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
  }

  function setupOperationalLayers() {
    if (!map || !map.getStyle()) return

    // 1. Planning Scheme Zones
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
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 1.5,
          'line-dasharray': [2, 1]
        }
      })
    }

    // 2. Cadastre Parcels
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
        paint: {
          'line-color': '#0369a1',
          'line-width': 2
        }
      })
    }

    // 3. Planning Scheme Overlays
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
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      })
    }

    // 4. Municipal Boundaries (LGA)
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
        paint: {
          'line-color': '#64748b',
          'line-width': 2.5,
          'line-dasharray': [4, 2]
        }
      })
    }

    // 5. Selected Parcel Highlight Layer
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
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.4
        }
      })
    }
    if (!map.getLayer('selected-parcel-outline')) {
      map.addLayer({
        id: 'selected-parcel-outline',
        type: 'line',
        source: 'selected-parcel-source',
        paint: {
          'line-color': '#d97706',
          'line-width': 3
        }
      })
    }

    // 6. 3D Architectural Buildings Extrusion
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
        paint: {
          'fill-extrusion-color': '#94a3b8',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.8
        }
      })
    }
  }

  function syncAllActiveData() {
    if (!map || !map.getStyle()) return

    // 1. Re-sync selected parcel
    const selected = mapStore.selectedParcel
    const selectedSrc = map.getSource('selected-parcel-source') as maplibregl.GeoJSONSource
    if (selectedSrc) {
      selectedSrc.setData({
        type: 'FeatureCollection',
        features: selected
          ? [
              {
                type: 'Feature',
                properties: { id: selected.id },
                geometry: selected.geometry
              }
            ]
          : []
      })
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
    const m = mapStore.measurement
    const mSrc = map.getSource('measure-source') as maplibregl.GeoJSONSource
    if (mSrc) {
      const features: any[] = []
      if (m.points.length > 0) {
        m.points.forEach((pt) => {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: pt },
            properties: {}
          })
        })
        if (m.type === 'distance' && m.points.length >= 2) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: m.points },
            properties: {}
          })
        } else if (m.type === 'area' && m.points.length >= 3) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[...m.points, m.points[0]]]
            },
            properties: {}
          })
        }
      }
      mSrc.setData({ type: 'FeatureCollection', features })
    }

  }

  function reapplyAllLayers() {
    if (!map || !map.getStyle()) return
    setupOperationalLayers()
    setupMeasurementLayers()
    setupBufferLayer()
    setupQueryResultsLayers()
    syncAllActiveData()
    mapStore.syncAllOperationalLayers()
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
          'fill-opacity': 0.25
        }
      })
    }

    if (!map.getLayer('measure-line')) {
      map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure-source',
        filter: ['in', '$type', 'LineString', 'Polygon'],
        paint: {
          'line-color': '#db2777',
          'line-width': 2.5,
          'line-dasharray': [2, 1]
        }
      })
    }

    if (!map.getLayer('measure-points')) {
      map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'measure-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#be185d',
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

  // Update selection highlight when selectedParcel changes
  $effect(() => {
    const selected = mapStore.selectedParcel
    if (!map || !map.getStyle()) return
    const src = map.getSource('selected-parcel-source') as maplibregl.GeoJSONSource
    if (!src) return

    if (selected) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: selected.id },
            geometry: selected.geometry
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
          : { top: 60, bottom: 60, left: padLeft + 40, right: 60 }

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

  // Update measurement layers when measurement state changes
  $effect(() => {
    const m = mapStore.measurement
    if (!map || !map.getStyle()) return
    const src = map.getSource('measure-source') as maplibregl.GeoJSONSource
    if (!src) return

    const features: any[] = []

    if (m.points.length > 0) {
      m.points.forEach((pt) => {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: {}
        })
      })

      if (m.type === 'distance' && m.points.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: m.points },
          properties: {}
        })
      } else if (m.type === 'area' && m.points.length >= 3) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[...m.points, m.points[0]]]
          },
          properties: {}
        })
      }
    }

    src.setData({
      type: 'FeatureCollection',
      features
    })

    if (mapContainer && map) {
      map.getCanvas().style.cursor = m.type || mapStore.activeMarkupTool ? 'crosshair' : ''
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
      class="map-btn"
      class:active={mapStore.basemapMenuOpen}
      onclick={() => (mapStore.basemapMenuOpen = !mapStore.basemapMenuOpen)}
      aria-label="Change base map"
      title="Change base map"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
      </svg>
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
        <span class="banner-pulse"></span>
        <span class="banner-text">
          Measuring {mapStore.measurement.type.toUpperCase()}: Click points on map
        </span>
        <button
          class="banner-finish-btn"
          onclick={() => mapStore.setMeasurementMode(null)}
        >
          Finish
        </button>
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
  >
    <span class="coord-txt">
      {mapStore.cursorCoordinates[1].toFixed(4)}° S, {mapStore.cursorCoordinates[0].toFixed(4)}° E
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
</style>
