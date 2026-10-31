<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import MapCanvas from './MapCanvas.svelte'
  import UserAvatarMenu from './UserAvatarMenu.svelte'
  import ModuleRenderer from '../modules/ModuleRenderer.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'
  import type { SurfaceMode } from '../types'

  let searchInputEl: HTMLInputElement | null = null
  let isSearchActive = $state(false)

  // Touch Gesture Handling for Mobile Sheet Dragging
  let startY = 0
  let currentY = 0
  let isDragging = $state(false)

  function onTouchStart(e: TouchEvent) {
    startY = e.touches[0].clientY
    currentY = startY
    isDragging = true
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging) return
    currentY = e.touches[0].clientY
  }

  function onTouchEnd() {
    if (!isDragging) return
    isDragging = false
    const deltaY = currentY - startY

    // Swiped down (> 70px)
    if (deltaY > 70) {
      if (mapStore.mobileSheetState === 'full') {
        mapStore.mobileSheetState = 'half'
      } else if (mapStore.mobileSheetState === 'half') {
        mapStore.closeMobileSheet()
      }
    }
    // Swiped up (< -70px)
    else if (deltaY < -70) {
      if (mapStore.mobileSheetState === 'closed') {
        mapStore.mobileSheetState = 'half'
      } else if (mapStore.mobileSheetState === 'half') {
        mapStore.mobileSheetState = 'full'
      }
    }
  }

  function toggleSheetHeight() {
    if (mapStore.mobileSheetState === 'half') {
      mapStore.mobileSheetState = 'full'
    } else if (mapStore.mobileSheetState === 'full') {
      mapStore.mobileSheetState = 'half'
    } else {
      mapStore.mobileSheetState = 'half'
    }
  }

  function onNavTap(tab: SurfaceMode) {
    if (mapStore.mobileSheetState === 'closed') {
      mapStore.openMobileSheet(tab, 'half')
    } else if (mapStore.activeTab === tab) {
      // Toggle height or close
      if (mapStore.mobileSheetState === 'half') {
        mapStore.mobileSheetState = 'full'
      } else {
        mapStore.closeMobileSheet()
      }
    } else {
      mapStore.activeTab = tab
    }
  }

  function onSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    mapStore.handleSearchInput(target.value)
    isSearchActive = true
  }

  function clearSearch() {
    mapStore.searchQuery = ''
    mapStore.searchResults = []
    mapStore.searchFocused = false
    isSearchActive = false
    searchInputEl?.focus()
  }

  function handleSelectResult(result: any) {
    mapStore.selectSearchResult(result)
    isSearchActive = false
    searchInputEl?.blur()
  }

  // Active module title & icon lookup
  let activeModuleMeta = $derived(
    mapStore.modules.find((m) => m.id === mapStore.activeTab) || {
      id: mapStore.activeTab,
      name: 'Tool details',
      shortTitle: 'Details'
    }
  )
</script>

<div class="mobile-layout-container">
  <!-- 1. Full-bleed Interactive Map Canvas -->
  <div class="mobile-map-stage">
    <MapCanvas />
  </div>

  <!-- 2. Top Floating Search & User Capsule -->
  <div class="mobile-top-header">
    <div class="mobile-search-capsule" class:focused={isSearchActive}>
      <div class="search-icon-wrap" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>

      <input
        bind:this={searchInputEl}
        type="text"
        class="mobile-search-input"
        placeholder="Search VicPlan address or parcel..."
        value={mapStore.searchQuery}
        oninput={onSearchInput}
        onfocus={() => {
          mapStore.searchFocused = true
          isSearchActive = true
        }}
        aria-label="Search address or parcel"
      />

      {#if mapStore.searchQuery}
        <button
          type="button"
          class="clear-btn"
          onclick={clearSearch}
          aria-label="Clear search query"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}

      <!-- Canonical User Avatar Context Menu -->
      <div class="mobile-avatar-slot">
        <UserAvatarMenu placement="top-right" />
      </div>
    </div>

    <!-- Search Suggestions Overlay -->
    {#if isSearchActive && mapStore.searchResults.length > 0}
      <div class="mobile-search-overlay" role="listbox">
        <div class="overlay-header">
          <span>SUGGESTED PARCELS ({mapStore.searchResults.length})</span>
          <button type="button" class="dismiss-search" onclick={() => (isSearchActive = false)}>
            Close
          </button>
        </div>
        <div class="suggestions-list">
          {#each mapStore.searchResults as r}
            <button
              type="button"
              class="suggestion-row"
              onclick={() => handleSelectResult(r)}
            >
              <div class="row-badge" data-category={r.category}>{r.category.toUpperCase()}</div>
              <div class="row-text">
                <span class="row-title">{r.title}</span>
                <span class="row-sub">{r.subtitle}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- 3. Dismiss Backdrop Scrim (Active when sheet is in full screen mode) -->
  {#if mapStore.mobileSheetState === 'full'}
    <div
      class="mobile-sheet-backdrop"
      role="button"
      tabindex="0"
      aria-label="Collapse bottom sheet to half"
      onclick={() => (mapStore.mobileSheetState = 'half')}
      onkeydown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter') mapStore.mobileSheetState = 'half'
      }}
    ></div>
  {/if}

  <!-- 4. Interactive Mobile Bottom Sheet (Snap points: closed, half, full) -->
  <div
    class="mobile-bottom-sheet"
    class:state-closed={mapStore.mobileSheetState === 'closed'}
    class:state-half={mapStore.mobileSheetState === 'half'}
    class:state-full={mapStore.mobileSheetState === 'full'}
  >
    <!-- Drag Handle & Sheet Header -->
    <div
      class="sheet-drag-zone"
      ontouchstart={onTouchStart}
      ontouchmove={onTouchMove}
      ontouchend={onTouchEnd}
      onclick={toggleSheetHeight}
      role="button"
      tabindex="0"
      onkeydown={(e) => { if (e.key === 'Enter') toggleSheetHeight() }}
      aria-label="Drag or toggle bottom sheet height"
    >
      <div class="drag-pill"></div>

      <div class="sheet-header-row">
        <div class="sheet-title-group">
          <span class="sheet-icon">
            <ModuleIcon id={activeModuleMeta.id} size={15} />
          </span>
          <span class="sheet-title">{activeModuleMeta.name}</span>
          <span class="sheet-state-badge">
            {mapStore.mobileSheetState === 'half' ? 'Tap to expand' : 'Tap to collapse'}
          </span>
        </div>

        <div class="header-action-group">
          <button
            type="button"
            class="sheet-height-btn"
            onclick={(e) => {
              e.stopPropagation()
              toggleSheetHeight()
            }}
            title={mapStore.mobileSheetState === 'half' ? 'Expand to full screen' : 'Collapse to half screen'}
            aria-label={mapStore.mobileSheetState === 'half' ? 'Expand to full screen' : 'Collapse to half screen'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              {#if mapStore.mobileSheetState === 'half'}
                <polyline points="18 15 12 9 6 15"></polyline>
              {:else}
                <polyline points="6 9 12 15 18 9"></polyline>
              {/if}
            </svg>
          </button>
          <button
            type="button"
            class="sheet-close-btn"
            onclick={(e) => {
              e.stopPropagation()
              mapStore.closeMobileSheet()
            }}
            title="Close sheet"
            aria-label="Close sheet"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Sheet Content Body (Scrollable) -->
    <div class="sheet-content-scroll">
      <ModuleRenderer id={mapStore.activeTab} />
    </div>
  </div>

  <!-- 5. Bottom Navigation Bar / Quick Module Dock -->
  <nav class="mobile-bottom-dock" aria-label="Mobile Navigation Dock">
    <button
      type="button"
      class="dock-item"
      class:active={mapStore.mobileSheetState === 'closed'}
      onclick={() => mapStore.closeMobileSheet()}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
        <line x1="8" y1="2" x2="8" y2="18"></line>
        <line x1="16" y1="6" x2="16" y2="22"></line>
      </svg>
      <span class="dock-label">Map</span>
    </button>

    <button
      type="button"
      class="dock-item"
      class:active={mapStore.mobileSheetState !== 'closed' && mapStore.activeTab === 'results'}
      onclick={() => onNavTap('results')}
    >
      <ModuleIcon id="results" size={18} />
      <span class="dock-label">Features</span>
    </button>

    <button
      type="button"
      class="dock-item"
      class:active={mapStore.mobileSheetState !== 'closed' && mapStore.activeTab === 'layers'}
      onclick={() => onNavTap('layers')}
    >
      <ModuleIcon id="layers" size={18} />
      <span class="dock-label">Layers</span>
    </button>

    <button
      type="button"
      class="dock-item"
      class:active={mapStore.mobileSheetState !== 'closed' && mapStore.activeTab === 'query'}
      onclick={() => onNavTap('query')}
    >
      <ModuleIcon id="query" size={18} />
      <span class="dock-label">Query</span>
    </button>

    <button
      type="button"
      class="dock-item"
      class:active={mapStore.mobileSheetState !== 'closed' && mapStore.activeTab === 'toolbox'}
      onclick={() => onNavTap('toolbox')}
    >
      <ModuleIcon id="toolbox" size={18} />
      <span class="dock-label">Tools</span>
    </button>
  </nav>
</div>

<style>
  .mobile-layout-container {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: var(--bg-canvas, #f8fafc);
  }

  .mobile-map-stage {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  /* 2. Top Header Capsule */
  .mobile-top-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    padding: max(10px, env(safe-area-inset-top, 10px)) 12px 0 12px;
    display: flex;
    flex-direction: column;
    pointer-events: none;
  }

  .mobile-search-capsule {
    pointer-events: auto;
    display: flex;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 28px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
    height: 44px;
    padding: 0 6px 0 14px;
    gap: 8px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .mobile-search-capsule.focused {
    border-color: var(--accent-primary);
    box-shadow: 0 6px 24px rgba(2, 132, 199, 0.25);
  }

  .search-icon-wrap {
    color: var(--accent-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .mobile-search-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13.5px;
    color: var(--text-main);
    font-family: inherit;
    min-width: 0;
  }

  .mobile-search-input::placeholder {
    color: var(--text-muted);
    font-size: 12.5px;
  }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .mobile-avatar-slot {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  /* Search Suggestions Overlay */
  .mobile-search-overlay {
    pointer-events: auto;
    margin-top: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    max-height: 55vh;
    display: flex;
    flex-direction: column;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-subtle);
    border-bottom: 1px solid var(--border-color);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .dismiss-search {
    border: none;
    background: transparent;
    color: var(--accent-primary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .suggestions-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .suggestion-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    text-align: left;
    cursor: pointer;
  }

  .suggestion-row:active {
    background-color: var(--bg-subtle);
  }

  .row-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    background-color: var(--bg-subtle);
    color: var(--accent-primary);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .row-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-sub {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 3. Dismiss Backdrop Scrim */
  .mobile-sheet-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.38);
    backdrop-filter: blur(2px);
    z-index: 28;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* 4. Bottom Sheet (Snap points) */
  .mobile-bottom-sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(56px + env(safe-area-inset-bottom, 0px));
    z-index: 30;
    background: var(--bg-panel);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.22);
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), height 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform, height;
  }

  .mobile-bottom-sheet.state-closed {
    transform: translateY(115%);
    pointer-events: none;
  }

  .mobile-bottom-sheet.state-half {
    transform: translateY(0);
    height: 48vh;
  }

  .mobile-bottom-sheet.state-full {
    transform: translateY(0);
    height: 84vh;
  }

  .sheet-drag-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 14px 8px 14px;
    cursor: grab;
    user-select: none;
    touch-action: none;
    border-bottom: 1px solid var(--border-subtle);
  }

  .drag-pill {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-color);
    margin-bottom: 6px;
  }

  .sheet-header-row {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sheet-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .sheet-icon {
    color: var(--accent-primary);
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .sheet-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    white-space: nowrap;
  }

  .sheet-state-badge {
    font-size: 10px;
    color: var(--text-muted);
    background-color: var(--bg-subtle);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .header-action-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .sheet-height-btn,
  .sheet-close-btn {
    border: none;
    background: var(--bg-subtle);
    border-radius: 50%;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }

  .sheet-height-btn:hover,
  .sheet-close-btn:hover {
    background: var(--bg-active);
    color: var(--accent-primary);
  }

  .sheet-content-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 12px;
  }

  /* 5. Bottom Navigation Bar / Quick Module Dock */
  .mobile-bottom-dock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    height: calc(56px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-sizing: border-box;
    background: var(--bg-card);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.06);
  }

  .dock-item {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .dock-item:active {
    background-color: var(--bg-subtle);
  }

  .dock-item.active {
    color: var(--accent-primary);
  }

  .dock-label {
    font-size: 10px;
    font-weight: 600;
  }
</style>
