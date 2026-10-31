<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { formatArea } from '../utils/geodesy'
  import type { QueryResultFeature } from '../types'

  let activeView = $derived(mapStore.resultsViewMode)
  let filterText = $state('')
  let copiedFeedback = $state(false)

  // Derived collections & sources
  let activeCollection = $derived(mapStore.activeFeatureCollection)
  let hasIdentify = $derived(Boolean(mapStore.identifyResults && mapStore.identifyResults.features.length > 0))
  let hasQuery = $derived(Boolean(mapStore.queryResults && mapStore.queryResults.features.length > 0))
  let hasBoth = $derived(hasIdentify && hasQuery)

  let rawFeatures = $derived(activeCollection?.features || [])
  let filteredFeatures = $derived.by(() => {
    if (!filterText.trim()) return rawFeatures
    const q = filterText.toLowerCase().trim()
    return rawFeatures.filter((f) => {
      const titleMatch = f.title.toLowerCase().includes(q)
      const subMatch = f.subtitle?.toLowerCase().includes(q)
      const layerMatch = (f.layerTitle || f.layerId).toLowerCase().includes(q)
      const propMatch = Object.values(f.properties || {}).some((v) =>
        String(v).toLowerCase().includes(q)
      )
      return titleMatch || subMatch || layerMatch || propMatch
    })
  })

  // Inspected feature for Level 2 detail
  let currentInspected = $derived.by<QueryResultFeature | null>(() => {
    if (mapStore.inspectedFeature) return mapStore.inspectedFeature
    if (mapStore.selectedParcel) {
      return {
        id: mapStore.selectedParcel.id,
        layerId: 'layer-parcels',
        layerTitle: 'Property Parcels',
        title: mapStore.selectedParcel.address,
        subtitle: `SPI: ${mapStore.selectedParcel.spi} | ${mapStore.selectedParcel.lga}`,
        geometry: mapStore.selectedParcel.geometry,
        properties: { ...mapStore.selectedParcel }
      }
    }
    return null
  })

  // Index of current inspected feature within active collection
  let currentFeatureIndex = $derived.by(() => {
    if (!currentInspected || !activeCollection) return -1
    return activeCollection.features.findIndex((f) => f.id === currentInspected?.id)
  })

  function handleSelectFeature(feat: QueryResultFeature) {
    mapStore.inspectFeature(feat)
  }

  function handleBackToList() {
    mapStore.backToFeatureList()
  }

  function handleClearCurrent() {
    if (mapStore.activeFeatureSource === 'identify') {
      mapStore.clearIdentifyResults()
    } else if (mapStore.activeFeatureSource === 'query') {
      mapStore.clearQueryResults()
    } else {
      mapStore.clearSelection()
    }
  }

  function exportResultsCsv() {
    if (!activeCollection || activeCollection.features.length === 0) return
    const featList = activeCollection.features
    const keys = Array.from(
      new Set(featList.flatMap((f) => Object.keys(f.properties || {})))
    )
    const header = ['Title', 'Layer', ...keys].join(',')
    const rows = featList.map((f) => {
      const line = [
        `"${f.title.replace(/"/g, '""')}"`,
        `"${(f.layerTitle || f.layerId).replace(/"/g, '""')}"`,
        ...keys.map((k) => {
          const val = f.properties?.[k]
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? ''
        })
      ]
      return line.join(',')
    })
    const csvContent = [header, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeCollection.source || 'feature'}-results-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyFeatureJson() {
    if (!currentInspected) return
    navigator.clipboard.writeText(JSON.stringify(currentInspected.properties, null, 2))
    copiedFeedback = true
    setTimeout(() => {
      copiedFeedback = false
    }, 1800)
  }

  function formatKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function isUrl(str: any): boolean {
    return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))
  }

  function getLayerColor(layerId: string): string {
    const layer = mapStore.layers.find((l) => l.id === layerId)
    return layer?.color || '#0284c7'
  }
</script>

<div class="results-panel">
  <!-- 0. Top Source Switcher (When user has both Identify AND Query Results) -->
  {#if hasBoth}
    <div class="source-switcher-bar">
      <button
        type="button"
        class="source-tab-btn"
        class:active={mapStore.activeFeatureSource === 'identify'}
        onclick={() => {
          mapStore.activeFeatureSource = 'identify'
          mapStore.featuresViewMode = 'list'
          mapStore.inspectedFeature = null
        }}
      >
        <span class="source-title">Identify</span>
        <span class="source-pill">{mapStore.identifyResults?.totalCount || 0}</span>
      </button>

      <button
        type="button"
        class="source-tab-btn"
        class:active={mapStore.activeFeatureSource === 'query'}
        onclick={() => {
          mapStore.activeFeatureSource = 'query'
          mapStore.featuresViewMode = 'list'
          mapStore.inspectedFeature = null
        }}
      >
        <span class="source-title">Query Results</span>
        <span class="source-pill">{mapStore.queryResults?.totalCount || 0}</span>
      </button>
    </div>
  {/if}

  {#if activeCollection && activeCollection.features.length > 0 && mapStore.featuresViewMode === 'list'}
    <!-- ========================================================================= -->
    <!-- LEVEL 1: LIST OF FEATURES (Query or Multi-Identify)                       -->
    <!-- ========================================================================= -->
    <div class="query-results-container">
      <!-- Quick Filter & Actions Toolbar (Compact single line) -->
      <div class="filter-and-actions">
        <div class="search-filter-wrap">
          <svg class="filter-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="filter-input"
            placeholder="Filter {activeCollection.totalCount} records..."
            bind:value={filterText}
          />
          {#if filterText}
            <button
              type="button"
              class="clear-filter-btn"
              onclick={() => (filterText = '')}
              aria-label="Clear filter"
            >
              &times;
            </button>
          {/if}
        </div>

        <button type="button" class="export-compact-btn" onclick={exportResultsCsv} title="Export results to CSV">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>CSV</span>
        </button>

        {#if activeCollection.source === 'query'}
          <button
            type="button"
            class="refine-compact-btn"
            onclick={() => mapStore.launchModule('query')}
            title="Refine query criteria"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        {/if}
      </div>

      <!-- Feature Items List / Cards -->
      {#if activeView === 'cards'}
        <div class="cards-list">
          {#each filteredFeatures as feat (feat.id)}
            <div
              class="feature-result-card"
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelectFeature(feat)
                }
              }}
              onclick={() => handleSelectFeature(feat)}
            >
              <div class="card-left">
                <span
                  class="card-layer-pill"
                  style="border-left: 3px solid {getLayerColor(feat.layerId)};"
                >
                  {feat.layerTitle || feat.layerId}
                </span>
                <span class="feature-title">{feat.title}</span>
                {#if feat.subtitle}
                  <span class="feature-subtitle">{feat.subtitle}</span>
                {/if}
              </div>

              <div class="card-right">
                <button
                  type="button"
                  class="zoom-to-btn"
                  title="Zoom to feature"
                  onclick={(e) => {
                    e.stopPropagation()
                    mapStore.zoomToFeatureGeometry(feat.geometry)
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              </div>
            </div>
          {/each}

          {#if filteredFeatures.length === 0}
            <div class="no-filter-match">
              <span>No features matching "{filterText}"</span>
              <button class="reset-filter-btn" onclick={() => (filterText = '')}>Clear filter</button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Data Table View -->
        {@const firstProps = activeCollection.features[0]?.properties || {}}
        {@const colKeys = Object.keys(firstProps).slice(0, 5)}
        <div class="table-wrapper">
          <table class="results-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Layer</th>
                {#each colKeys as k}
                  <th>{formatKey(k)}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each filteredFeatures as feat}
                <tr onclick={() => handleSelectFeature(feat)}>
                  <td class="bold-cell">{feat.title}</td>
                  <td>
                    <span
                      class="table-layer-tag"
                      style="color: {getLayerColor(feat.layerId)};"
                    >
                      {feat.layerTitle || feat.layerId}
                    </span>
                  </td>
                  {#each colKeys as k}
                    <td>{feat.properties[k] ?? ''}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  {:else if currentInspected}
    <!-- ========================================================================= -->
    <!-- LEVEL 2: DETAIL VIEW OF SELECTED FEATURE                                  -->
    <!-- ========================================================================= -->
    <div class="feature-detail-container">
      {#if mapStore.settings.layout === 'site'}
        <!-- Back Navigation Header (Shown for Site Layout where top header is tabstrip) -->
        <div class="detail-navigation-bar">
          {#if activeCollection && activeCollection.features.length > 1}
            <button
              type="button"
              class="back-to-list-btn"
              onclick={handleBackToList}
              title="Return to feature list"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back to list ({activeCollection.totalCount})</span>
            </button>

            <!-- Pager across identified features -->
            <div class="feature-pager">
              <button
                type="button"
                class="pager-btn"
                onclick={() => mapStore.navigateInspectedFeature('prev')}
                title="Previous feature"
                aria-label="Previous feature"
              >
                &lsaquo;
              </button>
              <span class="pager-text">
                {currentFeatureIndex >= 0 ? currentFeatureIndex + 1 : 1} of {activeCollection.totalCount}
              </span>
              <button
                type="button"
                class="pager-btn"
                onclick={() => mapStore.navigateInspectedFeature('next')}
                title="Next feature"
                aria-label="Next feature"
              >
                &rsaquo;
              </button>
            </div>
          {:else}
            <div class="single-indicator">
              <span
                class="layer-badge-dot"
                style="background-color: {getLayerColor(currentInspected.layerId)};"
              ></span>
              <span class="single-layer-txt">{currentInspected.layerTitle || currentInspected.layerId}</span>
            </div>
          {/if}

          <button
            class="close-btn"
            onclick={() => mapStore.clearSelection()}
            aria-label="Clear feature selection"
            title="Clear feature selection"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      {/if}

      <!-- Feature Card Header -->
      <div class="result-card">
        <div class="card-header">
          <div class="address-group">
            <div class="layer-pill-row">
              <span
                class="layer-tag-badge"
                style="color: {getLayerColor(currentInspected.layerId)}; border-color: {getLayerColor(currentInspected.layerId)};"
              >
                {currentInspected.layerTitle || currentInspected.layerId}
              </span>
            </div>
            <h2 class="address-title">{currentInspected.title}</h2>
            {#if currentInspected.subtitle}
              <span class="feature-subtitle">{currentInspected.subtitle}</span>
            {/if}
          </div>
        </div>

        {#if mapStore.selectedParcel}
          <!-- PARCEL FULL STATUTORY SPECIFICATION -->
          {@const p = mapStore.selectedParcel}

          <!-- Action Button: Planning Property Report -->
          <button
            class="report-action-btn"
            onclick={() => (mapStore.reportModalOpen = true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Planning Property Report (PDF)</span>
          </button>

          <!-- Cadastral Attributes Table -->
          <div class="property-specs">
            <div class="spec-row">
              <span class="spec-label">Standard Parcel ID (SPI)</span>
              <span class="spec-value mono">{p.spi}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Lot / Plan</span>
              <span class="spec-value">{p.lotPlan}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Municipality (LGA)</span>
              <span class="spec-value">{p.lga}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Council Ward</span>
              <span class="spec-value">{p.ward}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Council Property No.</span>
              <span class="spec-value mono">{p.councilPropId}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Calculated Land Area</span>
              <span class="spec-value numbers">{formatArea(p.areaM2)}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Perimeter</span>
              <span class="spec-value numbers">{p.perimeterM} m</span>
            </div>
          </div>

          <!-- Statutory Planning Zone Section -->
          <div class="statutory-section">
            <span class="section-label">STATUTORY PLANNING ZONE</span>
            <div class="zone-box">
              <div class="zone-badge-row">
                <span class="zone-badge" data-category={p.zone.category}>
                  {p.zone.code}
                </span>
                <span class="zone-category-label">{p.zone.category.toUpperCase()}</span>
              </div>
              <span class="zone-name">{p.zone.name}</span>
              {#if p.zone.schedule}
                <span class="zone-schedule">{p.zone.schedule}</span>
              {/if}
              <a
                href={p.zone.ordinanceUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="ordinance-link"
              >
                <span>View Scheme Ordinance (PDF)</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          </div>

          <!-- Statutory Planning Overlays Section -->
          <div class="statutory-section">
            <span class="section-label">PLANNING SCHEME OVERLAYS</span>
            {#if p.overlays && p.overlays.length > 0}
              <div class="overlays-list">
                {#each p.overlays as overlay}
                  <div class="overlay-item">
                    <div class="overlay-top">
                      <span class="overlay-code">{overlay.code}</span>
                      <span class="overlay-category">{overlay.category}</span>
                    </div>
                    <span class="overlay-name">{overlay.name}</span>
                    {#if overlay.schedule}
                      <span class="overlay-schedule">{overlay.schedule}</span>
                    {/if}
                    <a
                      href={overlay.ordinanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ordinance-link"
                    >
                      <span>Overlay Schedule (PDF)</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="no-overlays">
                <span>No statutory planning overlays affect this parcel.</span>
              </div>
            {/if}
          </div>

          <!-- Spatial Buffer Generator -->
          <div class="statutory-section">
            <span class="section-label">SPATIAL BUFFER & ADJOINING NOTICES</span>
            <div class="buffer-box">
              <div class="buffer-radios">
                {#each [50, 100, 200, 500] as r}
                  <button
                    class="buffer-btn"
                    class:active={mapStore.bufferState.active && mapStore.bufferState.radiusMeters === r}
                    onclick={() => mapStore.setBufferRadius(r)}
                  >
                    {r}m
                  </button>
                {/each}
                {#if mapStore.bufferState.active}
                  <button
                    class="buffer-clear-btn"
                    onclick={() => mapStore.clearBuffer()}
                    title="Clear buffer"
                  >
                    Clear
                  </button>
                {/if}
              </div>
              {#if mapStore.bufferState.active}
                <div class="buffer-info">
                  <span>Envelopes adjoining properties within {mapStore.bufferState.radiusMeters}m radius</span>
                </div>
              {/if}
            </div>
          </div>

        {:else}
          <!-- NON-PARCEL GENERIC / ADAPTER LAYER INSPECTOR -->
          <div class="generic-feature-inspector">
            <!-- Action Toolbar -->
            <div class="detail-actions-row">
              <button
                type="button"
                class="detail-action-btn"
                onclick={() => mapStore.zoomToFeatureGeometry(currentInspected.geometry)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Zoom to Extent</span>
              </button>

              <button
                type="button"
                class="detail-action-btn"
                onclick={copyFeatureJson}
                title="Copy attributes to clipboard as JSON"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>{copiedFeedback ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>

            <!-- Full Attributes Table -->
            <div class="statutory-section">
              <span class="section-label">FEATURE SPECIFICATIONS & ATTRIBUTES</span>
              <div class="property-specs">
                {#each Object.entries(currentInspected.properties || {}) as [key, val]}
                  {#if key !== 'geometry' && val !== undefined && val !== null}
                    <div class="spec-row">
                      <span class="spec-label">{formatKey(key)}</span>
                      {#if isUrl(val)}
                        <a
                          href={String(val)}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="ordinance-link"
                        >
                          <span>Open Link &rarr;</span>
                        </a>
                      {:else}
                        <span class="spec-value">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

  {:else}
    <!-- ========================================================================= -->
    <!-- EMPTY STATE                                                               -->
    <!-- ========================================================================= -->
    <div class="empty-state">
      <div class="empty-icon-wrap">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="empty-heading">No Feature Selected</h3>
      <p class="empty-desc">
        Click on any feature on the map, search for an address, or run a query to inspect attributes, zoning, and specifications here.
      </p>

      <div class="sample-hint">
        <span class="hint-label">Sample address to try:</span>
        <button
          class="hint-chip"
          onclick={() => mapStore.selectParcelById('parcel-1')}
        >
          120 Swanston Street, Melbourne
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .results-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Source Switcher (When both Identify & Query exist) */
  .source-switcher-bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 3px;
  }

  .source-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .source-tab-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  .source-tab-btn.active {
    background-color: var(--bg-panel);
    color: var(--accent-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .source-pill {
    background-color: var(--bg-subtle);
    color: var(--text-main);
    padding: 1px 5px;
    border-radius: 10px;
    font-size: 9.5px;
    font-weight: 700;
  }

  .source-tab-btn.active .source-pill {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
  }

  /* Level 2 Navigation Header */
  .detail-navigation-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .back-to-list-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-primary);
    cursor: pointer;
    transition: all 0.12s;
  }

  .back-to-list-btn:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  .feature-pager {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pager-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-main);
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.12s;
  }

  .pager-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--accent-primary);
  }

  .pager-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .single-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .single-layer-txt {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .layer-badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  /* Generic Feature Inspector */
  .generic-feature-inspector {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-actions-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .detail-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.12s;
  }

  .detail-action-btn:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  /* Results List Level 1 */
  .query-results-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Compact Filter & Action Row */
  .filter-and-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .search-filter-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .filter-icon {
    position: absolute;
    left: 8px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .filter-input {
    width: 100%;
    height: 28px;
    padding: 0 24px 0 26px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-main);
    box-sizing: border-box;
  }

  .filter-input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  .clear-filter-btn {
    position: absolute;
    right: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .export-compact-btn,
  .refine-compact-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .export-compact-btn:hover,
  .refine-compact-btn:hover {
    background: var(--bg-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 520px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .feature-result-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.12s ease;
    gap: 8px;
  }

  .feature-result-card:hover {
    border-color: var(--accent-primary);
    background: var(--bg-subtle);
  }

  .card-left {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 2px;
  }

  .card-layer-pill {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-left: 5px;
    margin-bottom: 1px;
  }

  .feature-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .feature-subtitle {
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .zoom-to-btn {
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
    flex-shrink: 0;
  }

  .zoom-to-btn:hover {
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .no-filter-match {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .reset-filter-btn {
    background: transparent;
    border: none;
    color: var(--accent-primary);
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
  }

  /* Table View */
  .table-wrapper {
    max-height: 500px;
    overflow-x: auto;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: left;
  }

  .results-table th {
    background: var(--bg-subtle);
    padding: 6px 8px;
    font-weight: 700;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
    position: sticky;
    top: 0;
  }

  .results-table td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-main);
    white-space: nowrap;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .results-table tr {
    cursor: pointer;
    transition: background-color 0.1s ease;
  }

  .results-table tr:hover {
    background-color: var(--bg-subtle);
  }

  .bold-cell {
    font-weight: 600;
    color: var(--accent-primary);
  }

  .table-layer-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Card Level 2 Detail View */
  .result-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 10px;
  }

  .address-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .layer-pill-row {
    margin-bottom: 2px;
  }

  .layer-tag-badge {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border: 1px solid;
    border-radius: 3px;
    background-color: var(--bg-card-subtle);
  }

  .address-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
    line-height: 1.3;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-light);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s, background-color 0.12s;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  .report-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 9px 12px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .report-action-btn:hover {
    background-color: var(--accent-hover);
  }

  .property-specs {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .spec-row {
    display: flex;
    justify-content: space-between;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
    gap: 8px;
  }

  .spec-row:last-child {
    border-bottom: none;
  }

  .spec-label {
    color: var(--text-muted);
  }

  .spec-value {
    color: var(--text-main);
    font-weight: 500;
    text-align: right;
  }

  .spec-value.mono {
    font-family: monospace;
    font-size: 11px;
  }

  .spec-value.numbers {
    font-variant-numeric: tabular-nums;
  }

  .statutory-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .zone-box {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .buffer-box {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .buffer-radios {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .buffer-btn {
    flex: 1;
    padding: 4px 6px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.12s;
  }

  .buffer-btn:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  .buffer-btn.active {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border-color: var(--accent-primary);
  }

  .buffer-clear-btn {
    padding: 4px 8px;
    background: transparent;
    border: 1px dashed var(--border-strong);
    color: var(--text-muted);
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
  }

  .buffer-clear-btn:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .buffer-info {
    font-size: 10px;
    color: var(--accent-primary);
    font-weight: 500;
    line-height: 1.3;
  }

  .zone-badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .zone-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 3px;
    border: 1px solid transparent;
    letter-spacing: 0.02em;
    background-color: var(--bg-card-subtle);
    color: var(--text-main);
  }

  .zone-badge[data-category="residential"] {
    background-color: #ffe4e6;
    color: #be123c;
    border-color: #fecdd3;
  }
  .zone-badge[data-category="commercial"] {
    background-color: #dbeafe;
    color: #1d4ed8;
    border-color: #bfdbfe;
  }
  .zone-badge[data-category="industrial"] {
    background-color: #ede9fe;
    color: #6d28d9;
    border-color: #ddd6fe;
  }
  .zone-badge[data-category="public"] {
    background-color: #dcfce7;
    color: #15803d;
    border-color: #bbf7d0;
  }

  :global([data-color-mode="dark"]) .zone-badge[data-category="residential"],
  :global([data-theme="dark"]) .zone-badge[data-category="residential"] {
    background-color: #4c0519;
    color: #fecdd3;
    border-color: #881337;
  }
  :global([data-color-mode="dark"]) .zone-badge[data-category="commercial"],
  :global([data-theme="dark"]) .zone-badge[data-category="commercial"] {
    background-color: #172554;
    color: #bfdbfe;
    border-color: #1e40af;
  }
  :global([data-color-mode="dark"]) .zone-badge[data-category="industrial"],
  :global([data-theme="dark"]) .zone-badge[data-category="industrial"] {
    background-color: #2e1065;
    color: #ddd6fe;
    border-color: #5b21b6;
  }
  :global([data-color-mode="dark"]) .zone-badge[data-category="public"],
  :global([data-theme="dark"]) .zone-badge[data-category="public"] {
    background-color: #052e16;
    color: #bbf7d0;
    border-color: #166534;
  }

  .zone-category-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .zone-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .zone-schedule {
    font-size: 11px;
    color: var(--text-muted);
  }

  .ordinance-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--accent-primary);
    text-decoration: none;
    font-weight: 500;
    margin-top: 2px;
  }

  .ordinance-link:hover {
    text-decoration: underline;
  }

  .overlays-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .overlay-item {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .overlay-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .overlay-code {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 5px;
    background-color: #ffedd5;
    color: #c2410c;
    border-radius: 3px;
  }

  :global([data-color-mode="dark"]) .overlay-code,
  :global([data-theme="dark"]) .overlay-code {
    background-color: #431407;
    color: #fdba74;
  }

  .overlay-category {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .overlay-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .overlay-schedule {
    font-size: 11px;
    color: var(--text-muted);
  }

  .no-overlays {
    background-color: var(--bg-card-subtle);
    border: 1px dashed var(--border-color);
    border-radius: 6px;
    padding: 12px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 30px 16px;
    background-color: var(--bg-card-subtle);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    gap: 8px;
  }

  .empty-icon-wrap {
    color: var(--text-light);
    margin-bottom: 4px;
  }

  .empty-heading {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-main);
    margin: 0;
  }

  .empty-desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
    margin: 0;
  }

  .sample-hint {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .hint-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .hint-chip {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--accent-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .hint-chip:hover {
    background-color: var(--bg-active);
    border-color: var(--accent-primary);
  }
</style>
