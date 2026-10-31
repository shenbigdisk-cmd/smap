<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'
  import { PLANNING_ZONES, PLANNING_OVERLAYS } from '../data/sampleData'
  import type { BasemapId, ServiceDefinition } from '../types'

  let legendExpanded = $state(false)

  let selectedServiceId = $derived(mapStore.layersConfigServiceId)
  let selectedService = $derived<ServiceDefinition | undefined>(
    mapStore.services.find((s) => s.id === selectedServiceId)
  )

  function openServiceConfig(serviceId: string) {
    mapStore.openServiceConfig(serviceId)
  }

  function backToServicesList() {
    mapStore.closeServiceConfig()
  }
</script>

<div class="layers-panel">
  {#if selectedServiceId && selectedService}
    <!-- ========================================================================= -->
    <!-- SERVICE CONFIG VIEW (Sublayer Visibility Only)                            -->
    <!-- ========================================================================= -->
    <div class="service-detail-view">
      {#if mapStore.settings.layout === 'site'}
        <!-- Back Navigation for Site layout -->
        <div class="site-detail-nav">
          <button
            type="button"
            class="back-btn"
            onclick={backToServicesList}
            title="Return to services list"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to Services</span>
          </button>
        </div>
      {/if}

      <!-- Sublayer checklist: only displayed when there are multiple sub-layers -->
      <div class="service-detail-actions">
        <button
          type="button"
          class="service-kill-toggle"
          class:is-active={selectedService.enabled !== false}
          onclick={() => mapStore.toggleServiceEnabled(selectedService.id)}
        >
          {selectedService.enabled !== false ? 'Disable Entire Service' : 'Enable Service'}
        </button>
      </div>

      {#if selectedService.layers.length > 0}
        <div class="sublayers-list">
          {#each selectedService.layers as layer (layer.id)}
            {@const isLayerEnabled = layer.enabled !== false && selectedService.enabled !== false}
            <div class="sublayer-item" class:disabled={!layer.visible || !isLayerEnabled}>
              <label class="sublayer-toggle">
                <input
                  type="checkbox"
                  checked={layer.visible && isLayerEnabled}
                  disabled={!isLayerEnabled}
                  onchange={() => mapStore.toggleLayer(layer.id)}
                />
                <span class="sublayer-name" title={layer.title}>{layer.title}</span>
              </label>

              <button
                type="button"
                class="sublayer-mute-btn"
                class:muted={!isLayerEnabled}
                onclick={() => mapStore.toggleLayerEnabled(layer.id)}
                title={isLayerEnabled ? "Disable sublayer" : "Enable sublayer"}
              >
                {isLayerEnabled ? 'Active' : 'Disabled'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else}
    <!-- ========================================================================= -->
    <!-- MAIN SERVICES LIST (Checkbox, Title, and Hover Config Button)             -->
    <!-- ========================================================================= -->
    <div class="services-list-container">
      {#each mapStore.services as service (service.id)}
        {@const isServiceEnabled = service.enabled !== false}
        <div class="service-item" class:disabled={!service.visible || !isServiceEnabled} class:offline={!isServiceEnabled}>
          <label class="service-toggle">
            <input
              type="checkbox"
              checked={service.visible && isServiceEnabled}
              disabled={!isServiceEnabled}
              onchange={() => mapStore.toggleService(service.id)}
            />
            <span class="service-name" title={service.name}>{service.name}</span>
          </label>

          {#if !isServiceEnabled}
            <button
              type="button"
              class="service-status-pill offline"
              onclick={() => mapStore.toggleServiceEnabled(service.id, true)}
              title="Service disabled. Click to re-enable."
            >
              Offline
            </button>
          {:else if service.status === 'error'}
            <span class="service-status-pill error" title={service.error || 'Connection error'}>
              Error
            </span>
          {/if}

          {#if service.layers.length > 1}
            <button
              type="button"
              class="config-btn"
              onclick={() => openServiceConfig(service.id)}
              title="Configure sub-layers"
              aria-label="Configure sub-layers"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <!-- 3. Symbology Legend Accordion -->
    <div class="legend-section">
      <button
        class="legend-header-btn"
        onclick={() => (legendExpanded = !legendExpanded)}
      >
        <div class="legend-header-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>MAP SYMBOLOGY LEGEND</span>
        </div>
        <svg
          class="chevron"
          class:rotated={legendExpanded}
          width="13"
          height="13"
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

    <!-- 4. Compact Basemap Dropdown (Stays pinned at bottom) -->
    <div class="basemap-compact-section">
      <div class="basemap-dropdown-row">
        <div class="basemap-label-group">
          <span
            class="basemap-swatch-indicator"
            data-basemap={mapStore.activeBasemapId}
          ></span>
          <label for="basemap-quick-select" class="basemap-label">BASEMAP</label>
        </div>

        <select
          id="basemap-quick-select"
          class="basemap-dropdown-select"
          value={mapStore.activeBasemapId}
          onchange={(e) => mapStore.setBasemap((e.target as HTMLSelectElement).value as BasemapId)}
        >
          {#each MAP_CONFIG.basemaps as b}
            <option value={b.id}>{b.name}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}
</div>

<style>
  .layers-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 100%;
    height: 100%;
    gap: 10px;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Operational Services List: Clean flat rows (no card/box wrappers) */
  .services-list-container {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding-right: 2px;
  }

  .service-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 8px;
    min-height: 32px;
    gap: 8px;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: 4px;
    transition: background-color 0.12s ease;
  }

  .service-item:hover {
    background-color: var(--bg-subtle);
  }

  .service-item.disabled {
    opacity: 0.55;
  }

  .service-item.offline {
    opacity: 0.45;
    background-color: var(--bg-card-subtle);
  }

  .service-status-pill {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 3px;
    cursor: pointer;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .service-status-pill.offline {
    color: var(--text-muted);
    border-style: dashed;
  }

  .service-status-pill.error {
    color: #ef4444;
    border-color: #fca5a5;
    background-color: #fef2f2;
  }

  .service-detail-actions {
    display: flex;
    justify-content: flex-end;
    padding: 4px 0;
  }

  .service-kill-toggle {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s;
  }

  .service-kill-toggle:hover {
    color: var(--text-main);
    border-color: var(--accent-primary);
  }

  .sublayer-mute-btn {
    font-size: 9.5px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .sublayer-mute-btn.muted {
    color: #ef4444;
    border-style: dashed;
  }

  .site-detail-nav {
    display: flex;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .service-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  .service-toggle input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: var(--accent-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .service-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Config Button: hidden by default, revealed on hover or keyboard focus */
  .config-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.15s ease, visibility 0.15s ease, color 0.12s ease, background-color 0.12s ease, border-color 0.12s ease;
  }

  .service-item:hover .config-btn,
  .config-btn:focus-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  @media (hover: none) {
    .config-btn {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
  }

  .config-btn:hover {
    color: var(--accent-primary);
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  /* ========================================================================= */
  /* SERVICE CONFIG VIEW (Sublayer Visibility Only)                            */
  /* ========================================================================= */
  .service-detail-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 8px;
    overflow: hidden;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-primary);
    cursor: pointer;
    transition: all 0.12s;
  }

  .back-btn:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  .sublayers-list {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding-right: 2px;
  }

  .sublayer-item {
    display: flex;
    align-items: center;
    padding: 7px 8px;
    min-height: 32px;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: 4px;
    transition: background-color 0.12s ease;
  }

  .sublayer-item:hover {
    background-color: var(--bg-subtle);
  }

  .sublayer-item.disabled {
    opacity: 0.55;
  }

  .sublayer-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  .sublayer-toggle input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: var(--accent-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .sublayer-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ========================================================================= */
  /* SYMBOLOGY LEGEND SECTION                                                  */
  /* ========================================================================= */
  .legend-section {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background-color: var(--bg-card);
    overflow: hidden;
    flex-shrink: 0;
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
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    transition: background-color 0.12s;
  }

  .legend-header-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .legend-header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chevron {
    transition: transform 0.15s ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .legend-content {
    padding: 8px 10px 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 160px;
    overflow-y: auto;
  }

  .legend-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .swatches-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .legend-swatch-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 4px;
  }

  .swatch-color {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid;
    flex-shrink: 0;
  }

  .swatch-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .swatch-code {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text-main);
  }

  .swatch-name {
    font-size: 9px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ========================================================================= */
  /* COMPACT BASEMAP DROPDOWN SECTION (Pinned to bottom)                       */
  /* ========================================================================= */
  .basemap-compact-section {
    margin-top: auto;
    padding: 7px 10px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    flex-shrink: 0;
  }

  .basemap-dropdown-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .basemap-label-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .basemap-swatch-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .basemap-swatch-indicator[data-basemap="carto-light"] {
    background-color: #f8fafc;
  }

  .basemap-swatch-indicator[data-basemap="carto-voyager"] {
    background-color: #cbd5e1;
  }

  .basemap-swatch-indicator[data-basemap="carto-dark"] {
    background-color: #0f172a;
  }

  .basemap-swatch-indicator[data-basemap="esri-satellite"] {
    background-color: #065f46;
  }

  .basemap-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    cursor: pointer;
  }

  .basemap-dropdown-select {
    flex: 1;
    max-width: 190px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    outline: none;
    transition: border-color 0.12s;
  }

  .basemap-dropdown-select:focus {
    border-color: var(--accent-primary);
  }
</style>
