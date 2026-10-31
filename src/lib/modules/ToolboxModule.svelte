<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import ModuleIcon from './ModuleIcon.svelte'
  import ModuleRenderer from './ModuleRenderer.svelte'

  // Toolbox modules follow the user's custom module order from Settings
  let toolboxModules = $derived(mapStore.modules.filter((m) => !m.isPinned))

  // At most ONE section can be active at any time, or null if closed
  let activeId = $derived(mapStore.activeToolboxModuleId)

  // Clicking an open section closes it.
  // Clicking a closed section opens it (and closes any other).
  function toggleSection(id: string) {
    mapStore.toggleToolboxModule(id)
  }
</script>

<div class="toolbox-stack">
  {#if toolboxModules.length === 0}
    <div class="empty-toolbox">
      <p class="empty-text">All modules are currently pinned as top-level tabs.</p>
      <p class="empty-hint">Manage and unpin tabs via your User Avatar menu → Settings &amp; Customization.</p>
    </div>
  {/if}

  {#each toolboxModules as mod (mod.id)}
    {@const isOpen = activeId === mod.id}
    <div class="section-item" class:active={isOpen}>
      <button
        type="button"
        class="section-header"
        class:active={isOpen}
        data-module={mod.id}
        onclick={() => toggleSection(mod.id)}
        aria-expanded={isOpen}
        title={mod.description}
      >
        <div class="header-left">
          <div class="icon-wrap" class:active={isOpen}>
            <ModuleIcon id={mod.id} size={13} />
          </div>
          <span class="section-title">{mod.name}</span>
        </div>

        <div class="header-right">
          <svg
            class="chevron-arrow"
            class:open={isOpen}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </button>

      {#if isOpen}
        <div class="section-body">
          <ModuleRenderer id={mod.id} />
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toolbox-stack {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0;
    padding: 0;
    background-color: var(--bg-panel);
  }

  .section-item {
    border-bottom: 1px solid var(--border-color);
    background-color: var(--bg-panel);
    display: flex;
    flex-direction: column;
  }

  .section-item:last-child {
    border-bottom: none;
  }

  /* ALL Tool Section Headers: Uniform Dark Header Color (Sleek One-Line) */
  .section-header {
    width: 100%;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: #1e293b;
    border: none;
    border-left: 3px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease, border-color 0.15s ease;
    user-select: none;
    box-sizing: border-box;
  }

  .section-header:hover {
    background-color: #273549;
  }

  /* ACTIVE / SELECTED HEADER: A bit darker, with active accent notch */
  .section-header.active {
    background-color: #0f172a;
    border-left-color: var(--accent-primary);
  }

  .section-header.active:hover {
    background-color: #0b1120;
  }

  /* Header Left: Icon + Title in a single line */
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  /* Icon Wrap: Refined compact badge on dark header */
  .icon-wrap {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.15s ease;
  }

  .section-header:hover .icon-wrap {
    color: #f8fafc;
    background-color: rgba(255, 255, 255, 0.14);
  }

  .section-header.active .icon-wrap {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border-color: var(--accent-primary);
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #f8fafc;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease;
  }

  .section-header.active .section-title {
    color: #ffffff;
    font-weight: 700;
  }

  /* Right-side Chevron Indicator */
  .header-right {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .chevron-arrow {
    color: #64748b;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
  }

  .section-header:hover .chevron-arrow {
    color: #cbd5e1;
  }

  .chevron-arrow.open {
    transform: rotate(90deg);
    color: var(--accent-primary);
  }

  /* OUTSTANDING PANEL BODY: Highly prominent, clear, contrasting surface */
  .section-body {
    padding: 16px;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-color);
    border-bottom: 2px solid var(--border-color);
    border-left: 4px solid var(--accent-primary);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.05);
    animation: fadeInPanel 0.15s ease-out;
  }

  @keyframes fadeInPanel {
    from {
      opacity: 0.7;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .empty-toolbox {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    gap: 12px;
    text-align: center;
  }

  .empty-text {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
  }

  .empty-hint {
    font-size: 11px;
    color: var(--text-light);
    margin: 0;
    line-height: 1.4;
  }
</style>
