# WebGIS Module Architecture Guide & Standards

This document establishes the canonical module architecture for the VicPlan WebGIS application. All built-in and future extension modules adhere to this contract.

---

## 1. Vision & Architecture Overview

The WebGIS application is built around a pluggable, decentralized module framework. Rather than hardcoding tools and views across monolithic stores, each capability is an autonomous module adhering to a single, unified contract: `ModuleBase`.

```
                    ┌────────────────────────┐
                    │     ModuleManager      │
                    │  (Lifecycle & Registry)│
                    └───────────┬────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ LayersModule │        │ QueryModule  │        │ PrintModule  │
│ (ModuleBase) │        │ (ModuleBase) │        │ (ModuleBase) │
└───────┬──────┘        └───────┬──────┘        └───────┬──────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    ┌────────────────────────┐
                    │     ModuleContext      │
                    │ • MapLibre Map Instance│
                    │ • Decoupled EventBus   │
                    │ • Scoped Local Storage │
                    │ • Pointer Interaction  │
                    └────────────────────────┘
```

### Core Architectural Tenets
1. **Single Canonical Contract**: Every module extends [ModuleBase](file:///d:/codeLab/smap/src/lib/modules/core/ModuleBase.ts) and implements [IWebGISModule](file:///d:/codeLab/smap/src/lib/modules/core/types.ts).
2. **Asynchronous Code-Splitting**: Svelte components and heavy vendor libraries (e.g., `jspdf`, `terra-draw`, `html2canvas`) are loaded on-demand via dynamic `import()`.
3. **Dependency Injection**: Modules never reach into global singletons blindly; they receive an isolated [ModuleContext](file:///d:/codeLab/smap/src/lib/modules/core/types.ts) upon initialization.
4. **Contribution Points**: Modules declare where and how they appear in the UI (`rail`, `toolbox`, `mapTools`, `shortcuts`, `actions`).
5. **UI Simplicity & Zero-Seam Rule** ([GEMINI.md](file:///d:/codeLab/smap/GEMINI.md)): High signal-to-noise ratio, zero narrative subtitle bloat, one canonical action per view, and physically connected tab surfaces.

---

## 2. The `ModuleBase` Contract & Lifecycle

Every module class inherits from `ModuleBase` which manages its lifecycle states:

```
  ┌──────────────┐
  │ unregistered │
  └──────┬───────┘
         │ moduleManager.register(module)
         ▼
  ┌──────────────┐
  │  registered  │
  └──────┬───────┘
         │ moduleManager.initialize(context) [Dependency-sorted]
         ▼
  ┌──────────────┐
  │    ready     │◄──────────────────┐
  └──────┬───────┘                   │
         │ moduleManager.activate()  │ moduleManager.deactivate()
         ▼                           │
  ┌──────────────┐                   │
  │    active    │───────────────────┘
  └──────┬───────┘
         │ module.destroy()
         ▼
  ┌──────────────┐
  │ unregistered │
  └──────────────┘
```

### Lifecycle Methods

| Method | Timing | Primary Responsibility |
| :--- | :--- | :--- |
| `load()` | On-demand before activation | Preload heavy libraries, WASM modules, or remote configuration data. |
| `loadComponent()` | First mount | Return dynamic import of Svelte UI component (`import('./XYZModule.svelte')`). |
| `initialize(context)` | Application boot / map ready | Store context, subscribe to application events, verify dependencies, init scoped storage. |
| `activate()` | User opens module tab or tool | Arm interactive map tools, set cursor, show preview frames. |
| `deactivate()` | User switches away or closes drawer | Clean up map interaction handlers, reset cursors, hide preview frames. |
| `destroy()` | Module unloaded / torn down | Unsubscribe from all events, remove custom map layers, clear timers. |
| `executeAction(name, ...args)` | Direct invocation | Programmatic command dispatcher for cross-module workflows. |

---

## 3. Dependency Management

Modules can declare prerequisites via `manifest.dependencies`:

```typescript
export class QueryModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'query',
    name: 'Query',
    shortTitle: 'Query',
    description: 'Filter features by attribute rules or drawn geometry',
    category: 'analysis',
    dependencies: ['layers'], // layers must initialize before query
    version: '1.0.0'
  }
}
```

The [ModuleManager](file:///d:/codeLab/smap/src/lib/modules/core/ModuleManager.ts):
- Performs a **topological sort** on the module dependency graph before calling `initialize()`.
- Detects circular dependencies at startup and logs diagnostic warnings.
- Allows modules to safely query their peers via `context.getModule<T>('layers')`.

---

## 4. Execution Context (`ModuleContext`)

The `ModuleContext` injected into every module provides:

| Property / Method | Description |
| :--- | :--- |
| `context.map` | Direct reference to the active `MapLibreMap` instance (or `null` before load). |
| `context.events` | Decoupled pub/sub event bus (`on`, `off`, `once`, `emit`). Subscriptions made via `this.on()` in `ModuleBase` are automatically cleaned up on `destroy()`. |
| `context.storage` | Scoped key-value storage (`smap:mod:<moduleId>:<key>`) isolated from other modules. |
| `context.registerMapHandler(handler)` | Arms pointer/drawing interaction with cursor control and escape guardrails. |
| `context.deactivateMapHandler()` | Disarms pointer/drawing interaction safely. |
| `context.notify(message, type)` | Triggers system toast notifications without UI coupling. |
| `context.getModule<T>(id)` | Accesses the public API of another initialized module. |

---

## 5. Contribution Points System

Modules define how they project into the user interface via `contributions`:

```typescript
export interface ModuleContributionPoints {
  rail?: {
    defaultPinned: boolean
    order?: number
    badge?: () => string | number | null
  }
  toolbox?: {
    defaultExpanded?: boolean
    order?: number
    keywords?: readonly string[]
  }
  mapTools?: readonly MapToolContribution[]
  shortcuts?: readonly ShortcutContribution[]
  actions?: Record<string, (context: ModuleContext, ...args: unknown[]) => unknown>
}
```

### 1. `rail` (Navigation Rail & Tabs)
- Pinned modules appear as primary tabs on the left navigation rail.
- Includes `order` index and dynamic reactive `badge` support (e.g. results count).

### 2. `toolbox` (Advanced GIS Toolbox)
- Unpinned modules appear as cards in the expandable Toolbox accordion.
- Includes `keywords` for instant omnibox tool searching.

### 3. `mapTools` (Floating Map Canvas Tools)
- Modules can contribute buttons to `.map-tools-floating` on the map canvas.
- For example, `PrintModule` contributes the **Quick Print** button: hovering displays the live framing box, and clicking immediately exports using saved settings.

### 4. `shortcuts` (Keyboard Accelerators)
- Keyboard shortcuts mapped to module actions (e.g. `Ctrl+P` for immediate print export, `M` for measure).
- Automatically suppressed while editing `<input>` or `<textarea>` elements.

### 5. `actions` (Programmatic Command Palette)
- Callable commands that can be invoked by other modules, search suggestions, or statutory workflows.

---

## 6. Asynchronous Loading & Code-Splitting

Heavy vendor libraries are never loaded on initial page load. Dynamic chunking is enforced by:
1. Svelte component lazy loading via `loadComponent: () => import('./MyModule.svelte')`.
2. Heavy third-party library loading inside `load()` (e.g., `await import('jspdf')`).
3. [ModuleRenderer.svelte](file:///d:/codeLab/smap/src/lib/modules/ModuleRenderer.svelte) dynamically handles chunk resolution with zero layout shifts via an animated skeleton state, caching resolved components permanently in memory.

---

## 7. Step-by-Step Guide: Creating a New Module

Follow this 5-step checklist to build any new WebGIS module.

### Step 1: Create the Svelte UI Component
Create `src/lib/modules/ElevationModule.svelte`:
```svelte
<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'

  let elevationProfile = $state<number[]>([])
</script>

<div class="elevation-panel">
  <!-- Adhere to GEMINI.md: No subtitle bloat, crisp high-density controls -->
  <button type="button" class="action-btn" onclick={() => alert('Tracing profile...')}>
    Trace Profile
  </button>
</div>

<style>
  .elevation-panel {
    padding: 12px;
  }
  .action-btn {
    width: 100%;
    height: 32px;
    background: var(--brand-primary);
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

### Step 2: Create the Module Definition Class
Create `src/lib/modules/definitions/ElevationModuleDef.ts`:
```typescript
import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleManifest } from '../core/types'

export class ElevationModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'elevation',
    name: 'Elevation Profile',
    shortTitle: 'Elevation',
    description: 'Ground elevation transects and slope analysis',
    category: 'analysis',
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    toolbox: {
      defaultExpanded: true,
      order: 75,
      keywords: ['elevation', 'height', 'terrain', 'slope', 'contour']
    },
    shortcuts: [
      {
        key: 'e',
        description: 'Trace elevation profile',
        action: (ctx) => ctx.notify('Elevation tool activated')
      }
    ],
    actions: {
      trace: async (ctx) => {
        // Implementation
      }
    }
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../ElevationModule.svelte')
    return mod.default as unknown as Component
  }

  async activate(): Promise<void> {
    await super.activate()
    this.registerHandler({
      id: 'elevation-trace',
      moduleId: this.manifest.id,
      cursor: 'crosshair',
      hint: 'Click to trace elevation transect. Esc to exit.'
    })
  }
}
```

### Step 3: Register in Module Definitions
In `src/lib/modules/definitions/index.ts`:
```typescript
export * from './ElevationModuleDef'
```

In `src/lib/modules/registry.ts`:
```typescript
import { ElevationModuleDef } from './definitions'

export const elevationModule = new ElevationModuleDef()

moduleManager.register(elevationModule)
```

### Step 4: Verify Compilation & Bundle Splitting
Run:
```bash
npm run check
npm run build
```
Verify that Vite creates a dedicated chunk (e.g. `dist/assets/ElevationModule-[hash].js`) and that `svelte-check` reports **0 errors and 0 warnings**.

---

## 8. Standards & Quality Checklist

Before submitting a new module, verify that it adheres to all workspace guidelines:

- [ ] **Physical Tab Seam**: Active tabs have rounded top corners, square bottom corners, identical background color (`var(--bg-panel)`), and no baseline divider cutting them off from the panel body.
- [ ] **No Subtitle Bloat**: No redundant descriptions stating the obvious (e.g. "Configure settings here", "Click to toggle layers").
- [ ] **Single Canonical Pathway**: Never duplicate actions (e.g., both a card click and an inspect button doing the same thing).
- [ ] **Settings via User Avatar Only**: Settings or preferences must never open from random gear icons; all settings route through the User Avatar context menu.
- [ ] **Map Interaction Guardrails**: Drawing and measurement modes must register a `MapInteractionHandler` and automatically release pointer capture when deactivated.
