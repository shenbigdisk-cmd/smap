<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { searchEngine } from '../services/search'

  let searchInputEl: HTMLInputElement | null = null
  let isPanelOpen = $derived(mapStore.sidebarOpen)
  let activeIndex = $state<number>(-1)

  function onSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    activeIndex = -1
    mapStore.handleSearchInput(target.value)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      mapStore.searchFocused = false
      searchInputEl?.blur()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (mapStore.searchResults.length > 0) {
        activeIndex = (activeIndex + 1) % mapStore.searchResults.length
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (mapStore.searchResults.length > 0) {
        activeIndex = (activeIndex - 1 + mapStore.searchResults.length) % mapStore.searchResults.length
      }
    } else if (e.key === 'Enter') {
      if (mapStore.searchResults.length > 0) {
        const selected = activeIndex >= 0 ? mapStore.searchResults[activeIndex] : mapStore.searchResults[0]
        mapStore.selectSearchResult(selected)
        searchInputEl?.blur()
      }
    }
  }

  function setFilter(providerId: string) {
    searchEngine.setActiveFilter(providerId)
    if (mapStore.searchQuery.trim()) {
      mapStore.handleSearchInput(mapStore.searchQuery)
    }
  }

  function clearSearch() {
    mapStore.clearSearch()
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
      placeholder="Search address, Lot/Plan, SPI, coordinates..."
      value={mapStore.searchQuery}
      oninput={onSearchInput}
      onfocus={() => (mapStore.searchFocused = true)}
      onkeydown={handleKeydown}
      aria-label="Search address or parcel on map"
    />

    {#if searchEngine.isSearching}
      <span class="search-busy-spinner" title="Searching spatial providers..." aria-label="Searching">
        <svg class="search-spinner-icon" viewBox="0 0 24 24" fill="none">
          <circle class="search-spinner-track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"></circle>
          <path class="search-spinner-head" d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
        </svg>
      </span>
    {/if}

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
      <!-- Provider Switcher / Filter Strip -->
      <div class="provider-filter-strip">
        <button
          type="button"
          class="provider-pill"
          class:active={searchEngine.activeFilter === 'all'}
          onclick={() => setFilter('all')}
        >
          <span>All</span>
          <span class="pill-count">{mapStore.searchResults.length}</span>
        </button>
        {#each searchEngine.providers as provider (provider.id)}
          {@const pCount = searchEngine.providerCounts[provider.id] || 0}
          <button
            type="button"
            class="provider-pill"
            class:active={searchEngine.activeFilter === provider.id}
            onclick={() => setFilter(provider.id)}
          >
            <span>{provider.name}</span>
            {#if pCount > 0}
              <span class="pill-count">{pCount}</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="results-list">
        {#each mapStore.searchResults as result, idx (result.id)}
          <button
            type="button"
            class="search-result-row"
            class:focused={idx === activeIndex}
            onclick={() => mapStore.selectSearchResult(result)}
            role="option"
            aria-selected={idx === activeIndex}
          >
            <div class="badges-col">
              <span class="category-badge" data-category={result.category}>
                {result.category.toUpperCase()}
              </span>
              {#if result.sourceName}
                <span class="source-sub-tag">{result.sourceName}</span>
              {/if}
            </div>
            <div class="result-text-group">
              <span class="result-title">{result.title}</span>
              <span class="result-sub">{result.subtitle}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {:else if mapStore.searchFocused && mapStore.searchQuery.trim().length >= 2 && !searchEngine.isSearching}
    <div class="search-results-dropdown empty-dropdown">
      <div class="empty-hint">No matches found in Vicmap or Cadastre.</div>
    </div>
  {/if}
</div>

<style>
  .map-search-card {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 35;
    width: 400px;
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

  .search-busy-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .search-spinner-icon {
    width: 14px;
    height: 14px;
    animation: search-spin 0.75s linear infinite;
  }

  .search-spinner-track {
    opacity: 0.25;
  }

  @keyframes search-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
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
    max-height: 320px;
    display: flex;
    flex-direction: column;
  }

  .empty-dropdown {
    padding: 12px;
  }

  .empty-hint {
    font-size: 11.5px;
    color: var(--text-muted);
    text-align: center;
  }

  /* Provider Filter Strip */
  .provider-filter-strip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
  }

  .provider-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 12px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s ease;
  }

  .provider-pill:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .provider-pill.active {
    background-color: var(--accent-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    font-weight: 700;
  }

  .pill-count {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.08);
  }

  :global([data-color-mode="dark"]) .pill-count {
    background-color: rgba(255, 255, 255, 0.12);
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
    padding: 8px 12px;
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

  .search-result-row:hover,
  .search-result-row.focused {
    background-color: var(--bg-subtle);
  }

  .badges-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    flex-shrink: 0;
    margin-top: 1px;
    min-width: 65px;
  }

  .category-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background-color: var(--bg-subtle);
    color: var(--text-muted);
  }

  .category-badge[data-category="address"] {
    background-color: rgba(2, 132, 199, 0.12);
    color: var(--accent-primary);
  }

  .category-badge[data-category="lot_plan"],
  .category-badge[data-category="spi"],
  .category-badge[data-category="parcel"] {
    background-color: rgba(16, 185, 129, 0.12);
    color: #059669;
  }

  .category-badge[data-category="lga"] {
    background-color: rgba(245, 158, 11, 0.12);
    color: #d97706;
  }

  .category-badge[data-category="coordinate"] {
    background-color: rgba(168, 85, 247, 0.12);
    color: #9333ea;
  }

  :global([data-color-mode="dark"]) .category-badge[data-category="lot_plan"],
  :global([data-color-mode="dark"]) .category-badge[data-category="spi"],
  :global([data-color-mode="dark"]) .category-badge[data-category="parcel"] {
    background-color: rgba(16, 185, 129, 0.22);
    color: #34d399;
  }

  :global([data-color-mode="dark"]) .category-badge[data-category="lga"] {
    background-color: rgba(245, 158, 11, 0.22);
    color: #fbbf24;
  }

  :global([data-color-mode="dark"]) .category-badge[data-category="coordinate"] {
    background-color: rgba(168, 85, 247, 0.22);
    color: #c084fc;
  }

  .source-sub-tag {
    font-size: 8px;
    color: var(--text-muted);
    letter-spacing: 0.02em;
    font-weight: 600;
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
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

