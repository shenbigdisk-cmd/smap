<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { formatArea } from '../utils/geodesy'
  import type { QueryResultFeature } from '../types'

  let activeView = $state<'cards' | 'table'>('cards')
  let selectedResultId = $state<string | number | null>(null)

  function zoomToFeature(feat: QueryResultFeature) {
    selectedResultId = feat.id
    if (!feat.geometry || !mapStore.map) return

    if (feat.geometry.type === 'Point') {
      mapStore.map.flyTo({
        center: [feat.geometry.coordinates[0], feat.geometry.coordinates[1]],
        zoom: 16
      })
    } else {
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

      if (feat.geometry.type === 'Polygon') {
        for (const ring of feat.geometry.coordinates) {
          for (const pt of ring) proc(pt[0], pt[1])
        }
      } else if (feat.geometry.type === 'MultiPolygon') {
        for (const poly of feat.geometry.coordinates) {
          for (const ring of poly) {
            for (const pt of ring) proc(pt[0], pt[1])
          }
        }
      }

      if (hasCoords && minx < maxx && miny < maxy) {
        const fitPad = mapStore.isMobile
          ? {
              top: 60,
              bottom: mapStore.mobileSheetState !== 'closed' ? 240 : 80,
              left: 20,
              right: 20
            }
          : 80

        mapStore.map.fitBounds(
          [
            [minx, miny],
            [maxx, maxy]
          ],
          {
            padding: fitPad,
            maxZoom: 17,
            duration: 800
          }
        )
      }
    }
  }

  function exportResultsCsv() {
    if (!mapStore.queryResults) return
    const features = mapStore.queryResults.features
    if (features.length === 0) return

    const keys = Object.keys(features[0].properties || {})
    const header = keys.join(',')
    const rows = features.map((f) =>
      keys
        .map((k) => {
          const val = f.properties[k]
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? ''
        })
        .join(',')
    )
    const csvContent = [header, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-results-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="results-panel">
  {#if mapStore.queryResults && mapStore.queryResults.features.length > 0}
    <!-- Query Results Multi-record View -->
    <div class="query-results-container">
      <div class="results-top-bar">
        <div class="top-bar-left">
          <span class="results-badge">{mapStore.queryResults.totalCount} FEATURES</span>
          <span class="results-layer-name">{mapStore.queryResults.layerTitle}</span>
        </div>
        <div class="top-bar-right">
          <div class="view-toggle">
            <button
              type="button"
              class="view-btn"
              class:selected={activeView === 'cards'}
              onclick={() => (activeView = 'cards')}
            >
              Cards
            </button>
            <button
              type="button"
              class="view-btn"
              class:selected={activeView === 'table'}
              onclick={() => (activeView = 'table')}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            class="clear-results-btn"
            onclick={() => mapStore.clearQueryResults()}
            title="Clear query results"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Action Toolbar -->
      <div class="results-actions-bar">
        <button type="button" class="action-btn" onclick={exportResultsCsv}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Export CSV</span>
        </button>
        <button
          type="button"
          class="action-btn"
          onclick={() => mapStore.launchModule('query')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Refine Query</span>
        </button>
      </div>

      {#if activeView === 'cards'}
        <!-- Cards List -->
        <div class="cards-list">
          {#each mapStore.queryResults.features as feat (feat.id)}
            <div
              class="feature-result-card"
              class:active={selectedResultId === feat.id}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  zoomToFeature(feat)
                }
              }}
              onclick={() => zoomToFeature(feat)}
            >
              <div class="card-main">
                <span class="feature-title">{feat.title}</span>
                {#if feat.subtitle}
                  <span class="feature-subtitle">{feat.subtitle}</span>
                {/if}
              </div>
              <button
                type="button"
                class="zoom-to-btn"
                title="Zoom to feature"
                onclick={(e) => {
                  e.stopPropagation()
                  zoomToFeature(feat)
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <!-- Data Table View -->
        {@const firstProps = mapStore.queryResults.features[0]?.properties || {}}
        {@const colKeys = Object.keys(firstProps).slice(0, 6)}
        <div class="table-wrapper">
          <table class="results-table">
            <thead>
              <tr>
                <th>Title</th>
                {#each colKeys as k}
                  <th>{k}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each mapStore.queryResults.features as feat}
                <tr
                  class:selected={selectedResultId === feat.id}
                  onclick={() => zoomToFeature(feat)}
                >
                  <td class="bold-cell">{feat.title}</td>
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
  {:else if mapStore.selectedParcel}
    {@const p = mapStore.selectedParcel}
    <div class="result-card">
      <div class="card-header">
        <div class="address-group">
          <h2 class="address-title">{p.address}</h2>
        </div>
        <button
          class="close-btn"
          onclick={() => mapStore.clearSelection()}
          aria-label="Clear property selection"
          title="Clear property selection"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

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
            <span
              class="zone-badge"
              data-category={p.zone.category}
            >
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

      <!-- Spatial Buffer Generator (VicPlan Notification Workflow) -->
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
            <span class="buffer-info">
              Showing active {mapStore.bufferState.radiusMeters}m geodesic buffer ring around {p.address}
            </span>
          {/if}
        </div>
      </div>

      <!-- Planning Overlays Section -->
      <div class="statutory-section">
        <span class="section-label">PLANNING OVERLAYS</span>
        {#if p.overlays.length > 0}
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
                  <span>Ordinance Clause</span>
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
            <span>No planning overlays affect this land parcel.</span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Empty State -->
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
    gap: 16px;
  }

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

  /* Query Results Styling */
  .query-results-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .results-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .top-bar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .results-badge {
    background: var(--accent-primary);
    color: var(--text-on-accent);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .results-layer-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-subtle);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1px;
  }

  .view-btn {
    border: none;
    background: transparent;
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 3px;
  }

  .view-btn.selected {
    background: var(--bg-panel);
    color: var(--accent-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .clear-results-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
    text-decoration: underline;
  }

  .clear-results-btn:hover {
    color: #ef4444;
  }

  .results-actions-bar {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .action-btn:hover {
    background: var(--accent-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 480px;
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

  .feature-result-card.active {
    border-color: var(--accent-primary);
    background: var(--accent-subtle);
  }

  .card-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
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

  .table-wrapper {
    max-height: 480px;
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

  .results-table tr.selected {
    background-color: var(--accent-subtle);
  }

  .bold-cell {
    font-weight: 600;
    color: var(--accent-primary);
  }
</style>
