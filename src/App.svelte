<script lang="ts">
  import { mapStore } from './lib/stores/mapStore.svelte'
  import Header from './lib/components/Header.svelte'
  import Sidebar from './lib/components/Sidebar.svelte'
  import MapCanvas from './lib/components/MapCanvas.svelte'
  import ReportModal from './lib/components/ReportModal.svelte'
  import SettingsModal from './lib/components/SettingsModal.svelte'
  import BasemapSelector from './lib/components/BasemapSelector.svelte'
  import CompactFloatingBar from './lib/components/CompactFloatingBar.svelte'
  import CompactPanel from './lib/components/CompactPanel.svelte'
  import ActionBar from './lib/components/ActionBar.svelte'
  import ActionPanel from './lib/components/ActionPanel.svelte'
  import ApplicationMapSearch from './lib/components/ApplicationMapSearch.svelte'
  import MobileLayout from './lib/components/MobileLayout.svelte'

  let layout = $derived(mapStore.settings.layout)
  let isMobile = $derived(mapStore.isMobile)
</script>

{#if isMobile}
  <!-- 0. Mobile Layout (Auto-triggered on phones & small viewports < 768px):
       Full-bleed map, top search capsule with User Avatar, snap bottom sheet, thumb dock -->
  <MobileLayout />
{:else if layout === 'application'}
  <!-- 1. GIS Application Layout (Enterprise Workstation):
       ActionBar on very left (54px), Workspace with ActionPanel and MapCanvas -->
  <div class="app-layout layout-application">
    <ActionBar />
    <div class="app-workspace">
      <ActionPanel />
      <div class="app-main-stage">
        <ApplicationMapSearch />
        <MapCanvas />
      </div>
    </div>
  </div>
{:else if layout === 'site'}
  <!-- 2. Public Portal Layout (VicPlan Classic):
       Top government banner with search, Sidebar drawer beneath with tabs, Map Canvas on right -->
  <div class="app-layout layout-site">
    <Header />
    <main class="portal-main-area">
      <Sidebar />
      <MapCanvas />
    </main>
  </div>
{:else}
  <!-- 3. Compact Layout (Google Maps Style / Map-First):
       100% full-bleed map, floating search card & buttons, tab-less sliding panels -->
  <div class="app-layout layout-compact">
    <CompactFloatingBar />
    <CompactPanel />
    <MapCanvas />
  </div>
{/if}

<!-- Universal Modals & Overlays -->
<ReportModal />
<SettingsModal />
<BasemapSelector />

<style>
  .app-layout {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
    background-color: var(--bg-canvas, #f8fafc);
  }

  /* 1. GIS Application Layout Styles */
  .layout-application {
    display: flex;
    flex-direction: row;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }

  .app-workspace {
    flex: 1;
    height: 100vh;
    position: relative;
    overflow: hidden;
    min-width: 0;
  }

  .app-main-stage {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10;
  }

  /* 2. Site / Portal Layout Styles */
  .layout-site {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .portal-main-area {
    position: relative;
    flex: 1;
    height: calc(100vh - 52px);
    overflow: hidden;
  }

  /* 3. Compact Layout Styles */
  .layout-compact {
    display: block;
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
</style>
