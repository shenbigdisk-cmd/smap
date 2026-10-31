<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import UserAvatarMenu from './UserAvatarMenu.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'

  let sidepanelViews = $derived(mapStore.sidepanelViews)

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

  <!-- Pinned Module / View Action Buttons -->
  <nav class="rail-nav">
    {#each sidepanelViews as view (view.id)}
      <button
        class="rail-btn"
        class:active={mapStore.activeTab === view.id && mapStore.sidebarOpen}
        onclick={() => handleRailClick(view.id)}
        title={view.name}
        aria-label={view.name}
      >
        <span class="rail-icon-wrap">
          <ModuleIcon id={view.icon || view.id} size={20} />
          {#if (view.id === 'results' || view.moduleId === 'results') && mapStore.hasFeatureResults}
            <span class="rail-active-dot"></span>
          {/if}
        </span>
        <span class="rail-label">{view.shortTitle}</span>
      </button>
    {/each}

    <!-- Dedicated Toolbox Hub Button on Action Bar (normal rail-btn) -->
    <button
      class="rail-btn"
      class:active={mapStore.activeTab === 'toolbox' && mapStore.sidebarOpen}
      onclick={() => handleRailClick('toolbox')}
      title="Advanced GIS Toolbox"
      aria-label="Toolbox"
    >
      <span class="rail-icon-wrap">
        <ModuleIcon id="toolbox" size={20} />
      </span>
      <span class="rail-label">Toolbox</span>
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
    height: 44px;
    aspect-ratio: 1 / 1;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-on-header-muted);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 3px 2px;
    position: relative;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    user-select: none;
    box-sizing: border-box;
  }

  .rail-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rail-btn:focus {
    outline: none;
  }

  .rail-btn:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 1px;
  }

  .rail-btn:hover:not(.active) {
    background-color: var(--bg-header-btn);
    color: var(--text-on-header);
    border-color: var(--border-header);
  }

  /* SELECTED & DRAWER OPEN: Bold, illuminated, clean pill */
  .rail-btn.active {
    background-color: var(--bg-header-active);
    color: var(--text-on-header-active);
    border-color: var(--border-header-active);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  }

  .rail-btn.active .rail-label {
    font-weight: 700;
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
