import type { Map as MapLibreMap } from 'maplibre-gl'
import type { TerraDraw } from 'terra-draw'
import { MAP_CONFIG } from '../config/map.config'
import {
  BUILDINGS_3D_GEOJSON,
  DEFAULT_BOOKMARKS,
  LGA_BOUNDARIES_GEOJSON,
  OVERLAYS_GEOJSON,
  PLANNING_ZONES,
  SAMPLE_PARCELS,
  SEARCH_INDEX,
  ZONE_POLYGONS_GEOJSON
} from '../data/sampleData'
import { dataAdapterRegistry } from '../services/adapters/DataAdapterRegistry'
import { legendService } from '../services/legendService'
import { localDbGet, localDbSet } from '../services/localDb'
import { persistenceEngine } from '../services/persistence'
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
  QueryResultFeature,
  SearchResult,
  ServiceDefinition,
  SurfaceMode,
  UserPrintSettings,
  UserSettings,
  ViewPlacement,
  WebGISModule,
  WebGISView
} from '../types'
import { createPointBufferPolygon } from '../utils/buffer'
import {
  calculateDistanceMeters,
  calculatePathLengthMeters,
  calculatePolygonAreaM2,
  formatCoordinates
} from '../utils/geodesy'
import { INITIAL_MODULES, INITIAL_VIEWS, moduleManager } from '../modules/registry'
import { serviceLoaderRegistry, type RawServiceConfig } from '../services/loaders'
import { executePrint, PAPER_DIMENSIONS_MM, type PrintConfig } from '../utils/printMap'

const DEFAULT_PRINT_SETTINGS: UserPrintSettings = {
  paperSize: 'a4',
  orientation: 'landscape',
  dpi: 150,
  format: 'pdf',
  showScale: true,
  showNorthArrow: true,
  showCoordinates: true,
  showLegend: true,
  dynamicLegend: true,
  showPrintFrame: true
}

const DEFAULT_SETTINGS: UserSettings = {
  layout: 'application',
  theme: 'light',
  unit: 'metric',
  coordFormat: 'dd',
  buildings3D: true,
  animationSpeed: 'normal',
  identifyDisplayMode: 'auto'
}

class MapStore {
  // Navigation & Surface State
  sidebarOpen = $state(
    persistenceEngine.get<boolean>('smap_sidebar_open', true)
  )
  activeTab = $state<SurfaceMode>('workflows')
  reportModalOpen = $state(false)
  basemapMenuOpen = $state(false)
  settingsModalOpen = $state(false)

  // User Settings & Customization
  settings = $state<UserSettings>({ ...DEFAULT_SETTINGS })

  // Modular Registry & Multi-View Architecture
  modules = $state<WebGISModule[]>([...INITIAL_MODULES])
  views = $state<WebGISView[]>([...INITIAL_VIEWS])
  sidepanelViews = $derived(this.views.filter((v) => v.placement === 'sidepanel' && v.id !== 'toolbox'))
  toolboxViews = $derived(this.views.filter((v) => v.placement === 'toolbox' && v.id !== 'toolbox'))
  toolboxSearch = $state('')
  activeToolboxModuleId = $state<string | null>(null)

  // Map Instance & Projection State
  map = $state<MapLibreMap | null>(null)
  activeBasemapId = $state<BasemapId>('carto-light')
  cursorCoordinates = $state<[number, number]>([144.9631, -37.8136])
  currentZoom = $state<number>(14.8)
  is3dActive = $state(false)

  // Services & Operational Layers State
  services = $state<ServiceDefinition[]>([...MAP_CONFIG.services.map((s) => ({ ...s }))])
  layers = $state<OperationalLayer[]>([...MAP_CONFIG.operationalLayers.map((l) => ({ ...l }))])

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

  // Dynamic Viewport & Legend Tracking
  viewportVersion = $state(0)
  dynamicLegendEnabled = $state(true)

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

  // Query Results State (Analytical Filters)
  queryResults = $state<QueryResultCollection | null>(null)
  isQueryLoading = $state(false)

  // Identify Results State (Map Click Inspection)
  identifyResults = $state<QueryResultCollection | null>(null)
  identifyCoordinate = $state<[number, number] | null>(null)
  identifyPopupOpen = $state<boolean>(false)
  popupFeatureIndex = $state<number>(0)

  // Two-Level Features Panel Navigation State
  activeFeatureSource = $state<'identify' | 'query' | null>(null)
  inspectedFeature = $state<QueryResultFeature | null>(null)
  featuresViewMode = $state<'list' | 'detail'>('list')
  resultsViewMode = $state<'cards' | 'table'>('cards')

  // Service configuration view state (replaces layer list)
  layersConfigServiceId = $state<string | null>(null)

  // Bookmark Add Mode
  isAddingBookmark = $state<boolean>(false)

  // Print settings & preview framing state
  printSettings = $state<UserPrintSettings>({ ...DEFAULT_PRINT_SETTINGS })
  printHoverActive = $state<boolean>(false)
  isQuickPrinting = $state<boolean>(false)

  get printAspectRatio(): number {
    const [pW, pH] = PAPER_DIMENSIONS_MM[this.printSettings.paperSize] || [210, 297]
    const widthMm = this.printSettings.orientation === 'landscape' ? pH : pW
    const heightMm = this.printSettings.orientation === 'landscape' ? pW : pH
    return widthMm / heightMm
  }

  get isPrintModuleActive(): boolean {
    if (this.isMobile) {
      if (this.mobileSheetState === 'closed') return false
    } else {
      if (!this.sidebarOpen) return false
    }
    if (this.activeTab === 'print' || this.activeTab === 'export') return true
    if (
      this.activeTab === 'toolbox' &&
      (this.activeToolboxModuleId === 'print' || this.activeToolboxModuleId === 'export')
    ) {
      return true
    }
    return false
  }

  get isPrintPreviewActive(): boolean {
    if (this.printHoverActive) return true
    if (!this.printSettings.showPrintFrame) return false
    return this.isPrintModuleActive
  }

  // Query module spatial drawing state
  activeQueryTool = $state<'rectangle' | 'polygon' | 'circle' | null>(null)
  querySpatialGeometry = $state<any | null>(null)
  queryFeatureId = $state<string | null>(null)

  // Responsive & User Configurable Identify Destination
  get effectiveIdentifyDisplayMode(): 'popup' | 'panel' {
    const mode = this.settings.identifyDisplayMode || 'auto'
    if (mode === 'popup') return 'popup'
    if (mode === 'panel') return 'panel'
    // 'auto' responsive behavior:
    if (this.isMobile) return 'panel'
    if (this.settings.layout === 'site') return 'panel'
    return 'popup'
  }

  get hasFeatureResults(): boolean {
    return Boolean(
      this.selectedParcel ||
      (this.queryResults && this.queryResults.features.length > 0) ||
      (this.identifyResults && this.identifyResults.features.length > 0)
    )
  }

  get activeFeatureCollection(): QueryResultCollection | null {
    if (
      this.activeFeatureSource === 'identify' &&
      this.identifyResults &&
      this.identifyResults.features.length > 0
    ) {
      return this.identifyResults
    }
    if (
      this.activeFeatureSource === 'query' &&
      this.queryResults &&
      this.queryResults.features.length > 0
    ) {
      return this.queryResults
    }
    // Smart fallbacks
    if (this.identifyResults && this.identifyResults.features.length > 0) {
      return this.identifyResults
    }
    if (this.queryResults && this.queryResults.features.length > 0) {
      return this.queryResults
    }
    return null
  }

  // Mobile Layout & Responsive State
  isMobile = $state<boolean>(false)
  mobileSheetState = $state<'closed' | 'half' | 'full'>('closed')

  constructor() {
    // Restore active module or view synchronously if in localStorage to prevent initial layout flicker
    if (typeof localStorage !== 'undefined') {
      const synModule = localStorage.getItem('smap_active_module')
      if (
        synModule &&
        (INITIAL_VIEWS.some((v) => v.id === synModule) ||
          INITIAL_MODULES.some((m) => m.id === synModule) ||
          synModule === 'toolbox')
      ) {
        this.activeTab = synModule as SurfaceMode
      }
      const synSidebar = localStorage.getItem('smap_sidebar_open')
      if (synSidebar !== null) {
        this.sidebarOpen = synSidebar === 'true'
      }
    }

    this.initMobileDetection()
    this.hydratePersistedStateSync()
    this.initGeoJsonAdapter()
    this.loadPersistedState()
    this.loadCustomBookmarks()
    this.loadModulesOrder()
    this.loadPinnedPreferences()
    this.loadViewPreferences()
    this.loadSettings()
    this.loadPrintSettings()
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

  // Query layer effective visibility (both enabled AND visible)
  isLayerVisible(layerId: string): boolean {
    const layer = this.layers.find((l) => l.id === layerId)
    if (!layer) return true
    return layer.enabled !== false && layer.visible
  }

  /**
   * Synchronously restore layer and service visibility, opacities, and basemap
   * from centralized PersistenceEngine at construction time (T=0) before any canvas mounts.
   * This guarantees MapLibre mounts only the restored layers and completely prevents
   * the visible layer flash/flicker and redundant initial tile requests.
   */
  private hydratePersistedStateSync() {
    const data = persistenceEngine.get<any>('smap_layer_states')
    if (data) {
      if (data.services) {
        for (const s of this.services) {
          if (data.services[s.id]) {
            s.visible = data.services[s.id].visible ?? s.visible
            s.opacity = data.services[s.id].opacity ?? s.opacity
            if (data.services[s.id].enabled !== undefined) {
              s.enabled = data.services[s.id].enabled
              s.status = s.enabled ? 'ready' : 'offline'
            }
          }
        }
      }
      if (data.layers) {
        for (const l of this.layers) {
          if (data.layers[l.id]) {
            l.visible = data.layers[l.id].visible ?? l.visible
            l.opacity = data.layers[l.id].opacity ?? l.opacity
            if (data.layers[l.id].enabled !== undefined) {
              l.enabled = data.layers[l.id].enabled
            }
          }
        }
      }
    }

    const savedBasemap = persistenceEngine.get<BasemapId>('smap_last_basemap')
    if (
      savedBasemap &&
      ['carto-light', 'carto-voyager', 'carto-dark', 'esri-satellite'].includes(savedBasemap)
    ) {
      this.activeBasemapId = savedBasemap
    }

    const savedSidebarOpen = persistenceEngine.get<boolean>('smap_sidebar_open')
    if (savedSidebarOpen !== undefined) {
      this.sidebarOpen = savedSidebarOpen
    }
  }

  // Set Map instance
  setMap(instance: MapLibreMap) {
    this.map = instance
    this.apply2D3DMode()
    moduleManager.initialize({
      getMap: () => this.map,
      registerMapHandler: (handler) => this.registerMapHandler(handler),
      deactivateMapHandler: (callerId) => this.deactivateMapHandler(callerId),
      store: this
    }).catch((err) => {
      console.error('Failed to initialize moduleManager:', err)
    })
  }

  // Persistence (delegated to centralized PersistenceEngine)
  saveMapExtent() {
    if (!this.map) return
    const center = this.map.getCenter()
    const extent = {
      center: [center.lng, center.lat] as [number, number],
      zoom: parseFloat(this.map.getZoom().toFixed(2)),
      pitch: parseFloat(this.map.getPitch().toFixed(1)),
      bearing: parseFloat(this.map.getBearing().toFixed(1))
    }
    persistenceEngine.set('smap_last_extent', extent, false, 300)
  }

  saveLayerStates() {
    const layerStates: Record<string, { visible: boolean; opacity: number; enabled: boolean }> = {}
    for (const l of this.layers) {
      layerStates[l.id] = { visible: l.visible, opacity: l.opacity, enabled: l.enabled !== false }
    }

    const serviceStates: Record<string, { visible: boolean; opacity: number; enabled: boolean }> = {}
    for (const s of this.services) {
      serviceStates[s.id] = { visible: s.visible, opacity: s.opacity, enabled: s.enabled !== false }
    }

    const data = { layers: layerStates, services: serviceStates }
    persistenceEngine.set('smap_layer_states', data, false, 250)
  }

  saveBasemap(id: BasemapId) {
    this.activeBasemapId = id
    persistenceEngine.set('smap_last_basemap', id, true)
  }

  async loadPersistedState() {
    // 1. Load layer & service visibility / opacity / enabled states
    try {
      const data =
        persistenceEngine.get<any>('smap_layer_states') ||
        (await localDbGet('layer_states'))

      if (data) {
        if (data.services) {
          for (const s of this.services) {
            if (data.services[s.id]) {
              s.visible = data.services[s.id].visible ?? s.visible
              s.opacity = data.services[s.id].opacity ?? s.opacity
              if (data.services[s.id].enabled !== undefined) {
                s.enabled = data.services[s.id].enabled
                s.status = s.enabled ? 'ready' : 'offline'
              }
            }
          }
        }
        if (data.layers) {
          for (const l of this.layers) {
            if (data.layers[l.id]) {
              l.visible = data.layers[l.id].visible ?? l.visible
              l.opacity = data.layers[l.id].opacity ?? l.opacity
              if (data.layers[l.id].enabled !== undefined) {
                l.enabled = data.layers[l.id].enabled
              }
            }
          }
        }
        this.syncAllOperationalLayers()
      }
    } catch (err) {
      console.warn('Error restoring layer states:', err)
    }

    // 2. Load basemap
    try {
      const savedBasemap =
        persistenceEngine.get<BasemapId>('smap_last_basemap') ||
        (await localDbGet<BasemapId>('basemap_id'))
      if (
        savedBasemap &&
        ['carto-light', 'carto-voyager', 'carto-dark', 'esri-satellite'].includes(savedBasemap)
      ) {
        this.activeBasemapId = savedBasemap
      }
    } catch (err) {
      console.warn('Error restoring basemap:', err)
    }

    // 3. Load active module & sidebar open state
    try {
      const savedSidebarOpen = persistenceEngine.get<boolean>('smap_sidebar_open')
      if (savedSidebarOpen !== undefined) {
        this.sidebarOpen = savedSidebarOpen
      }
      const savedModule =
        persistenceEngine.get<string>('smap_active_module') ||
        (await localDbGet<string>('active_module'))
      if (
        savedModule &&
        (this.views.some((v) => v.id === savedModule) ||
          this.modules.some((m) => m.id === savedModule) ||
          savedModule === 'toolbox')
      ) {
        this.activeTab = savedModule as SurfaceMode
      }
    } catch (err) {
      console.warn('Error restoring active module:', err)
    }
  }

  saveActiveModule() {
    persistenceEngine.set('smap_active_module', this.activeTab, true)
  }

  saveSidebarState() {
    persistenceEngine.set('smap_sidebar_open', this.sidebarOpen, true)
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
    persistenceEngine.set('smap_user_settings', this.settings)
  }

  private loadSettings() {
    const data = persistenceEngine.get<Partial<UserSettings>>('smap_user_settings')
    if (data) {
      this.settings = { ...DEFAULT_SETTINGS, ...data }
    }
    this.applyTheme(this.settings.theme)
  }

  private loadPrintSettings() {
    const data = persistenceEngine.get<Partial<UserPrintSettings>>('smap_print_settings')
    if (data) {
      this.printSettings = { ...DEFAULT_PRINT_SETTINGS, ...data }
    }
  }

  savePrintSettings(settings?: Partial<UserPrintSettings>) {
    if (settings) {
      this.printSettings = { ...this.printSettings, ...settings }
    }
    persistenceEngine.set('smap_print_settings', this.printSettings)
  }

  async executeQuickPrint(): Promise<void> {
    if (!this.map || this.isQuickPrinting) return
    this.isQuickPrinting = true
    try {
      const padLeft = this.sidebarOpen
        ? (this.settings.layout === 'site'
            ? 390
            : this.settings.layout === 'application'
              ? 380
              : 0)
        : 0

      const title = this.selectedParcel
        ? `VicPlan - ${this.selectedParcel.address}`
        : 'VicPlan Statewide Planning Scheme Map'

      const useDynamic = this.printSettings.dynamicLegend ?? true
      const container = this.map.getContainer()
      const viewportBox =
        padLeft > 0
          ? ([[padLeft, 0], [container.clientWidth, container.clientHeight]] as [
              [number, number],
              [number, number]
            ])
          : undefined

      const legendGroups = this.printSettings.showLegend
        ? legendService.getAllActiveLegendGroups(this.layers, this.map, !useDynamic, viewportBox)
        : undefined

      const config: PrintConfig = {
        title,
        paperSize: this.printSettings.paperSize,
        orientation: this.printSettings.orientation,
        dpi: this.printSettings.dpi,
        format: this.printSettings.format,
        showScale: this.printSettings.showScale,
        showNorthArrow: this.printSettings.showNorthArrow,
        showCoordinates: this.printSettings.showCoordinates,
        showLegend: this.printSettings.showLegend,
        dynamicLegend: useDynamic,
        legendGroups,
        padLeft
      }

      await executePrint(this.map, config)
    } catch (err) {
      console.error('Quick print failed:', err)
    } finally {
      this.isQuickPrinting = false
    }
  }

  // Tab & Drawer Actions
  updateExtentForSidebar(open: boolean) {
    if (!this.map) return
    // In application and site modes, do NOT pan or shift the camera when the panel slides in/out
    // to keep the map rock-steady and eliminate visual disruption.
    if (this.settings.layout === 'application' || this.settings.layout === 'site') {
      this.map.setPadding({ left: 0, top: 0, right: 0, bottom: 0 })
      return
    }
    this.map.setPadding({ left: 0, top: 0, right: 0, bottom: 0 })
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
    this.saveActiveModule()
    moduleManager.activateModule(tab).catch(() => {})
    if (!wasOpen) {
      this.sidebarOpen = true
      this.saveSidebarState()
      if (this.settings.layout !== 'application' && this.settings.layout !== 'site') {
        setTimeout(() => {
          this.updateExtentForSidebar(true)
        }, 250)
      }
    }
  }

  toggleTab(tab: SurfaceMode) {
    const wasOpen = this.sidebarOpen
    if (this.activeTab === tab && wasOpen) {
      this.sidebarOpen = false
      this.saveSidebarState()
      this.deactivateMapHandler()
    } else {
      if (this.activeHandler && !this.isHandlerMatchingTab(tab)) {
        this.deactivateMapHandler()
      }
      this.activeTab = tab
      this.saveActiveModule()
      this.sidebarOpen = true
      this.saveSidebarState()
    }
    const nowOpen = this.sidebarOpen
    if (wasOpen !== nowOpen && this.settings.layout !== 'application' && this.settings.layout !== 'site') {
      setTimeout(() => {
        this.updateExtentForSidebar(nowOpen)
      }, 250)
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen
    this.saveSidebarState()
    const nowOpen = this.sidebarOpen
    if (!nowOpen) {
      this.deactivateMapHandler()
    }
    if (this.settings.layout !== 'application' && this.settings.layout !== 'site') {
      setTimeout(() => {
        this.updateExtentForSidebar(nowOpen)
      }, 250)
    }
  }

  closeSidebar() {
    if (this.sidebarOpen) {
      this.sidebarOpen = false
      this.saveSidebarState()
      this.deactivateMapHandler()
      if (this.settings.layout !== 'application' && this.settings.layout !== 'site') {
        setTimeout(() => {
          this.updateExtentForSidebar(false)
        }, 250)
      }
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
      this.activeFeatureSource = 'query'
      this.featuresViewMode = 'list'
      this.inspectedFeature = null
      this.activeTab = 'results'
      if (!this.sidebarOpen) {
        this.sidebarOpen = true
        this.saveSidebarState()
      }
      if (this.isMobile) {
        this.mobileSheetState = 'half'
      }
    }
  }

  clearQueryResults() {
    this.queryResults = null
    if (this.activeFeatureSource === 'query') {
      if (this.identifyResults && this.identifyResults.features.length > 0) {
        this.activeFeatureSource = 'identify'
      } else {
        this.activeFeatureSource = null
      }
      this.featuresViewMode = 'list'
      this.inspectedFeature = null
    }
  }

  clearIdentifyResults() {
    this.identifyResults = null
    this.identifyPopupOpen = false
    this.identifyCoordinate = null
    this.popupFeatureIndex = 0
    if (this.activeFeatureSource === 'identify') {
      if (this.queryResults && this.queryResults.features.length > 0) {
        this.activeFeatureSource = 'query'
      } else {
        this.activeFeatureSource = null
      }
      this.featuresViewMode = 'list'
      this.inspectedFeature = null
    }
  }

  get currentHighlightedFeature(): QueryResultFeature | null {
    // 1. If Identify Popup is open with results, highlight the currently viewed popup feature
    if (
      this.identifyPopupOpen &&
      this.identifyResults &&
      this.identifyResults.features.length > 0
    ) {
      const idx = Math.max(0, Math.min(this.popupFeatureIndex, this.identifyResults.features.length - 1))
      return this.identifyResults.features[idx]
    }

    // 2. If inspecting a feature in Results detail view, highlight it
    if (this.featuresViewMode === 'detail' && this.inspectedFeature) {
      return this.inspectedFeature
    }

    // 3. Fallback to inspected feature if any
    if (this.inspectedFeature) {
      return this.inspectedFeature
    }

    // 4. Fallback to selected parcel if any
    if (this.selectedParcel) {
      return {
        id: this.selectedParcel.id,
        layerId: 'layer-parcels',
        layerTitle: 'Property Parcels',
        title: this.selectedParcel.address,
        subtitle: `SPI: ${this.selectedParcel.spi} | ${this.selectedParcel.lga}`,
        geometry: this.selectedParcel.geometry,
        properties: { ...this.selectedParcel }
      }
    }

    return null
  }

  inspectFeature(feature: QueryResultFeature, shouldZoom = false) {
    this.inspectedFeature = feature
    this.featuresViewMode = 'detail'

    // Check if this feature matches a sample parcel
    const parcelMatch = SAMPLE_PARCELS.find((p) => p.id === feature.id || p.spi === feature.id)
    if (parcelMatch) {
      this.selectedParcel = parcelMatch
    } else if (feature.layerId === 'layer-parcels' && feature.properties?.spi) {
      const bySpi = SAMPLE_PARCELS.find((p) => p.spi === feature.properties.spi)
      if (bySpi) this.selectedParcel = bySpi
    } else if (feature.layerId !== 'layer-parcels') {
      // Feature from a different layer (zones, overlays, etc.)
      this.selectedParcel = null
    }

    if (shouldZoom && feature.geometry) {
      this.zoomToFeatureGeometry(feature.geometry)
    }
  }

  backToFeatureList() {
    this.featuresViewMode = 'list'
    this.inspectedFeature = null
  }

  clearActiveFeatureCollection() {
    if (this.activeFeatureSource === 'identify') {
      this.clearIdentifyResults()
    } else if (this.activeFeatureSource === 'query') {
      this.clearQueryResults()
    } else {
      this.clearSelection()
    }
  }

  get inspectedFeatureIndex(): number {
    const coll = this.activeFeatureCollection
    if (!coll || !this.inspectedFeature) return -1
    return coll.features.findIndex((f) => f.id === this.inspectedFeature?.id)
  }

  get totalVisibleLayersCount(): number {
    return this.layers.filter((l) => l.visible).length
  }

  get totalActiveServicesCount(): number {
    return this.services.filter((s) => s.visible).length
  }

  openServiceConfig(serviceId: string) {
    this.layersConfigServiceId = serviceId
  }

  closeServiceConfig() {
    this.layersConfigServiceId = null
  }

  navigateInspectedFeature(direction: 'prev' | 'next') {
    const coll = this.activeFeatureCollection
    if (!coll || coll.features.length === 0) return

    let currentIndex = -1
    if (this.inspectedFeature) {
      currentIndex = coll.features.findIndex((f) => f.id === this.inspectedFeature?.id)
    }
    if (currentIndex === -1) currentIndex = 0

    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    if (newIndex >= coll.features.length) newIndex = 0
    if (newIndex < 0) newIndex = coll.features.length - 1

    // Map extent should NOT change when switching features via pager
    this.inspectFeature(coll.features[newIndex], false)
  }

  dockIdentifyToPanel() {
    this.identifyPopupOpen = false
    if (!this.identifyResults || this.identifyResults.features.length === 0) return

    this.activeFeatureSource = 'identify'
    this.activeTab = 'results'
    this.sidebarOpen = true
    this.saveSidebarState()
    if (this.isMobile) {
      this.mobileSheetState = 'half'
    }

    if (this.identifyResults.features.length === 1) {
      this.inspectFeature(this.identifyResults.features[0], false)
    } else {
      if (
        this.popupFeatureIndex >= 0 &&
        this.popupFeatureIndex < this.identifyResults.features.length
      ) {
        this.inspectFeature(this.identifyResults.features[this.popupFeatureIndex], false)
      } else {
        this.featuresViewMode = 'list'
        this.inspectedFeature = null
      }
    }
  }

  zoomToFeatureGeometry(geometry: any) {
    if (!this.map || !geometry) return

    if (geometry.type === 'Point') {
      this.map.flyTo({
        center: [geometry.coordinates[0], geometry.coordinates[1]],
        zoom: 17.5,
        essential: true,
        speed: 1.2
      })
      return
    }

    let minx = 180, miny = 90, maxx = -180, maxy = -90
    let hasCoords = false

    const proc = (lng: number, lat: number) => {
      if (!isNaN(lng) && !isNaN(lat)) {
        minx = Math.min(minx, lng)
        maxx = Math.max(maxx, lng)
        miny = Math.min(miny, lat)
        maxy = Math.max(maxy, lat)
        hasCoords = true
      }
    }

    if (geometry.type === 'Polygon') {
      for (const ring of geometry.coordinates) {
        for (const pt of ring) proc(pt[0], pt[1])
      }
    } else if (geometry.type === 'MultiPolygon') {
      for (const poly of geometry.coordinates) {
        for (const ring of poly) {
          for (const pt of ring) proc(pt[0], pt[1])
        }
      }
    } else if (geometry.type === 'LineString') {
      for (const pt of geometry.coordinates) proc(pt[0], pt[1])
    } else if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        for (const pt of line) proc(pt[0], pt[1])
      }
    }

    if (hasCoords && minx < maxx && miny < maxy) {
      const padLeft = this.isMobile
        ? 0
        : this.settings.layout === 'site'
          ? 390
          : this.settings.layout === 'application'
            ? 380
            : 0

      this.map.fitBounds(
        [
          [minx, miny],
          [maxx, maxy]
        ],
        {
          padding: { left: padLeft + 40, top: 60, right: 60, bottom: this.isMobile ? 240 : 60 },
          maxZoom: 18,
          duration: 800
        }
      )
    }
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

  // Modular Pinning & Multi-View Placement Management
  setViewPlacement(viewId: string, placement: ViewPlacement) {
    const view = this.views.find((v) => v.id === viewId)
    if (view) {
      view.placement = placement
      this.syncModulePinnedStates()
      this.saveViewPreferences()
    }
  }

  toggleViewPlacement(viewId: string) {
    const view = this.views.find((v) => v.id === viewId)
    if (view) {
      view.placement = view.placement === 'sidepanel' ? 'toolbox' : 'sidepanel'
      this.syncModulePinnedStates()
      this.saveViewPreferences()
    }
  }

  setModulePlacement(id: string, placement: 'tab' | 'toolbox') {
    const targetPlacement: ViewPlacement = placement === 'tab' ? 'sidepanel' : 'toolbox'
    // Update all views belonging to this module
    const moduleViews = this.views.filter((v) => v.moduleId === id || v.id === id)
    if (moduleViews.length > 0) {
      moduleViews.forEach((v) => {
        v.placement = targetPlacement
      })
    }
    const mod = this.modules.find((m) => m.id === id)
    if (mod) {
      mod.isPinned = placement === 'tab'
    }
    this.saveViewPreferences()
    this.savePinnedPreferences()
  }

  togglePinModule(id: string) {
    const mod = this.modules.find((m) => m.id === id)
    if (mod) {
      const nextPinned = !mod.isPinned
      this.setModulePlacement(id, nextPinned ? 'tab' : 'toolbox')
    }
  }

  moveView(fromIndex: number, toIndex: number) {
    if (
      fromIndex < 0 ||
      fromIndex >= this.views.length ||
      toIndex < 0 ||
      toIndex >= this.views.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const updated = [...this.views]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    this.views = updated
    this.saveViewPreferences()
  }

  resetViewPlacements() {
    this.views = INITIAL_VIEWS.map((v) => ({ ...v }))
    this.syncModulePinnedStates()
    persistenceEngine.remove('smap_view_placements')
    persistenceEngine.remove('smap_views_order')
  }

  private syncModulePinnedStates() {
    this.modules.forEach((mod) => {
      const hasPinnedView = this.views.some(
        (v) => (v.moduleId === mod.id || v.id === mod.id) && v.placement === 'sidepanel'
      )
      mod.isPinned = hasPinnedView
    })
  }

  private saveViewPreferences() {
    const placementMap: Record<string, ViewPlacement> = {}
    for (const v of this.views) {
      placementMap[v.id] = v.placement
    }
    persistenceEngine.set('smap_view_placements', placementMap)
    const order = this.views.map((v) => v.id)
    persistenceEngine.set('smap_views_order', order)
  }

  private loadViewPreferences() {
    // 1. Restore view order if saved
    const orderIds = persistenceEngine.get<string[]>('smap_views_order')
    if (orderIds && Array.isArray(orderIds)) {
      const map = new Map(this.views.map((v) => [v.id, v]))
      const reordered: WebGISView[] = []
      for (const id of orderIds) {
        const view = map.get(id)
        if (view) {
          reordered.push(view)
          map.delete(id)
        }
      }
      for (const remaining of map.values()) {
        reordered.push(remaining)
      }
      this.views = reordered
    }

    // 2. Restore user placements
    const placementMap = persistenceEngine.get<Record<string, ViewPlacement>>('smap_view_placements')
    if (placementMap && typeof placementMap === 'object') {
      this.views.forEach((v) => {
        if (placementMap[v.id]) {
          v.placement = placementMap[v.id]
        }
      })
    }
    this.syncModulePinnedStates()
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
    persistenceEngine.set('smap_active_toolbox_module', id, true)
  }

  toggleToolboxModule(id: string) {
    if (this.activeToolboxModuleId === id) {
      this.setActiveToolboxModule(null)
      moduleManager.deactivateModule(id).catch(() => {})
      if (this.activeHandler && this.activeHandler.moduleId === id) {
        this.deactivateMapHandler(id)
      }
    } else {
      if (this.activeHandler && this.activeHandler.moduleId !== id) {
        this.deactivateMapHandler()
      }
      this.setActiveToolboxModule(id)
      moduleManager.activateModule(id).catch(() => {})
    }
  }

  private loadToolboxPreference() {
    const saved = persistenceEngine.get<string | null>('smap_active_toolbox_module')
    if (saved !== undefined) {
      this.activeToolboxModuleId = saved
    }
  }

  launchModule(id: string) {
    const view = this.views.find((v) => v.id === id)
    if (view) {
      if (view.placement === 'toolbox') {
        this.setActiveToolboxModule(view.id)
        this.setActiveTab('toolbox')
      } else {
        this.setActiveTab(view.id)
      }
    } else {
      const isToolbox = this.modules.some((m) => m.id === id && !m.isPinned)
      if (isToolbox) {
        this.setActiveToolboxModule(id)
        this.setActiveTab('toolbox')
      } else {
        this.setActiveTab(id)
      }
    }
    this.sidebarOpen = true
    this.saveSidebarState()
    if (this.isMobile) {
      this.mobileSheetState = 'half'
    }
  }

  launchView(id: string) {
    this.launchModule(id)
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
    this.saveBasemap(id)
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
    const bldService = this.services.find((s) => s.id === 'service-buildings-3d')
    if (bldService) {
      bldService.visible = this.is3dActive
      for (const l of bldService.layers) {
        l.visible = this.is3dActive
      }
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

  // Service & Layer Visibility, Opacity & OmniLayer Enablement
  toggleServiceEnabled(serviceId: string, enabled?: boolean) {
    const srv = this.services.find((s) => s.id === serviceId)
    if (srv) {
      const nextEnabled = enabled !== undefined ? enabled : !(srv.enabled !== false)
      srv.enabled = nextEnabled
      srv.status = nextEnabled ? 'ready' : 'offline'
      if (!nextEnabled) {
        srv.visible = false
      }
      for (const layer of srv.layers) {
        layer.enabled = nextEnabled
        if (!nextEnabled) {
          layer.visible = false
        }
        const globalLayer = this.layers.find((l) => l.id === layer.id)
        if (globalLayer) {
          globalLayer.enabled = nextEnabled
          if (!nextEnabled) globalLayer.visible = false
        }
        this.updateMapLayerVisibility(layer)
      }
      this.saveLayerStates()
    }
  }

  toggleLayerEnabled(layerId: string, enabled?: boolean) {
    const layer = this.layers.find((l) => l.id === layerId)
    if (layer) {
      const nextEnabled = enabled !== undefined ? enabled : !(layer.enabled !== false)
      layer.enabled = nextEnabled
      if (!nextEnabled) {
        layer.visible = false
      }
      for (const s of this.services) {
        const sl = s.layers.find((l) => l.id === layerId)
        if (sl) {
          sl.enabled = nextEnabled
          if (!nextEnabled) sl.visible = false
        }
      }
      this.updateMapLayerVisibility(layer)
      this.saveLayerStates()
    }
  }

  async addService(configOrUrl: RawServiceConfig | string): Promise<ServiceDefinition> {
    let service: ServiceDefinition
    if (typeof configOrUrl === 'string') {
      service = await serviceLoaderRegistry.autoDiscoverService(configOrUrl)
    } else {
      service = await serviceLoaderRegistry.loadService(configOrUrl)
    }

    const existingIndex = this.services.findIndex((s) => s.id === service.id)
    if (existingIndex >= 0) {
      this.services[existingIndex] = service
    } else {
      this.services.push(service)
    }

    for (const layer of service.layers) {
      const lIdx = this.layers.findIndex((l) => l.id === layer.id)
      if (lIdx >= 0) {
        this.layers[lIdx] = layer
      } else {
        this.layers.push(layer)
      }
    }

    this.saveLayerStates()
    return service
  }

  toggleService(serviceId: string) {
    const srv = this.services.find((s) => s.id === serviceId)
    if (srv) {
      if (srv.enabled === false) {
        // Re-enable service if clicked while disabled
        this.toggleServiceEnabled(serviceId, true)
        return
      }
      srv.visible = !srv.visible
      for (const layer of srv.layers) {
        layer.visible = srv.visible
        const globalLayer = this.layers.find((l) => l.id === layer.id)
        if (globalLayer) globalLayer.visible = srv.visible
        this.updateMapLayerVisibility(layer)
      }
      this.saveLayerStates()
    }
  }

  setServiceOpacity(serviceId: string, opacity: number) {
    const srv = this.services.find((s) => s.id === serviceId)
    if (srv) {
      srv.opacity = opacity
      for (const layer of srv.layers) {
        layer.opacity = opacity
        const globalLayer = this.layers.find((l) => l.id === layer.id)
        if (globalLayer) globalLayer.opacity = opacity
        this.updateMapLayerOpacity(layer)
      }
      this.saveLayerStates()
    }
  }

  toggleLayer(layerId: string) {
    const layer = this.layers.find((l) => l.id === layerId)
    if (layer) {
      if (layer.enabled === false) {
        this.toggleLayerEnabled(layerId, true)
        return
      }
      layer.visible = !layer.visible
      for (const s of this.services) {
        const sl = s.layers.find((l) => l.id === layerId)
        if (sl) {
          sl.visible = layer.visible
          s.visible = s.layers.some((l) => l.visible)
        }
      }
      this.updateMapLayerVisibility(layer)
      this.saveLayerStates()
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
      this.saveLayerStates()
    }
  }

  async identifyAtCoordinate(coordinate: [number, number], point: { x: number; y: number }) {
    if (!this.map) return

    // Find all currently visible and enabled layers that support identify
    const visibleIdentifyLayers = this.layers.filter(
      (l) => l.enabled !== false && l.visible && (l.capabilities?.identify ?? l.operations?.includes('identify') ?? true)
    )

    if (visibleIdentifyLayers.length === 0) {
      this.identifyPopupOpen = false
      return
    }

    // Separate layers: Esri REST layers can be batched by service / MapServer
    const esriLayers: OperationalLayer[] = []
    const otherLayers: OperationalLayer[] = []

    for (const layer of visibleIdentifyLayers) {
      const adapterName =
        layer.data?.adapter ||
        (layer.feature_service?.type === 'esri_rest' || layer.format === 'esri-feature'
          ? 'esri-rest'
          : 'geojson-client')
      if (adapterName === 'esri-rest') {
        esriLayers.push(layer)
      } else {
        otherLayers.push(layer)
      }
    }

    const promises: Promise<QueryResultFeature[]>[] = []

    // 1. Batch Esri layers through EsriRestAdapter.identifyBatch (merges by MapServer into 1 call)
    if (esriLayers.length > 0) {
      const esriAdapter = dataAdapterRegistry.getAdapter('esri-rest')
      if (esriAdapter.identifyBatch) {
        promises.push(
          esriAdapter.identifyBatch(esriLayers, coordinate, point, this.map).catch((err) => {
            console.warn('Batched Esri identify error:', err)
            return []
          })
        )
      } else {
        for (const layer of esriLayers) {
          promises.push(
            esriAdapter.identify(layer, coordinate, point, this.map).catch((err) => {
              console.warn(`Identify error for layer ${layer.id}:`, err)
              return []
            })
          )
        }
      }
    }

    // 2. Query other layers individually via their respective adapters
    for (const layer of otherLayers) {
      const adapterName = layer.data?.adapter || 'geojson-client'
      const adapter = dataAdapterRegistry.getAdapter(adapterName)
      promises.push(
        adapter.identify(layer, coordinate, point, this.map).catch((err) => {
          console.warn(`Identify error for layer ${layer.id}:`, err)
          return []
        })
      )
    }

    const results = (await Promise.all(promises)).flat()

    if (results.length === 0) {
      this.clearIdentifyResults()
      this.clearSelection()
      return
    }

    const collection: QueryResultCollection = {
      layerId: 'multi-identify',
      layerTitle: `Identified Features (${results.length})`,
      timestamp: Date.now(),
      features: results,
      totalCount: results.length,
      coordinate,
      source: 'identify'
    }

    this.identifyResults = collection
    this.identifyCoordinate = coordinate
    this.popupFeatureIndex = 0

    // Check if a parcel was hit among results
    const parcelMatch = results.find((f) => f.layerId === 'layer-parcels')
    if (parcelMatch) {
      this.selectedParcel = SAMPLE_PARCELS.find((p) => p.id === parcelMatch.id) || null
    } else {
      this.selectedParcel = null
    }

    // Direct results according to effective identify destination
    if (this.effectiveIdentifyDisplayMode === 'popup') {
      this.identifyPopupOpen = true
    } else {
      this.identifyPopupOpen = false
      this.activeFeatureSource = 'identify'
      this.activeTab = 'results'
      this.sidebarOpen = true
      this.saveSidebarState()
      if (this.isMobile) {
        this.mobileSheetState = 'half'
      }

      if (results.length === 1) {
        this.inspectFeature(results[0], false)
      } else {
        this.featuresViewMode = 'list'
        this.inspectedFeature = null
      }
    }
  }

  private syncDynamicServiceLayersCallback: (() => void) | null = null

  setSyncServiceLayersCallback(cb: () => void) {
    this.syncDynamicServiceLayersCallback = cb
  }

  syncDynamicServiceLayers() {
    if (this.syncDynamicServiceLayersCallback) {
      this.syncDynamicServiceLayersCallback()
    }
  }

  updateMapLayerVisibility(layer: OperationalLayer) {
    if (!this.map) return
    const isVisible = layer.enabled !== false && layer.visible
    const visibility = isVisible ? 'visible' : 'none'
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

    // Dynamic Esri MapServer layers are merged at service level; trigger dynamic sync
    if (layer.render?.type === 'esri_export' || layer.format === 'esri-feature') {
      this.syncDynamicServiceLayers()
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
        if (type === 'raster') {
          this.map.setPaintProperty(id, 'raster-opacity', layer.opacity ?? 1)
        } else if (type === 'fill') {
          this.map.setPaintProperty(id, 'fill-opacity', layer.opacity)
        } else if (type === 'line') {
          this.map.setPaintProperty(id, 'line-opacity', layer.opacity)
        } else if (type === 'fill-extrusion') {
          this.map.setPaintProperty(id, 'fill-extrusion-opacity', layer.opacity)
        }
      }
    }

    // Dynamic Esri MapServer layers are merged at service level; trigger dynamic sync
    if (layer.render?.type === 'esri_export' || layer.format === 'esri-feature') {
      this.syncDynamicServiceLayers()
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
    this.inspectedFeature = {
      id: parcel.id,
      layerId: 'layer-parcels',
      layerTitle: 'Property Parcels',
      title: parcel.address,
      subtitle: `SPI: ${parcel.spi} | ${parcel.lga}`,
      geometry: parcel.geometry,
      properties: { ...parcel }
    }
    this.featuresViewMode = 'detail'
    this.activeTab = 'results'
    this.sidebarOpen = true
    this.saveSidebarState()
    if (this.isMobile) {
      this.mobileSheetState = 'half'
    }

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
    this.inspectedFeature = null
    this.featuresViewMode = 'list'
    this.clearBuffer()
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
    const customList = this.bookmarks.filter((b) => b.isCustom)
    persistenceEngine.set('smap_custom_bookmarks', customList)
  }

  private loadCustomBookmarks() {
    const data = persistenceEngine.get<MapBookmark[]>('smap_custom_bookmarks')
    if (data && Array.isArray(data)) {
      this.bookmarks = [...data, ...DEFAULT_BOOKMARKS]
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
        if (!this.activeQueryTool) {
          this.syncTerraDrawSnapshot()
        }
      })
      draw.on('finish', (id: any) => {
        if (this.activeQueryTool) {
          this.handleQueryDrawFinished(id)
        } else {
          this.syncTerraDrawSnapshot()
        }
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

  handleQueryDrawFinished(id: string | number) {
    if (!this.terraDraw) return
    const snapshot = this.terraDraw.getSnapshot() || []
    const feat = snapshot.find((f: any) => f.id === id) || snapshot[snapshot.length - 1]
    if (feat) {
      this.queryFeatureId = String(feat.id)
      this.querySpatialGeometry = feat.geometry
    }
    this.activeQueryTool = null
    this.deactivateMapHandler('query')
    try {
      this.terraDraw.setMode('static')
    } catch {
      // ignore
    }
  }

  setQueryDrawTool(tool: 'rectangle' | 'polygon' | 'circle' | null) {
    this.activeQueryTool = tool

    if (!this.terraDraw) return

    if (tool) {
      // Clear previous query geometry feature if exists
      if (this.queryFeatureId) {
        try {
          this.terraDraw.removeFeatures([this.queryFeatureId])
        } catch {}
        this.queryFeatureId = null
      }
      this.querySpatialGeometry = null

      this.activeMarkupTool = null
      this.setMeasurementMode(null)

      // Set distinctive query drawing style (cyan/sky blue)
      try {
        const queryColor = '#0284c7' as `#${string}`
        this.terraDraw.setModeStyles('rectangle', {
          fillColor: queryColor,
          fillOpacity: 0.22,
          outlineColor: queryColor,
          outlineWidth: 2
        })
        this.terraDraw.setModeStyles('polygon', {
          fillColor: queryColor,
          fillOpacity: 0.22,
          outlineColor: queryColor,
          outlineWidth: 2
        })
        this.terraDraw.setModeStyles('circle', {
          fillColor: queryColor,
          fillOpacity: 0.22,
          outlineColor: queryColor,
          outlineWidth: 2
        })
      } catch (err) {
        console.warn('Failed to set TerraDraw styles for query:', err)
      }

      const modeMap = {
        rectangle: 'rectangle',
        polygon: 'polygon',
        circle: 'circle'
      }

      try {
        this.terraDraw.setMode(modeMap[tool])
      } catch (e) {
        console.warn('Failed to set TerraDraw mode for query:', e)
      }

      const hints = {
        rectangle: 'Click and drag on map to sketch query bounding box. Esc to cancel.',
        polygon: 'Click map to place query polygon vertices. Double-click or close ring to finish.',
        circle: 'Click and drag on map to define query radius circle. Esc to cancel.'
      }

      this.registerMapHandler({
        id: `query-${tool}`,
        moduleId: 'query',
        cursor: 'crosshair',
        hint: hints[tool],
        onKeyDown: (e) => {
          if (e.key === 'Escape') {
            this.setQueryDrawTool(null)
          }
        },
        onDeactivate: () => {
          this.activeQueryTool = null
          if (this.terraDraw && this.terraDraw.enabled) {
            try {
              this.terraDraw.setMode('static')
            } catch {}
          }
        }
      })
    } else {
      this.deactivateMapHandler('query')
      if (this.terraDraw && this.terraDraw.enabled) {
        try {
          this.terraDraw.setMode('static')
        } catch {}
      }
    }
  }

  clearQuerySpatialGeometry() {
    if (this.queryFeatureId && this.terraDraw) {
      try {
        this.terraDraw.removeFeatures([this.queryFeatureId])
      } catch {}
    }
    this.queryFeatureId = null
    this.querySpatialGeometry = null
    this.setQueryDrawTool(null)
  }

  setQuerySpatialViewport() {
    if (!this.map || !this.terraDraw) return
    this.clearQuerySpatialGeometry()

    const bounds = this.map.getBounds()
    const minx = bounds.getWest()
    const miny = bounds.getSouth()
    const maxx = bounds.getEast()
    const maxy = bounds.getNorth()

    const id = `query-viewport-${Date.now()}`
    const geom = {
      type: 'Polygon' as const,
      coordinates: [[[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy], [minx, miny]]]
    }

    try {
      this.terraDraw.addFeatures([{
        id,
        type: 'Feature',
        geometry: geom,
        properties: { mode: 'rectangle' }
      }])
      this.queryFeatureId = id
      this.querySpatialGeometry = geom
    } catch (e) {
      console.warn('Failed to add viewport feature to TerraDraw:', e)
      this.querySpatialGeometry = geom
    }
  }

  setQuerySpatialParcel(parcel: ParcelFeature) {
    if (!this.terraDraw) return
    this.clearQuerySpatialGeometry()

    const id = `query-parcel-${Date.now()}`
    try {
      this.terraDraw.addFeatures([{
        id,
        type: 'Feature',
        geometry: parcel.geometry,
        properties: { mode: 'polygon' }
      }])
      this.queryFeatureId = id
      this.querySpatialGeometry = parcel.geometry
    } catch (e) {
      console.warn('Failed to add parcel feature to TerraDraw:', e)
      this.querySpatialGeometry = parcel.geometry
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
        if (this.queryFeatureId && f.id === this.queryFeatureId) {
          return false
        }
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
