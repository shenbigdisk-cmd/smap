<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'
  import { legendService } from '../services/legendService'
  import type { BasemapId, ServiceDefinition } from '../types'

  let legendExpanded = $state(false)
  let expandedSublayerLegendId = $state<string | null>(null)
  let expandedServices = $state<Record<string, boolean>>({})

  let selectedServiceId = $derived(mapStore.layersConfigServiceId)
  let selectedService = $derived<ServiceDefinition | undefined>(
    mapStore.services.find((s) => s.id === selectedServiceId)
  )

  let activeLegendGroups = $derived.by(() => {
    const _v = mapStore.viewportVersion
    return legendService.getAllActiveLegendGroups(
      mapStore.layers,
      mapStore.map,
      undefined,
      (l) => mapStore.isLayerVisible(l)
    )
  })

  function isServiceExpanded(serviceId: string): boolean {
    return expandedServices[serviceId] !== false
  }

  function toggleServiceExpand(serviceId: string) {
    const current = isServiceExpanded(serviceId)
    expandedServices[serviceId] = !current
  }

  function toggleSublayerLegend(layerId: string) {
    expandedSublayerLegendId = expandedSublayerLegendId === layerId ? null : layerId
  }

  function openServiceConfig(serviceId: string) {
    mapStore.openServiceConfig(serviceId)
  }

  function backToServicesList() {
    mapStore.closeServiceConfig()
    expandedSublayerLegendId = null
  }
</script>

<div class="layers-panel">
  {#if selectedServiceId && selectedService}
    <!-- ========================================================================= -->
    <!-- SERVICE CONFIG VIEW (Sublayer Visibility Only)                            -->
    <!-- ========================================================================= -->
    <div class="service-detail-view">
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
        {#if mapStore.isServiceLoading(selectedService.id)}
          <span class="service-loading-spinner" title="Loading {selectedService.name}..." aria-label="Loading service">
            <svg class="spinner-icon" viewBox="0 0 24 24" fill="none">
              <circle class="spinner-track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"></circle>
              <path class="spinner-head" d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
            </svg>
          </span>
        {/if}
      </div>

      {#if selectedService.layers.length > 0}
        <div class="sublayers-list">
          {#each selectedService.layers as layer (layer.id)}
            {@const layerLegend = legendService.getLayerLegendGroup(layer, mapStore.map)}
            <div class="sublayer-item-wrapper">
              <div class="sublayer-item" class:disabled={!layer.visible}>
                <label class="sublayer-toggle">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onchange={() => mapStore.toggleLayer(layer.id)}
                  />
                  {#if layer.legend?.items?.[0]?.image}
                    <img class="sublayer-swatch-img" src={layer.legend.items[0].image} alt="" />
                  {:else if layer.color}
                    <span class="sublayer-swatch-dot" style="background-color: {layer.color};"></span>
                  {/if}
                  <span class="sublayer-name" title={layer.title}>{layer.title}</span>
                </label>

                {#if mapStore.isLayerLoading(layer.id)}
                  <span class="service-loading-spinner" title="Loading {layer.title}..." aria-label="Loading layer">
                    <svg class="spinner-icon" viewBox="0 0 24 24" fill="none">
                      <circle class="spinner-track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"></circle>
                      <path class="spinner-head" d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
                    </svg>
                  </span>
                {/if}

                <div class="sublayer-actions">
                  {#if layerLegend && layerLegend.items.length > 0}
                    <button
                      type="button"
                      class="sublayer-legend-btn"
                      class:active={expandedSublayerLegendId === layer.id}
                      onclick={() => toggleSublayerLegend(layer.id)}
                      title="Toggle layer legend"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                    </button>
                  {/if}
                </div>
              </div>

              {#if expandedSublayerLegendId === layer.id && layerLegend}
                <div class="sublayer-inline-legend">
                  <div class="swatches-grid">
                    {#each layerLegend.items as item}
                      <div class="legend-swatch-item">
                        {#if item.image}
                          <img class="swatch-img" src={item.image} alt={item.label} />
                        {:else}
                          <div
                            class="swatch-color"
                            class:pattern={item.pattern === 'diagonal'}
                            style="background-color: {item.color}; border-color: {item.border || item.stroke || '#94a3b8'}; color: {item.border || item.stroke || '#000000'};"
                          ></div>
                        {/if}
                        <div class="swatch-info">
                          {#if item.code && item.code !== item.label}
                            <span class="swatch-code">{item.code}</span>
                          {/if}
                          <span class="swatch-name" title={item.label}>{item.label}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else}
    <!-- ========================================================================= -->
    <!-- MAIN SERVICES & LAYERS LIST (Hierarchical Grouped View)                   -->
    <!-- ========================================================================= -->
    <div class="services-list-container">
      {#each mapStore.services as service (service.id)}
        {@const isExpanded = isServiceExpanded(service.id)}
        <div class="service-group" class:disabled={!service.visible}>
          <div class="service-item">
            {#if service.layers.length > 0}
              <button
                type="button"
                class="service-expand-btn"
                class:expanded={isExpanded}
                onclick={() => toggleServiceExpand(service.id)}
                title={isExpanded ? 'Collapse layers' : 'Expand layers'}
                aria-label={isExpanded ? 'Collapse layers' : 'Expand layers'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            {:else}
              <span class="service-expand-spacer"></span>
            {/if}

            <label class="service-toggle">
              <input
                type="checkbox"
                checked={service.visible}
                onchange={() => mapStore.toggleService(service.id)}
              />
              <span class="service-name" title={service.name}>{service.name}</span>
            </label>

            {#if mapStore.isServiceLoading(service.id)}
              <span class="service-loading-spinner" title="Loading {service.name}..." aria-label="Loading service">
                <svg class="spinner-icon" viewBox="0 0 24 24" fill="none">
                  <circle class="spinner-track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"></circle>
                  <path class="spinner-head" d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
                </svg>
              </span>
            {/if}

            {#if service.status === 'error'}
              <span class="service-status-pill error" title={service.error || 'Connection error'}>
                Error
              </span>
            {/if}
          </div>

          <!-- Inline Sublayers List -->
          {#if isExpanded && service.layers.length > 0}
            <div class="service-sublayers-inline">
              {#each service.layers as layer (layer.id)}
                {@const layerLegend = legendService.getLayerLegendGroup(layer, mapStore.map)}
                <div class="sublayer-item-wrapper">
                  <div class="sublayer-item" class:disabled={!layer.visible || !service.visible}>
                    <label class="sublayer-toggle">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        disabled={!service.visible}
                        onchange={() => mapStore.toggleLayer(layer.id)}
                      />
                      {#if layer.legend?.items?.[0]?.image}
                        <img class="sublayer-swatch-img" src={layer.legend.items[0].image} alt="" />
                      {:else if layer.color}
                        <span class="sublayer-swatch-dot" style="background-color: {layer.color};"></span>
                      {/if}
                      <span class="sublayer-name" title={layer.title}>{layer.title}</span>
                    </label>

                    {#if mapStore.isLayerLoading(layer.id)}
                      <span class="service-loading-spinner" title="Loading {layer.title}..." aria-label="Loading layer">
                        <svg class="spinner-icon" viewBox="0 0 24 24" fill="none">
                          <circle class="spinner-track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"></circle>
                          <path class="spinner-head" d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
                        </svg>
                      </span>
                    {/if}

                    <div class="sublayer-actions">
                      {#if layerLegend && layerLegend.items.length > 0}
                        <button
                          type="button"
                          class="sublayer-legend-btn"
                          class:active={expandedSublayerLegendId === layer.id}
                          onclick={() => toggleSublayerLegend(layer.id)}
                          title="Toggle layer legend"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                          </svg>
                        </button>
                      {/if}
                    </div>
                  </div>

                  {#if expandedSublayerLegendId === layer.id && layerLegend}
                    <div class="sublayer-inline-legend">
                      <div class="swatches-grid">
                        {#each layerLegend.items as item}
                          <div class="legend-swatch-item">
                            {#if item.image}
                              <img class="swatch-img" src={item.image} alt={item.label} />
                            {:else}
                              <div
                                class="swatch-color"
                                class:pattern={item.pattern === 'diagonal'}
                                style="background-color: {item.color}; border-color: {item.border || item.stroke || '#94a3b8'}; color: {item.border || item.stroke || '#000000'};"
                              ></div>
                            {/if}
                            <div class="swatch-info">
                              {#if item.code && item.code !== item.label}
                                <span class="swatch-code">{item.code}</span>
                              {/if}
                              <span class="swatch-name" title={item.label}>{item.label}</span>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
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
          {#if activeLegendGroups.length === 0}
            <div class="legend-empty">
              <span>No active layer symbology in current view</span>
            </div>
          {:else}
            {#each activeLegendGroups as group (group.layerId)}
              <div class="legend-group">
                {#if group.items.length === 0}
                  <span class="group-empty-hint">None in current extent</span>
                {:else}
                  <div class="swatches-grid">
                    {#each group.items as item (item.id || item.code || item.label)}
                      <div class="legend-swatch-item">
                        {#if item.image}
                          <img class="swatch-img" src={item.image} alt={item.label} />
                        {:else}
                          <div
                            class="swatch-color"
                            class:pattern={item.pattern === 'diagonal'}
                            style="background-color: {item.color}; border-color: {item.border || item.stroke || '#94a3b8'}; color: {item.border || item.stroke || '#000000'};"
                          ></div>
                        {/if}
                        <div class="swatch-info">
                          {#if item.code && item.code !== item.label}
                            <span class="swatch-code">{item.code}</span>
                          {/if}
                          <span class="swatch-name" title={item.label}>{item.label}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
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
    min-height: 0;
    gap: 10px;
    box-sizing: border-box;
  }

  /* Operational Services List: Clean flat rows (no card/box wrappers) */
  .services-list-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding-right: 2px;
    gap: 3px;
  }

  .service-group {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 2px;
  }

  .service-item {
    display: flex;
    align-items: center;
    padding: 6px 4px;
    min-height: 32px;
    gap: 6px;
    border-radius: 4px;
    transition: background-color 0.12s ease;
  }

  .service-item:hover {
    background-color: var(--bg-subtle);
  }

  .service-expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: transform 0.18s ease, color 0.12s ease, background-color 0.12s ease;
    flex-shrink: 0;
    padding: 0;
  }

  .service-expand-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-card-subtle);
  }

  .service-expand-btn.expanded svg {
    transform: rotate(0deg);
  }

  .service-expand-btn:not(.expanded) svg {
    transform: rotate(-90deg);
  }

  .service-expand-spacer {
    width: 22px;
    flex-shrink: 0;
  }

  .service-sublayers-inline {
    display: flex;
    flex-direction: column;
    padding-left: 14px;
    border-left: 2px solid var(--border-subtle);
    margin-left: 11px;
    margin-top: 2px;
    margin-bottom: 6px;
    gap: 2px;
  }

  .service-status-pill {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 3px;
    cursor: default;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .service-status-pill.error {
    color: #ef4444;
    border-color: #fca5a5;
    background-color: #fef2f2;
  }

  /* Busy Spinner for Loading Services & Sublayers */
  .service-loading-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--accent-primary);
    line-height: 1;
    margin-left: auto;
  }

  .site-detail-nav .service-loading-spinner {
    margin-left: 8px;
  }

  .sublayer-item .service-loading-spinner {
    margin-left: auto;
    margin-right: 4px;
  }

  .spinner-icon {
    width: 12px;
    height: 12px;
    animation: service-spin 0.75s linear infinite;
  }

  .spinner-track {
    opacity: 0.25;
  }

  @keyframes service-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
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

  .sublayer-item-wrapper {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border-subtle);
  }

  .sublayer-item-wrapper .sublayer-item {
    border-bottom: none;
  }

  .sublayer-swatch-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sublayer-swatch-img {
    width: 14px;
    height: 14px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .sublayer-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .sublayer-legend-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .sublayer-legend-btn:hover,
  .sublayer-legend-btn.active {
    background-color: var(--accent-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .sublayer-inline-legend {
    padding: 6px 8px 8px 24px;
    background-color: var(--bg-card-subtle);
    border-top: 1px dashed var(--border-subtle);
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

  .swatch-img {
    width: 16px;
    height: 16px;
    object-fit: contain;
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

  .swatch-color.pattern {
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      currentColor 2px,
      currentColor 3px
    );
  }

  .group-empty-hint,
  .legend-empty {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    padding: 2px 0;
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
