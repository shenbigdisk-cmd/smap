<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import UserAvatarMenu from './UserAvatarMenu.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'

  let inputEl: HTMLInputElement | null = null
  let sidepanelViews = $derived(mapStore.sidepanelViews)

  function onSearch(e: Event) {
    const val = (e.target as HTMLInputElement).value
    mapStore.handleSearchInput(val)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      mapStore.searchFocused = false
      inputEl?.blur()
    }
  }

  function clear() {
    mapStore.clearSearch()
    inputEl?.focus()
  }

  function togglePanel(tab: string) {
    mapStore.toggleTab(tab as any)
  }
</script>

<div class="compact-floating-bar-wrapper">
  <!-- Horizontal Top Bar: Search card on left, Action buttons beside it -->
  <div class="compact-header-row">
    <!-- Google Maps Style Search Card -->
    <div class="floating-search-card">
      <!-- User Avatar & Status Menu (replaces old gear button) -->
      <UserAvatarMenu placement="bottom-right" />

      <div class="search-input-area">
        <input
          bind:this={inputEl}
          type="text"
          placeholder="Search VicPlan address or parcel..."
          value={mapStore.searchQuery}
          oninput={onSearch}
          onfocus={() => (mapStore.searchFocused = true)}
          onkeydown={handleKeydown}
          class="floating-input"
          aria-label="Search address or parcel"
        />
      </div>

      {#if mapStore.searchQuery}
        <button class="clear-btn" onclick={clear} aria-label="Clear search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}

      <div class="divider"></div>

      <button
        class="search-action-btn"
        onclick={() => {
          if (mapStore.searchResults.length > 0) {
            mapStore.selectSearchResult(mapStore.searchResults[0])
          }
        }}
        title="Search"
        aria-label="Submit search"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>

      <!-- Search Suggestions Dropdown -->
      {#if mapStore.searchFocused && mapStore.searchResults.length > 0}
        <div class="search-dropdown-menu" role="listbox">
          {#each mapStore.searchResults as r}
            <button
              class="dropdown-item"
              onclick={() => mapStore.selectSearchResult(r)}
              role="option"
              aria-selected="false"
            >
              <span class="badge" data-category={r.category}>{r.category.toUpperCase()}</span>
              <div class="item-text">
                <span class="item-title">{r.title}</span>
                <span class="item-sub">{r.subtitle}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Action Buttons Group: Pinned modules in custom user order, then Toolbox & Basemap -->
    <div class="floating-buttons-group">
      {#each sidepanelViews as view (view.id)}
        <button
          class="chip-btn"
          class:active={mapStore.activeTab === view.id && mapStore.sidebarOpen}
          onclick={() => togglePanel(view.id)}
          title={view.name}
          aria-label={view.name}
        >
          <ModuleIcon id={view.icon || view.id} size={18} />
          {#if (view.id === 'results' || view.moduleId === 'results') && mapStore.hasFeatureResults}
            <span class="active-dot" title="Active features available"></span>
          {/if}
        </button>
      {/each}

      <!-- 4. Toolbox Panel Button (Hosts all modules: Measure, Buffer, Markup, Bookmarks, Export) -->
      <button
        class="chip-btn"
        class:active={mapStore.activeTab === 'toolbox' && mapStore.sidebarOpen}
        onclick={() => togglePanel('toolbox')}
        title="GIS Toolbox"
        aria-label="GIS Toolbox"
      >
        <ModuleIcon id="toolbox" size={18} />
      </button>
    </div>
  </div>
</div>

<style>
  .compact-floating-bar-wrapper {
    position: absolute;
    top: 14px;
    left: 14px;
    right: 14px;
    z-index: 50;
    pointer-events: none;
  }

  .compact-header-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    position: relative;
    overflow: visible;
  }

  .floating-search-card {
    display: flex;
    align-items: center;
    background-color: var(--bg-card);
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    height: 44px;
    width: 320px;
    padding: 0 8px;
    position: relative;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
    pointer-events: auto;
    z-index: 60;
  }

  .search-input-area {
    flex: 1;
    margin: 0 8px;
    min-width: 0;
  }

  .floating-input {
    width: 100%;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--text-main);
    background: transparent;
  }

  .floating-input::placeholder {
    color: var(--text-light);
  }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--text-light);
    padding: 6px;
    cursor: pointer;
    transition: color 0.12s;
  }

  .clear-btn:hover {
    color: var(--text-main);
  }

  .divider {
    width: 1px;
    height: 22px;
    background-color: var(--border-color);
    margin: 0 4px;
  }

  .search-action-btn {
    background: transparent;
    border: none;
    padding: 8px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    color: var(--accent-primary);
  }

  .search-action-btn:hover {
    color: var(--accent-hover);
  }

  .search-dropdown-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background-color: var(--bg-card);
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border-color);
    overflow: hidden;
    z-index: 100;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s;
  }

  .dropdown-item:hover {
    background-color: var(--bg-subtle);
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: var(--bg-subtle);
    color: var(--text-muted);
  }

  .badge[data-category="address"] {
    background-color: var(--accent-subtle);
    color: var(--accent-primary);
  }

  .badge[data-category="spi"],
  .badge[data-category="parcel"] {
    background-color: #ede9fe;
    color: #5b21b6;
  }

  .badge[data-category="lga"] {
    background-color: #fef3c7;
    color: #92400e;
  }

  :global([data-color-mode="dark"]) .badge[data-category="spi"],
  :global([data-color-mode="dark"]) .badge[data-category="parcel"],
  :global([data-theme="dark"]) .badge[data-category="spi"],
  :global([data-theme="dark"]) .badge[data-category="parcel"] {
    background-color: #3b0764;
    color: #c084fc;
  }

  :global([data-color-mode="dark"]) .badge[data-category="lga"],
  :global([data-theme="dark"]) .badge[data-category="lga"] {
    background-color: #451a03;
    color: #fcd34d;
  }

  .item-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .item-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-sub {
    font-size: 11px;
    color: var(--text-muted);
  }

  /* Action Buttons Group */
  .floating-buttons-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    pointer-events: auto;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 2px 0;
    z-index: 55;
  }

  .floating-buttons-group::-webkit-scrollbar {
    display: none;
  }

  .chip-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-card);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    width: 38px;
    height: 38px;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .chip-btn:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
    color: var(--text-main);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.14);
  }

  .chip-btn.active {
    background-color: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
  }

  .active-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent-primary);
    border: 1.5px solid var(--bg-card);
  }

  .chip-btn.active .active-dot {
    background-color: #ffffff;
    border-color: var(--accent-primary);
  }

  @media (max-width: 640px) {
    .floating-search-card {
      width: 200px;
    }
  }
</style>
