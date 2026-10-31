import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest, ModuleViewDescriptor } from '../core/types'

export class ToolboxModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'toolbox',
    name: 'Toolbox',
    shortTitle: 'Toolbox',
    description: 'Specialist analysis and cartographic WebGIS tools',
    category: 'core',
    dependencies: [],
    version: '1.0.0'
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: true,
      order: 100
    }
  }

  /**
   * Toolbox is a shell container that hosts other tool views.
   * It does not contribute a placeable view inside itself or in view reordering.
   */
  override get views(): readonly ModuleViewDescriptor[] {
    return []
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('toolbox:ready', { timestamp: Date.now() })
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../ToolboxModule.svelte')
    return mod.default as unknown as Component
  }
}
