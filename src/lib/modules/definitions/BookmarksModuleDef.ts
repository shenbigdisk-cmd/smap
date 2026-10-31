import type { Component } from 'svelte'
import { ModuleBase } from '../core/ModuleBase'
import type { ModuleContributionPoints, ModuleContext, ModuleManifest } from '../core/types'

export class BookmarksModuleDef extends ModuleBase {
  readonly manifest: ModuleManifest = {
    id: 'bookmarks',
    name: 'Bookmarks',
    shortTitle: 'Bookmarks',
    description: 'Saved viewpoints and extents across planning precincts',
    category: 'cartography',
    dependencies: [],
    version: '1.0.0',
    persistence: {
      properties: {
        customBookmarks: { default: [] }
      }
    }
  }

  async init(context: ModuleContext): Promise<void> {
    context.events.emit('bookmarks:ready', { timestamp: Date.now() })
  }

  readonly contributions: ModuleContributionPoints = {
    rail: {
      defaultPinned: false,
      order: 80
    },
    toolbox: {
      defaultExpanded: false,
      order: 80,
      keywords: ['bookmarks', 'views', 'saved extents', 'locations', 'precincts']
    }
  }

  async loadComponent(): Promise<Component> {
    const mod = await import('../BookmarksModule.svelte')
    return mod.default as unknown as Component
  }
}
