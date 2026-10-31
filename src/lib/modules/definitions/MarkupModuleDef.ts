import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class MarkupModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'markup',
    name: 'Markup',
    shortTitle: 'Markup',
    description: 'Annotations, pins, lines, and custom sketches',
    category: 'cartography',
    dependencies: [],
    version: '1.0.0'
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('markup:ready', { timestamp: Date.now() })
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: false,
      order: 70
    },
    toolbox: {
      defaultExpanded: false,
      order: 70,
      keywords: ['annotation', 'draw', 'sketch', 'pin', 'label', 'markup', 'redline']
    },
    actions: {
      clearAll: (ctx) => {
        const store = ctx.store as any
        store?.clearAllMarkup?.()
      }
    }
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../MarkupModule.svelte')
    return mod.default as unknown as Component
  }
}
