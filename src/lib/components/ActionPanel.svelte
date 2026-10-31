<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import ModuleRenderer from '../modules/ModuleRenderer.svelte'

  let activeMod = $derived(
    mapStore.modules.find((m) => m.id === mapStore.activeTab)
  )

  let title = $derived(
    mapStore.activeTab === 'toolbox'
      ? 'Advanced GIS Toolbox'
      : activeMod?.name || 'Inspection Panel'
  )
</script>

<aside class="action-panel-drawer" class:hidden={!mapStore.sidebarOpen}>
  <div class="panel-header-bar">
    <div class="header-titles">
      <h2 class="panel-title">{title}</h2>
    </div>
    <button
      class="panel-close-btn"
      onclick={() => mapStore.closeSidebar()}
      title="Close Panel"
      aria-label="Close Panel"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>

  <div class="panel-content-area" class:flush-content={mapStore.activeTab === 'toolbox'}>
    <ModuleRenderer id={mapStore.activeTab} />
  </div>
</aside>

<style>
  .action-panel-drawer {
    width: 380px;
    height: 100vh;
    background-color: var(--bg-panel);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
    transform: translateX(0);
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
    overflow: hidden;
  }

  .action-panel-drawer.hidden {
    transform: translateX(-100%);
    box-shadow: none;
    border-right-color: transparent;
    pointer-events: none;
  }

  .panel-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
    line-height: 1.2;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .panel-close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
  }

  .panel-close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  .panel-content-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background-color: var(--bg-panel);
  }

  .panel-content-area.flush-content {
    padding: 0;
  }

  @media (max-width: 640px) {
    .action-panel-drawer {
      width: calc(100vw - 54px);
    }
  }
</style>
