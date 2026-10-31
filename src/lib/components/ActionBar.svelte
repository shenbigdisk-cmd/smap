<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import UserAvatarMenu from './UserAvatarMenu.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'

  let pinnedModules = $derived(mapStore.modules.filter((m) => m.isPinned))

  function handleRailClick(id: string) {
    mapStore.toggleTab(id as any)
  }
</script>

<aside class="action-bar-rail" aria-label="Primary Action Bar">
  <!-- Top Vic Badge / Brand Icon -->
  <div class="rail-top">
    <div class="brand-crest" title="State of Victoria WebGIS">
      <span class="crest-txt">VIC</span>
    </div>
  </div>

  <!-- Pinned Module Action Buttons -->
  <nav class="rail-nav">
    {#each pinnedModules as mod (mod.id)}
      <button
        class="rail-btn"
        class:active={mapStore.activeTab === mod.id && mapStore.sidebarOpen}
        class:current-tab={mapStore.activeTab === mod.id && !mapStore.sidebarOpen}
        onclick={() => handleRailClick(mod.id)}
        title={mod.name}
        aria-label={mod.name}
      >
        <span class="rail-icon-wrap">
          <ModuleIcon id={mod.id} size={20} />
          {#if mod.id === 'results' && mapStore.selectedParcel}
            <span class="rail-active-dot"></span>
          {/if}
        </span>
        <span class="rail-label">{mod.shortTitle}</span>
        <span class="active-indicator-bar" aria-hidden="true"></span>
      </button>
    {/each}

    <!-- Dedicated Toolbox Hub Button on Action Bar (normal rail-btn) -->
    <button
      class="rail-btn"
      class:active={mapStore.activeTab === 'toolbox' && mapStore.sidebarOpen}
      class:current-tab={mapStore.activeTab === 'toolbox' && !mapStore.sidebarOpen}
      onclick={() => handleRailClick('toolbox')}
      title="Advanced GIS Toolbox"
      aria-label="Toolbox"
    >
      <span class="rail-icon-wrap">
        <ModuleIcon id="toolbox" size={20} />
      </span>
      <span class="rail-label">Toolbox</span>
      <span class="active-indicator-bar" aria-hidden="true"></span>
    </button>
  </nav>

  <!-- Bottom User Avatar Menu (houses Settings, Maximus, User Status, Extent, Clear) -->
  <div class="rail-bottom">
    <UserAvatarMenu placement="bottom-left" />
  </div>
</aside>

<style>
  .action-bar-rail {
    width: 54px;
    height: 100vh;
    background-color: var(--bg-header);
    border-right: 1px solid var(--border-header);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    flex-shrink: 0;
    position: relative;
    z-index: 100;
    user-select: none;
  }

  .rail-top {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-header);
    width: 100%;
  }

  .brand-crest {
    width: 32px;
    height: 24px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .rail-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex: 1;
    padding: 8px 0;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .rail-btn {
    width: 44px;
    height: 50px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-on-header-muted);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px 2px;
    position: relative;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    user-select: none;
  }

  .rail-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rail-btn:hover:not(.active) {
    background-color: var(--bg-header-btn);
    color: var(--text-on-header);
    border-color: var(--border-header);
  }

  /* SELECTED & DRAWER OPEN: Bold, illuminated, unmistakably selected */
  .rail-btn.active {
    background-color: var(--bg-header-active);
    color: var(--text-on-header-active);
    border-color: var(--border-header-active);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--border-header-active);
    transform: scale(1.02);
  }

  .rail-btn.active .rail-label {
    font-weight: 700;
  }

  /* Left accent micro-notch inside the button for maximum recognition */
  .rail-btn.active::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background-color: currentColor;
    border-radius: 2px;
    opacity: 0.85;
  }

  /* Physical Right-edge Connection Notch directly to the ActionPanel Drawer */
  .active-indicator-bar {
    display: none;
    position: absolute;
    right: -5px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 28px;
    background-color: var(--indicator-header-active);
    border-radius: 3px 0 0 3px;
    box-shadow: 0 0 8px var(--indicator-header-active);
  }

  .rail-btn.active .active-indicator-bar {
    display: block;
  }

  /* SELECTED BUT DRAWER COLLAPSED: Outlined & right notch so user knows which tab is primed */
  .rail-btn.current-tab {
    color: var(--text-on-header);
    background-color: var(--bg-header-btn);
    border-color: var(--border-header);
  }

  .rail-btn.current-tab .active-indicator-bar {
    display: block;
    height: 14px;
    opacity: 0.75;
  }

  .rail-label {
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40px;
  }

  .rail-active-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    background-color: var(--accent-primary);
    border-radius: 50%;
  }

  .rail-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border-header);
    width: 100%;
  }
</style>
