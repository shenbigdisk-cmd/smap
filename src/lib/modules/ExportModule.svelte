<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import {
    exportMapToPng,
    exportEsriServiceImage,
    exportFeaturesToGeoJson,
    exportFeaturesToCsv
  } from '../utils/exportMap'
  import { executeLayerQuery } from '../services/queryAdapter'

  type ExportTab = 'map' | 'esri' | 'data'
  let activeTab = $state<ExportTab>('map')

  // Map PNG Export State
  let exportTitle = $state(
    mapStore.selectedParcel
      ? `VicPlan - ${mapStore.selectedParcel.address}`
      : 'VicPlan Statewide Planning Scheme Extent'
  )

  // Esri Direct Service Image Export State
  let esriServices = $derived(
    mapStore.services.filter(
      (s) => s.type === 'esri-rest' || (s.url && s.url.toLowerCase().includes('/mapserver'))
    )
  )
  let selectedServiceId = $state<string>('')
  $effect(() => {
    if (esriServices.length > 0 && !esriServices.some((s) => s.id === selectedServiceId)) {
      selectedServiceId = esriServices[0].id
    }
  })
  let selectedService = $derived(esriServices.find((s) => s.id === selectedServiceId))
  let esriDpi = $state<number>(150)
  let esriResolution = $state<'1080p' | '4k'>('1080p')

  // Layer Feature Data Export State
  let exportableLayers = $derived(
    mapStore.layers.filter((l) => l.capabilities?.export !== false)
  )
  let selectedDataLayerId = $state<string>('')
  $effect(() => {
    if (exportableLayers.length > 0 && !exportableLayers.some((l) => l.id === selectedDataLayerId)) {
      selectedDataLayerId = exportableLayers[0].id
    }
  })
  let selectedDataLayer = $derived(exportableLayers.find((l) => l.id === selectedDataLayerId))
  let dataFormat = $state<'geojson' | 'csv'>('geojson')

  let isExporting = $state(false)
  let exportStatus = $state<string | null>(null)

  async function handleMapExport() {
    if (!mapStore.map) return
    isExporting = true
    exportStatus = null
    try {
      await exportMapToPng(mapStore.map, exportTitle)
      exportStatus = 'Map PNG generated successfully'
    } catch (err: any) {
      exportStatus = `Export failed: ${err?.message || 'Error'}`
    } finally {
      isExporting = false
    }
  }

  async function handleEsriServiceExport() {
    if (!selectedService || !mapStore.map) return
    isExporting = true
    exportStatus = null

    try {
      const bounds = mapStore.map.getBounds()
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ]

      const visibleSublayers: number[] = selectedService.layers
        .filter((l) => l.enabled !== false && l.visible)
        .map((l) => Number(l.serviceLayerId ?? 0))

      const width = esriResolution === '4k' ? 3840 : 1920
      const height = esriResolution === '4k' ? 2160 : 1080

      await exportEsriServiceImage(selectedService.url, {
        serviceName: selectedService.name,
        sublayerIds: visibleSublayers.length > 0 ? visibleSublayers : undefined,
        bbox,
        width,
        height,
        dpi: esriDpi
      })
      exportStatus = `Esri high-res image downloaded`
    } catch (err: any) {
      exportStatus = `Esri export failed: ${err?.message || 'Error'}`
    } finally {
      isExporting = false
    }
  }

  async function handleDataExport() {
    if (!selectedDataLayer) return
    isExporting = true
    exportStatus = null

    try {
      const bounds = mapStore.map?.getBounds()
      const spatialCriteria = bounds
        ? {
            mode: 'bbox' as const,
            geometry: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
          }
        : undefined

      const queryRes = await executeLayerQuery(
        selectedDataLayer,
        {
          layerId: selectedDataLayer.id,
          attributeRules: [],
          spatialCriteria,
          limit: 100
        },
        mapStore.map
      )

      if (queryRes.features.length === 0) {
        exportStatus = 'No features in map extent'
        return
      }

      if (dataFormat === 'geojson') {
        exportFeaturesToGeoJson(queryRes.features, selectedDataLayer.id)
      } else {
        exportFeaturesToCsv(queryRes.features, selectedDataLayer.id)
      }
      exportStatus = `Exported ${queryRes.features.length} features`
    } catch (err: any) {
      exportStatus = `Feature export failed: ${err?.message || 'Error'}`
    } finally {
      isExporting = false
    }
  }
</script>

<div class="export-module">
  <!-- Connected Tab Navigation Bar -->
  <div class="export-tab-strip">
    <button
      type="button"
      class="export-tab-btn"
      class:is-active={activeTab === 'map'}
      onclick={() => (activeTab = 'map')}
    >
      Map Canvas
    </button>
    <button
      type="button"
      class="export-tab-btn"
      class:is-active={activeTab === 'esri'}
      onclick={() => (activeTab = 'esri')}
    >
      ArcGIS /export
    </button>
    <button
      type="button"
      class="export-tab-btn"
      class:is-active={activeTab === 'data'}
      onclick={() => (activeTab = 'data')}
    >
      Feature Data
    </button>
  </div>

  <!-- Connected Tabpanel Body -->
  <div class="export-tabpanel">
    {#if activeTab === 'map'}
      <div class="tabpanel-content">
        <div class="field-group">
          <label for="export-title-input" class="field-label">BANNER TITLE</label>
          <input
            id="export-title-input"
            type="text"
            bind:value={exportTitle}
            placeholder="Map banner title..."
            class="text-input"
          />
        </div>

        <div class="meta-preview">
          <div class="preview-row">
            <span class="preview-lbl">Scale & Coordinates</span>
            <span class="preview-val">Auto-calculated</span>
          </div>
          <div class="preview-row">
            <span class="preview-lbl">Format</span>
            <span class="preview-val">Lossless PNG</span>
          </div>
        </div>

        <button
          type="button"
          class="export-btn"
          disabled={isExporting}
          onclick={handleMapExport}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>{isExporting ? 'Generating PNG...' : 'Download Map PNG'}</span>
        </button>
      </div>

    {:else if activeTab === 'esri'}
      <div class="tabpanel-content">
        {#if esriServices.length === 0}
          <div class="empty-hint">No active ArcGIS MapServer services configured.</div>
        {:else}
          <div class="field-group">
            <label for="esri-service-select" class="field-label">ARCGIS SERVICE</label>
            <select
              id="esri-service-select"
              bind:value={selectedServiceId}
              class="select-input"
            >
              {#each esriServices as srv (srv.id)}
                <option value={srv.id}>{srv.name}</option>
              {/each}
            </select>
          </div>

          <div class="field-row">
            <div class="field-group flex-1">
              <label for="esri-dpi-select" class="field-label">RESOLUTION (DPI)</label>
              <select id="esri-dpi-select" bind:value={esriDpi} class="select-input">
                <option value={96}>96 DPI (Screen)</option>
                <option value={150}>150 DPI (Print)</option>
                <option value={300}>300 DPI (High-Res)</option>
              </select>
            </div>

            <div class="field-group flex-1">
              <label for="esri-size-select" class="field-label">DIMENSIONS</label>
              <select id="esri-size-select" bind:value={esriResolution} class="select-input">
                <option value="1080p">1920 × 1080 (Full HD)</option>
                <option value="4k">3840 × 2160 (4K)</option>
              </select>
            </div>
          </div>

          <div class="meta-preview">
            <div class="preview-row">
              <span class="preview-lbl">Visible Sublayers</span>
              <span class="preview-val">
                {selectedService?.layers.filter((l) => l.enabled !== false && l.visible).length || 0} sublayers merged
              </span>
            </div>
            <div class="preview-row">
              <span class="preview-lbl">Format</span>
              <span class="preview-val">32-bit Transparent PNG</span>
            </div>
          </div>

          <button
            type="button"
            class="export-btn"
            disabled={isExporting}
            onclick={handleEsriServiceExport}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>{isExporting ? 'Requesting /export...' : 'Download ArcGIS Image'}</span>
          </button>
        {/if}
      </div>

    {:else if activeTab === 'data'}
      <div class="tabpanel-content">
        <div class="field-group">
          <label for="data-layer-select" class="field-label">OPERATIONAL LAYER</label>
          <select
            id="data-layer-select"
            bind:value={selectedDataLayerId}
            class="select-input"
          >
            {#each exportableLayers as lyr (lyr.id)}
              <option value={lyr.id}>{lyr.title}</option>
            {/each}
          </select>
        </div>

        <div class="field-group">
          <label for="data-format-select" class="field-label">EXPORT FORMAT</label>
          <select id="data-format-select" bind:value={dataFormat} class="select-input">
            <option value="geojson">GeoJSON (.geojson)</option>
            <option value="csv">Comma-Separated Values (.csv)</option>
          </select>
        </div>

        <div class="meta-preview">
          <div class="preview-row">
            <span class="preview-lbl">Spatial Scope</span>
            <span class="preview-val">Current Map Extent</span>
          </div>
        </div>

        <button
          type="button"
          class="export-btn"
          disabled={isExporting}
          onclick={handleDataExport}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>{isExporting ? 'Fetching Data...' : `Download ${dataFormat.toUpperCase()}`}</span>
        </button>
      </div>
    {/if}

    {#if exportStatus}
      <div class="export-status-banner">
        {exportStatus}
      </div>
    {/if}
  </div>
</div>

<style>
  .export-module {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  /* Connected Tab Strip */
  .export-tab-strip {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    padding: 0 4px;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--bg-card-subtle);
  }

  .export-tab-btn {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s;
    margin-bottom: -1px;
  }

  .export-tab-btn:hover:not(.is-active) {
    color: var(--text-main);
  }

  .export-tab-btn.is-active {
    color: var(--text-main);
    font-weight: 600;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-bottom: 1px solid var(--bg-card);
    z-index: 2;
  }

  /* Connected Tabpanel Body */
  .export-tabpanel {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-top: none;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tabpanel-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-row {
    display: flex;
    gap: 8px;
  }

  .flex-1 {
    flex: 1;
  }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .text-input,
  .select-input {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-main);
    outline: none;
    background-color: var(--bg-input);
  }

  .text-input:focus,
  .select-input:focus {
    border-color: var(--accent-primary);
  }

  .meta-preview {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preview-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .preview-lbl {
    color: var(--text-muted);
  }

  .preview-val {
    color: var(--text-main);
    font-weight: 500;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 34px;
    padding: 0 12px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .export-status-banner {
    padding: 6px 10px;
    font-size: 11px;
    border-radius: 4px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    color: var(--accent-primary);
  }

  .empty-hint {
    font-size: 12px;
    color: var(--text-muted);
    padding: 8px 0;
  }
</style>
