import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class WorkflowsModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'workflows',
    name: 'Workflows',
    shortTitle: 'Workflows',
    description: 'Guided statutory property checks, permits and reports',
    category: 'core',
    dependencies: ['layers', 'results', 'query', 'buffer'],
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: true,
      order: 10
    },
    toolbox: {
      defaultExpanded: false,
      order: 10
    }
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('workflows:ready', { timestamp: Date.now() })
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../WorkflowsModule.svelte')
    return mod.default as unknown as Component
  }
}
