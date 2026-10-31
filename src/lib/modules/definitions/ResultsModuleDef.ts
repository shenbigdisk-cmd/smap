import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class ResultsModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'results',
    name: 'Features',
    shortTitle: 'Features',
    description: 'Inspect individual properties or browse multi-record query results',
    category: 'core',
    dependencies: [],
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: true,
      order: 40
    },
    toolbox: {
      defaultExpanded: true,
      order: 40
    }
  }

  async init(context: ModuleContext): Promise<void> {
    // Feature selection and query results listener
    context.events.emit('results:ready', { timestamp: Date.now() })
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../ResultsModule.svelte')
    return mod.default as unknown as Component
  }
}
