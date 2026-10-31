<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { exportMapToPng } from '../utils/exportMap'

  let exportTitle = $state(
    mapStore.selectedParcel
      ? `VicPlan - ${mapStore.selectedParcel.address}`
      : 'VicPlan Statewide Planning Scheme Extent'
  )
  let isExporting = $state(false)

  async function triggerExport() {
    if (!mapStore.map) return
    isExporting = true
    try {
      await exportMapToPng(mapStore.map, exportTitle)
    } finally {
      isExporting = false
    }
  }
</script>

<div class="export-module">
  <div class="field-group">
    <label for="export-title-input" class="field-label">EXPORT MAP TITLE</label>
    <input
      id="export-title-input"
      type="text"
      bind:value={exportTitle}
      placeholder="Map banner title..."
      class="text-input"
    />
  </div>

  <div class="meta-preview">
    <div class="preview-row">
      <span class="preview-lbl">Scale & Coordinates:</span>
      <span class="preview-val">Auto-calculated from viewport</span>
    </div>
    <div class="preview-row">
      <span class="preview-lbl">Resolution:</span>
      <span class="preview-val">Full canvas native pixel density</span>
    </div>
    <div class="preview-row">
      <span class="preview-lbl">Format:</span>
      <span class="preview-val">Lossless PNG with VicPlan banner</span>
    </div>
  </div>

  <button
    class="export-btn"
    disabled={isExporting}
    onclick={triggerExport}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span>{isExporting ? 'Generating PNG...' : 'Download High-Res Map (PNG)'}</span>
  </button>
</div>

<style>
  .export-module {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .text-input {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-main);
    outline: none;
    background-color: var(--bg-input);
  }

  .text-input:focus {
    border-color: var(--accent-primary);
  }

  .meta-preview {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preview-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .preview-lbl {
    color: var(--text-muted);
  }

  .preview-val {
    color: var(--text-main);
    font-weight: 500;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 9px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }
</style>
