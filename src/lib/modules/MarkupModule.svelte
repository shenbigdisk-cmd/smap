<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import type { MarkupTool } from '../types'

  const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0f172a']

  function selectTool(tool: MarkupTool) {
    if (mapStore.activeMarkupTool === tool) {
      mapStore.setMarkupTool(null)
    } else {
      mapStore.setMarkupTool(tool)
    }
  }
</script>

<div class="markup-panel">
  <div class="panel-header">
    <span class="title">SPATIAL MARKUP & SKETCH</span>
    <span class="subtitle">Draw annotations, boundaries, and shapes on map</span>
  </div>

  <!-- Drawing Tools Grid -->
  <div class="tools-grid">
    <button
      type="button"
      class="tool-btn"
      class:active={mapStore.activeMarkupTool === 'point'}
      onclick={() => selectTool('point')}
      title="Pin Marker Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span>Pin</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={mapStore.activeMarkupTool === 'line'}
      onclick={() => selectTool('line')}
      title="Line String Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="4" y1="20" x2="20" y2="4"></line>
        <circle cx="4" cy="20" r="2.5" fill="currentColor"></circle>
        <circle cx="20" cy="4" r="2.5" fill="currentColor"></circle>
      </svg>
      <span>Line</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={mapStore.activeMarkupTool === 'polygon'}
      onclick={() => selectTool('polygon')}
      title="Polygon Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      </svg>
      <span>Polygon</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={mapStore.activeMarkupTool === 'rectangle'}
      onclick={() => selectTool('rectangle')}
      title="Rectangle Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      </svg>
      <span>Rectangle</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={mapStore.activeMarkupTool === 'circle'}
      onclick={() => selectTool('circle')}
      title="Circle Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"></circle>
      </svg>
      <span>Circle</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={mapStore.activeMarkupTool === 'freehand'}
      onclick={() => selectTool('freehand')}
      title="Freehand Sketch Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m18 2 4 4-12 12H6v-4L18 2z"></path>
      </svg>
      <span>Freehand</span>
    </button>

    <button
      type="button"
      class="tool-btn select-btn"
      class:active={mapStore.activeMarkupTool === 'select'}
      onclick={() => selectTool('select')}
      title="Select & Reshape Tool (midpoints, vertices, dragging)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m3 3 7 18 3-7 7-3L3 3z"></path>
      </svg>
      <span>Edit / Reshape</span>
    </button>
  </div>

  <!-- Utility Action Row (Undo, Redo, Finish) -->
  <div class="utility-row">
    <button
      type="button"
      class="util-btn"
      disabled={!mapStore.canUndoMarkup}
      onclick={() => mapStore.undoMarkup()}
      title="Undo last action (Ctrl+Z)"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 7v6h6"></path>
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
      </svg>
      <span>Undo</span>
    </button>

    <button
      type="button"
      class="util-btn"
      disabled={!mapStore.canRedoMarkup}
      onclick={() => mapStore.redoMarkup()}
      title="Redo action (Ctrl+Shift+Z)"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 7v6h-6"></path>
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
      </svg>
      <span>Redo</span>
    </button>

    {#if mapStore.activeMarkupTool}
      <button
        type="button"
        class="util-btn done-btn"
        onclick={() => mapStore.setMarkupTool(null)}
        title="Exit sketch mode (Esc)"
      >
        <span>Done</span>
      </button>
    {/if}
  </div>

  <!-- Color Picker -->
  <div class="color-picker-section">
    <span class="section-label">MARKUP COLOR</span>
    <div class="colors-row">
      {#each COLORS as c}
        <button
          type="button"
          class="color-chip"
          style="background-color: {c};"
          class:selected={mapStore.markupColor === c}
          onclick={() => mapStore.setMarkupColor(c)}
          aria-label="Select color {c}"
        ></button>
      {/each}
    </div>
  </div>

  <!-- Contextual Guidance Box -->
  <div class="instruction-box">
    {#if mapStore.activeMarkupTool === 'point'}
      <span>Click any location on the map canvas to place pin markers.</span>
    {:else if mapStore.activeMarkupTool === 'line'}
      <span>Click map to add line vertices. Double-click or press <strong>Enter</strong> to finish.</span>
    {:else if mapStore.activeMarkupTool === 'polygon'}
      <span>Click map to add polygon corners. Double-click or click starting vertex to close ring.</span>
    {:else if mapStore.activeMarkupTool === 'rectangle'}
      <span>Click and drag on the map canvas to draw a rectangular area.</span>
    {:else if mapStore.activeMarkupTool === 'circle'}
      <span>Click and drag on the map canvas to create a circle from center to radius.</span>
    {:else if mapStore.activeMarkupTool === 'freehand'}
      <span>Click and drag freehand to draw any custom outline directly on the map.</span>
    {:else if mapStore.activeMarkupTool === 'select'}
      <span>Click any shape on the map to select it. Drag corner handles or ghost midpoints to reshape.</span>
    {:else}
      <span>Select a tool above to sketch or edit vector graphics directly on the map.</span>
    {/if}
  </div>

  <!-- Active Markups List -->
  {#if mapStore.markups.length > 0}
    <div class="markups-list-box">
      <div class="list-head">
        <span>CURRENT MARKUPS ({mapStore.markups.length})</span>
      </div>
      <div class="items-wrap">
        {#each mapStore.markups as m, idx}
          <div class="markup-row">
            <span class="row-badge" style="background-color: {m.color};"></span>
            <span class="row-name" title={m.label || `${m.type.toUpperCase()} #${idx + 1}`}>
              {m.label || `${m.type.toUpperCase()} #${idx + 1}`}
            </span>
            <div class="row-btns">
              <button
                type="button"
                class="item-icon-btn"
                title="Zoom to markup"
                onclick={() => mapStore.zoomToMarkup(m.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
              <button
                type="button"
                class="item-icon-btn delete"
                title="Delete markup"
                onclick={() => mapStore.removeMarkup(m.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Actions Row -->
  <div class="actions-row">
    <button
      type="button"
      class="action-btn primary"
      disabled={mapStore.markups.length === 0}
      onclick={() => mapStore.exportMarkupsGeoJson()}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Export GeoJSON</span>
    </button>

    <button
      type="button"
      class="action-btn secondary"
      disabled={mapStore.markups.length === 0}
      onclick={() => mapStore.clearMarkups()}
    >
      Clear All
    </button>
  </div>
</div>

<style>
  .markup-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .panel-header {
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    padding-bottom: 8px;
  }

  .title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #64748b);
    letter-spacing: 0.05em;
    display: block;
  }

  .subtitle {
    font-size: 11px;
    color: var(--text-light, #94a3b8);
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 8px 4px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-btn.select-btn {
    grid-column: span 3;
    flex-direction: row;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
  }

  .tool-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .tool-btn.active {
    background-color: var(--bg-active);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    box-shadow: 0 0 0 1px var(--accent-primary);
  }

  .utility-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .util-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 6px 10px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid var(--border-color);
    background-color: var(--bg-card-subtle);
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.12s;
  }

  .util-btn:hover:not(:disabled) {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .util-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .util-btn.done-btn {
    background-color: var(--accent-primary);
    border-color: var(--accent-primary);
    color: var(--text-on-accent, #ffffff);
  }

  .util-btn.done-btn:hover {
    background-color: var(--accent-hover, #0284c7);
  }

  .color-picker-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .colors-row {
    display: flex;
    gap: 8px;
  }

  .color-chip {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid var(--bg-card);
    box-shadow: 0 0 0 1px var(--border-strong);
    cursor: pointer;
    transition: transform 0.15s;
  }

  .color-chip:hover {
    transform: scale(1.1);
  }

  .color-chip.selected {
    box-shadow: 0 0 0 2px var(--accent-primary);
    transform: scale(1.15);
  }

  .instruction-box {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .markups-list-box {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
  }

  .list-head {
    padding: 6px 10px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .items-wrap {
    display: flex;
    flex-direction: column;
    max-height: 220px;
    overflow-y: auto;
  }

  .markup-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
    color: var(--text-main);
  }

  .markup-row:last-child {
    border-bottom: none;
  }

  .row-badge {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .row-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-btns {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .item-icon-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    background: transparent;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s;
  }

  .item-icon-btn:hover {
    color: var(--accent-primary);
    border-color: var(--accent-primary);
    background-color: var(--bg-subtle);
  }

  .item-icon-btn.delete:hover {
    color: #ef4444;
    border-color: #ef4444;
    background-color: rgba(239, 68, 68, 0.1);
  }

  .actions-row {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .action-btn.primary {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
  }

  .action-btn.primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .action-btn.secondary {
    background-color: var(--bg-card-subtle);
    border-color: var(--border-color);
    color: var(--text-main);
  }

  .action-btn.secondary:hover:not(:disabled) {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
