<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'

  let searchInputEl: HTMLInputElement | null = null
  let isPanelOpen = $derived(mapStore.sidebarOpen)

  function onSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    mapStore.handleSearchInput(target.value)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      mapStore.searchFocused = false
      searchInputEl?.blur()
    } else if (e.key === 'Enter') {
      if (mapStore.searchResults.length > 0) {
        mapStore.selectSearchResult(mapStore.searchResults[0])
        searchInputEl?.blur()
      }
    }
  }

  function clearSearch() {
    mapStore.searchQuery = ''
    mapStore.searchResults = []
    mapStore.searchFocused = false
    searchInputEl?.focus()
  }
</script>

<div class="map-search-card" class:panel-open={isPanelOpen}>
  <div class="search-field-bar">
    <div class="search-lead-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </div>

    <input
      bind:this={searchInputEl}
      type="text"
      class="map-search-input"
      placeholder="Search address, Lot/Plan, SPI, LGA..."
      value={mapStore.searchQuery}
      oninput={onSearchInput}
      onfocus={() => (mapStore.searchFocused = true)}
      onkeydown={handleKeydown}
      aria-label="Search address or parcel on map"
    />

    {#if mapStore.searchQuery}
      <button
        type="button"
        class="search-clear-btn"
        onclick={clearSearch}
        title="Clear search"
        aria-label="Clear search"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>

  <!-- Autocomplete Suggestions Dropdown -->
  {#if mapStore.searchFocused && mapStore.searchResults.length > 0}
    <div class="search-results-dropdown" role="listbox">
      <div class="dropdown-header">
        <span>SUGGESTED PARCELS & ADDRESSES</span>
        <span class="count-pill">{mapStore.searchResults.length} matches</span>
      </div>

      <div class="results-list">
        {#each mapStore.searchResults as result}
          <button
            type="button"
            class="search-result-row"
            onclick={() => mapStore.selectSearchResult(result)}
            role="option"
            aria-selected="false"
          >
            <span class="category-badge" data-category={result.category}>
              {result.category.toUpperCase()}
            </span>
            <div class="result-text-group">
              <span class="result-title">{result.title}</span>
              <span class="result-sub">{result.subtitle}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .map-search-card {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 35;
    width: 380px;
    max-width: calc(100% - 28px);
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    transform: translateX(0);
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .map-search-card.panel-open {
    transform: translateX(380px);
  }

  @media (max-width: 640px) {
    .map-search-card.panel-open {
      display: none;
    }
  }

  .search-field-bar {
    display: flex;
    align-items: center;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06);
    height: 42px;
    padding: 0 10px 0 12px;
    gap: 8px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .search-field-bar:focus-within {
    border-color: var(--accent-primary);
    box-shadow: 0 4px 20px rgba(2, 132, 199, 0.22), 0 0 0 2px var(--accent-subtle);
  }

  .search-lead-icon {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .search-field-bar:focus-within .search-lead-icon {
    color: var(--accent-primary);
  }

  .map-search-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    color: var(--text-main);
    font-family: inherit;
    min-width: 0;
  }

  .map-search-input::placeholder {
    color: var(--text-muted);
    font-size: 12px;
  }

  .search-clear-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .search-clear-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }


  .search-results-dropdown {
    margin-top: 6px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
    overflow: hidden;
    max-height: 280px;
    display: flex;
    flex-direction: column;
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .count-pill {
    background-color: var(--bg-subtle);
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .results-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .search-result-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.05));
    text-align: left;
    cursor: pointer;
    transition: background-color 0.12s ease;
    width: 100%;
  }

  .search-result-row:last-child {
    border-bottom: none;
  }

  .search-result-row:hover {
    background-color: var(--bg-subtle);
  }

  .category-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    margin-top: 2px;
    background-color: var(--bg-subtle);
    color: var(--text-muted);
  }

  .category-badge[data-category="address"] {
    background-color: rgba(2, 132, 199, 0.12);
    color: var(--accent-primary);
  }

  .category-badge[data-category="lot_plan"],
  .category-badge[data-category="spi"] {
    background-color: rgba(16, 185, 129, 0.12);
    color: #059669;
  }

  .category-badge[data-category="lga"] {
    background-color: rgba(245, 158, 11, 0.12);
    color: #d97706;
  }

  :global([data-color-mode="dark"]) .category-badge[data-category="lot_plan"],
  :global([data-color-mode="dark"]) .category-badge[data-category="spi"] {
    background-color: rgba(16, 185, 129, 0.22);
    color: #34d399;
  }

  :global([data-color-mode="dark"]) .category-badge[data-category="lga"] {
    background-color: rgba(245, 158, 11, 0.22);
    color: #fbbf24;
  }

  .result-text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .result-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-sub {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
