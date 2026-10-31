import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class LayersModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'layers',
    name: 'Layers',
    shortTitle: 'Layers',
    description: 'Layer visibility, sub-layers, and statutory planning legend',
    category: 'core',
    dependencies: [],
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: true,
      order: 20
    },
    toolbox: {
      defaultExpanded: true,
      order: 20
    }
  }

  async init(context: ModuleContext): Promise<void> {
    // Foundation layer catalog initialization
    context.events.emit('layers:catalog-ready', { timestamp: Date.now() })
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../LayersModule.svelte')
    return mod.default as unknown as Component
  }
}
