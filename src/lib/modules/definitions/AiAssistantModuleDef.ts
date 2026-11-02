import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest, ModuleViewDescriptor } from '../core/types'

export class AiAssistantModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'assistant',
    name: 'AI Spatial Assistant',
    shortTitle: 'Assistant',
    description: 'Natural language spatial assistant for parcel search, zoning inquiries, reports, and map workflows',
    category: 'analysis',
    version: '1.0.0',
    persistence: {
      properties: {}
    }
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('assistant:ready', { timestamp: Date.now() })
  }

  override get views(): readonly ModuleViewDescriptor[] {
    return [
      {
        id: 'assistant',
        moduleId: 'assistant',
        name: 'AI Spatial Assistant',
        shortTitle: 'Assistant',
        description: 'Chat-based GIS assistant for spatial queries and reports',
        category: 'analysis',
        icon: 'assistant',
        defaultPlacement: 'sidepanel',
        supportedPlacements: ['sidepanel', 'toolbox'],
        defaultOrder: 15,
        loadComponent: () => this.loadComponent()
      }
    ]
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: true,
      order: 15
    },
    toolbox: {
      defaultExpanded: true,
      order: 15,
      keywords: ['ai', 'chat', 'assistant', 'prompt', 'search', 'parcel', 'report', 'zoning']
    }
  }

  public override async loadComponent(): Promise<Component> {
    const mod = await import('../AiAssistantModule.svelte')
    return mod.default as unknown as Component
  }
}
