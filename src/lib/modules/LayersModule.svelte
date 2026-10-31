<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'
  import { PLANNING_ZONES, PLANNING_OVERLAYS } from '../data/sampleData'
  import type { BasemapId } from '../types'

  let legendExpanded = $state(false)
  let expandedLayers = $state<Record<string, boolean>>({})

  function toggleLayerFold(id: string) {
    expandedLayers[id] = !expandedLayers[id]
  }
</script>

<div class="layers-panel">
  <!-- 1. Operational Layers (Top Priority) -->
  <div class="layers-header">
    <div class="header-text">
      <span class="title">OPERATIONAL LAYERS</span>
      <span class="subtitle">Folded by default. Click row to configure opacity.</span>
    </div>
  </div>

  <div class="layer-list">
    {#each mapStore.services as service (service.id)}
      <div class="service-group">
        <div class="service-header">
          <div class="service-info">
            <span class="service-badge {service.type}">{service.type.toUpperCase()}</span>
            <span class="service-name" title={service.description || service.name}>{service.name}</span>
          </div>
          <span class="service-count">{service.layers.length} {service.layers.length === 1 ? 'layer' : 'layers'}</span>
        </div>

        <div class="service-layers">
          {#each service.layers as layer (layer.id)}
            {@const isFolded = !expandedLayers[layer.id]}
            <div class="layer-item" class:disabled={!layer.visible} class:expanded={!isFolded}>
              <!-- Compact Main Row: Checkbox + Title + Chevron -->
              <div class="layer-main-row">
                <label class="layer-toggle-label">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onchange={() => mapStore.toggleLayer(layer.id)}
                  />
                  <span class="layer-title" title={layer.title}>{layer.title}</span>
                  {#if layer.data?.adapter === 'mvt-client'}
                    <span class="layer-format-pill mvt" title="Vector Tile stream: in-viewport Identify only">MVT</span>
                  {:else if layer.format === 'esri-feature' || layer.data?.adapter === 'esri-rest'}
                    <span class="layer-format-pill esri" title="ArcGIS REST Feature Service">ESRI</span>
                  {/if}
                </label>

                <button
                  type="button"
                  class="layer-chevron-btn"
                  class:rotated={!isFolded}
                  onclick={() => toggleLayerFold(layer.id)}
                  title={isFolded ? 'Expand layer controls' : 'Collapse layer controls'}
                  aria-label={isFolded ? `Expand ${layer.title}` : `Collapse ${layer.title}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>

              <!-- Collapsible Details Zone: Opacity + Capabilities + Description -->
              {#if !isFolded}
                <div class="layer-details-zone">
                  {#if layer.visible}
                    <div class="layer-controls-row">
                      <div class="opacity-control">
                        <span class="control-label">Opacity: {Math.round(layer.opacity * 100)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={layer.opacity}
                          oninput={(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value)
                            mapStore.setLayerOpacity(layer.id, val)
                          }}
                          class="opacity-slider"
                        />
                      </div>
                    </div>
                  {/if}

                  {#if layer.description}
                    <p class="layer-description">{layer.description}</p>
                  {/if}

                  <!-- Capabilities Badge Line -->
                  <div class="capabilities-row">
                    <span class="cap-label">Capabilities:</span>
                    {#if layer.capabilities?.identify}
                      <span class="cap-tag active" title="Supports map-click feature identification">Identify</span>
                    {/if}
                    {#if layer.capabilities?.queryAttribute || layer.capabilities?.querySpatial}
                      <span class="cap-tag active" title="Supports attribute SQL and spatial geometric filtering">Query</span>
                    {:else}
                      <span class="cap-tag muted" title="Vector tile in-viewport only; global query disabled">No Query</span>
                    {/if}
                    {#if layer.capabilities?.buffer}
                      <span class="cap-tag active" title="Supports proximity buffer analysis">Buffer</span>
                    {/if}
                  </div>

                  <!-- Layer Operations / Shortcuts -->
                  <div class="layer-ops-row">
                    {#if layer.capabilities?.queryAttribute || layer.capabilities?.querySpatial}
                      <button
                        type="button"
                        class="layer-op-btn"
                        onclick={() => mapStore.launchModule('query')}
                        title="Query records in this layer"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <span>Query</span>
                      </button>
                    {/if}
                    {#if layer.capabilities?.buffer}
                      <button
                        type="button"
                        class="layer-op-btn"
                        onclick={() => mapStore.launchModule('buffer')}
                        title="Buffer analysis"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <circle cx="12" cy="12" r="9"></circle>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>Buffer</span>
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- 2. Symbology Legend Accordion -->
  <div class="legend-section">
    <button
      class="legend-header-btn"
      onclick={() => (legendExpanded = !legendExpanded)}
    >
      <div class="legend-header-left">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>MAP SYMBOLOGY LEGEND</span>
      </div>
      <svg
        class="chevron"
        class:rotated={legendExpanded}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    {#if legendExpanded}
      <div class="legend-content">
        <div class="legend-group">
          <span class="group-title">Planning Scheme Zones</span>
          <div class="swatches-grid">
            {#each Object.values(PLANNING_ZONES) as zone}
              <div class="legend-swatch-item">
                <div
                  class="swatch-color"
                  style="background-color: {zone.fillColor}; border-color: {zone.strokeColor};"
                ></div>
                <div class="swatch-info">
                  <span class="swatch-code">{zone.code}</span>
                  <span class="swatch-name">{zone.name}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="legend-group">
          <span class="group-title">Planning Overlays</span>
          <div class="swatches-grid">
            {#each Object.values(PLANNING_OVERLAYS) as overlay}
              <div class="legend-swatch-item">
                <div
                  class="swatch-color pattern"
                  style="background-color: {overlay.fillColor}; border-color: {overlay.strokeColor};"
                ></div>
                <div class="swatch-info">
                  <span class="swatch-code">{overlay.code}</span>
                  <span class="swatch-name">{overlay.name}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- 3. Integrated Base Map Selector (Moved to Bottom & Made Compact) -->
  <div class="basemap-section">
    <div class="section-heading-row">
      <span class="title">BASE MAP</span>
      <span class="active-basemap-badge">
        {MAP_CONFIG.basemaps.find((b) => b.id === mapStore.activeBasemapId)?.name || 'Standard'}
      </span>
    </div>

    <div class="basemap-compact-grid">
      {#each MAP_CONFIG.basemaps as b}
        <button
          class="basemap-compact-chip"
          class:selected={mapStore.activeBasemapId === b.id}
          onclick={() => mapStore.setBasemap(b.id as BasemapId)}
          title={b.description}
        >
          <div class="mini-swatch" data-id={b.id}>
            {#if b.id === 'esri-satellite'}
              <div class="mini-sat"></div>
            {:else if b.id === 'carto-dark'}
              <div class="mini-dark"></div>
            {:else if b.id === 'carto-voyager'}
              <div class="mini-voyager"></div>
            {:else}
              <div class="mini-light"></div>
            {/if}
          </div>
          <span class="basemap-chip-name">{b.name}</span>
          {#if mapStore.activeBasemapId === b.id}
            <span class="chip-check">✓</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .layers-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .layers-header {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 6px;
  }

  .title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    display: block;
  }

  .subtitle {
    font-size: 10px;
    color: var(--text-light);
  }

  /* Compact Collapsible Layer List */
  .layer-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .service-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 10px;
  }

  .service-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--border-color);
  }

  .service-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .service-name {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .service-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .service-badge.esri-rest {
    background-color: rgba(37, 99, 235, 0.15);
    color: #2563eb;
    border: 1px solid rgba(37, 99, 235, 0.3);
  }

  .service-badge.geojson-static {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .service-badge.vector-tile {
    background-color: rgba(14, 165, 233, 0.15);
    color: #0ea5e9;
    border: 1px solid rgba(14, 165, 233, 0.3);
  }

  .service-count {
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .service-layers {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .capabilities-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    margin-top: 2px;
  }

  .cap-label {
    color: var(--text-muted);
    font-weight: 600;
  }

  .cap-tag {
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
  }

  .cap-tag.active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .cap-tag.muted {
    background-color: rgba(100, 116, 139, 0.15);
    color: #64748b;
  }

  .layer-format-pill.mvt {
    background-color: rgba(14, 165, 233, 0.15);
    color: #0ea5e9;
    border: 1px solid rgba(14, 165, 233, 0.3);
  }

  .layer-item {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    transition: all 0.15s ease;
    overflow: hidden;
  }

  .layer-item.disabled {
    opacity: 0.65;
    background-color: var(--bg-card-subtle);
  }

  .layer-main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    cursor: pointer;
    min-height: 32px;
    user-select: none;
    transition: background-color 0.12s ease;
  }

  .layer-main-row:hover {
    background-color: var(--bg-subtle);
  }

  .layer-toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  .layer-toggle-label input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: var(--accent-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .layer-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-chevron-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: transform 0.15s ease, color 0.12s ease;
    flex-shrink: 0;
  }

  .layer-chevron-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  .layer-chevron-btn.rotated {
    transform: rotate(180deg);
  }

  .layer-details-zone {
    padding: 8px 10px 10px 10px;
    border-top: 1px solid var(--border-subtle);
    background-color: var(--bg-panel);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .layer-controls-row {
    padding-top: 2px;
  }

  .opacity-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .control-label {
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .opacity-slider {
    flex: 1;
    height: 4px;
    accent-color: var(--accent-primary);
    cursor: pointer;
  }

  .layer-description {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.35;
  }

  .layer-format-pill {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .layer-format-pill.esri {
    background-color: rgba(37, 99, 235, 0.15);
    color: #2563eb;
    border: 1px solid rgba(37, 99, 235, 0.3);
  }

  :global([data-color-mode="dark"]) .layer-format-pill.esri {
    background-color: rgba(96, 165, 250, 0.18);
    color: #93c5fd;
    border-color: rgba(96, 165, 250, 0.35);
  }

  .layer-ops-row {
    display: flex;
    gap: 5px;
    margin-top: 4px;
  }

  .layer-op-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    background-color: var(--bg-subtle);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .layer-op-btn:hover {
    color: var(--accent-primary);
    border-color: var(--accent-primary);
    background-color: var(--accent-subtle);
  }

  /* Legend */
  .legend-section {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
  }

  .legend-header-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
  }

  .legend-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chevron {
    transition: transform 0.2s ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .legend-content {
    padding: 8px 12px 12px 12px;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 14px;
    background-color: var(--bg-card);
  }

  .legend-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .swatches-grid {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .legend-swatch-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .swatch-color {
    width: 16px;
    height: 14px;
    border-radius: 2px;
    border: 1.5px solid transparent;
    flex-shrink: 0;
  }

  .swatch-info {
    display: flex;
    align-items: baseline;
    gap: 6px;
    overflow: hidden;
  }

  .swatch-code {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
    width: 44px;
    flex-shrink: 0;
  }

  .swatch-name {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Compact Basemap Section at Bottom */
  .basemap-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--border-color);
  }

  .section-heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .active-basemap-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-primary);
    background-color: var(--bg-active);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .basemap-compact-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .basemap-compact-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s ease;
  }

  .basemap-compact-chip:hover {
    border-color: var(--accent-primary);
    background-color: var(--bg-subtle);
  }

  .basemap-compact-chip.selected {
    border-color: var(--accent-primary);
    background-color: var(--bg-active);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .mini-swatch {
    width: 20px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.15);
  }

  .mini-sat {
    width: 100%;
    height: 100%;
    background-color: #0e7490;
  }

  .mini-dark {
    width: 100%;
    height: 100%;
    background-color: #1e293b;
  }

  .mini-voyager {
    width: 100%;
    height: 100%;
    background-color: #86efac;
  }

  .mini-light {
    width: 100%;
    height: 100%;
    background-color: #f1f5f9;
  }

  .basemap-chip-name {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .chip-check {
    font-size: 11px;
    font-weight: bold;
    color: var(--accent-primary);
  }
</style>
