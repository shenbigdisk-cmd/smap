import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class QueryModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'query',
    name: 'Query',
    shortTitle: 'Query',
    description: 'Filter features by attribute rules or drawn geometry',
    category: 'analysis',
    dependencies: ['layers', 'results'],
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: true,
      order: 30
    },
    toolbox: {
      defaultExpanded: true,
      order: 30
    }
  }

  async init(context: ModuleContext): Promise<void> {
    // Query module waits for layers and results to complete init
    context.events.emit('query:ready', { timestamp: Date.now() })
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../QueryModule.svelte')
    return mod.default as unknown as Component
  }
}
