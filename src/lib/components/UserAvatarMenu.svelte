<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { MAP_CONFIG } from '../config/map.config'

  let {
    placement = 'top-right'
  }: {
    placement?: 'top-right' | 'bottom-left' | 'bottom-right'
  } = $props()

  let isOpen = $state(false)
  let menuContainerEl: HTMLDivElement | null = null

  type UserStatus = 'active' | 'busy' | 'field'
  let userStatus = $state<UserStatus>('active')

  let isFullscreen = $state(false)

  $effect(() => {
    function onFsChange() {
      isFullscreen = !!document.fullscreenElement
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  })

  $effect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isOpen && menuContainerEl && !menuContainerEl.contains(e.target as Node)) {
        isOpen = false
      }
    }
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        isOpen = false
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeydown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeydown)
    }
  })

  function toggleMenu() {
    isOpen = !isOpen
  }

  function openSettings() {
    isOpen = false
    mapStore.settingsModalOpen = true
  }

  function toggleMaximus() {
    isOpen = false
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  function resetStateExtent() {
    isOpen = false
    if (mapStore.map) {
      mapStore.map.fitBounds(MAP_CONFIG.extentVictoria.bbox, {
        padding: 50,
        duration: 1200
      })
    }
  }

  function clearActiveSelection() {
    isOpen = false
    mapStore.clearSelection()
    mapStore.clearIdentifyResults()
    mapStore.searchQuery = ''
    mapStore.searchResults = []
    mapStore.closeSidebar()
  }

  function setStatus(status: UserStatus) {
    userStatus = status
  }
</script>

<div class="user-avatar-container" bind:this={menuContainerEl}>
  <!-- Top Right Avatar Button -->
  <button
    type="button"
    class="avatar-btn"
    class:open={isOpen}
    onclick={toggleMenu}
    aria-haspopup="true"
    aria-expanded={isOpen}
    aria-label="User profile, status, and options"
    title="User status and options"
  >
    <div class="avatar-face">
      <!-- User Head Silhouette Icon -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>

    <!-- Status Indicator Dot on Avatar -->
    <span class="status-dot {userStatus}" aria-label="Status: {userStatus}"></span>
  </button>

  <!-- Avatar Dropdown Menu -->
  {#if isOpen}
    <div class="avatar-dropdown {placement}" role="menu">
      <!-- 1. User Identity & Status Section -->
      <div class="user-profile-header">
        <div class="profile-avatar-large">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="large-status-dot {userStatus}"></span>
        </div>

        <div class="profile-info">
          <div class="profile-name-row">
            <span class="profile-name">GIS Planning Officer</span>
            <span class="profile-badge">Local</span>
          </div>
          <span class="profile-dept">State Government of Victoria</span>
        </div>
      </div>

      <!-- User Status Selector Chips -->
      <div class="status-chips-bar" role="group" aria-label="Set active status">
        <button
          type="button"
          class="status-chip"
          class:active={userStatus === 'active'}
          onclick={() => setStatus('active')}
          title="Active Session"
        >
          <span class="chip-dot active-dot"></span>
          <span>Active</span>
        </button>
        <button
          type="button"
          class="status-chip"
          class:active={userStatus === 'busy'}
          onclick={() => setStatus('busy')}
          title="In Map Session (Do Not Disturb)"
        >
          <span class="chip-dot busy-dot"></span>
          <span>In Session</span>
        </button>
        <button
          type="button"
          class="status-chip"
          class:active={userStatus === 'field'}
          onclick={() => setStatus('field')}
          title="Field Inspection Mode"
        >
          <span class="chip-dot field-dot"></span>
          <span>Field Mode</span>
        </button>
      </div>

      <div class="dropdown-divider"></div>

      <!-- 2. Primary Menu Actions: Settings & Maximus (Maximize) -->
      <div class="menu-action-group">
        <!-- Settings Trigger -->
        <button
          type="button"
          class="menu-item-btn"
          onclick={openSettings}
          role="menuitem"
        >
          <div class="item-icon-box settings-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div class="item-text-group">
            <span class="item-title">Settings & Customization</span>
            <span class="item-subtitle">Layout, tabs, themes, and 3D features</span>
          </div>
        </button>

        <!-- Maximus (Maximize Canvas / Fullscreen) -->
        <button
          type="button"
          class="menu-item-btn"
          onclick={toggleMaximus}
          role="menuitem"
        >
          <div class="item-icon-box maximus-icon">
            {#if isFullscreen}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7"></path>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
            {/if}
          </div>
          <div class="item-text-group">
            <span class="item-title">{isFullscreen ? 'Exit Maximus' : 'Maximus (Maximize)'}</span>
            <span class="item-subtitle">{isFullscreen ? 'Restore standard windowed display' : 'Expand map canvas to fullscreen display'}</span>
          </div>
          <span class="shortcut-pill">{isFullscreen ? 'Esc' : 'F11'}</span>
        </button>
      </div>

      <div class="dropdown-divider"></div>

      <!-- 3. Workspace Utility Options -->
      <div class="menu-action-group">
        <button
          type="button"
          class="menu-item-btn secondary"
          onclick={resetStateExtent}
          role="menuitem"
        >
          <div class="item-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
          </div>
          <div class="item-text-group">
            <span class="item-title">Reset State View</span>
            <span class="item-subtitle">Fly to Victoria statewide boundary</span>
          </div>
        </button>

        <button
          type="button"
          class="menu-item-btn secondary"
          onclick={clearActiveSelection}
          role="menuitem"
        >
          <div class="item-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
          </div>
          <div class="item-text-group">
            <span class="item-title">Clear Active Parcel</span>
            <span class="item-subtitle">Deselect property and search queries</span>
          </div>
        </button>
      </div>

      <!-- 4. Footer Info -->
      <div class="menu-footer">
        <div class="footer-meta-row">
          <span class="footer-label">Layout:</span>
          <span class="footer-val">{mapStore.settings.layout}</span>
          <span class="footer-sep">•</span>
          <span class="footer-label">Theme:</span>
          <span class="footer-val">{mapStore.settings.theme}</span>
        </div>
        <span class="footer-privacy">Local-first • Private session</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .user-avatar-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Circular Avatar Button */
  .avatar-btn {
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background-color: var(--bg-card-subtle, rgba(255, 255, 255, 0.1));
    border: 1.5px solid var(--border-color, rgba(255, 255, 255, 0.2));
    color: var(--text-main, #0f172a);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Support inside headers & rails across all light and dark themes */
  :global(.app-header) .avatar-btn,
  :global(.action-bar-rail) .avatar-btn {
    background-color: var(--bg-header-btn);
    border-color: var(--border-header);
    color: var(--text-on-header);
  }

  :global(.app-header) .avatar-btn:hover,
  :global(.action-bar-rail) .avatar-btn:hover {
    background-color: var(--bg-header-btn);
    border-color: var(--accent-primary);
    color: var(--text-on-header);
  }

  .avatar-btn:hover {
    border-color: var(--accent-primary, #0284c7);
    background-color: var(--bg-subtle, rgba(255, 255, 255, 0.2));
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .avatar-btn.open {
    border-color: var(--accent-primary, #0284c7);
    box-shadow: 0 0 0 2px var(--accent-subtle, rgba(2, 132, 199, 0.3));
  }

  .avatar-face {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Status Indicator Dot */
  .status-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-header, var(--bg-card, #ffffff));
    background-color: #22c55e;
  }

  :global(.app-header) .status-dot,
  :global(.action-bar-rail) .status-dot {
    border-color: var(--bg-header);
  }

  .status-dot.active {
    background-color: #22c55e;
  }

  .status-dot.busy {
    background-color: #f59e0b;
  }

  .status-dot.field {
    background-color: #8b5cf6;
  }

  /* Dropdown Menu Container */
  .avatar-dropdown {
    position: absolute;
    width: 280px;
    background-color: var(--bg-card, #ffffff);
    color: var(--text-main, #0f172a);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    overflow: hidden;
  }

  /* Default top-right placement (Header top-right) */
  .avatar-dropdown.top-right {
    top: calc(100% + 8px);
    right: 0;
    animation: dropdownSlideIn 0.15s ease-out;
  }

  /* bottom-left placement (Action Bar bottom rail) */
  .avatar-dropdown.bottom-left {
    top: auto;
    bottom: 0;
    left: calc(100% + 12px);
    right: auto;
    animation: dropdownSlideInLeft 0.15s ease-out;
  }

  /* bottom-right placement (Compact Floating Search bar) */
  .avatar-dropdown.bottom-right {
    top: calc(100% + 8px);
    left: 0;
    right: auto;
    animation: dropdownSlideIn 0.15s ease-out;
  }

  @keyframes dropdownSlideIn {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes dropdownSlideInLeft {
    from {
      opacity: 0;
      transform: translateX(-6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  /* 1. Header Profile Box */
  .user-profile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px 10px 14px;
    background-color: var(--bg-card-subtle, #f8fafc);
  }

  .profile-avatar-large {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background-color: var(--accent-subtle, #e0f2fe);
    color: var(--accent-primary, #0284c7);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color, #cbd5e1);
    flex-shrink: 0;
  }

  .large-status-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-card-subtle, #ffffff);
  }

  .large-status-dot.active {
    background-color: #22c55e;
  }

  .large-status-dot.busy {
    background-color: #f59e0b;
  }

  .large-status-dot.field {
    background-color: #8b5cf6;
  }

  .profile-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .profile-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .profile-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #0f172a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 4px;
    border-radius: 3px;
    background-color: var(--bg-subtle, #e2e8f0);
    color: var(--text-muted, #64748b);
  }

  .profile-dept {
    font-size: 11px;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Status Chips */
  .status-chips-bar {
    display: flex;
    gap: 4px;
    padding: 4px 14px 10px 14px;
    background-color: var(--bg-card-subtle, #f8fafc);
  }

  .status-chip {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 3px 6px;
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    background-color: var(--bg-card, #ffffff);
    color: var(--text-muted, #64748b);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .status-chip:hover {
    color: var(--text-main, #0f172a);
    border-color: var(--accent-primary, #0284c7);
  }

  .status-chip.active {
    background-color: var(--accent-subtle, #e0f2fe);
    color: var(--accent-primary, #0284c7);
    border-color: var(--accent-primary, #0284c7);
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .active-dot {
    background-color: #22c55e;
  }

  .busy-dot {
    background-color: #f59e0b;
  }

  .field-dot {
    background-color: #8b5cf6;
  }

  .dropdown-divider {
    height: 1px;
    background-color: var(--border-subtle, #e2e8f0);
    margin: 0;
  }

  /* 2. Menu Action Items */
  .menu-action-group {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-item-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-main, #0f172a);
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s, color 0.12s;
  }

  .menu-item-btn:hover {
    background-color: var(--bg-subtle, #f1f5f9);
  }

  .item-icon-box {
    width: 28px;
    height: 28px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-subtle, #f1f5f9);
    color: var(--text-muted, #64748b);
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .menu-item-btn:hover .item-icon-box {
    background-color: var(--accent-subtle, #e0f2fe);
    color: var(--accent-primary, #0284c7);
  }

  .settings-icon {
    color: var(--accent-primary, #0284c7);
  }

  .maximus-icon {
    color: #6366f1;
  }

  .item-text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main, #0f172a);
  }

  .item-subtitle {
    font-size: 10px;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shortcut-pill {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 3px;
    background-color: var(--bg-subtle, #f1f5f9);
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-muted, #64748b);
  }

  /* 4. Footer */
  .menu-footer {
    padding: 8px 12px;
    background-color: var(--bg-card-subtle, #f8fafc);
    border-top: 1px solid var(--border-subtle, #e2e8f0);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .footer-meta-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
  }

  .footer-label {
    color: var(--text-muted, #64748b);
  }

  .footer-val {
    font-weight: 600;
    color: var(--text-main, #0f172a);
    text-transform: capitalize;
  }

  .footer-sep {
    color: var(--text-muted, #94a3b8);
  }

  .footer-privacy {
    font-size: 9.5px;
    color: var(--text-muted, #94a3b8);
  }

  @media (max-width: 768px) {
    .avatar-dropdown {
      right: 0 !important;
      left: auto !important;
      max-width: calc(100vw - 24px) !important;
    }
  }
</style>
