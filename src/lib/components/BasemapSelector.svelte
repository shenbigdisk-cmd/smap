<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'
  import type { BasemapId } from '../types'
</script>

{#if mapStore.basemapMenuOpen}
  <div
    class="basemap-modal-backdrop"
    role="button"
    tabindex="0"
    aria-label="Close basemap selector"
    onclick={() => (mapStore.basemapMenuOpen = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        mapStore.basemapMenuOpen = false
      }
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="basemap-dialog"
      role="dialog"
      tabindex="-1"
      aria-labelledby="basemap-dialog-title"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="dialog-header">
        <div class="dialog-title-group">
          <h3 id="basemap-dialog-title" class="dialog-title">Select Base Map</h3>
          <span class="dialog-desc">Choose a cartographic or photographic base layer</span>
        </div>
        <button
          class="close-btn"
          onclick={() => (mapStore.basemapMenuOpen = false)}
          aria-label="Close basemap selector"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="basemap-grid">
        {#each MAP_CONFIG.basemaps as b}
          <button
            class="basemap-card"
            class:selected={mapStore.activeBasemapId === b.id}
            onclick={() => mapStore.setBasemap(b.id as BasemapId)}
          >
            <div class="card-preview" data-id={b.id}>
              {#if b.id === 'esri-satellite'}
                <div class="preview-aerial">
                  <div class="sat-grid"></div>
                </div>
              {:else if b.id === 'carto-dark'}
                <div class="preview-dark">
                  <div class="dark-road"></div>
                </div>
              {:else if b.id === 'carto-voyager'}
                <div class="preview-voyager">
                  <div class="color-park"></div>
                  <div class="color-road"></div>
                </div>
              {:else}
                <div class="preview-light">
                  <div class="light-road"></div>
                </div>
              {/if}
              {#if mapStore.activeBasemapId === b.id}
                <div class="selected-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              {/if}
            </div>
            <div class="card-info">
              <span class="basemap-name">{b.name}</span>
              <span class="basemap-desc">{b.description}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .basemap-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding-top: 66px;
    padding-right: 16px;
    background-color: transparent;
  }

  .basemap-dialog {
    width: 320px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 12px 14px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
  }

  .dialog-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-light);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    transition: color 0.12s, background-color 0.12s;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  .basemap-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px;
  }

  .basemap-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background-color: var(--bg-card);
    border: 1.5px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .basemap-card:hover {
    border-color: var(--accent-primary);
    background-color: var(--bg-subtle);
  }

  .basemap-card.selected {
    border-color: var(--accent-primary);
    background-color: var(--bg-active);
    box-shadow: 0 0 0 1px var(--accent-primary);
  }

  .card-preview {
    width: 56px;
    height: 42px;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .preview-light {
    width: 100%;
    height: 100%;
    background-color: #f1f5f9;
    position: relative;
  }
  .light-road {
    position: absolute;
    top: 50%;
    left: -10%;
    width: 120%;
    height: 4px;
    background-color: #ffffff;
    border-top: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    transform: rotate(25deg);
  }

  .preview-voyager {
    width: 100%;
    height: 100%;
    background-color: #e2e8f0;
    position: relative;
  }
  .color-park {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 60%;
    height: 60%;
    background-color: #bbf7d0;
  }
  .color-road {
    position: absolute;
    top: 30%;
    left: -10%;
    width: 120%;
    height: 5px;
    background-color: #fde047;
    border-top: 1px solid #ca8a04;
    border-bottom: 1px solid #ca8a04;
    transform: rotate(-15deg);
  }

  .preview-dark {
    width: 100%;
    height: 100%;
    background-color: #1e293b;
    position: relative;
  }
  .dark-road {
    position: absolute;
    top: 50%;
    left: -10%;
    width: 120%;
    height: 3px;
    background-color: #334155;
    transform: rotate(35deg);
  }

  .preview-aerial {
    width: 100%;
    height: 100%;
    background-color: #164e63;
    position: relative;
  }
  .sat-grid {
    width: 100%;
    height: 100%;
    background-color: #0e7490;
    opacity: 0.85;
  }

  .selected-badge {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 16px;
    height: 16px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .basemap-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .basemap-desc {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.3;
  }

  @media (max-width: 640px) {
    .basemap-modal-backdrop {
      justify-content: center;
      align-items: center;
      padding: 16px;
      background-color: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
    }

    .basemap-dialog {
      width: 100%;
      max-width: 340px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .basemap-grid {
      overflow-y: auto;
    }
  }
</style>
