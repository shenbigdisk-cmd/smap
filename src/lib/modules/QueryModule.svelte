<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { executeLayerQuery } from '../services/queryAdapter'
  import { SAMPLE_PARCELS } from '../data/sampleData'
  import type {
    AttributeFilterRule,
    LayerFieldConfig,
    OperationalLayer,
    QueryDefinition,
    QuerySpatialMode,
    SpatialFilterCriteria
  } from '../types'

  // Queryable Layers (filtered by capability)
  let queryableLayers = $derived(
    mapStore.layers.filter(
      (l) =>
        Boolean(l.capabilities?.queryAttribute || l.capabilities?.querySpatial) ||
        Boolean(l.operations?.includes('query-attribute') || l.operations?.includes('query-spatial'))
    )
  )

  let selectedLayerId = $state<string>('layer-parcels')

  $effect(() => {
    if (queryableLayers.length > 0 && !queryableLayers.some((l) => l.id === selectedLayerId)) {
      selectedLayerId = queryableLayers[0].id
    }
  })

  let selectedLayer = $derived(
    mapStore.layers.find((l) => l.id === selectedLayerId) || mapStore.layers[0]
  )

  // Query mode: 'attribute' | 'spatial' | 'combined'
  let queryMode = $state<'attribute' | 'spatial' | 'combined'>('attribute')

  // Attribute Rules State
  let availableFields = $derived<LayerFieldConfig[]>(
    selectedLayer?.queryConfig?.fields || [
      { key: 'address', label: 'Property Address', type: 'string' },
      { key: 'spi', label: 'Standard Parcel ID', type: 'string' }
    ]
  )

  let attributeRules = $state<AttributeFilterRule[]>([
    { field: '', operator: 'contains', value: '' }
  ])

  let attributeOperator = $state<'AND' | 'OR'>('AND')

  // When layer changes, reset first field to layer's default
  $effect(() => {
    if (availableFields.length > 0 && !attributeRules[0].field) {
      attributeRules[0].field = availableFields[0].key
    }
  })

  // Spatial Criteria State
  let spatialMode = $state<QuerySpatialMode>('bbox')
  let radiusMeters = $state<number>(500)
  let spatialFilter = $state<SpatialFilterCriteria | null>(null)
  let isDrawingSpatial = $state(false)
  let draftVertices = $state<[number, number][]>([])

  // Query Execution State
  let queryError = $state<string | null>(null)
  let lastQuerySummary = $state<string | null>(null)

  function addAttributeRule() {
    const defaultField = availableFields[0]?.key || ''
    attributeRules = [
      ...attributeRules,
      { field: defaultField, operator: 'contains', value: '' }
    ]
  }

  function removeAttributeRule(index: number) {
    if (attributeRules.length > 1) {
      attributeRules = attributeRules.filter((_, idx) => idx !== index)
    } else {
      attributeRules[0].value = ''
    }
  }

  // Spatial Drawing Tool Registration (Guardrail Integrated)
  function startSpatialDrawing(mode: QuerySpatialMode) {
    spatialMode = mode
    isDrawingSpatial = true
    draftVertices = []

    if (mode === 'viewport') {
      if (mapStore.map) {
        const bounds = mapStore.map.getBounds()
        spatialFilter = {
          mode: 'bbox',
          geometry: [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
          ]
        }
      }
      isDrawingSpatial = false
      return
    }

    if (mode === 'selected') {
      if (mapStore.selectedParcel) {
        spatialFilter = {
          mode: 'polygon',
          geometry: mapStore.selectedParcel.geometry
        }
      }
      isDrawingSpatial = false
      return
    }

    mapStore.registerMapHandler({
      id: `query-spatial-${mode}`,
      moduleId: 'query',
      cursor: 'crosshair',
      hint:
        mode === 'radius'
          ? 'Click map to place search center'
          : mode === 'bbox'
            ? 'Click first corner, then opposite corner'
            : 'Click map to add polygon vertices. Press Enter to finish.',
      onClick: (coord) => {
        if (mode === 'radius') {
          spatialFilter = {
            mode: 'radius',
            center: coord,
            radiusMeters: radiusMeters
          }
          isDrawingSpatial = false
          mapStore.deactivateMapHandler('query')
        } else if (mode === 'bbox') {
          draftVertices = [...draftVertices, coord]
          if (draftVertices.length >= 2) {
            const minx = Math.min(draftVertices[0][0], draftVertices[1][0])
            const maxx = Math.max(draftVertices[0][0], draftVertices[1][0])
            const miny = Math.min(draftVertices[0][1], draftVertices[1][1])
            const maxy = Math.max(draftVertices[0][1], draftVertices[1][1])
            spatialFilter = {
              mode: 'bbox',
              geometry: [minx, miny, maxx, maxy]
            }
            isDrawingSpatial = false
            draftVertices = []
            mapStore.deactivateMapHandler('query')
          }
        } else if (mode === 'polygon') {
          draftVertices = [...draftVertices, coord]
          if (draftVertices.length >= 3) {
            spatialFilter = {
              mode: 'polygon',
              geometry: {
                type: 'Polygon',
                coordinates: [[...draftVertices, draftVertices[0]]]
              }
            }
          }
        }
      },
      onKeyDown: (e) => {
        if (e.key === 'Enter' && mode === 'polygon' && draftVertices.length >= 3) {
          spatialFilter = {
            mode: 'polygon',
            geometry: {
              type: 'Polygon',
              coordinates: [[...draftVertices, draftVertices[0]]]
            }
          }
          isDrawingSpatial = false
          draftVertices = []
          mapStore.deactivateMapHandler('query')
        }
      },
      onDeactivate: () => {
        isDrawingSpatial = false
        draftVertices = []
      }
    })
  }

  function clearSpatialFilter() {
    spatialFilter = null
    draftVertices = []
    if (isDrawingSpatial) {
      mapStore.deactivateMapHandler('query')
    }
  }

  async function handleRunQuery() {
    if (!selectedLayer) return

    mapStore.isQueryLoading = true
    queryError = null

    try {
      const activeRules =
        queryMode === 'spatial'
          ? []
          : attributeRules.filter(
              (r) => r.value !== '' && r.value !== undefined && r.value !== null
            )

      const activeSpatial =
        queryMode === 'attribute' ? undefined : spatialFilter || undefined

      const queryDef: QueryDefinition = {
        layerId: selectedLayer.id,
        attributeRules: activeRules,
        attributeOperator: attributeOperator,
        spatialCriteria: activeSpatial,
        limit: 50
      }

      const results = await executeLayerQuery(
        selectedLayer,
        queryDef,
        mapStore.map
      )

      mapStore.setQueryResults(results)
      lastQuerySummary = `Found ${results.totalCount} feature${results.totalCount === 1 ? '' : 's'}`

      // If user queried ArcGIS feature layer, make sure layer is turned on
      if (selectedLayer && !selectedLayer.visible) {
        mapStore.toggleLayer(selectedLayer.id)
      }
    } catch (err: any) {
      console.error('Query execution failed:', err)
      queryError = err.message || 'Query failed. Please check network or query syntax.'
    } finally {
      mapStore.isQueryLoading = false
    }
  }
</script>

<div class="query-panel">
  <!-- Header -->
  <div class="query-header">
    <div class="title-row">
      <h2 class="title">SPATIAL & ATTRIBUTE QUERY</h2>
      <span class="subtitle">Search records using SQL attribute filters and geometry</span>
    </div>
  </div>

  <!-- Target Layer Selection -->
  <div class="section-box">
    <label class="section-label" for="query-target-layer">
      <span>TARGET LAYER</span>
      <span class="badge">{selectedLayer?.format?.toUpperCase() || 'GEOJSON'}</span>
    </label>
    <select
      id="query-target-layer"
      class="layer-select"
      bind:value={selectedLayerId}
      onchange={() => {
        clearSpatialFilter()
        attributeRules = [{ field: availableFields[0]?.key || '', operator: 'contains', value: '' }]
      }}
    >
      {#each queryableLayers as lyr (lyr.id)}
        <option value={lyr.id}>
          {lyr.title} ({lyr.format === 'esri-feature' ? 'ArcGIS REST' : 'Local'})
        </option>
      {/each}
    </select>
  </div>

  <!-- Mode Selector Segmented Tabs -->
  <div class="mode-tabs">
    <button
      type="button"
      class="mode-tab-btn"
      class:active={queryMode === 'attribute'}
      onclick={() => (queryMode = 'attribute')}
    >
      Attributes
    </button>
    <button
      type="button"
      class="mode-tab-btn"
      class:active={queryMode === 'spatial'}
      onclick={() => (queryMode = 'spatial')}
    >
      Geometry
    </button>
    <button
      type="button"
      class="mode-tab-btn"
      class:active={queryMode === 'combined'}
      onclick={() => (queryMode = 'combined')}
    >
      Combined
    </button>
  </div>

  <!-- Attribute Filter Section -->
  {#if queryMode === 'attribute' || queryMode === 'combined'}
    <div class="query-card">
      <div class="card-header-bar">
        <span class="card-title">ATTRIBUTE FILTER CLAUSES</span>
        {#if attributeRules.length > 1}
          <div class="operator-toggle">
            <button
              type="button"
              class="op-btn"
              class:selected={attributeOperator === 'AND'}
              onclick={() => (attributeOperator = 'AND')}
            >
              AND
            </button>
            <button
              type="button"
              class="op-btn"
              class:selected={attributeOperator === 'OR'}
              onclick={() => (attributeOperator = 'OR')}
            >
              OR
            </button>
          </div>
        {/if}
      </div>

      <div class="rules-list">
        {#each attributeRules as rule, idx (idx)}
          {@const fieldDef = availableFields.find((f) => f.key === rule.field)}
          <div class="rule-row">
            <!-- Field Dropdown -->
            <select class="field-select" bind:value={rule.field}>
              {#each availableFields as f}
                <option value={f.key}>{f.label}</option>
              {/each}
            </select>

            <!-- Operator Dropdown -->
            <select class="op-select" bind:value={rule.operator}>
              <option value="contains">contains</option>
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value="starts_with">starts with</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
            </select>

            <!-- Value Input -->
            {#if fieldDef?.options && fieldDef.options.length > 0}
              <select class="val-input" bind:value={rule.value}>
                <option value="">Select value...</option>
                {#each fieldDef.options as opt}
                  <option value={opt}>{opt}</option>
                {/each}
              </select>
            {:else}
              <input
                type={fieldDef?.type === 'number' ? 'number' : 'text'}
                class="val-input"
                placeholder="Enter value..."
                bind:value={rule.value}
              />
            {/if}

            <!-- Remove Button -->
            <button
              type="button"
              class="remove-btn"
              onclick={() => removeAttributeRule(idx)}
              title="Remove filter rule"
              aria-label="Remove filter rule"
            >
              &times;
            </button>
          </div>
        {/each}
      </div>

      <button type="button" class="add-rule-btn" onclick={addAttributeRule}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Add Rule Clause</span>
      </button>
    </div>
  {/if}

  <!-- Spatial Filter Section -->
  {#if queryMode === 'spatial' || queryMode === 'combined'}
    <div class="query-card">
      <div class="card-header-bar">
        <span class="card-title">SPATIAL / GEOMETRY FILTER</span>
        {#if spatialFilter}
          <button type="button" class="clear-geo-btn" onclick={clearSpatialFilter}>
            Clear Geometry
          </button>
        {/if}
      </div>

      <div class="spatial-tools-grid">
        <button
          type="button"
          class="spatial-tool-btn"
          class:active={isDrawingSpatial && spatialMode === 'bbox'}
          onclick={() => startSpatialDrawing('bbox')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          <span>Bounding Box</span>
        </button>

        <button
          type="button"
          class="spatial-tool-btn"
          class:active={isDrawingSpatial && spatialMode === 'polygon'}
          onclick={() => startSpatialDrawing('polygon')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          </svg>
          <span>Draw Polygon</span>
        </button>

        <button
          type="button"
          class="spatial-tool-btn"
          class:active={isDrawingSpatial && spatialMode === 'radius'}
          onclick={() => startSpatialDrawing('radius')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
          <span>Point & Radius</span>
        </button>

        <button
          type="button"
          class="spatial-tool-btn"
          onclick={() => startSpatialDrawing('viewport')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6"></path>
            <path d="M9 21H3v-6"></path>
            <path d="M21 3l-7 7"></path>
            <path d="M3 21l7-7"></path>
          </svg>
          <span>Map Viewport</span>
        </button>
      </div>

      {#if spatialMode === 'radius'}
        <div class="radius-slider-box">
          <div class="slider-header">
            <span>Buffer Radius</span>
            <span class="slider-val">{radiusMeters} m</span>
          </div>
          <input
            type="range"
            min="50"
            max="5000"
            step="50"
            bind:value={radiusMeters}
            class="range-slider"
          />
        </div>
      {/if}

      {#if isDrawingSpatial}
        <div class="drawing-instruction-box">
          <span class="pulsing-dot"></span>
          <span>
            {mapStore.activeHandler?.hint || 'Click on map to define spatial boundary. Esc to cancel.'}
          </span>
        </div>
      {:else if spatialFilter}
        <div class="geo-status-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>
            Active Spatial Filter: {spatialFilter.mode.toUpperCase()}
            {#if spatialFilter.radiusMeters}
              ({spatialFilter.radiusMeters}m radius)
            {/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Error feedback -->
  {#if queryError}
    <div class="error-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{queryError}</span>
    </div>
  {/if}

  <!-- Execution Button -->
  <button
    type="button"
    class="execute-query-btn"
    disabled={mapStore.isQueryLoading}
    onclick={handleRunQuery}
  >
    {#if mapStore.isQueryLoading}
      <span class="loading-spinner"></span>
      <span>Executing Query...</span>
    {:else}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span>Run Query</span>
    {/if}
  </button>

  {#if lastQuerySummary}
    <div class="summary-footer">
      <span>{lastQuerySummary}</span>
      <button
        type="button"
        class="view-results-link"
        onclick={() => (mapStore.activeTab = 'results')}
      >
        View in Features &rarr;
      </button>
    </div>
  {/if}
</div>

<style>
  .query-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 14px;
    font-size: 13px;
    color: var(--text-main);
  }

  .query-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    text-transform: uppercase;
    margin: 0;
  }

  .subtitle {
    font-size: 11px;
    color: var(--text-muted);
  }

  .section-box {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .badge {
    background: var(--bg-subtle);
    border: 1px solid var(--border-color);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9px;
    color: var(--accent-primary);
  }

  .layer-select {
    width: 100%;
    padding: 6px 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-main);
    font-size: 12px;
    font-weight: 500;
  }

  .mode-tabs {
    display: flex;
    background: var(--bg-subtle);
    padding: 2px;
    border-radius: 5px;
    gap: 2px;
    border: 1px solid var(--border-color);
  }

  .mode-tab-btn {
    flex: 1;
    padding: 5px 8px;
    border: none;
    background: transparent;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-tab-btn.active {
    background: var(--bg-panel);
    color: var(--accent-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .query-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .operator-toggle {
    display: flex;
    background: var(--bg-subtle);
    border-radius: 3px;
    border: 1px solid var(--border-color);
  }

  .op-btn {
    padding: 1px 6px;
    border: none;
    background: transparent;
    font-size: 9px;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
  }

  .op-btn.selected {
    background: var(--accent-primary);
    color: var(--text-on-accent);
    border-radius: 2px;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rule-row {
    display: grid;
    grid-template-columns: 1.2fr 0.9fr 1.5fr 24px;
    gap: 4px;
    align-items: center;
  }

  .field-select,
  .op-select,
  .val-input {
    padding: 5px 6px;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-main);
    font-size: 11px;
    min-width: 0;
  }

  .remove-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
  }

  .remove-btn:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .add-rule-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    background: var(--bg-subtle);
    border: 1px dashed var(--border-color);
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .add-rule-btn:hover {
    background: var(--accent-subtle);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .spatial-tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .spatial-tool-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 8px;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-main);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .spatial-tool-btn:hover {
    border-color: var(--accent-primary);
  }

  .spatial-tool-btn.active {
    background: var(--accent-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .radius-slider-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 0;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }

  .slider-val {
    font-weight: 700;
    color: var(--accent-primary);
  }

  .range-slider {
    width: 100%;
    accent-color: var(--accent-primary);
  }

  .drawing-instruction-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--accent-subtle);
    border-radius: 4px;
    font-size: 11px;
    color: var(--accent-primary);
    font-weight: 500;
  }

  .pulsing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-primary);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 0.4;
      transform: scale(0.9);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
    100% {
      opacity: 0.4;
      transform: scale(0.9);
    }
  }

  .geo-status-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .clear-geo-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
    text-decoration: underline;
  }

  .clear-geo-btn:hover {
    color: #ef4444;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #dc2626;
    font-size: 11.5px;
  }

  .execute-query-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    background: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 5px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .execute-query-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .execute-query-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .summary-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .view-results-link {
    border: none;
    background: transparent;
    color: var(--accent-primary);
    font-weight: 600;
    cursor: pointer;
    font-size: 11.5px;
  }

  .view-results-link:hover {
    text-decoration: underline;
  }
</style>
