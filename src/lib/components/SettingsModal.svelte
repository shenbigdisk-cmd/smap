<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { ModuleIcon } from '../modules'
  import { aiService } from '../services/ai/aiService.svelte'
  import type { AppTheme } from '../types'

  let s = $derived(mapStore.settings)

  type SettingsCategory = 'layout' | 'modules' | 'theme' | 'map' | 'ai'
  let activeSection = $state<SettingsCategory>('layout')

  interface ThemeOption {
    id: AppTheme
    name: string
    family: string
    mode: 'Light' | 'Dark'
    description: string
    colors: {
      bg: string
      surface: string
      border: string
      accent: string
      header: string
    }
  }

  const THEME_OPTIONS: ThemeOption[] = [
    {
      id: 'light',
      name: 'VicPlan Classic',
      family: 'Cartographic',
      mode: 'Light',
      description: 'Clean Victorian state cartographic portal with Slate header',
      colors: {
        bg: '#f8fafc',
        surface: '#ffffff',
        border: '#cbd5e1',
        accent: '#0284c7',
        header: '#0f172a'
      }
    },
    {
      id: 'dark',
      name: 'Dark Matter',
      family: 'Cartographic',
      mode: 'Dark',
      description: 'Deep-space low-glare GIS workstation theme with electric blue',
      colors: {
        bg: '#090d16',
        surface: '#0f172a',
        border: '#334155',
        accent: '#38bdf8',
        header: '#020617'
      }
    },
    {
      id: 'fluent-light',
      name: 'Microsoft Fluent 2',
      family: 'Fluent 2',
      mode: 'Light',
      description: 'Clean Windows 11 & M365 aesthetic with Fluent Blue (#0f6cbd)',
      colors: {
        bg: '#f5f5f5',
        surface: '#ffffff',
        border: '#d1d1d1',
        accent: '#0f6cbd',
        header: '#f3f3f3'
      }
    },
    {
      id: 'fluent-dark',
      name: 'Fluent 2 Dark',
      family: 'Fluent 2',
      mode: 'Dark',
      description: 'Windows 11 dark mode with layered charcoal depth & subtle acrylic',
      colors: {
        bg: '#202020',
        surface: '#292929',
        border: '#3d3d3d',
        accent: '#2886de',
        header: '#1c1c1c'
      }
    },
    {
      id: 'github-light',
      name: 'GitHub Primer',
      family: 'GitHub',
      mode: 'Light',
      description: 'Developer-grade high-contrast light theme with classic dark header',
      colors: {
        bg: '#f6f8fa',
        surface: '#ffffff',
        border: '#d0d7de',
        accent: '#0969da',
        header: '#24292f'
      }
    },
    {
      id: 'github-dark',
      name: 'GitHub Dark',
      family: 'GitHub',
      mode: 'Dark',
      description: 'Iconic GitHub dark canvas with #0d1117 and #30363d borders',
      colors: {
        bg: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        accent: '#2f81f7',
        header: '#010409'
      }
    },
    {
      id: 'material-light',
      name: 'Material 3 Light',
      family: 'Material You',
      mode: 'Light',
      description: 'Google M3 expressive tonal surfaces with violet-indigo (#6750a4)',
      colors: {
        bg: '#f3edf7',
        surface: '#fef7ff',
        border: '#cac4d0',
        accent: '#6750a4',
        header: '#6750a4'
      }
    },
    {
      id: 'material-dark',
      name: 'Material 3 Dark',
      family: 'Material You',
      mode: 'Dark',
      description: 'Google M3 dark baseline with #141218 and soft pastel lilac',
      colors: {
        bg: '#141218',
        surface: '#1d1b20',
        border: '#49454f',
        accent: '#d0bcff',
        header: '#141218'
      }
    }
  ]

  let currentTheme = $derived(
    THEME_OPTIONS.find((t) => t.id === s.theme) ?? THEME_OPTIONS[0]
  )

  let draggedIndex = $state<number | null>(null)
  let dragOverIndex = $state<number | null>(null)

  function handleDragStart(index: number, e: DragEvent) {
    draggedIndex = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    }
  }

  function handleDragOver(index: number, e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    dragOverIndex = index
  }

  function handleDrop(index: number, e: DragEvent) {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      mapStore.moveView(draggedIndex, index)
    }
    draggedIndex = null
    dragOverIndex = null
  }

  function handleDragEnd() {
    draggedIndex = null
    dragOverIndex = null
  }

  function close() {
    mapStore.settingsModalOpen = false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
</script>

{#if mapStore.settingsModalOpen}
  <div
    class="settings-overlay"
    role="button"
    tabindex="0"
    aria-label="Close settings"
    onclick={close}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="settings-modal"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Application Settings"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="title-group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="gear-icon">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <h2 class="modal-title">Settings</h2>
        </div>
        <button class="close-btn" onclick={close} aria-label="Close settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-layout">
        <!-- Left Index Sidebar (Chrome Settings Style) -->
        <aside class="settings-sidebar">
          <nav class="sidebar-nav" aria-label="Settings categories">
            <button
              type="button"
              class="nav-item"
              class:active={activeSection === 'layout'}
              onclick={() => (activeSection = 'layout')}
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <span class="nav-label">Layout Mode</span>
            </button>

            <button
              type="button"
              class="nav-item"
              class:active={activeSection === 'modules'}
              onclick={() => (activeSection = 'modules')}
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              <span class="nav-label">Modules & Tabs</span>
            </button>

            <button
              type="button"
              class="nav-item"
              class:active={activeSection === 'theme'}
              onclick={() => (activeSection = 'theme')}
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
              </svg>
              <span class="nav-label">Appearance</span>
            </button>

            <button
              type="button"
              class="nav-item"
              class:active={activeSection === 'map'}
              onclick={() => (activeSection = 'map')}
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                <line x1="8" y1="2" x2="8" y2="18"></line>
                <line x1="16" y1="6" x2="16" y2="22"></line>
              </svg>
              <span class="nav-label">Map & 3D</span>
            </button>

            <button
              type="button"
              class="nav-item"
              class:active={activeSection === 'ai'}
              onclick={() => (activeSection = 'ai')}
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
              </svg>
              <span class="nav-label">AI Assistant</span>
            </button>
          </nav>
        </aside>

        <!-- Right Content Pane -->
        <main class="settings-content">
          {#if activeSection === 'layout'}
            <section class="section-pane">
              <div class="pane-header-block">
                <h3 class="pane-title">Interface Layout Mode</h3>
                <p class="pane-subtitle">Choose how the map canvas and navigation controls are structured</p>
              </div>

              <div class="layout-grid">
                <!-- Site Layout -->
                <button
                  type="button"
                  class="layout-card"
                  class:selected={s.layout === 'site'}
                  onclick={() => mapStore.setLayout('site')}
                >
                  <div class="layout-preview site-preview">
                    <div class="mock-header"></div>
                    <div class="mock-body">
                      <div class="mock-sidebar"></div>
                      <div class="mock-canvas"></div>
                    </div>
                  </div>
                  <div class="card-meta">
                    <span class="card-title">Site / Portal</span>
                    <span class="card-desc">Top banner & sidebar</span>
                  </div>
                </button>

                <!-- Application Layout (Geocortex / VicPlan) -->
                <button
                  type="button"
                  class="layout-card"
                  class:selected={s.layout === 'application'}
                  onclick={() => mapStore.setLayout('application')}
                >
                  <div class="layout-preview app-preview">
                    <div class="mock-body full">
                      <div class="mock-rail"></div>
                      <div class="mock-sidebar dense"></div>
                      <div class="mock-canvas">
                        <div class="mock-floating-tools"></div>
                      </div>
                    </div>
                  </div>
                  <div class="card-meta">
                    <span class="card-title">GIS Application</span>
                    <span class="card-desc">Full-screen GIS rail</span>
                  </div>
                </button>

                <!-- Compact Layout (Google Maps Style) -->
                <button
                  type="button"
                  class="layout-card"
                  class:selected={s.layout === 'compact'}
                  onclick={() => mapStore.setLayout('compact')}
                >
                  <div class="layout-preview compact-preview">
                    <div class="mock-canvas full">
                      <div class="mock-floating-search"></div>
                      <div class="mock-floating-chips"></div>
                    </div>
                  </div>
                  <div class="card-meta">
                    <span class="card-title">Compact Map</span>
                    <span class="card-desc">Floating controls</span>
                  </div>
                </button>
              </div>
            </section>
          {:else if activeSection === 'modules'}
            <section class="section-pane">
              <div class="pane-header-block with-action">
                <div>
                  <h3 class="pane-title">Views & Container Placement</h3>
                  <p class="pane-subtitle">Configure whether each view appears as a primary sidebar tab or inside the expandable Toolbox</p>
                </div>
                <button
                  type="button"
                  class="reset-order-btn"
                  onclick={() => {
                    mapStore.resetViewPlacements()
                    mapStore.resetModulesOrder()
                  }}
                  title="Reset default view placements and order"
                >
                  Reset Defaults
                </button>
              </div>

              <div class="module-config-list" role="list">
                {#each mapStore.views.filter((v) => v.id !== 'toolbox') as view, index (view.id)}
                  {@const parentMod = mapStore.modules.find((m) => m.id === view.moduleId)}
                  <div
                    class="module-config-row"
                    class:is-dragging={draggedIndex === index}
                    class:is-drag-over={dragOverIndex === index}
                    draggable="true"
                    ondragstart={(e) => handleDragStart(index, e)}
                    ondragover={(e) => handleDragOver(index, e)}
                    ondragleave={() => { if (dragOverIndex === index) dragOverIndex = null }}
                    ondrop={(e) => handleDrop(index, e)}
                    ondragend={handleDragEnd}
                    role="listitem"
                  >
                    <!-- Drag handle for reordering -->
                    <div class="drag-grip" title="Drag to reorder" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="9" cy="6" r="1.5" fill="currentColor"></circle>
                        <circle cx="15" cy="6" r="1.5" fill="currentColor"></circle>
                        <circle cx="9" cy="12" r="1.5" fill="currentColor"></circle>
                        <circle cx="15" cy="12" r="1.5" fill="currentColor"></circle>
                        <circle cx="9" cy="18" r="1.5" fill="currentColor"></circle>
                        <circle cx="15" cy="18" r="1.5" fill="currentColor"></circle>
                      </svg>
                    </div>

                    <!-- View Details -->
                    <div class="mod-meta">
                      <div class="mod-name-row">
                        <span class="mod-icon-badge">
                          <ModuleIcon id={view.icon || view.id} size={14} />
                        </span>
                        <span class="mod-name">{view.name}</span>
                        {#if parentMod && parentMod.id !== view.id}
                          <span class="mod-parent-tag">{parentMod.shortTitle}</span>
                        {/if}
                        <span class="mod-tag" data-category={view.category}>{view.category}</span>
                      </div>
                      <span class="mod-desc">{view.description}</span>
                    </div>

                    <!-- Sidepanel / Toolbox Placement Toggle -->
                    <div class="placement-segmented">
                      <button
                        type="button"
                        class="segment-btn"
                        class:selected={view.placement === 'sidepanel'}
                        onclick={() => mapStore.setViewPlacement(view.id, 'sidepanel')}
                      >
                        Sidepanel Tab
                      </button>
                      <button
                        type="button"
                        class="segment-btn"
                        class:selected={view.placement === 'toolbox'}
                        onclick={() => mapStore.setViewPlacement(view.id, 'toolbox')}
                      >
                        Toolbox
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          {:else if activeSection === 'theme'}
            <section class="section-pane">
              <div class="pane-header-block">
                <h3 class="pane-title">Theme & Appearance</h3>
                <p class="pane-subtitle">Choose from curated design languages: VicPlan Cartographic, Microsoft Fluent 2, GitHub Primer, and Google Material 3</p>
              </div>

              <div class="card-setting-box">
                <div class="form-row theme-form-row">
                  <div class="row-label-group">
                    <label for="setting-theme-select" class="row-label">Theme & Design System:</label>
                    <span class="row-sublabel">{currentTheme.description}</span>
                  </div>
                  <div class="theme-picker-group">
                    <div class="theme-swatch-pill" title="Current theme palette preview">
                      <span class="swatch" style="background-color: {currentTheme.colors.header};"></span>
                      <span class="swatch" style="background-color: {currentTheme.colors.surface};"></span>
                      <span class="swatch" style="background-color: {currentTheme.colors.bg};"></span>
                      <span class="swatch" style="background-color: {currentTheme.colors.accent};"></span>
                    </div>
                    <select
                      id="setting-theme-select"
                      class="styled-select theme-select"
                      value={s.theme}
                      onchange={(e) => mapStore.setTheme((e.target as HTMLSelectElement).value as AppTheme)}
                    >
                      <optgroup label="Cartographic / Government">
                        <option value="light">VicPlan Classic (Light)</option>
                        <option value="dark">Dark Matter (Dark)</option>
                      </optgroup>
                      <optgroup label="Microsoft Fluent 2">
                        <option value="fluent-light">Microsoft Fluent 2 (Light)</option>
                        <option value="fluent-dark">Fluent 2 Dark (Windows 11)</option>
                      </optgroup>
                      <optgroup label="GitHub Primer">
                        <option value="github-light">GitHub Primer (Light)</option>
                        <option value="github-dark">GitHub Dark (#0d1117)</option>
                      </optgroup>
                      <optgroup label="Google Material 3">
                        <option value="material-light">Google Material 3 (Light)</option>
                        <option value="material-dark">Material 3 Dark (#141218)</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div class="theme-preview-card">
                  <div class="preview-badge-row">
                    <span class="preview-family">{currentTheme.family}</span>
                    <span class="preview-mode" class:dark={currentTheme.mode === 'Dark'}>{currentTheme.mode}</span>
                  </div>
                  <div class="preview-name">{currentTheme.name}</div>
                  <div class="preview-palette-bar">
                    <div class="palette-swatch" style="background-color: {currentTheme.colors.header};" title="Header: {currentTheme.colors.header}">
                      <span>Header</span>
                    </div>
                    <div class="palette-swatch" style="background-color: {currentTheme.colors.surface};" title="Surface: {currentTheme.colors.surface}">
                      <span>Surface</span>
                    </div>
                    <div class="palette-swatch" style="background-color: {currentTheme.colors.bg};" title="Canvas: {currentTheme.colors.bg}">
                      <span>Canvas</span>
                    </div>
                    <div class="palette-swatch" style="background-color: {currentTheme.colors.accent};" title="Accent: {currentTheme.colors.accent}">
                      <span>Accent</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          {:else if activeSection === 'map'}
            <section class="section-pane">
              <div class="pane-header-block">
                <h3 class="pane-title">Map & 3D Features</h3>
                <p class="pane-subtitle">Configure 3D volumetric building mass extrusions and performance options</p>
              </div>

              <div class="card-setting-box">
                <div class="form-row">
                  <div class="row-label-group">
                    <label for="setting-identify-mode" class="row-label">Map Click Identify Destination</label>
                    <span class="row-sublabel">Choose whether clicking features on the map displays a popup pane or opens the side panel</span>
                  </div>
                  <select
                    id="setting-identify-mode"
                    class="styled-select"
                    value={s.identifyDisplayMode || 'auto'}
                    onchange={(e) =>
                      mapStore.updateSettings({
                        identifyDisplayMode: (e.target as HTMLSelectElement).value as any
                      })
                    }
                  >
                    <option value="auto">Automatic (Popup in App & Compact, Sidepanel in Site)</option>
                    <option value="popup">Map Popup Pane</option>
                    <option value="panel">Side Panel (Features Panel)</option>
                  </select>
                </div>
              </div>

              <div class="card-setting-box">
                <div class="form-row">
                  <div class="row-label-group">
                    <span class="row-label">3D Building Mass Extrusions</span>
                    <span class="row-sublabel">Render architectural building heights dynamically on the map canvas</span>
                  </div>
                  <label class="switch-toggle">
                    <input
                      type="checkbox"
                      checked={s.buildings3D}
                      onchange={(e) =>
                        mapStore.updateSettings({
                          buildings3D: (e.target as HTMLInputElement).checked
                        })
                      }
                    />
                    <span class="slider-round"></span>
                  </label>
                </div>
              </div>
            </section>
          {:else if activeSection === 'ai'}
            <section class="section-pane">
              <div class="pane-header-block">
                <h3 class="pane-title">AI Assistant & Provider</h3>
              </div>

              <div class="card-setting-box">
                <div class="form-row">
                  <div class="row-label-group">
                    <label for="ai-provider" class="row-label">Intelligence Provider</label>
                  </div>
                  <select
                    id="ai-provider"
                    class="styled-select"
                    value={aiService.config.provider}
                    onchange={(e) => aiService.saveConfig({ provider: (e.target as HTMLSelectElement).value as any })}
                  >
                    <option value="gemini">Google Gemini (Cloud AI)</option>
                    <option value="built-in">Built-in Spatial Agent (Zero Setup / Offline)</option>
                    <option value="ollama">Ollama (Local LLM)</option>
                    <option value="openai-compatible">OpenAI-Compatible Local Endpoint</option>
                  </select>
                </div>

                {#if aiService.config.provider === 'gemini'}
                  <div class="form-row">
                    <div class="row-label-group">
                      <label for="gemini-key" class="row-label">Gemini API Key</label>
                    </div>
                    <input
                      id="gemini-key"
                      type="password"
                      class="styled-input"
                      value={aiService.config.geminiApiKey || ''}
                      oninput={(e) => aiService.saveConfig({ geminiApiKey: (e.target as HTMLInputElement).value })}
                      placeholder="Enter Gemini API key"
                    />
                  </div>

                  <div class="form-row">
                    <div class="row-label-group">
                      <label for="gemini-model" class="row-label">Gemini Model</label>
                    </div>
                    <select
                      id="gemini-model"
                      class="styled-select"
                      value={aiService.config.geminiModel || 'gemini-2.5-flash'}
                      onchange={(e) => aiService.saveConfig({ geminiModel: (e.target as HTMLSelectElement).value })}
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Accurate)</option>
                      <option value="gemini-flash-latest">gemini-flash-latest</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (Deep Reasoning)</option>
                      <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Ultra Fast)</option>
                    </select>
                  </div>
                {/if}

                {#if aiService.config.provider === 'ollama' || aiService.config.provider === 'openai-compatible'}
                  <div class="form-row">
                    <div class="row-label-group">
                      <label for="ai-endpoint" class="row-label">Endpoint Host</label>
                    </div>
                    <input
                      id="ai-endpoint"
                      type="text"
                      class="styled-input"
                      value={aiService.config.endpoint}
                      oninput={(e) => aiService.saveConfig({ endpoint: (e.target as HTMLInputElement).value })}
                      placeholder="http://localhost:11434"
                    />
                  </div>

                  <div class="form-row">
                    <div class="row-label-group">
                      <label for="ai-model" class="row-label">Model Name</label>
                    </div>
                    <input
                      id="ai-model"
                      type="text"
                      class="styled-input"
                      value={aiService.config.model}
                      oninput={(e) => aiService.saveConfig({ model: (e.target as HTMLInputElement).value })}
                      placeholder="llama3.2"
                    />
                  </div>
                {/if}
              </div>
            </section>
          {/if}
        </main>
      </div>

      <div class="modal-footer">
        <span class="persistence-hint">Settings are saved automatically to local storage.</span>
        <button class="done-btn" onclick={close}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 120;
    padding: 12px;
  }

  .settings-modal {
    background-color: var(--bg-card);
    width: 100%;
    max-width: 720px;
    height: 480px;
    max-height: 88vh;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: var(--text-main);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background-color: var(--bg-card-subtle);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .gear-icon {
    color: var(--accent-primary);
  }

  .modal-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
    color: var(--text-main);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-light);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    transition: color 0.12s, background-color 0.12s;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-subtle);
  }

  /* Two-Column Chrome-Style Layout */
  .modal-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Left Sidebar Index Panel */
  .settings-sidebar {
    width: 180px;
    background-color: var(--bg-card-subtle);
    border-right: 1px solid var(--border-color);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s ease;
    user-select: none;
    position: relative;
  }

  .nav-item:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .nav-item.active {
    background-color: var(--accent-subtle);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background-color: var(--accent-primary);
  }

  .nav-icon {
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Right Content Pane */
  .settings-content {
    flex: 1;
    min-width: 0;
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-card);
  }

  .section-pane {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
  }

  .pane-header-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pane-header-block.with-action {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
  }

  .pane-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
  }

  .pane-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
  }

  .card-setting-box {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background-color: var(--bg-card-subtle);
    padding: 6px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Layout Cards */
  .layout-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .layout-card {
    display: flex;
    flex-direction: column;
    background-color: var(--bg-card-subtle);
    border: 1.5px solid var(--border-color);
    border-radius: 6px;
    padding: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .layout-card:hover {
    border-color: var(--accent-primary);
    background-color: var(--bg-subtle);
  }

  .layout-card.selected {
    border-color: var(--accent-primary);
    background-color: var(--bg-active);
    box-shadow: 0 0 0 1px var(--accent-primary);
  }

  .layout-preview {
    height: 52px;
    background-color: var(--bg-subtle);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    margin-bottom: 6px;
  }

  .mock-header {
    height: 8px;
    background-color: var(--bg-header);
    width: 100%;
  }

  .mock-rail {
    width: 14%;
    background-color: var(--bg-header);
    border-right: 1px solid var(--border-color);
  }

  .mock-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .mock-body.full {
    height: 100%;
  }

  .mock-sidebar {
    width: 35%;
    background-color: var(--bg-panel);
    border-right: 1px solid var(--border-color);
  }

  .mock-sidebar.dense {
    width: 30%;
  }

  .mock-canvas {
    flex: 1;
    background-color: var(--bg-subtle);
    position: relative;
  }

  .mock-canvas.full {
    width: 100%;
    height: 100%;
  }

  .mock-floating-tools {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 9px;
    height: 16px;
    background-color: var(--bg-card);
    border-radius: 2px;
  }

  .mock-floating-search {
    position: absolute;
    top: 5px;
    left: 5px;
    width: 55%;
    height: 8px;
    background-color: var(--bg-card);
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .mock-floating-chips {
    position: absolute;
    top: 18px;
    left: 5px;
    width: 70%;
    height: 5px;
    background-color: var(--accent-primary);
    border-radius: 2px;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .card-title {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main);
  }

  .card-desc {
    font-size: 9.5px;
    color: var(--text-muted);
    line-height: 1.25;
  }

  .reset-order-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .reset-order-btn:hover {
    color: var(--accent-primary);
    background-color: var(--bg-subtle);
    border-color: var(--accent-primary);
  }

  /* Module Config List */
  .module-config-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background-color: var(--bg-card);
    max-height: 310px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .module-config-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border-subtle);
    gap: 10px;
    transition: background-color 0.15s, border-color 0.15s;
  }

  .module-config-row:last-child {
    border-bottom: none;
  }

  .module-config-row.is-drag-over {
    border-top: 2px solid var(--accent-primary);
    background-color: var(--accent-subtle);
  }

  .module-config-row.is-dragging {
    opacity: 0.35;
  }

  .drag-grip {
    cursor: grab;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 4px;
    border-radius: 4px;
    opacity: 0.55;
    transition: opacity 0.15s, color 0.15s, background-color 0.15s;
    user-select: none;
    flex-shrink: 0;
  }

  .drag-grip:hover {
    opacity: 1;
    color: var(--accent-primary);
    background-color: var(--bg-subtle);
  }

  .mod-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 1px;
  }

  .mod-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mod-icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .mod-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .mod-parent-tag {
    font-size: 8.5px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 3px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--accent-primary);
  }

  .mod-tag {
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 4px;
    border-radius: 3px;
    background-color: var(--bg-subtle);
    color: var(--text-muted);
  }

  .mod-desc {
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .placement-segmented {
    display: flex;
    background-color: var(--bg-subtle);
    padding: 2px;
    border-radius: 5px;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .segment-btn {
    padding: 3px 8px;
    font-size: 10.5px;
    font-weight: 600;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.12s;
  }

  .segment-btn:hover {
    color: var(--text-main);
  }

  .segment-btn.selected {
    background-color: var(--bg-card);
    color: var(--accent-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Theme Dropdown & Swatch */
  .theme-form-row {
    padding: 8px 0;
  }

  .row-label-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .row-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .row-sublabel {
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .theme-picker-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .theme-swatch-pill {
    display: flex;
    width: 32px;
    height: 18px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
  }

  .theme-swatch-pill .swatch {
    flex: 1;
    height: 100%;
  }

  .theme-select {
    min-width: 220px;
    font-weight: 600;
    padding: 4px 8px;
  }

  /* Theme Details Preview Card */
  .theme-preview-card {
    border-top: 1px solid var(--border-subtle);
    padding-top: 10px;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-badge-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .preview-family {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--accent-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-mode {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 10px;
    background-color: var(--bg-subtle);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .preview-mode.dark {
    background-color: #0f172a;
    color: #38bdf8;
    border-color: #1e293b;
  }

  .preview-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .preview-palette-bar {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .palette-swatch {
    flex: 1;
    height: 36px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    display: flex;
    align-items: flex-end;
    padding: 4px 6px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .palette-swatch span {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    mix-blend-mode: difference;
    color: #ffffff;
  }

  /* Form Rows */
  .form-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .styled-select,
  .styled-input {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11.5px;
    color: var(--text-main);
    background-color: var(--bg-input);
    outline: none;
    font-family: inherit;
    box-sizing: border-box;
    width: 220px;
  }

  .styled-select:focus,
  .styled-input:focus {
    border-color: var(--accent-primary);
  }

  /* Switch Toggle */
  .switch-toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }

  .switch-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider-round {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: var(--border-strong);
    border-radius: 20px;
    transition: 0.2s;
  }

  .slider-round:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
  }

  input:checked + .slider-round {
    background-color: var(--accent-primary);
  }

  input:checked + .slider-round:before {
    transform: translateX(16px);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background-color: var(--bg-card-subtle);
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .persistence-hint {
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .done-btn {
    padding: 5px 14px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .done-btn:hover {
    background-color: var(--accent-hover);
  }

  @media (max-width: 640px) {
    .modal-layout {
      flex-direction: column;
    }

    .settings-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border-color);
      padding: 6px;
    }

    .sidebar-nav {
      flex-direction: row;
      overflow-x: auto;
      gap: 4px;
    }

    .nav-item {
      padding: 6px 10px;
      font-size: 11.5px;
      white-space: nowrap;
    }

    .nav-item.active::before {
      display: none;
    }

    .layout-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
