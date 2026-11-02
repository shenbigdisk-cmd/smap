import type { SearchResult } from '../../../types'
import { SEARCH_INDEX } from '../../../data/sampleData'
import type { ISearchProvider, SearchOptions } from '../types'

export class LocalParcelsProvider implements ISearchProvider {
  readonly id: string
  readonly name: string
  readonly type = 'local-parcels'
  enabled: boolean
  priority: number

  constructor(options: {
    id?: string
    name?: string
    enabled?: boolean
    priority?: number
  } = {}) {
    this.id = options.id || 'local-cadastre'
    this.name = options.name || 'Parcels & Cadastre'
    this.enabled = options.enabled !== false
    this.priority = options.priority ?? 2
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []

    const limit = options.limit || 8
    const matched = SEARCH_INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(trimmed) ||
        item.subtitle.toLowerCase().includes(trimmed)
    ).slice(0, limit)

    return matched.map((item) => ({
      ...item,
      sourceId: this.id,
      sourceName: this.name
    }))
  }
}
