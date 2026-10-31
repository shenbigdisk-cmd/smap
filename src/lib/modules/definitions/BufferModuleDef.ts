import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class BufferModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'buffer',
    name: 'Buffer',
    shortTitle: 'Buffer',
    description: 'Circular geodesic notification buffer envelopes',
    category: 'analysis',
    dependencies: ['layers', 'results'],
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: false,
      order: 60
    },
    toolbox: {
      defaultExpanded: true,
      order: 60,
      keywords: ['buffer', 'radius', 'envelope', 'notification', 'proximity']
    }
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('buffer:ready', { timestamp: Date.now() })
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../BufferModule.svelte')
    return mod.default as unknown as Component
  }
}
