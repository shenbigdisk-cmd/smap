<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import type { QueryResultFeature } from '../types'

  let popupEl = $state<HTMLDivElement | null>(null)
  let screenX = $state(0)
  let screenY = $state(0)
  let isFlippedBottom = $state(false)
  let viewMode = $state<'detail' | 'list'>('detail')
  let currentIdx = $derived(mapStore.popupFeatureIndex)

  let results = $derived(mapStore.identifyResults)
  let features = $derived(results?.features || [])
  let totalCount = $derived(features.length)
  let currentFeature = $derived<QueryResultFeature | null>(
    features.length > 0 ? features[Math.min(currentIdx, features.length - 1)] : null
  )

  // Keep index valid when features change
  $effect(() => {
    if (mapStore.popupFeatureIndex >= features.length && features.length > 0) {
      mapStore.popupFeatureIndex = 0
    }
  })

  // Whenever identify coordinate updates, recalculate screen position
  $effect(() => {
    if (mapStore.identifyCoordinate && mapStore.map) {
      updatePopupPosition()
    }
  })

  function updatePopupPosition() {
    if (!mapStore.map || !mapStore.identifyCoordinate) return
    const pt = mapStore.map.project(mapStore.identifyCoordinate)
    screenX = pt.x
    screenY = pt.y

    // If point is close to the top edge of map container, flip popup to appear below the point
    isFlippedBottom = pt.y < 260
  }

  function handleMapChange() {
    updatePopupPosition()
  }

  $effect(() => {
    const map = mapStore.map
    if (!map) return

    map.on('move', handleMapChange)
    map.on('zoom', handleMapChange)
    map.on('rotate', handleMapChange)
    map.on('pitch', handleMapChange)

    return () => {
      map.off('move', handleMapChange)
      map.off('zoom', handleMapChange)
      map.off('rotate', handleMapChange)
      map.off('pitch', handleMapChange)
    }
  })

  function nextFeature() {
    if (totalCount === 0) return
    mapStore.popupFeatureIndex = (mapStore.popupFeatureIndex + 1) % totalCount
  }

  function prevFeature() {
    if (totalCount === 0) return
    mapStore.popupFeatureIndex = (mapStore.popupFeatureIndex - 1 + totalCount) % totalCount
  }

  function selectFeatureFromList(idx: number) {
    mapStore.popupFeatureIndex = idx
    viewMode = 'detail'
  }

  function zoomToCurrent() {
    if (currentFeature?.geometry) {
      mapStore.zoomToFeatureGeometry(currentFeature.geometry)
    }
  }

  function dockToPanel() {
    mapStore.dockIdentifyToPanel()
  }

  function closePopup() {
    mapStore.clearIdentifyResults()
  }

  function getLayerColor(layerId: string): string {
    const layer = mapStore.layers.find((l) => l.id === layerId)
    return layer?.color || '#0284c7'
  }
</script>

{#if mapStore.identifyPopupOpen && totalCount > 0 && mapStore.identifyCoordinate}
  <!-- Click Pin Pulse Target on Map Canvas -->
  <div
    class="identify-target-pin"
    style="left: {screenX}px; top: {screenY}px;"
    aria-hidden="true"
  >
    <div class="pin-ring"></div>
    <div class="pin-center"></div>
  </div>

  <!-- Interactive Identify Popup Card -->
  <div
    bind:this={popupEl}
    class="identify-popup-card"
    class:flipped-bottom={isFlippedBottom}
    style="left: {screenX}px; top: {screenY}px;"
    role="region"
    aria-label="Map Identify Results"
  >
    <!-- Pointer Notch Triangle -->
    <div class="popup-notch" class:flipped={isFlippedBottom}></div>

    <!-- Header -->
    <div class="popup-header">
      <div class="header-left">
        <span class="identify-pill">
          IDENTIFY
        </span>
        {#if totalCount > 1}
          <div class="pager-controls">
            <button
              type="button"
              class="pager-btn"
              onclick={prevFeature}
              title="Previous feature"
              aria-label="Previous feature"
            >
              &lsaquo;
            </button>
            <span class="pager-counter">{currentIdx + 1} of {totalCount}</span>
            <button
              type="button"
              class="pager-btn"
              onclick={nextFeature}
              title="Next feature"
              aria-label="Next feature"
            >
              &rsaquo;
            </button>
          </div>
        {/if}
      </div>

      <div class="header-right">
        {#if totalCount > 1}
          <button
            type="button"
            class="header-action-btn"
            class:active={viewMode === 'list'}
            onclick={() => (viewMode = viewMode === 'list' ? 'detail' : 'list')}
            title={viewMode === 'list' ? 'Show feature detail' : 'Show all identified features list'}
          >
            {#if viewMode === 'list'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            {:else}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            {/if}
          </button>
        {/if}

        <!-- Dock to Features Side Panel -->
        <button
          type="button"
          class="header-action-btn dock-btn"
          onclick={dockToPanel}
          title="Dock to Features panel"
          aria-label="Dock to Features panel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>

        <!-- Close -->
        <button
          type="button"
          class="header-action-btn close-btn"
          onclick={closePopup}
          title="Close identify popup"
          aria-label="Close identify popup"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="popup-body">
      {#if viewMode === 'list'}
        <!-- Multi-feature List View -->
        <div class="popup-feature-list">
          {#each features as feat, idx (feat.id)}
            <button
              type="button"
              class="list-item-btn"
              class:selected={idx === currentIdx}
              onclick={() => selectFeatureFromList(idx)}
            >
              <div class="list-item-left">
                <span
                  class="layer-badge-dot"
                  style="background-color: {getLayerColor(feat.layerId)};"
                ></span>
                <div class="list-item-text">
                  <span class="list-item-title">{feat.title}</span>
                  <span class="list-item-sub">
                    {feat.layerTitle || feat.layerId}
                    {#if feat.subtitle} &bull; {feat.subtitle}{/if}
                  </span>
                </div>
              </div>
              <span class="arrow-glyph">&rarr;</span>
            </button>
          {/each}
        </div>
      {:else if currentFeature}
        <!-- Single Feature Detail View -->
        <div class="feature-detail-content">
          <div class="feature-title-block">
            <div class="feature-layer-tag">
              <span
                class="layer-color-dot"
                style="background-color: {getLayerColor(currentFeature.layerId)};"
              ></span>
              <span class="layer-name-txt">
                {currentFeature.layerTitle || currentFeature.layerId}
              </span>
            </div>
            <h4 class="feature-heading">{currentFeature.title}</h4>
            {#if currentFeature.subtitle}
              <span class="feature-subheading">{currentFeature.subtitle}</span>
            {/if}
          </div>

          <!-- Feature Attributes Grid / Table -->
          <div class="props-table">
            {#each Object.entries(currentFeature.properties || {}).slice(0, 6) as [key, val]}
              {#if val !== null && val !== undefined && val !== '' && key !== 'geometry' && key !== 'id'}
                <div class="prop-row">
                  <span class="prop-key">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span class="prop-val">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                </div>
              {/if}
            {/each}
          </div>

          <!-- Quick Action Buttons -->
          <div class="popup-footer-actions">
            {#if currentFeature.layerId === 'layer-parcels' || currentFeature.properties?.spi}
              <button
                type="button"
                class="footer-btn primary"
                onclick={() => (mapStore.reportModalOpen = true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>Planning Report</span>
              </button>
            {/if}

            <button type="button" class="footer-btn" onclick={zoomToCurrent}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Zoom</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Target Click Pin */
  .identify-target-pin {
    position: absolute;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 35;
  }

  .pin-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent-primary, #0284c7);
    background-color: rgba(2, 132, 199, 0.2);
    animation: pin-pulse 1.8s infinite ease-out;
  }

  .pin-center {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background-color: var(--accent-primary, #0284c7);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  }

  @keyframes pin-pulse {
    0% {
      transform: scale(0.6);
      opacity: 1;
    }
    100% {
      transform: scale(1.6);
      opacity: 0;
    }
  }

  /* Popup Card Container */
  .identify-popup-card {
    position: absolute;
    width: 320px;
    max-width: calc(100vw - 32px);
    background-color: var(--bg-card, #ffffff);
    color: var(--text-main, #0f172a);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.25),
      0 4px 10px -2px rgba(0, 0, 0, 0.1);
    z-index: 40;
    transform: translate(-50%, -100%) translateY(-14px);
    pointer-events: auto;
    font-size: 12px;
    overflow: visible;
    transition: transform 0.12s ease;
  }

  .identify-popup-card.flipped-bottom {
    transform: translate(-50%, 14px);
  }

  /* Triangle Pointer Notch */
  .popup-notch {
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid var(--bg-card, #ffffff);
    filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.1));
  }

  .popup-notch.flipped {
    bottom: auto;
    top: -8px;
    border-top: none;
    border-bottom: 8px solid var(--bg-card, #ffffff);
  }

  /* Header */
  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background-color: var(--bg-card-subtle, #f8fafc);
    border-bottom: 1px solid var(--border-subtle, #e2e8f0);
    border-top-left-radius: 7px;
    border-top-right-radius: 7px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .identify-pill {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: var(--accent-primary, #0284c7);
    color: var(--text-on-accent, #ffffff);
  }

  .pager-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pager-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-subtle, #cbd5e1);
    border-radius: 3px;
    color: var(--text-main, #0f172a);
    font-size: 13px;
    cursor: pointer;
    line-height: 1;
    transition: background-color 0.12s;
  }

  .pager-btn:hover {
    background-color: var(--bg-subtle, #e2e8f0);
  }

  .pager-counter {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #64748b);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-action-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted, #64748b);
    cursor: pointer;
    transition: color 0.12s, background-color 0.12s;
  }

  .header-action-btn:hover {
    color: var(--text-main, #0f172a);
    background-color: var(--bg-subtle, #e2e8f0);
  }

  .header-action-btn.active {
    color: var(--accent-primary, #0284c7);
    background-color: var(--bg-active, #e0f2fe);
  }

  .header-action-btn.close-btn:hover {
    color: #ef4444;
  }

  /* Body */
  .popup-body {
    padding: 10px 12px;
    max-height: 320px;
    overflow-y: auto;
  }

  .feature-detail-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .feature-title-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .feature-layer-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .layer-color-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .feature-heading {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #0f172a);
    margin: 0;
    line-height: 1.3;
  }

  .feature-subheading {
    font-size: 11px;
    color: var(--text-muted, #64748b);
  }

  /* Properties Table */
  .props-table {
    display: flex;
    flex-direction: column;
    background-color: var(--bg-card-subtle, #f8fafc);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 4px;
    overflow: hidden;
  }

  .prop-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border-subtle, #e2e8f0);
    font-size: 11px;
    gap: 8px;
  }

  .prop-row:last-child {
    border-bottom: none;
  }

  .prop-key {
    color: var(--text-muted, #64748b);
    font-weight: 500;
    white-space: nowrap;
  }

  .prop-val {
    color: var(--text-main, #0f172a);
    font-weight: 600;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Multi-feature List */
  .popup-feature-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .list-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 8px;
    border-radius: 5px;
    background-color: var(--bg-card-subtle, #f8fafc);
    border: 1px solid var(--border-subtle, #e2e8f0);
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s, border-color 0.12s;
  }

  .list-item-btn:hover {
    background-color: var(--bg-subtle, #e2e8f0);
    border-color: var(--accent-primary, #0284c7);
  }

  .list-item-btn.selected {
    background-color: var(--bg-active, #e0f2fe);
    border-color: var(--accent-primary, #0284c7);
  }

  .list-item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .layer-badge-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .list-item-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .list-item-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main, #0f172a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list-item-sub {
    font-size: 10px;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .arrow-glyph {
    color: var(--text-muted, #64748b);
    font-size: 13px;
  }

  /* Footer Actions */
  .popup-footer-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .footer-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 5px 9px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    background-color: var(--bg-card-subtle, #f8fafc);
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-main, #0f172a);
    transition: all 0.12s;
  }

  .footer-btn:hover {
    background-color: var(--bg-subtle, #e2e8f0);
  }

  .footer-btn.primary {
    background-color: var(--accent-primary, #0284c7);
    color: var(--text-on-accent, #ffffff);
    border-color: var(--accent-primary, #0284c7);
  }

  .footer-btn.primary:hover {
    background-color: var(--accent-hover, #0369a1);
  }
</style>
