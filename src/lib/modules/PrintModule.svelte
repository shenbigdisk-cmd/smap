<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import {
    executePrint,
    getPrintDimensions,
    type PrintConfig
  } from '../utils/printMap'
  import { PLANNING_ZONES } from '../data/sampleData'

  let title = $state(
    mapStore.selectedParcel
      ? `VicPlan - ${mapStore.selectedParcel.address}`
      : 'VicPlan Statewide Planning Scheme Map'
  )

  let isExporting = $state(false)
  let statusMessage = $state<string | null>(null)

  let ps = mapStore.printSettings

  let dimensions = $derived(
    getPrintDimensions(ps.paperSize, ps.orientation, ps.dpi)
  )

  function onSettingChange() {
    mapStore.savePrintSettings()
  }

  async function handleExport() {
    if (!mapStore.map || isExporting) return
    isExporting = true
    statusMessage = 'Rendering map layout...'

    try {
      const legendItems = ps.showLegend
        ? Object.values(PLANNING_ZONES).map((z) => ({
            label: `${z.code} - ${z.name}`,
            color: z.fillColor,
            border: z.strokeColor
          }))
        : undefined

      const padLeft = mapStore.sidebarOpen
        ? (mapStore.settings.layout === 'site'
            ? 390
            : mapStore.settings.layout === 'application'
              ? 380
              : 0)
        : 0

      const config: PrintConfig = {
        title,
        paperSize: ps.paperSize,
        orientation: ps.orientation,
        dpi: ps.dpi,
        format: ps.format,
        showScale: ps.showScale,
        showNorthArrow: ps.showNorthArrow,
        showCoordinates: ps.showCoordinates,
        showLegend: ps.showLegend,
        legendItems,
        padLeft
      }

      await executePrint(mapStore.map, config)
      statusMessage = 'Export complete'
      setTimeout(() => {
        statusMessage = null
      }, 3000)
    } catch (err) {
      console.error('Print generation failed:', err)
      statusMessage = 'Export failed. Please try again.'
    } finally {
      isExporting = false
    }
  }

  function handleDirectPrint() {
    window.print()
  }
</script>

<div class="print-module">
  <!-- Title Input -->
  <div class="form-row">
    <label for="print-title" class="field-label">TITLE</label>
    <input
      id="print-title"
      type="text"
      bind:value={title}
      placeholder="Map sheet title..."
      class="text-input"
    />
  </div>

  <!-- Paper Size & Orientation (2-column layout) -->
  <div class="grid-two-col">
    <div class="form-row">
      <label for="paper-size" class="field-label">PAGE SIZE</label>
      <select id="paper-size" bind:value={ps.paperSize} onchange={onSettingChange} class="select-input">
        <option value="a4">A4 (297 × 210 mm)</option>
        <option value="a3">A3 (420 × 297 mm)</option>
        <option value="a5">A5 (210 × 148 mm)</option>
        <option value="letter">Letter (8.5 × 11 in)</option>
      </select>
    </div>

    <div class="form-row">
      <label for="page-orientation" class="field-label">ORIENTATION</label>
      <select id="page-orientation" bind:value={ps.orientation} onchange={onSettingChange} class="select-input">
        <option value="landscape">Landscape</option>
        <option value="portrait">Portrait</option>
      </select>
    </div>
  </div>

  <!-- Resolution (DPI) & Output Format (2-column layout) -->
  <div class="grid-two-col">
    <div class="form-row">
      <label for="print-dpi" class="field-label">RESOLUTION (DPI)</label>
      <select id="print-dpi" bind:value={ps.dpi} onchange={onSettingChange} class="select-input">
        <option value={96}>96 DPI (Screen Draft)</option>
        <option value={150}>150 DPI (Standard Print)</option>
        <option value={300}>300 DPI (High Resolution)</option>
      </select>
    </div>

    <div class="form-row">
      <label for="print-format" class="field-label">FORMAT</label>
      <select id="print-format" bind:value={ps.format} onchange={onSettingChange} class="select-input">
        <option value="pdf">PDF Document</option>
        <option value="png">PNG (Lossless)</option>
        <option value="jpeg">JPEG (Compressed)</option>
      </select>
    </div>
  </div>

  <!-- Cartographic Options Checklist -->
  <div class="options-checklist">
    <label class="check-item">
      <input type="checkbox" bind:checked={ps.showScale} onchange={onSettingChange} />
      <span>Scale bar & scale ratio</span>
    </label>

    <label class="check-item">
      <input type="checkbox" bind:checked={ps.showCoordinates} onchange={onSettingChange} />
      <span>Center coordinates (GDA2020 / MGA55)</span>
    </label>

    <label class="check-item">
      <input type="checkbox" bind:checked={ps.showNorthArrow} onchange={onSettingChange} />
      <span>North arrow compass</span>
    </label>

    <label class="check-item">
      <input type="checkbox" bind:checked={ps.showLegend} onchange={onSettingChange} />
      <span>Include planning symbology legend</span>
    </label>

    <label class="check-item">
      <input type="checkbox" bind:checked={ps.showPrintFrame} onchange={onSettingChange} />
      <span>Show print boundary frame on map</span>
    </label>
  </div>

  <!-- Dimension Preview Pill -->
  <div class="dimension-bar">
    <span class="dim-spec">{dimensions.widthPx} × {dimensions.heightPx} px</span>
    <span class="dim-meta">{ps.paperSize.toUpperCase()} {ps.orientation} @ {ps.dpi} DPI</span>
  </div>

  <!-- Actions -->
  <div class="actions-group">
    <button
      type="button"
      class="primary-print-btn"
      disabled={isExporting}
      onclick={handleExport}
    >
      {#if isExporting}
        <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        <span>{statusMessage || 'Generating export...'}</span>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if ps.format === 'pdf'}
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          {:else}
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          {/if}
        </svg>
        <span>Download {ps.format.toUpperCase()}</span>
      {/if}
    </button>

    <button
      type="button"
      class="secondary-print-btn"
      onclick={handleDirectPrint}
      title="Open browser print dialog directly"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      <span>Print to Printer</span>
    </button>
  </div>
</div>

<style>
  .print-module {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 2px;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .grid-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .text-input,
  .select-input {
    height: 32px;
    padding: 0 10px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-main);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .text-input:focus,
  .select-input:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-subtle);
  }

  .options-checklist {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 8px 10px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    margin-top: 2px;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-main);
    cursor: pointer;
    user-select: none;
  }

  .check-item input[type='checkbox'] {
    width: 14px;
    height: 14px;
    accent-color: var(--accent-primary);
    cursor: pointer;
    margin: 0;
  }

  .dimension-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background-color: var(--bg-subtle);
    border-radius: 4px;
    font-size: 11px;
  }

  .dim-spec {
    font-weight: 700;
    font-family: var(--font-mono, monospace);
    color: var(--text-main);
  }

  .dim-meta {
    color: var(--text-muted);
    font-size: 10px;
  }

  .actions-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .primary-print-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 36px;
    background-color: var(--accent-primary);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s, transform 0.08s;
  }

  .primary-print-btn:hover:not(:disabled) {
    background-color: var(--accent-hover, #0284c7);
  }

  .primary-print-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .secondary-print-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    background-color: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }

  .secondary-print-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .spin-icon {
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>