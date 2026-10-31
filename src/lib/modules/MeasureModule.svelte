<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { formatArea, formatCoordinates, formatDistance } from '../utils/geodesy'

  let activeType = $derived(mapStore.measurement.type)
  let ptCount = $derived(mapStore.measurement.points.length)
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
</script>

<div class="measure-panel">
  <div class="measure-header">
    <span class="title">SPATIAL MEASUREMENT TOOLS</span>
    <span class="subtitle">Click on the map to place vertices</span>
  </div>

  <!-- Mode Switcher -->
  <div class="tool-selector">
    <button
      class="tool-btn"
      class:active={activeType === 'distance'}
      onclick={() => mapStore.setMeasurementMode('distance')}
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
      class="tool-btn"
      class:active={activeType === 'area'}
      onclick={() => mapStore.setMeasurementMode('area')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
      <span>Area</span>
    </button>

    <button
      class="tool-btn"
      class:active={activeType === 'coordinate'}
      onclick={() => mapStore.setMeasurementMode('coordinate')}
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
        <span class="label">Total Polyline Distance</span>
        <span class="value big">{distStr}</span>
      </div>
      <div class="sub-row">
        <span>Vertices placed: {ptCount}</span>
      </div>
    {:else if activeType === 'area'}
      <div class="reading-row">
        <span class="label">Total Enclosed Area</span>
        <span class="value big">{areaStr}</span>
      </div>
      <div class="sub-row">
        <span>Perimeter: {distStr} · Vertices: {ptCount}</span>
      </div>
    {:else if activeType === 'coordinate'}
      {#if coordDetails}
        <div class="reading-row">
          <span class="label">WGS84 / GDA2020 Decimal</span>
          <span class="value mono">{coordDetails.latLng}</span>
        </div>
        <div class="reading-row">
          <span class="label">Map Grid of Australia (Zone 55)</span>
          <span class="value mono">{coordDetails.mga55}</span>
        </div>
        <div class="reading-row">
          <span class="label">Degrees Minutes Seconds</span>
          <span class="value mono">{coordDetails.dms}</span>
        </div>
      {:else}
        <p class="empty-instruction">Click anywhere on the map to sample coordinates.</p>
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
          Click map to add points along a path. Values calculate dynamically.
        {:else if activeType === 'area'}
          Click map to draw a polygon boundary (requires at least 3 points).
        {:else}
          Click any feature or location to display official coordinates.
        {/if}
      </div>
    </div>
  {/if}

  <!-- Action Controls -->
  {#if activeType}
    <div class="measure-actions">
      <button
        class="action-btn secondary"
        disabled={ptCount === 0 && !mapStore.measurement.lastCoordinate}
        onclick={() => mapStore.clearMeasurement()}
      >
        Clear Measurement
      </button>

      <button
        class="action-btn done"
        onclick={() => mapStore.setMeasurementMode(null)}
      >
        Done Measuring
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
    gap: 2px;
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
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    display: inline-block;
    color: var(--text-main);
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
