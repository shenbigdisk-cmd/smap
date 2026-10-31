# Design System

<!-- impeccable:design-schema 1 -->

## Visual World & Identity

- **Direction**: Enterprise Spatial Discovery (VicPlan / VertiGIS Geocortex).
- **Tone**: Authoritative, calm, utilitarian, high-density, and precision-engineered.
- **Atmosphere**: Professional cartographic workbench with crisp structural hierarchy, clear spatial separation, and immediate tactile feedback.

## Palette & Semantics

### Neutral Ground & Panels
- **App Shell Header**: `#0f172a` (Slate 900) — Deep solid anchor for global branding and search.
- **Panel Background**: `#ffffff` (White) with secondary surfaces in `#f8fafc` (Slate 50).
- **Subtle Dividers & Borders**: `#e2e8f0` (Slate 200).
- **Foreground Primary**: `#0f172a` (Slate 900) — Contrast ratio > 12:1 against white.
- **Foreground Muted**: `#475569` (Slate 600) — Contrast ratio > 5.5:1 against white (WCAG AA compliant).
- **Hover/Active Highlight**: `#f1f5f9` (Slate 100) / `#e2e8f0` (Slate 200).

### Brand & Interactive Accents
- **Primary Accent**: `#0284c7` (Sky 600) / Hover `#0369a1` (Sky 700).
- **Focus Rings**: `2px solid #0284c7` with `2px` offset (`#38bdf8` in dark header).
- **Active State / Selection**: `#e0f2fe` (Sky 100) background with `#0369a1` text.

### Planning Scheme Zone Badges (Victorian Standard Palette)
- **Residential (GRZ, RGZ, NRZ)**: Fill `#ffe4e6` (Rose 100), Text `#be123c` (Rose 700), Border `#fecdd3`.
- **Commercial (C1Z, C2Z)**: Fill `#dbeafe` (Blue 100), Text `#1d4ed8` (Blue 700), Border `#bfdbfe`.
- **Industrial (IN1Z, IN2Z, IN3Z)**: Fill `#ede9fe` (Violet 100), Text `#6d28d9` (Violet 700), Border `#ddd6fe`.
- **Public & Conservation (PPRZ, PCRZ)**: Fill `#dcfce7` (Green 100), Text `#15803d` (Green 700), Border `#bbf7d0`.
- **Special Purpose & Urban Growth (UGZ, SUZ)**: Fill `#fef3c7` (Amber 100), Text `#b45309` (Amber 700), Border `#fde68a`.
- **Overlays (Heritage HO, Bushfire BMO, Design DDO)**: Fill `#ffedd5` (Orange 100), Text `#c2410c` (Orange 700), Border `#fed7aa`.

## Typography

- **Font Family**: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Numeric Font**: Tabular numerals enabled via `font-variant-numeric: tabular-nums` for all geographic coordinates, scale ratios, parcel dimensions, and measurement readings.
- **Type Scale**:
  - `Header Title`: 15px / 600 weight / tracking -0.01em
  - `Section / Drawer Titles`: 14px / 600 weight / tracking -0.01em
  - `Body / Primary UI`: 13px / 400 weight (500 for emphasized labels)
  - `Secondary / Meta Labels`: 12px / 400 weight
  - `Badges & Micro Legend`: 11px / 600 weight / tracking +0.02em (uppercase codes e.g. `GRZ1`, `BMO`)

## Spacing & Rhythm

- Base grid: 4px. Standard paddings: `8px`, `12px`, `16px`.
- Left Sidebar Drawer: Fixed standard width `380px` (or `100vw` on mobile screens below 640px).
- Top Header: Fixed height `52px`.
- Elevation & Depth:
  - Header: `0 1px 3px 0 rgb(0 0 0 / 0.1)`
  - Floating controls & search dropdown: `0 4px 12px -1px rgb(0 0 0 / 0.12), 0 2px 4px -2px rgb(0 0 0 / 0.08)`
  - Sidebar Drawer: `1px solid #e2e8f0` right border with gentle shadow `2px 0 8px -2px rgb(0 0 0 / 0.06)`

## Component Shell Architecture

1. **Top Global Bar**:
   - Left: Department / Agency crest badge & application title ("VicPlan WebGIS Engine").
   - Center: Omnibox search with instant suggestions, parcel/SPI/address parsing, and quick-clear.
   - Right: Basemap switcher toggle, coordinate format toggle, and panel shortcuts.
2. **Dockable Left Sidebar**:
   - Navigation rail or tab bar with 4 core views:
     - `Workflow ("I want to...")`: Step-by-step spatial workflows.
     - `Layers`: Hierarchical layers (Planning Zones, Bushfire Overlays, Heritage, Cadastre) with checkbox toggles, opacity sliders, and expand/collapse legends.
     - `Results`: Detailed feature inspector with address title, SPI, LGA, planning scheme links, and interactive property attribute cards.
     - `Measure`: Distance, Area, and Coordinate query tools with interactive snapping indicators.
3. **Map Canvas & Overlay Controls**:
   - MapLibre GL JS engine.
   - Floating map tools: Zoom +/- buttons, North orientation reset, Home extent, Locate Me.
   - Bottom status bar: Dynamic metric scale bar, live mouse coordinate readout (Lat/Lng & Easting/Northing).
