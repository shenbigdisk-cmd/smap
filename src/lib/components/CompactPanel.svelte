<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'
  import ModuleRenderer from '../modules/ModuleRenderer.svelte'

  let activeView = $derived(
    mapStore.views.find((v) => v.id === mapStore.activeTab)
  )

  let activeMod = $derived(
    activeView
      ? mapStore.modules.find((m) => m.id === activeView.moduleId)
      : mapStore.modules.find((m) => m.id === mapStore.activeTab)
  )

  let isServiceDetail = $derived(
    mapStore.activeTab === 'layers' && Boolean(mapStore.layersConfigServiceId)
  )

  let isFeatureDetail = $derived(
    mapStore.activeTab === 'results' && mapStore.featuresViewMode === 'detail'
  )

  let isDetailView = $derived(isServiceDetail || isFeatureDetail)

  let activeService = $derived(
    isServiceDetail ? mapStore.services.find((s) => s.id === mapStore.layersConfigServiceId) : null
  )

  let activeCollection = $derived(mapStore.activeFeatureCollection)
  let currentFeatureIndex = $derived(mapStore.inspectedFeatureIndex)

  let panelTitle = $derived.by(() => {
    if (mapStore.activeTab === 'toolbox') return 'Toolbox'
    if (isServiceDetail && activeService) {
      return activeService.name
    }
    if (isFeatureDetail) {
      return 'Feature Details'
    }
    return activeView?.name || activeMod?.name || 'Information Panel'
  })

  function closePanel() {
    mapStore.closeSidebar()
  }

  function handleBack() {
    if (mapStore.activeTab === 'layers') {
      mapStore.closeServiceConfig()
    } else if (mapStore.activeTab === 'results') {
      mapStore.backToFeatureList()
    }
  }
</script>

<aside
  class="compact-panel"
  class:open={mapStore.sidebarOpen}
  aria-label={panelTitle}
  aria-hidden={!mapStore.sidebarOpen}
>
  <!-- Panel Header: Title + Icon + Information + Actions + Close Button -->
  <div class="panel-header">
    <div class="header-left">
      {#if isDetailView}
        <button
          type="button"
          class="header-back-btn"
          onclick={handleBack}
          title="Back to list"
          aria-label="Back to list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
      {:else}
        <div class="panel-icon-wrap">
          <ModuleIcon id={mapStore.activeTab} size={15} />
        </div>
      {/if}

      <span class="panel-heading" title={panelTitle}>{panelTitle}</span>

      <!-- Information Badges -->
      {#if mapStore.activeTab === 'layers'}
        {#if !isServiceDetail}
          <span class="header-count-badge">{mapStore.totalActiveServicesCount} active</span>
        {:else if activeService && mapStore.isServiceLoading(activeService.id)}
          <span class="service-loading-spinner" title="Loading {activeService.name}..." aria-label="Loading service">
            <svg class="spinner-icon" viewBox="0 0 24 24" fill="none">
              <circle class="spinner-track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"></circle>
              <path class="spinner-head" d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
            </svg>
          </span>
        {/if}
      {:else if mapStore.activeTab === 'results'}
        {#if !isFeatureDetail && activeCollection && activeCollection.totalCount > 0}
          <span class="header-count-badge">{activeCollection.totalCount}</span>
        {/if}
      {:else if mapStore.activeTab === 'bookmarks'}
        <span class="header-count-badge">{mapStore.bookmarks.length}</span>
      {:else if mapStore.activeTab === 'markup'}
        <span class="header-count-badge">{mapStore.markups.length}</span>
      {/if}
    </div>

    <!-- Right Header Actions -->
    <div class="header-right">
      {#if mapStore.activeTab === 'results'}
        {#if !isFeatureDetail && activeCollection && activeCollection.features.length > 0}
          <div class="header-view-toggle">
            <button
              type="button"
              class="toggle-btn"
              class:active={mapStore.resultsViewMode === 'cards'}
              onclick={() => (mapStore.resultsViewMode = 'cards')}
              title="Cards view"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              type="button"
              class="toggle-btn"
              class:active={mapStore.resultsViewMode === 'table'}
              onclick={() => (mapStore.resultsViewMode = 'table')}
              title="Table view"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>

          <button
            type="button"
            class="header-icon-btn"
            onclick={() => mapStore.clearActiveFeatureCollection()}
            title="Clear results"
            aria-label="Clear results"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        {:else if isFeatureDetail && activeCollection && activeCollection.features.length > 1}
          <div class="header-pager">
            <button
              type="button"
              class="pager-nav-btn"
              disabled={currentFeatureIndex <= 0}
              onclick={() => mapStore.navigateInspectedFeature('prev')}
              title="Previous feature"
            >
              &lsaquo;
            </button>
            <span class="pager-text">{currentFeatureIndex + 1}/{activeCollection.features.length}</span>
            <button
              type="button"
              class="pager-nav-btn"
              disabled={currentFeatureIndex >= activeCollection.features.length - 1}
              onclick={() => mapStore.navigateInspectedFeature('next')}
              title="Next feature"
            >
              &rsaquo;
            </button>
          </div>
        {/if}
      {:else if mapStore.activeTab === 'bookmarks'}
        <button
          type="button"
          class="header-pill-btn"
          onclick={() => (mapStore.isAddingBookmark = !mapStore.isAddingBookmark)}
          title="Bookmark view"
        >
          {mapStore.isAddingBookmark ? 'Cancel' : '+ Add'}
        </button>
      {:else if mapStore.activeTab === 'measure' && mapStore.measurement.points.length > 0}
        <button
          type="button"
          class="header-pill-btn"
          onclick={() => mapStore.clearMeasurement()}
          title="Clear measurement"
        >
          Clear
        </button>
      {:else if mapStore.activeTab === 'markup' && mapStore.markups.length > 0}
        <button
          type="button"
          class="header-pill-btn"
          onclick={() => mapStore.clearMarkups()}
          title="Clear markups"
        >
          Clear
        </button>
      {/if}

      <button
        class="panel-close-btn"
        onclick={closePanel}
        title="Close Panel"
        aria-label="Close panel"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  <!-- Panel Body Content: Pure focused module, no tabs -->
  <div class="panel-body">
    <ModuleRenderer id={mapStore.activeTab} />
  </div>
</aside>

<style>
  .compact-panel {
    position: absolute;
    top: 68px;
    left: 14px;
    width: 380px;
    height: auto;
    max-height: calc(100vh * 2 / 3);
    max-width: calc(100vw - 28px);
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    z-index: 45;
    pointer-events: none;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
    transform: translateX(calc(-100% - 24px));
    opacity: 0;
    overflow: hidden;
  }

  .compact-panel.open {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 10px 0 12px;
    background-color: transparent;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }

  .header-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-main);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .header-back-btn:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .panel-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background-color: var(--bg-card);
    color: var(--accent-primary);
    border: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .panel-heading {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .header-count-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    background-color: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 1px 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .service-loading-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--accent-primary);
    line-height: 1;
    margin-left: 4px;
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


  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .header-view-toggle {
    display: inline-flex;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .toggle-btn.active {
    background-color: var(--accent-primary);
    color: #ffffff;
  }

  .header-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .header-icon-btn:hover {
    color: var(--error-color, #dc2626);
    background-color: var(--bg-subtle);
    border-color: var(--border-color);
  }

  .header-pill-btn {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-primary);
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1px 6px;
    cursor: pointer;
    line-height: 1.4;
    transition: all 0.12s ease;
  }

  .header-pill-btn:hover {
    background-color: var(--accent-subtle);
    border-color: var(--accent-primary);
  }

  .header-pager {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1px 4px;
    height: 20px;
  }

  .pager-nav-btn {
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    padding: 0 1px;
  }

  .pager-nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .pager-text {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .panel-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.12s ease;
  }

  .panel-close-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
  }

  /* Compact Card Layout Overrides: ensure layer/service lists do not collapse in auto-height mode */
  .compact-panel :global(.layers-panel) {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  .compact-panel :global(.services-list-container) {
    flex: none !important;
    min-height: auto !important;
    overflow: visible !important;
  }

  .compact-panel :global(.sublayers-list) {
    flex: none !important;
    min-height: auto !important;
    overflow: visible !important;
  }

  .compact-panel :global(.service-detail-view) {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
</style>
