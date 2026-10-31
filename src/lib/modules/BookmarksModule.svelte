<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'

  let newName = $state('')
  let newDesc = $state('')
  let isAdding = $derived(mapStore.isAddingBookmark)

  function saveBookmark() {
    if (!newName.trim()) return
    mapStore.addCurrentViewAsBookmark(newName, newDesc)
    newName = ''
    newDesc = ''
    mapStore.isAddingBookmark = false
  }
</script>

<div class="bookmarks-panel">
  {#if mapStore.settings.layout === 'site' && !isAdding}
    <div class="site-header-actions">
      <button
        type="button"
        class="site-add-btn"
        onclick={() => (mapStore.isAddingBookmark = true)}
      >
        + Bookmark Current View
      </button>
    </div>
  {/if}

  {#if isAdding}
    <div class="add-form">
      <span class="form-title">Bookmark Current View</span>
      <input
        type="text"
        bind:value={newName}
        placeholder="Bookmark title (e.g. Project Site Alpha)..."
        class="form-input"
      />
      <input
        type="text"
        bind:value={newDesc}
        placeholder="Description or notes..."
        class="form-input"
      />
      <div class="form-actions">
        <button type="button" class="cancel-btn" onclick={() => (mapStore.isAddingBookmark = false)}>
          Cancel
        </button>
        <button type="button" class="save-btn" onclick={saveBookmark} disabled={!newName.trim()}>
          Save Bookmark
        </button>
      </div>
    </div>
  {/if}

  <div class="bookmark-list">
    {#each mapStore.bookmarks as bm}
      <div class="bookmark-card">
        <button class="bm-jump-btn" onclick={() => mapStore.flyToBookmark(bm)}>
          <div class="bm-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
            </svg>
          </div>
          <div class="bm-info">
            <span class="bm-name">{bm.name}</span>
            <span class="bm-desc">{bm.description}</span>
            <span class="bm-meta">Zoom: {bm.zoom} {bm.pitch ? `· Pitch: ${bm.pitch}°` : ''}</span>
          </div>
        </button>

        {#if bm.isCustom}
          <button
            class="bm-del-btn"
            onclick={() => mapStore.deleteCustomBookmark(bm.id)}
            aria-label="Delete bookmark"
            title="Delete bookmark"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .bookmarks-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .site-header-actions {
    display: flex;
    justify-content: flex-end;
  }

  .site-add-btn {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-primary);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    margin-right: 8px;
  }

  .add-form {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
  }

  .form-input {
    width: 100%;
    height: 30px;
    padding: 0 8px;
    font-size: 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    outline: none;
    background-color: var(--bg-input);
    color: var(--text-main);
  }

  .form-input:focus {
    border-color: var(--accent-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .save-btn {
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .save-btn:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .bookmark-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bookmark-card {
    display: flex;
    align-items: center;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    transition: all 0.15s;
  }

  .bookmark-card:hover {
    border-color: var(--accent-primary);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .bm-jump-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .bm-icon {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    background-color: var(--bg-card-subtle);
    color: var(--accent-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .bm-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .bm-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bm-desc {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bm-meta {
    font-size: 10px;
    color: var(--text-light);
    font-variant-numeric: tabular-nums;
  }

  .bm-del-btn {
    background: transparent;
    border: none;
    color: var(--text-light);
    cursor: pointer;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s;
  }

  .bm-del-btn:hover {
    color: #ef4444;
  }
</style>
