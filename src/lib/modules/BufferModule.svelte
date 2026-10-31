<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'

  let p = $derived(mapStore.selectedParcel)
  let customRadius = $state(150)
</script>

<div class="buffer-module">
  {#if p}
    <div class="selected-summary">
      <div class="summary-top">
        <span class="lbl">BUFFER TARGET</span>
        <span class="val-mono">{p.spi}</span>
      </div>
      <span class="addr">{p.address}</span>
    </div>

    <div class="buffer-controls">
      <span class="section-label">PRESET BUFFER DISTANCES</span>
      <div class="preset-buttons">
        {#each [25, 50, 100, 200, 500] as r}
          <button
            class="radius-btn"
            class:active={mapStore.bufferState.active && mapStore.bufferState.radiusMeters === r}
            onclick={() => mapStore.setBufferRadius(r)}
          >
            {r}m
          </button>
        {/each}
      </div>

      <div class="custom-radius-row">
        <span class="section-label">CUSTOM DISTANCE</span>
        <div class="slider-group">
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            bind:value={customRadius}
            oninput={() => mapStore.setBufferRadius(customRadius)}
            class="range-slider"
          />
          <span class="slider-val">{customRadius} m</span>
        </div>
      </div>

      {#if mapStore.bufferState.active}
        <div class="active-buffer-card">
          <div class="card-left">
            <span class="status-dot"></span>
            <span class="active-txt">
              Active Geodesic Ring: <strong>{mapStore.bufferState.radiusMeters}m</strong>
            </span>
          </div>
          <button
            class="clear-btn"
            onclick={() => mapStore.clearBuffer()}
          >
            Clear Buffer
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-box">
      <span class="empty-title">Select a Property First</span>
      <p class="empty-desc">
        Click a parcel on the map or search an address to generate spatial notification buffer rings.
      </p>
      <button
        class="sample-btn"
        onclick={() => mapStore.selectParcelById('parcel-1')}
      >
        Select 120 Swanston Street
      </button>
    </div>
  {/if}
</div>

<style>
  .buffer-module {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .selected-summary {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .summary-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .val-mono {
    font-size: 10px;
    font-family: monospace;
    font-weight: 700;
    color: var(--accent-primary);
  }

  .addr {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
    line-height: 1.3;
  }

  .buffer-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .preset-buttons {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .radius-btn {
    padding: 6px 2px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.12s;
  }

  .radius-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .radius-btn.active {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border-color: var(--accent-primary);
  }

  .custom-radius-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .range-slider {
    flex: 1;
    height: 4px;
    accent-color: var(--accent-primary);
    cursor: pointer;
  }

  .slider-val {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    font-variant-numeric: tabular-nums;
    width: 48px;
    text-align: right;
  }

  .active-buffer-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background-color: var(--bg-active);
    border: 1px solid var(--accent-primary);
    border-radius: 6px;
  }

  .card-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent-primary);
  }

  .active-txt {
    font-size: 11px;
    color: var(--text-main);
  }

  .clear-btn {
    background: transparent;
    border: 1px solid var(--accent-primary);
    color: var(--accent-primary);
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }

  .clear-btn:hover {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
  }

  .empty-box {
    padding: 16px;
    background-color: var(--bg-card-subtle);
    border: 1px dashed var(--border-color);
    border-radius: 6px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .empty-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
  }

  .empty-desc {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .sample-btn {
    margin-top: 6px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--accent-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sample-btn:hover {
    background-color: var(--bg-active);
    border-color: var(--accent-primary);
  }
</style>
