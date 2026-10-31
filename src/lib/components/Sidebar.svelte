<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'
  import ModuleRenderer from '../modules/ModuleRenderer.svelte'

  interface TabItem {
    id: string
    name: string
    shortTitle: string
    category?: string
  }

  const TOOLBOX_TAB: TabItem = {
    id: 'toolbox',
    name: 'Advanced GIS Toolbox',
    shortTitle: 'Toolbox',
    category: 'Tools'
  }

  let pinnedModules = $derived(mapStore.modules.filter((m) => m.isPinned))

  // Count toolbox as a normal tab in the tabs sequence
  let allTabs = $derived<TabItem[]>([
    ...pinnedModules,
    TOOLBOX_TAB
  ])

  // In the sidebar tab bar, up to 4 tabs fit directly side-by-side without crowding.
  // When there are more than 4 tabs (not enough space), we show 3 direct tabs
  // and move the remaining tabs (including Toolbox) into the 'More' dropdown.
  const MAX_FIT_TABS = 4
  const DIRECT_SLOTS_WHEN_OVERFLOW = 3

  let visibleTabs = $derived(
    allTabs.length <= MAX_FIT_TABS
      ? allTabs
      : allTabs.slice(0, DIRECT_SLOTS_WHEN_OVERFLOW)
  )

  let overflowTabs = $derived(
    allTabs.length <= MAX_FIT_TABS
      ? []
      : allTabs.slice(DIRECT_SLOTS_WHEN_OVERFLOW)
  )

  let activeOverflow = $derived(
    overflowTabs.find((m) => m.id === mapStore.activeTab)
  )

  let moreDropdownOpen = $state(false)

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && moreDropdownOpen) {
      moreDropdownOpen = false
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<aside class="sidebar-container" class:collapsed={!mapStore.sidebarOpen}>
  <!-- Top Navigation Tab Bar -->
  <div class="sidebar-tab-bar" role="tablist">
    {#each visibleTabs as mod (mod.id)}
      <button
        type="button"
        class="tab-btn"
        class:active={mapStore.activeTab === mod.id}
        onclick={() => {
          moreDropdownOpen = false
          mapStore.setActiveTab(mod.id)
        }}
        role="tab"
        aria-selected={mapStore.activeTab === mod.id}
        title={mod.name}
      >
        <span class="tab-icon">
          <ModuleIcon id={mod.id} size={14} />
        </span>
        <span class="tab-label">{mod.shortTitle}</span>
        {#if mod.id === 'results' && mapStore.selectedParcel}
          <span class="active-dot"></span>
        {/if}
      </button>
    {/each}

    <!-- Overflow 'More' Dropdown for extra pinned modules -->
    {#if overflowTabs.length > 0}
      <div class="more-tab-container">
        <button
          type="button"
          class="tab-btn more-tab-btn"
          class:active={!!activeOverflow}
          onclick={() => (moreDropdownOpen = !moreDropdownOpen)}
          aria-haspopup="menu"
          aria-expanded={moreDropdownOpen}
          title={activeOverflow ? `Active: ${activeOverflow.name}. Click to switch tabs.` : 'More pinned modules'}
        >
          {#if activeOverflow}
            <span class="tab-icon">
              <ModuleIcon id={activeOverflow.id} size={14} />
            </span>
            <span class="tab-label">{activeOverflow.shortTitle}</span>
          {:else}
            <span class="tab-label">More</span>
            <span class="overflow-badge">+{overflowTabs.length}</span>
          {/if}
          <svg class="chevron-icon" class:open={moreDropdownOpen} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {#if moreDropdownOpen}
          <div
            class="dropdown-backdrop"
            onclick={() => (moreDropdownOpen = false)}
            tabindex="-1"
            role="presentation"
          ></div>
          <div class="more-dropdown-menu" role="menu">
            <div class="dropdown-header">
              <span>MORE TABS</span>
              <span class="dropdown-count">{overflowTabs.length} tabs</span>
            </div>
            <div class="dropdown-items">
              {#each overflowTabs as mod (mod.id)}
                <button
                  type="button"
                  class="dropdown-item"
                  class:active={mapStore.activeTab === mod.id}
                  onclick={() => {
                    mapStore.setActiveTab(mod.id)
                    moreDropdownOpen = false
                  }}
                  role="menuitem"
                >
                  <span class="item-icon">
                    <ModuleIcon id={mod.id} size={14} />
                  </span>
                  <div class="item-text">
                    <span class="item-title">{mod.name}</span>
                    <span class="item-category">{mod.shortTitle} • {mod.category || 'Tools'}</span>
                  </div>
                  {#if mapStore.activeTab === mod.id}
                    <svg class="item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Close / Collapse Button (integrated neatly inside the tab bar) -->
    <button
      type="button"
      class="sidebar-close-btn"
      onclick={() => mapStore.closeSidebar()}
      title="Collapse side panel"
      aria-label="Collapse side panel"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>

  <!-- Tab Content Body -->
  <div class="sidebar-body" class:flush-content={mapStore.activeTab === 'toolbox'}>
    <ModuleRenderer id={mapStore.activeTab} />
  </div>
</aside>

<style>
  .sidebar-container {
    width: 390px;
    height: 100%;
    background-color: var(--bg-panel);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.08);
    transform: translateX(0);
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
  }

  .sidebar-container.collapsed {
    transform: translateX(-100%);
    box-shadow: none;
    border-right-color: transparent;
    pointer-events: none;
  }

  .sidebar-tab-bar {
    display: flex;
    align-items: flex-end;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    padding: 6px 8px 0 8px;
    gap: 3px;
    height: 42px;
    box-sizing: border-box;
    position: relative;
    user-select: none;
    flex-shrink: 0;
  }

  /* Physical Connected Tab: NOT a floating button */
  .tab-btn {
    flex: 1;
    min-width: 0;
    height: 35px;
    margin-bottom: -1px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 8px;
    background: transparent;
    border: 1px solid transparent;
    border-bottom: 1px solid var(--border-color);
    border-radius: 6px 6px 0 0;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    position: relative;
    transition: color 0.15s ease, background-color 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    z-index: 1;
  }

  .tab-btn:hover:not(.active) {
    color: var(--text-main);
    background-color: var(--bg-subtle);
    border-color: var(--border-subtle) var(--border-subtle) var(--border-color) var(--border-subtle);
  }

  /* ACTIVE TAB: Seamlessly connected to the tab panel below (zero bottom seam) */
  .tab-btn.active {
    color: var(--accent-primary);
    background-color: var(--bg-panel);
    font-weight: 600;
    border: 1px solid var(--border-color);
    border-bottom: 1px solid var(--bg-panel);
    border-radius: 6px 6px 0 0;
    box-shadow: none;
    z-index: 2;
  }

  .tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 5px;
    height: 5px;
    background-color: var(--accent-primary);
    border-radius: 50%;
  }

  .more-tab-container {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-end;
  }

  .more-tab-btn {
    width: 100%;
    gap: 4px;
  }

  .more-tab-btn.active {
    color: var(--accent-primary);
    background-color: var(--bg-panel);
    font-weight: 600;
    border: 1px solid var(--border-color);
    border-bottom: 1px solid var(--bg-panel);
    border-radius: 6px 6px 0 0;
    box-shadow: none;
    z-index: 2;
  }

  .overflow-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    background-color: var(--bg-subtle);
    border-radius: 8px;
    color: var(--text-muted);
  }

  .chevron-icon {
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  .chevron-icon.open {
    transform: rotate(180deg);
  }

  .dropdown-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99;
  }

  .more-dropdown-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 230px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    z-index: 100;
    overflow: hidden;
    animation: fadeInMenu 0.15s ease;
  }

  @keyframes fadeInMenu {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .dropdown-count {
    font-weight: 500;
    color: var(--text-light);
  }

  .dropdown-items {
    padding: 4px;
    max-height: 260px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s ease;
    color: var(--text-main);
  }

  .dropdown-item:hover {
    background-color: var(--bg-subtle);
  }

  .dropdown-item.active {
    background-color: var(--accent-subtle);
    color: var(--accent-primary);
  }

  .dropdown-item .item-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .dropdown-item.active .item-icon {
    color: var(--accent-primary);
  }

  .item-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .item-title {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-category {
    font-size: 10px;
    color: var(--text-muted);
  }

  .item-check {
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .sidebar-close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 5px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    margin-left: 2px;
    margin-bottom: 5px;
    transition: background-color 0.15s, color 0.15s;
    z-index: 1;
  }

  .sidebar-close-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    background-color: var(--bg-panel);
    position: relative;
    z-index: 1;
  }

  .sidebar-body.flush-content {
    padding: 0;
  }

  @media (max-width: 640px) {
    .sidebar-container {
      width: 100vw;
      position: absolute;
      top: 52px;
      left: 0;
      bottom: 0;
      height: calc(100vh - 52px);
    }
  }
</style>
