import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class MeasureModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'measure',
    name: 'Measure',
    shortTitle: 'Measure',
    description: 'Geodesic distance, polygon area, and coordinates',
    category: 'analysis',
    dependencies: [],
    version: '1.0.0'
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('measure:ready', { timestamp: Date.now() })
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: false,
      order: 50
    },
    toolbox: {
      defaultExpanded: true,
      order: 50,
      keywords: ['distance', 'area', 'perimeter', 'ruler', 'coordinate', 'geodesic']
    },
    shortcuts: [
      {
        key: 'm',
        description: 'Open spatial measurement tool',
        action: (ctx) => {
          const store = ctx.store as any
          if (store?.launchModule) {
            store.launchModule('measure')
          }
        }
      }
    ],
    actions: {
      clear: (ctx) => {
        const store = ctx.store as any
        store?.clearMeasurement?.()
      }
    }
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../MeasureModule.svelte')
    return mod.default as unknown as Component
  }
}
