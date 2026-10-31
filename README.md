# VicPlan WebGIS Map Framework

A high-performance, modular WebGIS application engine and reusable template built with **Svelte 5**, **Vite**, **TypeScript**, and **MapLibre GL JS**.

Designed after enterprise spatial discovery and planning scheme portals such as the **Victorian Government's VicPlan** and **VertiGIS Geocortex Viewer for HTML5**.

---

## Truly Distinct Layout Architectures

The framework provides three fully implemented layout architectures that behave according to their intended paradigm:

### 1. `application` Layout (Enterprise GIS Workstation / Geocortex Web)
- **ActionBar (Very Left)**: Dedicated 54px vertical activity bar containing:
  - Top agency brand badge (`VIC`).
  - Vertical icon buttons for each pinned module (`Tasks`, `Layers`, `Property`, `Measure`, `Toolbox`, etc.).
  - Bottom utility triggers (`Basemap`, `Settings`).
- **ActionPanel (Left Drawer)**: Sits immediately to the right of the `ActionBar` (380px wide).
  - Clicking an icon on the `ActionBar` opens / switches the `ActionPanel`.
  - Clicking the active icon again collapses the `ActionPanel`, leaving only the 54px `ActionBar` to maximize map real estate!
  - Header displays active module title, description, and close button.
- **Top Toolbar & Map Stage**:
  - Horizontal search omnibox with auto-suggest.
  - Quick action controls (`3D Buildings`, `Export Map`, `Share Link`, `Fullscreen`).
  - Full MapLibre map canvas with bottom coordinate and scale status bar.

### 2. `site` Layout (Victorian Government Public Portal / VicPlan Classic)
- **Top Header Banner**: 52px full-width banner with Vic government crest, site title, and centered omnibox search.
- **Side Panel Drawer**: Standard full-height side drawer (390px wide) beneath the header with horizontal tab switcher (`Tasks | Layers | Property | Toolbox`) and collapsible edge handle.

### 3. `compact` Layout (Google Maps Style / Map-First)
- **100% Full-Bleed Map**: No persistent headers or tabbed sidebars.
- **Pure Buttons & Panels**: No tabs in compact mode. All navigation is driven by floating action buttons (`Tasks`, `Layers`, `Property`, `Measure`, `Toolbox`, `Basemap`, `3D`, `Settings`).
- **Floating Search Card**: Floating omnibox pill in the top-left with panel toggle button, search input, clear button, and dropdown suggestions.
- **Dedicated Floating Panels**: Clean, tab-less slide-over panels for focused inspection and tooling with header title, icon, and close control.

---

## Modular Toolbox & Panel Architecture

- **Every Feature is a Reusable Module**: Measure, Buffer, Markup, Bookmarks, Layers, Results, and Map Exporter exist as independent components.
- **Dedicated Launch Buttons (Pinned Rail)**: Primary modules (`Tasks`, `Layers`, `Property`) have 1-click launch buttons on the top tab rail / ActionBar.
- **Advanced GIS Toolbox**: A dedicated power hub tab containing **all modules as collapsible accordion panes**:
  - Filter / search tools in real-time.
  - Expand multiple tool panes simultaneously for advanced multi-step spatial analysis (e.g., have Measure, Buffer, and Markup open at the same time).
  - **Pin to Tab Rail**: Advanced users can click the pin icon on any tool inside the Toolbox to promote it to a first-class launch button on the ActionBar / tab bar. Pinned preferences persist automatically to `localStorage`.

---

## Project Structure & Library Exports

```
smap/
├── PRODUCT.md                 # Durable product truth & target specifications
├── DESIGN.md                  # Visual identity tokens & component rules
├── src/
│   ├── lib/
│   │   ├── index.ts           # Public library entrypoint (exports stores, components, & utils)
│   │   ├── config/
│   │   │   └── map.config.ts  # Declarative configuration (basemaps, layers, initial view)
│   │   ├── data/
│   │   │   └── sampleData.ts  # Planning scheme zones, overlays, Melbourne parcels, 3D buildings
│   │   ├── stores/
│   │   │   └── mapStore.svelte.ts # Svelte 5 reactive state store ($state runes)
│   │   ├── utils/
│   │   │   ├── geodesy.ts     # Great-circle distance, spherical area, and MGA55 coords
│   │   │   ├── buffer.ts      # Geodesic polygon buffer generator
│   │   │   ├── exportMap.ts   # High-resolution PNG map canvas exporter
│   │   │   └── urlState.ts    # Bidirectional URL hash synchronization
│   │   ├── components/
│   │   │   ├── Header.svelte          # Site mode top Vic branding & search
│   │   │   ├── Sidebar.svelte         # Site mode modular tab bar & drawer
│   │   │   ├── ActionBar.svelte       # Application mode far-left vertical icon rail
│   │   │   ├── ActionPanel.svelte     # Application mode collapsible side panel
│   │   │   ├── ApplicationHeader.svelte # Application mode top toolbar
│   │   │   ├── CompactFloatingBar.svelte # Compact mode Google Maps-style floating UI
│   │   │   ├── MapCanvas.svelte       # MapLibre GL JS engine with 3D buildings & layers
│   │   │   ├── SettingsModal.svelte   # User customization & layout/theme modal
│   │   │   ├── BasemapSelector.svelte # Base map switcher
│   │   │   ├── ReportModal.svelte     # Printable Planning Property Report
│   │   │   ├── tabs/
│   │   │   │   ├── ToolboxTab.svelte  # Advanced GIS Toolbox with collapsible panes & search
│   │   │   │   ├── WorkflowsTab.svelte# Core workflows
│   │   │   │   ├── LayersTab.svelte   # Operational layers & TOC
│   │   │   │   ├── ResultsTab.svelte  # Property & planning scheme inspector
│   │   │   │   ├── MeasureTab.svelte  # Distance, area, & coordinate tools
│   │   │   │   ├── MarkupTab.svelte   # Interactive sketch & GeoJSON export
│   │   │   │   └── BookmarksTab.svelte# Saved spatial viewpoints
│   │   │   └── modules/
│   │   │       ├── BufferModule.svelte# Geodesic buffer & notices module
│   │   │       └── ExportModule.svelte# High-res PNG exporter module
│   │   └── types.ts           # Core TypeScript interfaces
│   ├── App.svelte             # Root shell with reactive layout switching
│   ├── app.css                # Base stylesheet, dark/light semantic design tokens
│   └── main.ts                # Application entrypoint
└── package.json
```

---

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Type Checking & Diagnostics
```bash
npm run check
```

### Production Build
```bash
npm run build
npm run preview
```
