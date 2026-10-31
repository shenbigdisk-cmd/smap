<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import ModuleIcon from '../modules/ModuleIcon.svelte'
  import ModuleRenderer from '../modules/ModuleRenderer.svelte'

  let activeMod = $derived(
    mapStore.modules.find((m) => m.id === mapStore.activeTab)
  )

  let panelTitle = $derived(
    mapStore.activeTab === 'toolbox'
      ? 'Advanced GIS Toolbox'
      : activeMod?.name || 'Information Panel'
  )

  function closePanel() {
    mapStore.closeSidebar()
  }
</script>

<aside
  class="compact-panel"
  class:open={mapStore.sidebarOpen}
  aria-label={panelTitle}
  aria-hidden={!mapStore.sidebarOpen}
>
  <!-- Panel Header: Title + Icon + Close Button (No Tabs) -->
  <div class="panel-header">
    <div class="header-left">
      <div class="panel-icon-wrap">
        <ModuleIcon id={mapStore.activeTab} size={16} />
      </div>
      <span class="panel-heading">{panelTitle}</span>
    </div>

    <button
      class="panel-close-btn"
      onclick={closePanel}
      title="Close Panel"
      aria-label="Close panel"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
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
    bottom: 14px;
    width: 380px;
    max-width: calc(100vw - 28px);
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
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
    padding: 10px 14px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .panel-icon-wrap {
    color: var(--accent-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .panel-heading {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .panel-close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s, background-color 0.12s;
    flex-shrink: 0;
  }

  .panel-close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    background-color: var(--bg-panel);
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 640px) {
    .compact-panel {
      top: 64px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      width: auto;
      max-width: none;
    }
  }
</style>
