<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'
  import UserAvatarMenu from './UserAvatarMenu.svelte'

  let searchInputEl: HTMLInputElement | null = null

  function onSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    mapStore.handleSearchInput(target.value)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      mapStore.searchFocused = false
      searchInputEl?.blur()
    }
  }

  function clearSearch() {
    mapStore.clearSearch()
    searchInputEl?.focus()
  }
</script>

<header class="app-header">
  <div class="header-left">
    <button
      class="sidebar-toggle-btn"
      class:active={mapStore.sidebarOpen}
      onclick={() => mapStore.toggleSidebar()}
      aria-label={mapStore.sidebarOpen ? 'Collapse side panel' : 'Open side panel'}
      title={mapStore.sidebarOpen ? 'Collapse side panel' : 'Open side panel'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>

    <div class="brand-group">
      <div class="brand-badge">
        <span class="crest-text">VIC</span>
      </div>
      <div class="brand-text">
        <h1 class="brand-title">{mapStore.appTitle || MAP_CONFIG.title}</h1>
        <span class="brand-subtitle">{mapStore.appSubtitle || MAP_CONFIG.subtitle}</span>
      </div>
    </div>
  </div>

  <div class="header-center">
    <div class="search-container">
      <div class="search-input-wrapper">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>

        <input
          bind:this={searchInputEl}
          type="text"
          class="search-input"
          placeholder="Search address, Lot/Plan, SPI (e.g. 1\TP842910), or LGA..."
          value={mapStore.searchQuery}
          oninput={onSearchInput}
          onfocus={() => (mapStore.searchFocused = true)}
          onkeydown={handleKeydown}
          aria-label="Search address or parcel"
        />

        {#if mapStore.searchQuery}
          <button class="search-clear-btn" onclick={clearSearch} aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>

      {#if mapStore.searchFocused && mapStore.searchResults.length > 0}
        <div class="search-dropdown" role="listbox">
          <div class="dropdown-header">
            <span>SUGGESTED RESULTS</span>
            <span class="dropdown-count">{mapStore.searchResults.length} matches</span>
          </div>
          {#each mapStore.searchResults as result}
            <button
              class="search-result-item"
              onclick={() => mapStore.selectSearchResult(result)}
              role="option"
              aria-selected="false"
            >
              <div class="result-category-badge" data-category={result.category}>
                {result.category.toUpperCase()}
              </div>
              <div class="result-details">
                <span class="result-title">{result.title}</span>
                <span class="result-subtitle">{result.subtitle}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="header-right">
    <UserAvatarMenu />
  </div>
</header>

<style>
  .app-header {
    height: 52px;
    background-color: var(--bg-header);
    color: var(--text-on-header);
    border-bottom: 1px solid var(--border-header);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    gap: 16px;
    position: relative;
    z-index: 50;
    box-shadow: none;
    user-select: none;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }

  .sidebar-toggle-btn {
    background: transparent;
    border: none;
    color: var(--text-on-header-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s, color 0.15s;
  }

  .sidebar-toggle-btn:hover {
    background-color: var(--bg-header-btn);
    color: var(--text-on-header);
  }

  .sidebar-toggle-btn.active {
    background-color: var(--bg-header-btn);
    color: var(--accent-primary);
  }

  .brand-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-badge {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.05em;
  }

  .brand-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--text-on-header);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .brand-subtitle {
    font-size: 11px;
    color: var(--text-on-header-muted);
    display: block;
    line-height: 1.1;
  }

  .header-center {
    flex: 1;
    max-width: 580px;
    position: relative;
  }

  .search-container {
    position: relative;
    width: 100%;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background-color: var(--bg-header-btn);
    border: 1px solid var(--border-header);
    border-radius: 6px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .search-input-wrapper:focus-within {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-subtle);
    background-color: var(--bg-header);
  }

  .search-icon {
    position: absolute;
    left: 10px;
    color: var(--text-on-header-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 34px;
    background: transparent;
    border: none;
    padding: 0 34px 0 34px;
    color: var(--text-on-header);
    font-size: 13px;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-on-header-muted);
  }

  .search-clear-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--text-on-header-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-clear-btn:hover {
    color: var(--text-on-header);
    background-color: var(--bg-header-btn);
  }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background-color: var(--bg-card);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    z-index: 100;
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .search-result-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s;
  }

  .search-result-item:hover {
    background-color: var(--bg-subtle);
  }

  .result-category-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 3px;
    background-color: var(--bg-subtle);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .result-category-badge[data-category="address"] {
    background-color: var(--accent-subtle);
    color: var(--accent-primary);
  }

  .result-category-badge[data-category="spi"],
  .result-category-badge[data-category="parcel"] {
    background-color: #ede9fe;
    color: #5b21b6;
  }

  .result-category-badge[data-category="lga"] {
    background-color: #fef3c7;
    color: #92400e;
  }

  :global([data-color-mode="dark"]) .result-category-badge[data-category="spi"],
  :global([data-color-mode="dark"]) .result-category-badge[data-category="parcel"],
  :global([data-theme="dark"]) .result-category-badge[data-category="spi"],
  :global([data-theme="dark"]) .result-category-badge[data-category="parcel"] {
    background-color: #3b0764;
    color: #c084fc;
  }

  :global([data-color-mode="dark"]) .result-category-badge[data-category="lga"],
  :global([data-theme="dark"]) .result-category-badge[data-category="lga"] {
    background-color: #451a03;
    color: #fcd34d;
  }

  .result-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .result-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .brand-subtitle {
      display: none;
    }
  }
</style>
