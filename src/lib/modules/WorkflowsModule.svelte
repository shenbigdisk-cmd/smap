<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { SAMPLE_PARCELS } from '../data/sampleData'
  import ModuleIcon from './ModuleIcon.svelte'

  function zoomToSample(id: string) {
    mapStore.selectParcelById(id)
  }
</script>

<div class="workflows-panel">
  <div class="section-block">
    <div class="block-title">PRIMARY WORKFLOWS</div>
    <div class="task-list">
      <button class="task-item" onclick={() => mapStore.zoomToVictoriaExtent()}>
        <div class="task-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
        <div class="task-info">
          <span class="task-name">Statewide Extent</span>
          <span class="task-desc">Zoom out to full State of Victoria</span>
        </div>
      </button>

      <button class="task-item" onclick={() => mapStore.setActiveTab('layers')}>
        <div class="task-icon">
          <ModuleIcon id="layers" size={18} />
        </div>
        <div class="task-info">
          <span class="task-name">Planning Scheme Layers</span>
          <span class="task-desc">Toggle zones, overlays, and cadastre</span>
        </div>
      </button>

      <button class="task-item" onclick={() => mapStore.launchModule('measure')}>
        <div class="task-icon">
          <ModuleIcon id="measure" size={18} />
        </div>
        <div class="task-info">
          <span class="task-name">Measure Distance & Area</span>
          <span class="task-desc">Calculate parcel lengths and polygon boundaries</span>
        </div>
      </button>

      <button class="task-item" onclick={() => mapStore.launchModule('buffer')}>
        <div class="task-icon">
          <ModuleIcon id="buffer" size={18} />
        </div>
        <div class="task-info">
          <span class="task-name">Spatial Buffer & Notices</span>
          <span class="task-desc">Generate adjoining notification boundary rings</span>
        </div>
      </button>

      <button class="task-item highlight" onclick={() => mapStore.setActiveTab('toolbox')}>
        <div class="task-icon highlight">
          <ModuleIcon id="toolbox" size={18} />
        </div>
        <div class="task-info">
          <span class="task-name">All Tools (Advanced Toolbox)</span>
          <span class="task-desc">Access measurement, sketch, buffer, export & bookmarks</span>
        </div>
      </button>
    </div>
  </div>

  <div class="section-block">
    <div class="block-title">POPULAR PROPERTY LOOKUPS</div>
    <div class="popular-list">
      {#each SAMPLE_PARCELS.slice(0, 4) as p}
        <button class="property-link" onclick={() => zoomToSample(p.id)}>
          <div class="prop-marker"></div>
          <div class="prop-text">
            <span class="prop-address">{p.address}</span>
            <span class="prop-meta">{p.zone.code} · {p.spi} · {p.lga}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <div class="section-block info-card">
    <div class="info-badge">MODULAR WEBGIS ARCHITECTURE</div>
    <p class="info-text">
      Modules in the Toolbox can be pinned to the primary top tab rail for 1-click access. Expand multiple tool panes simultaneously inside the Toolbox for advanced spatial analysis.
    </p>
  </div>
</div>

<style>
  .workflows-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .section-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .block-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .task-item:hover {
    border-color: var(--accent-primary);
    background-color: var(--bg-subtle);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .task-item.highlight {
    background-color: var(--bg-card-subtle);
    border-color: var(--border-color);
  }

  .task-item.highlight:hover {
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  .task-icon {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    background-color: var(--bg-card-subtle);
    color: var(--accent-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .task-icon.highlight {
    background-color: var(--bg-active);
    color: var(--accent-primary);
  }

  .task-info {
    display: flex;
    flex-direction: column;
  }

  .task-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .task-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .popular-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .property-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s, border-color 0.12s;
  }

  .property-link:hover {
    background-color: var(--bg-active);
    border-color: var(--accent-primary);
  }

  .prop-marker {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--accent-primary);
    flex-shrink: 0;
  }

  .prop-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .prop-address {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prop-meta {
    font-size: 10px;
    color: var(--text-muted);
    font-family: inherit;
    font-variant-numeric: tabular-nums;
  }

  .info-card {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 12px;
  }

  .info-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-primary);
    margin-bottom: 4px;
  }

  .info-text {
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-muted);
    margin: 0;
  }
</style>
