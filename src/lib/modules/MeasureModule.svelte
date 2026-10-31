<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import type { MeasurementType } from '../types'
  import { formatArea, formatCoordinates, formatDistance } from '../utils/geodesy'

  let activeType = $derived(mapStore.measurement.type)
  let ptCount = $derived(mapStore.measurement.points.length)
  let isFinished = $derived(Boolean(mapStore.measurement.isFinished))
  let distStr = $derived(formatDistance(mapStore.measurement.totalDistanceMeters))
  let areaStr = $derived(formatArea(mapStore.measurement.totalAreaM2))

  let coordDetails = $derived(
    mapStore.measurement.lastCoordinate
      ? formatCoordinates(
          mapStore.measurement.lastCoordinate[0],
          mapStore.measurement.lastCoordinate[1]
        )
      : null
  )

  function selectTool(type: MeasurementType) {
    if (mapStore.measurement.type === type) {
      mapStore.setMeasurementMode(null)
    } else {
      mapStore.setMeasurementMode(type)
    }
  }
</script>

<div class="measure-panel">
  <div class="measure-header">
    <span class="title">SPATIAL MEASUREMENT TOOLS</span>
    <span class="subtitle">Click on map to measure · Double-click to finish</span>
  </div>

  <!-- Mode Switcher -->
  <div class="tool-selector">
    <button
      type="button"
      class="tool-btn"
      class:active={activeType === 'distance'}
      onclick={() => selectTool('distance')}
      title="Distance Measurement Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0l12.6 12.6z"></path>
        <line x1="7" y1="4" x2="8" y2="7"></line>
        <line x1="10" y1="7" x2="11" y2="10"></line>
        <line x1="13" y1="10" x2="14" y2="13"></line>
        <line x1="16" y1="13" x2="17" y2="16"></line>
      </svg>
      <span>Distance</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={activeType === 'area'}
      onclick={() => selectTool('area')}
      title="Area Measurement Tool"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
      <span>Area</span>
    </button>

    <button
      type="button"
      class="tool-btn"
      class:active={activeType === 'coordinate'}
      onclick={() => selectTool('coordinate')}
      title="GDA2020 Coordinate Inspector"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="22" y1="12" x2="18" y2="12"></line>
        <line x1="6" y1="12" x2="2" y2="12"></line>
        <line x1="12" y1="6" x2="12" y2="2"></line>
        <line x1="12" y1="22" x2="12" y2="18"></line>
      </svg>
      <span>Coordinate</span>
    </button>
  </div>

  <!-- Measurement Readings -->
  <div class="readings-card">
    {#if activeType === 'distance'}
      <div class="reading-row">
        <div class="row-header">
          <span class="label">Total Polyline Distance</span>
          {#if isFinished}
            <span class="status-badge finished">Finished</span>
          {:else if ptCount > 0}
            <span class="status-badge measuring">Drawing...</span>
          {/if}
        </div>
        <span class="value big">{distStr}</span>
      </div>
      <div class="sub-row">
        <span>Vertices placed: {ptCount}</span>
      </div>
    {:else if activeType === 'area'}
      <div class="reading-row">
        <div class="row-header">
          <span class="label">Total Enclosed Area</span>
          {#if isFinished}
            <span class="status-badge finished">Finished</span>
          {:else if ptCount > 0}
            <span class="status-badge measuring">Drawing...</span>
          {/if}
        </div>
        <span class="value big">{areaStr}</span>
      </div>
      <div class="sub-row">
        <span>Perimeter: {distStr} · Vertices: {ptCount}</span>
      </div>
    {:else if activeType === 'coordinate'}
      {#if coordDetails}
        <div class="reading-row">
          <span class="label">MGA2020 Zone 55 (Projected)</span>
          <span class="value mono">{coordDetails.mga2020}</span>
        </div>
        <div class="reading-row">
          <span class="label">GDA2020 Geographic</span>
          <span class="value mono">{coordDetails.gda2020LatLng}</span>
        </div>
        <div class="reading-row">
          <span class="label">Coordinate Datum</span>
          <span class="value mono sub">{coordDetails.datum}</span>
        </div>
      {:else}
        <p class="empty-instruction">Click anywhere on the map to sample GDA2020 coordinates.</p>
      {/if}
    {:else}
      <p class="empty-instruction">Select a measurement tool above to begin measuring on the map canvas.</p>
    {/if}
  </div>

  <!-- Instruction Helper -->
  {#if activeType}
    <div class="instruction-box">
      <div class="icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </div>
      <div class="text">
        {#if activeType === 'distance'}
          {#if isFinished}
            Measurement complete. Click Clear to start a new distance measurement.
          {:else}
            Click map to place line vertices. Follow the helper line. Double-click to finish.
          {/if}
        {:else if activeType === 'area'}
          {#if isFinished}
            Polygon complete. Click Clear to start a new area measurement.
          {:else}
            Click map to place polygon vertices. Follow the preview shape. Double-click to finish (requires 3+ points).
          {/if}
        {:else}
          Click any feature or parcel to sample official GDA2020 coordinates.
        {/if}
      </div>
    </div>
  {/if}

  <!-- Action Controls -->
  {#if activeType}
    <div class="measure-actions">
      {#if !isFinished && ((activeType === 'distance' && ptCount >= 2) || (activeType === 'area' && ptCount >= 3))}
        <button
          type="button"
          class="action-btn primary"
          onclick={() => mapStore.finishMeasurement()}
        >
          Finish
        </button>
      {/if}

      <button
        type="button"
        class="action-btn secondary"
        disabled={ptCount === 0 && !mapStore.measurement.lastCoordinate}
        onclick={() => mapStore.clearMeasurement()}
      >
        Clear
      </button>

      <button
        type="button"
        class="action-btn done"
        onclick={() => mapStore.setMeasurementMode(null)}
      >
        {isFinished ? 'Done' : 'Cancel'}
      </button>
    </div>
  {/if}
</div>

<style>
  .measure-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .measure-header {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    display: block;
  }

  .subtitle {
    font-size: 11px;
    color: var(--text-light);
  }

  .tool-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 4px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s;
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
  }

  .readings-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .reading-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .status-badge.measuring {
    background-color: rgba(236, 72, 153, 0.15);
    color: #db2777;
    border: 1px solid rgba(236, 72, 153, 0.3);
  }

  .status-badge.finished {
    background-color: rgba(22, 163, 74, 0.15);
    color: #16a34a;
    border: 1px solid rgba(22, 163, 74, 0.3);
  }

  .label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
    font-variant-numeric: tabular-nums;
  }

  .value.big {
    font-size: 20px;
    font-weight: 700;
    color: var(--accent-primary);
  }

  .value.mono {
    font-family: monospace;
    font-size: 11px;
    background-color: var(--bg-card-subtle);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    display: inline-block;
    color: var(--text-main);
  }

  .value.mono.sub {
    color: var(--text-muted);
    font-size: 10px;
  }

  .sub-row {
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .empty-instruction {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    text-align: center;
    padding: 10px 0;
  }

  .instruction-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .instruction-box .icon {
    color: var(--accent-primary);
    flex-shrink: 0;
    margin-top: 1px;
  }

  .measure-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 8px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .action-btn.primary {
    background-color: #db2777;
    color: #ffffff;
    border-color: #db2777;
  }

  .action-btn.primary:hover {
    background-color: #be185d;
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

  .action-btn.secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.done {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
  }

  .action-btn.done:hover {
    background-color: var(--accent-hover);
  }
</style>
