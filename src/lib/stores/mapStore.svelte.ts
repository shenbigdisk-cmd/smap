import type { Map as MapLibreMap } from 'maplibre-gl'
import type { TerraDraw } from 'terra-draw'
import { MAP_CONFIG } from '../config/map.config'
import {
  BUILDINGS_3D_GEOJSON,
  DEFAULT_BOOKMARKS,
  LGA_BOUNDARIES_GEOJSON,
  OVERLAYS_GEOJSON,
  SAMPLE_PARCELS,
  SEARCH_INDEX,
  ZONE_POLYGONS_GEOJSON
} from '../data/sampleData'
import { dataAdapterRegistry } from '../services/adapters/DataAdapterRegistry'
import type {
  AppTheme,
  BasemapId,
  BufferState,
  LayoutMode,
  MapBookmark,
  MapInteractionHandler,
  MarkupItem,
  MarkupTool,
  MeasurementState,
  MeasurementType,
  OperationalLayer,
  ParcelFeature,
  QueryResultCollection,
  SearchResult,
  ServiceDefinition,
  SurfaceMode,
  UserSettings,
  WebGISModule
} from '../types'
import { createPointBufferPolygon } from '../utils/buffer'
import {
  calculateDistanceMeters,
  calculatePathLengthMeters,
  calculatePolygonAreaM2,
  formatCoordinates
} from '../utils/geodesy'
import { updateUrlHash } from '../utils/urlState'
import { INITIAL_MODULES } from '../modules/registry'

const DEFAULT_SETTINGS: UserSettings = {
  layout: 'application',
  theme: 'light',
  unit: 'metric',
  coordFormat: 'dd',
  buildings3D: true,
  animationSpeed: 'normal'
}

class MapStore {
  // Navigation & Surface State
  sidebarOpen = $state(true)
  activeTab = $state<SurfaceMode>('workflows')
  reportModalOpen = $state(false)
  basemapMenuOpen = $state(false)
  settingsModalOpen = $state(false)

  // User Settings & Customization
  settings = $state<UserSettings>({ ...DEFAULT_SETTINGS })

  // Modular Registry
  modules = $state<WebGISModule[]>([...INITIAL_MODULES])
  toolboxSearch = $state('')
  activeToolboxModuleId = $state<string | null>('measure')

  // Map Instance & Projection State
  map = $state<MapLibreMap | null>(null)
  activeBasemapId = $state<BasemapId>('carto-light')
  cursorCoordinates = $state<[number, number]>([144.9631, -37.8136])
  currentZoom = $state<number>(14.8)
  is3dActive = $state(false)

  // Services & Operational Layers State
  services = $state<ServiceDefinition[]>([...MAP_CONFIG.services.map((s) => ({ ...s }))])
  layers = $state<OperationalLayer[]>([
    ...MAP_CONFIG.operationalLayers.map((l) => ({ ...l })),
    {
      id: 'layer-buildings-3d',
      serviceId: 'service-cadastre',
      title: '3D Building Heights (Melbourne CBD)',
      category: 'buildings',
      geometryType: 'polygon',
      visible: true,
      opacity: 0.8,
      minZoom: 14,
      color: '#94a3b8',
      type: 'fill-extrusion',
      description: 'Extruded 3D building architectural masses with height data',
      rendering: {
        format: 'geojson',
        sourceId: 'buildings-source',
        style: {
          type: 'fill-extrusion',
          paint: {
            'fill-extrusion-color': '#94a3b8',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-opacity': 0.8
          }
        }
      },
      data: {
        adapter: 'geojson-client',
        primaryKey: 'id',
        displayField: 'name'
      },
      capabilities: {
        identify: true,
        queryAttribute: false,
        querySpatial: false,
        buffer: false,
        export: false,
        table: false
      }
    }
  ])

  // Selected Features
  selectedParcel = $state<ParcelFeature | null>(null)
  hoveredParcelId = $state<string | null>(null)

  // Search State
  searchQuery = $state('')
  searchResults = $state<SearchResult[]>([])
  searchFocused = $state(false)

  // Measurement State
  measurement = $state<MeasurementState>({
    type: null,
    points: [],
    totalDistanceMeters: 0,
    totalAreaM2: 0,
    lastCoordinate: null,
    isFinished: false
  })

  get formattedCursorCoord(): string {
    if (!this.cursorCoordinates) return ''
    return formatCoordinates(this.cursorCoordinates[0], this.cursorCoordinates[1]).pillText
  }

  // Buffer State (for selected parcel)
  bufferState = $state<BufferState>({
    active: false,
    radiusMeters: 100,
    geometry: null
  })

  // Bookmarks State
  bookmarks = $state<MapBookmark[]>([...DEFAULT_BOOKMARKS])

  // Markup & Annotations State
  activeMarkupTool = $state<MarkupTool | null>(null)
  activeMarkupPoints = $state<[number, number][]>([])
  markupColor = $state('#dc2626')
  markups = $state<MarkupItem[]>([])
  terraDraw = $state<TerraDraw | null>(null)
  canUndoMarkup = $state(false)
  canRedoMarkup = $state(false)

  // Map Interaction & Guardrails Controller
  activeHandler = $state<MapInteractionHandler | null>(null)

  // Query Results State
  queryResults = $state<QueryResultCollection | null>(null)
  isQueryLoading = $state(false)

  // Mobile Layout & Responsive State
  isMobile = $state<boolean>(false)
  mobileSheetState = $state<'closed' | 'half' | 'full'>('closed')

  constructor() {
    this.initMobileDetection()
    this.initGeoJsonAdapter()
    this.loadCustomBookmarks()
    this.loadModulesOrder()
    this.loadPinnedPreferences()
    this.loadSettings()
    this.loadToolboxPreference()
  }

  private initGeoJsonAdapter() {
    dataAdapterRegistry.geoJsonAdapter.registerFeatures(
      'layer-parcels',
      SAMPLE_PARCELS.map((p) => ({
        id: p.id,
        geometry: p.geometry,
        properties: { ...p }
      }))
    )
    dataAdapterRegistry.geoJsonAdapter.registerFeatures(
      'layer-zones',
      ZONE_POLYGONS_GEOJSON.features
    )
    dataAdapterRegistry.geoJsonAdapter.registerFeatures(
      'layer-overlays',
      OVERLAYS_GEOJSON.features
    )
    dataAdapterRegistry.geoJsonAdapter.registerFeatures(
      'layer-lga',
      LGA_BOUNDARIES_GEOJSON.features
    )
    dataAdapterRegistry.geoJsonAdapter.registerFeatures(
      'layer-buildings-3d',
      BUILDINGS_3D_GEOJSON.features
    )
  }

  private initMobileDetection() {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    this.isMobile = mq.matches
    mq.addEventListener('change', (e) => {
      this.isMobile = e.matches
    })
  }

  // Set Map instance
  setMap(instance: MapLibreMap) {
    this.map = instance
    this.apply2D3DMode()
  }

  // Settings Management
  updateSettings(partial: Partial<UserSettings>) {
    this.settings = { ...this.settings, ...partial }
    this.saveSettings()

    if (partial.theme) {
      this.applyTheme(partial.theme)
    }
  }

  setLayout(layout: LayoutMode) {
    this.updateSettings({ layout })
  }

  setTheme(theme: AppTheme) {
    this.updateSettings({ theme })
  }

  applyTheme(theme: AppTheme) {
    if (typeof document === 'undefined') return
    const isDark = theme.endsWith('-dark') || theme === 'dark'

    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-color-mode', isDark ? 'dark' : 'light')

    if (isDark) {
      if (this.activeBasemapId === 'carto-light') {
        this.setBasemap('carto-dark')
      }
    } else {
      if (this.activeBasemapId === 'carto-dark') {
        this.setBasemap('carto-light')
      }
    }
  }

  private saveSettings() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem('smap_user_settings', JSON.stringify(this.settings))
  }

  private loadSettings() {
    if (typeof localStorage === 'undefined') return
    try {
      const data = localStorage.getItem('smap_user_settings')
      if (data) {
        const parsed = JSON.parse(data)
        this.settings = { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch {
      // ignore JSON errors
    }
    this.applyTheme(this.settings.theme)
  }

  // Tab & Drawer Actions
  updateExtentForSidebar(open: boolean) {
    if (!this.map) return
    const padLeft = open
      ? this.settings.layout === 'site'
        ? 390
        : this.settings.layout === 'application'
          ? 380
          : 0
      : 0
    // Smoothly ease camera extent without resizing the WebGL canvas buffer
    this.map.easeTo({
      padding: { left: padLeft, top: 0, right: 0, bottom: 0 },
      duration: 250
    })
  }

  private isHandlerMatchingTab(tab: SurfaceMode): boolean {
    if (!this.activeHandler) return true
    if (this.activeHandler.moduleId === tab) return true
    if (
      tab === 'toolbox' &&
      (this.activeHandler.moduleId === 'markup' ||
        this.activeHandler.moduleId === 'measure' ||
        this.activeHandler.moduleId === 'buffer' ||
        this.activeHandler.moduleId === this.activeToolboxModuleId)
    ) {
      return true
    }
    return false
  }

  setActiveTab(tab: SurfaceMode) {
    const wasOpen = this.sidebarOpen
    if (this.activeHandler && !this.isHandlerMatchingTab(tab)) {
      this.deactivateMapHandler()
    }
    this.activeTab = tab
    if (!wasOpen) {
      this.sidebarOpen = true
      // Keep map visually constant while panel slides out (0-250ms),
      // then once panel is fully out, smoothly recalculate camera extent.
      setTimeout(() => {
        this.updateExtentForSidebar(true)
      }, 250)
    }
  }

  toggleTab(tab: SurfaceMode) {
    const wasOpen = this.sidebarOpen
    if (this.activeTab === tab && wasOpen) {
      this.sidebarOpen = false
      this.deactivateMapHandler()
    } else {
      if (this.activeHandler && !this.isHandlerMatchingTab(tab)) {
        this.deactivateMapHandler()
      }
      this.activeTab = tab
      this.sidebarOpen = true
    }
    const nowOpen = this.sidebarOpen
    if (wasOpen !== nowOpen) {
      // Keep map visually constant while panel is moving in/out;
      // then once panel is fully finished moving, recalculate extent!
      setTimeout(() => {
        this.updateExtentForSidebar(nowOpen)
      }, 250)
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen
    const nowOpen = this.sidebarOpen
    if (!nowOpen) {
      this.deactivateMapHandler()
    }
    setTimeout(() => {
      this.updateExtentForSidebar(nowOpen)
    }, 250)
  }

  closeSidebar() {
    if (this.sidebarOpen) {
      this.sidebarOpen = false
      this.deactivateMapHandler()
      setTimeout(() => {
        this.updateExtentForSidebar(false)
      }, 250)
    }
  }

  // Map Interaction Handler Lifecycle Controller
  registerMapHandler(handler: MapInteractionHandler) {
    if (this.activeHandler && this.activeHandler.id !== handler.id) {
      try {
        this.activeHandler.onDeactivate()
      } catch (err) {
        console.error('Error during previous handler deactivation:', err)
      }
    }
    this.activeHandler = handler
    if (this.map) {
      this.map.getCanvas().style.cursor = handler.cursor || 'default'
    }
  }

  deactivateMapHandler(callerModuleId?: string) {
    if (!this.activeHandler) return
    if (callerModuleId && this.activeHandler.moduleId !== callerModuleId) return

    const handler = this.activeHandler
    this.activeHandler = null
    try {
      handler.onDeactivate()
    } catch (err) {
      console.error('Error during handler deactivation:', err)
    }
    if (this.map) {
      this.map.getCanvas().style.cursor = ''
    }
  }

  setQueryResults(results: QueryResultCollection | null) {
    this.queryResults = results
    if (results && results.features.length > 0) {
      this.activeTab = 'results'
      if (!this.sidebarOpen) {
        this.sidebarOpen = true
      }
      if (this.isMobile) {
        this.mobileSheetState = 'half'
      }
    }
  }

  clearQueryResults() {
    this.queryResults = null
  }

  // Mobile Bottom Sheet Controller
  openMobileSheet(tab?: SurfaceMode, state: 'half' | 'full' = 'half') {
    if (tab) {
      this.activeTab = tab
    }
    this.mobileSheetState = state
    this.sidebarOpen = true
  }

  closeMobileSheet() {
    this.mobileSheetState = 'closed'
    this.deactivateMapHandler()
  }

  toggleMobileSheet(tab?: SurfaceMode) {
    if (this.mobileSheetState !== 'closed' && (!tab || this.activeTab === tab)) {
      this.closeMobileSheet()
    } else {
      this.openMobileSheet(tab, 'half')
    }
  }

  // Modular Pinning & Toolbox Management
  setModulePlacement(id: string, placement: 'tab' | 'toolbox') {
    const mod = this.modules.find((m) => m.id === id)
    if (mod) {
      mod.isPinned = placement === 'tab'
      this.savePinnedPreferences()
    }
  }

  togglePinModule(id: string) {
    const mod = this.modules.find((m) => m.id === id)
    if (mod) {
      mod.isPinned = !mod.isPinned
      this.savePinnedPreferences()
    }
  }

  toggleToolboxPane(id: string) {
    const mod = this.modules.find((m) => m.id === id)
    if (mod) {
      mod.isExpandedInToolbox = !mod.isExpandedInToolbox
    }
  }

  expandAllToolbox() {
    this.modules.forEach((m) => {
      m.isExpandedInToolbox = true
    })
  }

  collapseAllToolbox() {
    this.modules.forEach((m) => {
      m.isExpandedInToolbox = false
    })
  }

  moveModule(fromIndex: number, toIndex: number) {
    if (
      fromIndex < 0 ||
      fromIndex >= this.modules.length ||
      toIndex < 0 ||
      toIndex >= this.modules.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const updated = [...this.modules]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    this.modules = updated
    this.saveModulesOrder()
  }

  resetModulesOrder() {
    const defaultIds = INITIAL_MODULES.map((m) => m.id)
    const map = new Map(this.modules.map((m) => [m.id, m]))
    const resetList: WebGISModule[] = []
    for (const id of defaultIds) {
      const mod = map.get(id)
      if (mod) resetList.push(mod)
    }
    for (const remaining of map.values()) {
      if (!resetList.some((m) => m.id === remaining.id)) {
        resetList.push(remaining)
      }
    }
    this.modules = resetList
    this.saveModulesOrder()
  }

  private saveModulesOrder() {
    if (typeof localStorage === 'undefined') return
    try {
      const order = this.modules.map((m) => m.id)
      localStorage.setItem('smap_modules_order', JSON.stringify(order))
    } catch {
      // ignore
    }
  }

  private loadModulesOrder() {
    if (typeof localStorage === 'undefined') return
    try {
      const data = localStorage.getItem('smap_modules_order')
      if (data) {
        const orderIds = JSON.parse(data) as string[]
        if (Array.isArray(orderIds)) {
          const map = new Map(this.modules.map((m) => [m.id, m]))
          const reordered: WebGISModule[] = []
          for (const id of orderIds) {
            const mod = map.get(id)
            if (mod) {
              reordered.push(mod)
              map.delete(id)
            }
          }
          for (const remaining of map.values()) {
            reordered.push(remaining)
          }
          this.modules = reordered
        }
      }
    } catch {
      // ignore
    }
  }

  setActiveToolboxModule(id: string | null) {
    this.activeToolboxModuleId = id
    if (typeof localStorage !== 'undefined') {
      try {
        if (id) {
          localStorage.setItem('smap_active_toolbox_module', id)
        } else {
          localStorage.removeItem('smap_active_toolbox_module')
        }
      } catch {
        // ignore
      }
    }
  }

  toggleToolboxModule(id: string) {
    if (this.activeToolboxModuleId === id) {
      this.setActiveToolboxModule(null)
      if (this.activeHandler && this.activeHandler.moduleId === id) {
        this.deactivateMapHandler(id)
      }
    } else {
      if (this.activeHandler && this.activeHandler.moduleId !== id) {
        this.deactivateMapHandler()
      }
      this.setActiveToolboxModule(id)
    }
  }

  private loadToolboxPreference() {
    if (typeof localStorage === 'undefined') return
    try {
      const saved = localStorage.getItem('smap_active_toolbox_module')
      if (saved) {
        this.activeToolboxModuleId = saved
      }
    } catch {
      // ignore
    }
  }

  launchModule(id: string) {
    const isToolbox = this.modules.some((m) => m.id === id && !m.isPinned)
    if (isToolbox) {
      this.setActiveToolboxModule(id)
      this.setActiveTab('toolbox')
    } else {
      this.setActiveTab(id)
    }
    this.sidebarOpen = true
    if (this.isMobile) {
      this.mobileSheetState = 'half'
    }
  }

  private savePinnedPreferences() {
    if (typeof localStorage === 'undefined') return
    const pinnedIds = this.modules.filter((m) => m.isPinned).map((m) => m.id)
    localStorage.setItem('smap_pinned_modules', JSON.stringify(pinnedIds))
  }

  private loadPinnedPreferences() {
    if (typeof localStorage === 'undefined') return
    try {
      const data = localStorage.getItem('smap_pinned_modules')
      if (data) {
        const pinnedIds = JSON.parse(data) as string[]
        if (Array.isArray(pinnedIds)) {
          this.modules.forEach((m) => {
            m.isPinned = pinnedIds.includes(m.id)
          })
        }
      }
    } catch {
      // ignore JSON errors
    }
  }

  // Basemap Switcher
  setBasemap(id: BasemapId) {
    this.activeBasemapId = id
    this.basemapMenuOpen = false
    updateUrlHash()
    if (!this.map) return

    const basemap = MAP_CONFIG.basemaps.find((b) => b.id === id)
    if (!basemap) return

    if (basemap.styleUrl) {
      this.map.setStyle(basemap.styleUrl, { diff: false })
    } else if (basemap.rasterTiles) {
      this.map.setStyle(
        {
          version: 8,
          sources: {
            'raster-tiles': {
              type: 'raster',
              tiles: basemap.rasterTiles,
              tileSize: 256,
              attribution: basemap.attribution
            }
          },
          layers: [
            {
              id: 'raster-layer',
              type: 'raster',
              source: 'raster-tiles',
              minzoom: 0,
              maxzoom: 22
            }
          ]
        },
        { diff: false }
      )
    }
  }

  // 2D / 3D Mode Toggle
  toggle3D() {
    this.is3dActive = !this.is3dActive
    this.apply2D3DMode()
  }

  apply2D3DMode() {
    if (!this.map) return

    // 3D buildings layer toggle
    const bldLayer = this.layers.find((l) => l.id === 'layer-buildings-3d')
    if (bldLayer) {
      bldLayer.visible = this.is3dActive
      this.updateMapLayerVisibility(bldLayer)
    }

    if (this.is3dActive) {
      // 3D Mode: Enable tilting and rotating (with Esri linear rotation)
      this.map.setMaxPitch(85)
      this.map.dragRotate.enable()
      this.map.touchPitch.enable()
      this.map.touchZoomRotate.enableRotation()
      this.map.keyboard.enableRotation()
      this.map.easeTo({
        pitch: 55,
        bearing: -18,
        duration: 800
      })
    } else {
      // 2D Mode: Disable tilting & rotating, lock camera strictly to nadir (pitch 0, bearing 0)
      this.map.dragRotate.disable()
      this.map.touchPitch.disable()
      this.map.touchZoomRotate.disableRotation()
      this.map.keyboard.disableRotation()
      this.map.setMaxPitch(0)
      this.map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 700
      })
    }
  }

  // Layer Visibility & Opacity
  toggleLayer(layerId: string) {
    const layer = this.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.visible = !layer.visible
      for (const s of this.services) {
        const sl = s.layers.find((l) => l.id === layerId)
        if (sl) sl.visible = layer.visible
      }
      this.updateMapLayerVisibility(layer)
    }
  }

  setLayerOpacity(layerId: string, opacity: number) {
    const layer = this.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.opacity = opacity
      for (const s of this.services) {
        const sl = s.layers.find((l) => l.id === layerId)
        if (sl) sl.opacity = opacity
      }
      this.updateMapLayerOpacity(layer)
    }
  }

  async identifyAtCoordinate(coordinate: [number, number], point: { x: number; y: number }) {
    if (!this.map) return

    // Find all currently visible layers that support identify
    const visibleIdentifyLayers = this.layers.filter(
      (l) => l.visible && l.capabilities?.identify
    )

    if (visibleIdentifyLayers.length === 0) return

    const promises = visibleIdentifyLayers.map(async (layer) => {
      try {
        const adapterName =
          layer.data?.adapter || (layer.format === 'esri-feature' ? 'esri-rest' : 'geojson-client')
        const adapter = dataAdapterRegistry.getAdapter(adapterName)
        return await adapter.identify(layer, coordinate, point, this.map)
      } catch (err) {
        console.warn(`Identify error for layer ${layer.id}:`, err)
        return []
      }
    })

    const results = (await Promise.all(promises)).flat()

    if (results.length > 0) {
      this.setQueryResults({
        layerId: 'multi-identify',
        layerTitle: `Identified Features (${results.length})`,
        timestamp: Date.now(),
        features: results,
        totalCount: results.length
      })

      // If parcel is among results, select it as primary parcel
      const parcelMatch = results.find((f) => f.layerId === 'layer-parcels')
      if (parcelMatch) {
        this.selectedParcel = SAMPLE_PARCELS.find((p) => p.id === parcelMatch.id) || null
      }
    }
  }

  updateMapLayerVisibility(layer: OperationalLayer) {
    if (!this.map) return
    const visibility = layer.visible ? 'visible' : 'none'
    const mapLayerIds = [
      layer.id,
      `${layer.id}-fill`,
      `${layer.id}-line`,
      `${layer.id}-outline`
    ]
    if (layer.id === 'layer-buildings-3d') {
      mapLayerIds.push('layer-3d-buildings')
    }
    for (const id of mapLayerIds) {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', visibility)
      }
    }
  }

  updateMapLayerOpacity(layer: OperationalLayer) {
    if (!this.map) return
    const ids = [layer.id, `${layer.id}-fill`, `${layer.id}-line`, `${layer.id}-outline`]
    if (layer.id === 'layer-buildings-3d') {
      ids.push('layer-3d-buildings')
    }
    for (const id of ids) {
      const lyr = this.map.getLayer(id)
      if (lyr) {
        const type = lyr.type
        if (type === 'fill') {
          this.map.setPaintProperty(id, 'fill-opacity', layer.opacity)
        } else if (type === 'line') {
          this.map.setPaintProperty(id, 'line-opacity', layer.opacity)
        } else if (type === 'fill-extrusion') {
          this.map.setPaintProperty(id, 'fill-extrusion-opacity', layer.opacity)
        }
      }
    }
  }

  syncAllOperationalLayers() {
    if (!this.map) return
    for (const layer of this.layers) {
      this.updateMapLayerVisibility(layer)
      this.updateMapLayerOpacity(layer)
    }
  }

  // Feature Selection
  selectParcel(parcel: ParcelFeature) {
    this.selectedParcel = parcel
    this.activeTab = 'results'
    this.sidebarOpen = true
    if (this.isMobile) {
      this.mobileSheetState = 'half'
    }
    updateUrlHash()

    const padLeft = this.isMobile
      ? 0
      : this.settings.layout === 'site'
        ? 390
        : this.settings.layout === 'application'
          ? 380
          : 0

    const padBottom = this.isMobile ? 220 : 0

    if (this.map) {
      this.map.flyTo({
        center: parcel.center,
        zoom: 17.5,
        padding: { left: padLeft, top: 0, right: 0, bottom: padBottom },
        essential: true,
        speed: 1.2
      })
    }
  }

  selectParcelById(id: string) {
    const parcel = SAMPLE_PARCELS.find((p) => p.id === id)
    if (parcel) {
      this.selectParcel(parcel)
    }
  }

  clearSelection() {
    this.selectedParcel = null
    this.clearBuffer()
    updateUrlHash()
  }

  // Spatial Buffer Tool
  setBufferRadius(radiusMeters: number) {
    if (!this.selectedParcel) return
    const polyCoords = createPointBufferPolygon(this.selectedParcel.center, radiusMeters)
    this.bufferState = {
      active: true,
      radiusMeters,
      geometry: {
        type: 'Polygon',
        coordinates: polyCoords
      }
    }
  }

  clearBuffer() {
    this.bufferState = {
      active: false,
      radiusMeters: this.bufferState.radiusMeters,
      geometry: null
    }
  }

  // Search
  handleSearchInput(query: string) {
    this.searchQuery = query
    if (!query.trim()) {
      this.searchResults = []
      return
    }

    const q = query.toLowerCase()
    this.searchResults = SEARCH_INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    ).slice(0, 8)
  }

  selectSearchResult(result: SearchResult) {
    this.searchFocused = false
    this.searchQuery = result.title

    if (result.parcelId) {
      this.selectParcelById(result.parcelId)
    } else if (this.map) {
      this.map.flyTo({
        center: result.center,
        zoom: result.zoom || 15,
        essential: true
      })
    }
  }

  // Navigation Shortcuts
  zoomToVictoriaExtent() {
    if (!this.map) return
    const padLeft = this.sidebarOpen
      ? this.settings.layout === 'site'
        ? 390
        : this.settings.layout === 'application'
          ? 380
          : 0
      : 0
    this.map.fitBounds(MAP_CONFIG.extentVictoria.bbox, {
      padding: { top: 40, bottom: 40, left: padLeft + 40, right: 40 },
      essential: true
    })
  }

  zoomIn() {
    this.map?.zoomIn()
  }

  zoomOut() {
    this.map?.zoomOut()
  }

  resetBearing() {
    this.map?.resetNorthPitch({ duration: 500 })
  }

  // Bookmarks
  flyToBookmark(bm: MapBookmark) {
    if (!this.map) return
    this.map.flyTo({
      center: bm.center,
      zoom: bm.zoom,
      pitch: bm.pitch || 0,
      bearing: bm.bearing || 0,
      essential: true
    })
  }

  addCurrentViewAsBookmark(name: string, description: string) {
    if (!this.map) return
    const center = this.map.getCenter()
    const newBm: MapBookmark = {
      id: `custom-bm-${Date.now()}`,
      name: name.trim() || 'Custom Spatial View',
      description: description.trim() || 'User saved bookmark',
      center: [center.lng, center.lat],
      zoom: parseFloat(this.map.getZoom().toFixed(1)),
      pitch: Math.round(this.map.getPitch()),
      bearing: Math.round(this.map.getBearing()),
      isCustom: true
    }
    this.bookmarks = [newBm, ...this.bookmarks]
    this.saveCustomBookmarks()
  }

  deleteCustomBookmark(id: string) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id)
    this.saveCustomBookmarks()
  }

  private saveCustomBookmarks() {
    if (typeof localStorage === 'undefined') return
    const customList = this.bookmarks.filter((b) => b.isCustom)
    localStorage.setItem('smap_custom_bookmarks', JSON.stringify(customList))
  }

  private loadCustomBookmarks() {
    if (typeof localStorage === 'undefined') return
    try {
      const data = localStorage.getItem('smap_custom_bookmarks')
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          this.bookmarks = [...parsed, ...DEFAULT_BOOKMARKS]
        }
      }
    } catch {
      // ignore JSON errors
    }
  }

  // Measurement Engine
  setMeasurementMode(type: MeasurementType | null) {
    if (this.activeMarkupTool) {
      this.activeMarkupTool = null
    }

    if (type) {
      this.measurement = {
        type,
        points: [],
        totalDistanceMeters: 0,
        totalAreaM2: 0,
        lastCoordinate: null,
        isFinished: false
      }
      this.launchModule('measure')
      this.registerMapHandler({
        id: `measure-${type}`,
        moduleId: 'measure',
        cursor: 'crosshair',
        hint:
          type === 'coordinate'
            ? 'Click anywhere on map to inspect GDA2020 coordinate.'
            : `Click map to add ${type} vertices. Double-click or Enter to finish. Esc to cancel.`,
        onClick: (coord) => {
          this.addMeasurementPoint(coord)
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape') {
            this.setMeasurementMode(null)
          } else if (e.key === 'Enter') {
            this.finishMeasurement()
          }
        },
        onDeactivate: () => {
          if (this.measurement.type === type && !this.measurement.isFinished) {
            this.measurement = {
              type: null,
              points: [],
              totalDistanceMeters: 0,
              totalAreaM2: 0,
              lastCoordinate: null,
              isFinished: false
            }
          }
        }
      })
    } else {
      this.measurement = {
        type: null,
        points: [],
        totalDistanceMeters: 0,
        totalAreaM2: 0,
        lastCoordinate: null,
        isFinished: false
      }
      this.deactivateMapHandler('measure')
    }
  }

  addMeasurementPoint(coord: [number, number]) {
    if (!this.measurement.type || this.measurement.isFinished) return

    if (this.measurement.type === 'coordinate') {
      this.measurement = {
        type: 'coordinate',
        points: [coord],
        totalDistanceMeters: 0,
        totalAreaM2: 0,
        lastCoordinate: coord,
        isFinished: true
      }
      return
    }

    if (this.measurement.points.length > 0) {
      const last = this.measurement.points[this.measurement.points.length - 1]
      if (calculateDistanceMeters(last, coord) < 0.5) {
        return
      }
    }

    const newPoints: [number, number][] = [...this.measurement.points, coord]
    const distance =
      this.measurement.type === 'area' && newPoints.length >= 3
        ? calculatePathLengthMeters([...newPoints, newPoints[0]])
        : calculatePathLengthMeters(newPoints)
    const area =
      this.measurement.type === 'area' && newPoints.length >= 3
        ? calculatePolygonAreaM2(newPoints)
        : 0

    this.measurement = {
      type: this.measurement.type,
      points: newPoints,
      totalDistanceMeters: distance,
      totalAreaM2: area,
      lastCoordinate: coord,
      isFinished: false
    }
  }

  finishMeasurement() {
    if (!this.measurement.type || this.measurement.isFinished) return

    let points = [...this.measurement.points]
    if (points.length >= 2) {
      const last = points[points.length - 1]
      const prev = points[points.length - 2]
      if (calculateDistanceMeters(last, prev) < 2) {
        points.pop()
      }
    }

    if (this.measurement.type === 'distance') {
      if (points.length < 2) return
      const distance = calculatePathLengthMeters(points)
      this.measurement = {
        ...this.measurement,
        points,
        totalDistanceMeters: distance,
        isFinished: true
      }
    } else if (this.measurement.type === 'area') {
      if (points.length < 3) return
      const distance = calculatePathLengthMeters([...points, points[0]])
      const area = calculatePolygonAreaM2(points)
      this.measurement = {
        ...this.measurement,
        points,
        totalDistanceMeters: distance,
        totalAreaM2: area,
        isFinished: true
      }
    }

    if (this.map) {
      this.map.getCanvas().style.cursor = 'default'
    }
  }

  clearMeasurement() {
    const currentType = this.measurement.type
    this.measurement = {
      type: currentType,
      points: [],
      totalDistanceMeters: 0,
      totalAreaM2: 0,
      lastCoordinate: null,
      isFinished: false
    }
    if (currentType) {
      this.setMeasurementMode(currentType)
    }
  }

  // Markup & Annotations Engine (Terra Draw)
  setTerraDraw(draw: TerraDraw | null) {
    this.terraDraw = draw
    if (draw) {
      draw.on('change', () => {
        this.syncTerraDrawSnapshot()
      })
      draw.on('finish', () => {
        this.syncTerraDrawSnapshot()
      })
      draw.on('history', () => {
        this.updateUndoRedoState()
      })
      this.syncTerraDrawSnapshot()
    } else {
      this.markups = []
      this.canUndoMarkup = false
      this.canRedoMarkup = false
    }
  }

  updateUndoRedoState() {
    if (!this.terraDraw) {
      this.canUndoMarkup = false
      this.canRedoMarkup = false
      return
    }
    this.canUndoMarkup = Boolean(this.terraDraw.canUndo?.())
    this.canRedoMarkup = Boolean(this.terraDraw.canRedo?.())
  }

  setMarkupColor(color: string) {
    this.markupColor = color
    this.applyMarkupStyles()
  }

  applyMarkupStyles() {
    if (!this.terraDraw) return
    const hexColor = (this.markupColor.startsWith('#') ? this.markupColor : '#dc2626') as `#${string}`
    try {
      this.terraDraw.setModeStyles('point', {
        pointColor: hexColor,
        pointWidth: 6,
        pointOutlineColor: '#ffffff',
        pointOutlineWidth: 2
      })
      this.terraDraw.setModeStyles('linestring', {
        lineStringColor: hexColor,
        lineStringWidth: 3
      })
      this.terraDraw.setModeStyles('polygon', {
        fillColor: hexColor,
        fillOpacity: 0.35,
        outlineColor: hexColor,
        outlineWidth: 2
      })
      this.terraDraw.setModeStyles('rectangle', {
        fillColor: hexColor,
        fillOpacity: 0.35,
        outlineColor: hexColor,
        outlineWidth: 2
      })
      this.terraDraw.setModeStyles('circle', {
        fillColor: hexColor,
        fillOpacity: 0.35,
        outlineColor: hexColor,
        outlineWidth: 2
      })
      this.terraDraw.setModeStyles('freehand', {
        fillColor: hexColor,
        fillOpacity: 0.35,
        outlineColor: hexColor,
        outlineWidth: 2
      })
    } catch (err) {
      console.warn('Failed to update TerraDraw mode styles:', err)
    }
  }

  setMarkupTool(tool: MarkupTool | null) {
    this.activeMarkupTool = tool
    this.activeMarkupPoints = []

    if (!this.terraDraw) return

    if (tool) {
      this.setMeasurementMode(null)
      this.launchModule('markup')

      const modeMap: Record<MarkupTool, string> = {
        point: 'point',
        line: 'linestring',
        polygon: 'polygon',
        rectangle: 'rectangle',
        circle: 'circle',
        freehand: 'freehand',
        select: 'select'
      }

      const targetMode = modeMap[tool]
      if (targetMode) {
        try {
          this.terraDraw.setMode(targetMode)
        } catch (e) {
          console.warn('Failed to set TerraDraw mode:', e)
        }
      }

      this.applyMarkupStyles()

      const hints: Record<MarkupTool, string> = {
        point: 'Click map to place pin markers. Esc to finish.',
        line: 'Click map to add line vertices. Double-click or Enter to finish.',
        polygon: 'Click map to place polygon vertices. Double-click or close ring to finish.',
        rectangle: 'Click and drag on map to sketch rectangle. Esc to finish.',
        circle: 'Click and drag on map to sketch circle. Esc to finish.',
        freehand: 'Click and drag freehand to draw shape. Release to finish.',
        select: 'Click any feature to select. Drag vertices or midpoints to reshape.'
      }

      this.registerMapHandler({
        id: `markup-${tool}`,
        moduleId: 'markup',
        cursor: tool === 'select' ? 'default' : 'crosshair',
        hint: hints[tool] || 'Markup active',
        onKeyDown: (e) => {
          if (e.key === 'Escape') {
            this.setMarkupTool(null)
          } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            if (e.shiftKey) {
              this.redoMarkup()
            } else {
              this.undoMarkup()
            }
          }
        },
        onDeactivate: () => {
          if (this.activeMarkupTool === tool) {
            this.activeMarkupTool = null
          }
          if (!this.activeMarkupTool && this.terraDraw && this.terraDraw.enabled) {
            try {
              this.terraDraw.setMode('static')
            } catch (e) {}
          }
        }
      })
    } else {
      if (this.terraDraw && this.terraDraw.enabled) {
        try {
          this.terraDraw.setMode('static')
        } catch (e) {}
      }
      this.deactivateMapHandler('markup')
    }
  }

  syncTerraDrawSnapshot() {
    if (!this.terraDraw) {
      this.markups = []
      this.canUndoMarkup = false
      this.canRedoMarkup = false
      return
    }

    try {
      const raw = this.terraDraw.getSnapshot() || []
      const userFeatures = raw.filter((f) => {
        const p = f.properties || {}
        if (p.midPoint || p.selectionPoint || p.coordinatePoint || p.snappingPoint) {
          return false
        }
        const mode = typeof p.mode === 'string' ? p.mode : ''
        return ['point', 'linestring', 'polygon', 'rectangle', 'circle', 'freehand'].includes(mode)
      })

      const typeMap: Record<string, MarkupTool> = {
        point: 'point',
        linestring: 'line',
        polygon: 'polygon',
        rectangle: 'rectangle',
        circle: 'circle',
        freehand: 'freehand'
      }

      this.markups = userFeatures.map((f, idx) => {
        const mode = typeof f.properties?.mode === 'string' ? f.properties.mode : 'polygon'
        const mType: MarkupTool = typeMap[mode] || 'polygon'
        const rawLabel = f.properties?.label
        const label =
          typeof rawLabel === 'string'
            ? rawLabel
            : `${mType.charAt(0).toUpperCase() + mType.slice(1)} #${idx + 1}`
        return {
          id: String(f.id),
          type: mType,
          coordinates: f.geometry.coordinates,
          color: this.markupColor,
          strokeWidth: 2,
          label
        }
      })

      this.updateUndoRedoState()
    } catch (e) {
      console.warn('Failed to sync TerraDraw snapshot:', e)
    }
  }

  undoMarkup() {
    if (!this.terraDraw) return
    try {
      this.terraDraw.undo()
      this.syncTerraDrawSnapshot()
    } catch (e) {
      console.warn('Undo error:', e)
    }
  }

  redoMarkup() {
    if (!this.terraDraw) return
    try {
      this.terraDraw.redo()
      this.syncTerraDrawSnapshot()
    } catch (e) {
      console.warn('Redo error:', e)
    }
  }

  removeMarkup(id: string) {
    if (this.terraDraw) {
      try {
        this.terraDraw.removeFeatures([id])
      } catch (e) {
        console.warn('Remove feature error:', e)
      }
    }
    this.syncTerraDrawSnapshot()
  }

  zoomToMarkup(id: string) {
    const m = this.markups.find((mk) => mk.id === id)
    if (!m || !this.map) return

    if (m.type === 'point') {
      this.map.flyTo({
        center: m.coordinates as [number, number],
        zoom: 17,
        essential: true
      })
    } else if (m.type === 'line') {
      const pts = m.coordinates as [number, number][]
      if (pts && pts.length > 0) {
        let minx = 180, miny = 90, maxx = -180, maxy = -90
        pts.forEach(([lng, lat]) => {
          minx = Math.min(minx, lng)
          maxx = Math.max(maxx, lng)
          miny = Math.min(miny, lat)
          maxy = Math.max(maxy, lat)
        })
        this.map.fitBounds(
          [[minx, miny], [maxx, maxy]],
          { padding: 80, maxZoom: 18, duration: 800 }
        )
      }
    } else {
      // Polygon, Rectangle, Circle, Freehand: ring coordinates
      const ring = (m.coordinates as [number, number][][])?.[0]
      if (ring && ring.length > 0) {
        let minx = 180, miny = 90, maxx = -180, maxy = -90
        ring.forEach(([lng, lat]) => {
          minx = Math.min(minx, lng)
          maxx = Math.max(maxx, lng)
          miny = Math.min(miny, lat)
          maxy = Math.max(maxy, lat)
        })
        this.map.fitBounds(
          [[minx, miny], [maxx, maxy]],
          { padding: 80, maxZoom: 18, duration: 800 }
        )
      }
    }
  }

  clearMarkups() {
    if (this.terraDraw) {
      try {
        this.terraDraw.clear()
      } catch (e) {
        console.warn('Clear markups error:', e)
      }
    }
    this.markups = []
    this.activeMarkupPoints = []
    this.canUndoMarkup = false
    this.canRedoMarkup = false
  }

  exportMarkupsGeoJson() {
    const raw = this.terraDraw?.getSnapshot() || []
    const userFeatures = raw.filter((f) => {
      const p = f.properties || {}
      if (p.midPoint || p.selectionPoint || p.coordinatePoint || p.snappingPoint) {
        return false
      }
      const mode = typeof p.mode === 'string' ? p.mode : ''
      return ['point', 'linestring', 'polygon', 'rectangle', 'circle', 'freehand'].includes(mode)
    })

    const geojson = {
      type: 'FeatureCollection',
      features: userFeatures.map((f, idx) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: f.id,
          mode: f.properties?.mode,
          label:
            f.properties?.label ||
            `${String(f.properties?.mode || 'Markup').toUpperCase()} #${idx + 1}`,
          color: this.markupColor
        }
      }))
    }

    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `VicPlan-Markup-${Date.now()}.geojson`
    link.click()
    URL.revokeObjectURL(url)
  }
}

export const mapStore = new MapStore()
