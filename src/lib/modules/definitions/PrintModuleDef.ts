import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest, ModuleViewDescriptor } from '../core/types'

export class PrintModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'print',
    name: 'Print & Export',
    shortTitle: 'Print',
    description: 'High-resolution map printing, composer layout, and rapid PNG/PDF cartographic export',
    category: 'output',
    dependencies: ['layers'],
    version: '1.0.0',
    persistence: {
      properties: {
        paperSize: { default: 'a4' },
        orientation: { default: 'landscape' },
        format: { default: 'pdf' },
        resolution: { default: 300 },
        includeLegend: { default: true }
      }
    },
    resources: [
      { id: 'jspdf-engine', type: 'dataset', uri: 'npm:jspdf' }
    ]
  }

  /**
   * Auto-persisting reactive settings for the Print module.
   * Modifying any property automatically syncs with central persistence.
   */
  readonly printSettings = this.createPersistedState({
    paperSize: 'a4',
    orientation: 'landscape',
    format: 'pdf',
    resolution: 300,
    includeLegend: true
  })

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('print:ready', { timestamp: Date.now() })
  }

  override get views(): readonly ModuleViewDescriptor[] {
    return [
      {
        id: 'print',
        moduleId: 'print',
        name: 'Print Composer',
        shortTitle: 'Print',
        description: 'High-resolution map printing with paper size, orientation, and layout configuration',
        category: 'output',
        icon: 'print',
        defaultPlacement: 'sidepanel',
        supportedPlacements: ['sidepanel', 'toolbox'],
        defaultOrder: 90,
        loadComponent: () => this.loadComponent()
      },
      {
        id: 'export',
        moduleId: 'print',
        name: 'Quick Map Export',
        shortTitle: 'Export',
        description: 'Instant lossless PNG map raster snapshot with VicPlan banner and coordinates',
        category: 'output',
        icon: 'export',
        defaultPlacement: 'toolbox',
        supportedPlacements: ['sidepanel', 'toolbox'],
        defaultOrder: 95,
        loadComponent: async () => {
          const mod = await import('../ExportModule.svelte')
          return mod.default as unknown as Component
        }
      }
    ]
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: false,
      order: 90
    },
    toolbox: {
      defaultExpanded: true,
      order: 90,
      keywords: ['print', 'pdf', 'png', 'export', 'neatline', 'cartography', 'scale']
    },
    mapTools: [
      {
        id: 'map-tool-print',
        title: () => {
          const store = this.context?.store as any
          const settings = store?.printSettings
          if (settings) {
            return `Print map (${settings.paperSize.toUpperCase()} ${settings.orientation} • ${settings.format.toUpperCase()})`
          }
          return 'Print map'
        },
        icon: 'printer',
        order: 50,
        isLoading: () => Boolean((this.context?.store as any)?.isQuickPrinting),
        onClick: async (ctx) => {
          const store = ctx.store as any
          if (store?.executeQuickPrint) {
            await store.executeQuickPrint()
          }
        },
        onHover: (ctx, isHovering) => {
          const store = ctx.store as any
          if (store) {
            store.printHoverActive = isHovering
          }
        }
      }
    ],
    shortcuts: [
      {
        key: 'ctrl+p',
        description: 'Export map with active print settings',
        action: async (ctx) => {
          const store = ctx.store as any
          if (store?.executeQuickPrint) {
            await store.executeQuickPrint()
          }
        }
      }
    ],
    actions: {
      executeQuickPrint: async (ctx) => {
        const store = ctx.store as any
        return store?.executeQuickPrint?.()
      }
    }
  }

  /**
   * Preload heavy PDF export engine dynamically on demand.
   */
  async load(): Promise<void> {
    try {
      await import('jspdf')
    } catch (err) {
      console.warn('[PrintModuleDef] Failed to pre-warm jspdf bundle:', err)
    }
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../PrintModule.svelte')
    return mod.default as unknown as Component
  }

  async deactivate(): Promise<void> {
    await super.deactivate()
    const store = this.context?.store as any
    if (store) {
      store.printHoverActive = false
    }
  }
}
