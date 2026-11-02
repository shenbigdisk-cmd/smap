import type { SearchResult } from '../../types'
import type { ISearchProvider, SearchOptions, SearchProviderConfig } from './types'
import { EsriGeocoderProvider } from './providers/EsriGeocoderProvider'
import { LocalParcelsProvider } from './providers/LocalParcelsProvider'
import { CoordinateSearchProvider } from './providers/CoordinateSearchProvider'

export class SearchEngine {
  providers = $state<ISearchProvider[]>([])
  activeFilter = $state<string>('all')
  isSearching = $state<boolean>(false)
  results = $state<SearchResult[]>([])
  providerCounts = $state<Record<string, number>>({})

  private currentAbortController: AbortController | null = null
  private debounceTimer: any = null

  constructor(initialConfigs?: SearchProviderConfig[]) {
    if (initialConfigs && initialConfigs.length > 0) {
      this.initFromConfig(initialConfigs)
    } else {
      // Default initial Victorian spatial search suite
      this.registerProvider(new CoordinateSearchProvider({ priority: 0 }))
      this.registerProvider(new EsriGeocoderProvider({ priority: 1 }))
      this.registerProvider(new LocalParcelsProvider({ priority: 2 }))
    }
  }

  registerProvider(provider: ISearchProvider) {
    const existingIdx = this.providers.findIndex((p) => p.id === provider.id)
    if (existingIdx >= 0) {
      this.providers[existingIdx] = provider
    } else {
      this.providers.push(provider)
    }
    // Sort providers by priority (ascending: 0, 1, 2...)
    this.providers.sort((a, b) => a.priority - b.priority)
  }

  unregisterProvider(id: string) {
    this.providers = this.providers.filter((p) => p.id !== id)
  }

  getProvider(id: string): ISearchProvider | undefined {
    return this.providers.find((p) => p.id === id)
  }

  setProviderEnabled(id: string, enabled: boolean) {
    const p = this.getProvider(id)
    if (p) {
      p.enabled = enabled
    }
  }

  setActiveFilter(providerId: string) {
    this.activeFilter = providerId
  }

  initFromConfig(configs: SearchProviderConfig[]) {
    this.providers = []
    for (const cfg of configs) {
      if (cfg.type === 'esri-geocoder') {
        this.registerProvider(
          new EsriGeocoderProvider({
            id: cfg.id,
            name: cfg.name,
            url: cfg.url,
            enabled: cfg.enabled,
            priority: cfg.priority
          })
        )
      } else if (cfg.type === 'local-parcels') {
        this.registerProvider(
          new LocalParcelsProvider({
            id: cfg.id,
            name: cfg.name,
            enabled: cfg.enabled,
            priority: cfg.priority
          })
        )
      } else if (cfg.type === 'coordinates') {
        this.registerProvider(
          new CoordinateSearchProvider({
            id: cfg.id,
            name: cfg.name,
            enabled: cfg.enabled,
            priority: cfg.priority
          })
        )
      }
    }
  }

  /**
   * Executes multi-provider search across all enabled or filtered search engines in parallel.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      this.cancelInFlight()
      this.isSearching = false
      this.results = []
      this.providerCounts = {}
      return []
    }

    // Cancel previous in-flight network requests
    this.cancelInFlight()
    const abortCtrl = new AbortController()
    this.currentAbortController = abortCtrl

    this.isSearching = true

    // Identify active providers according to filter & enabled status
    const targetProviders = this.providers.filter((p) => {
      if (!p.enabled) return false
      if (this.activeFilter !== 'all' && p.id !== this.activeFilter) return false
      return true
    })

    try {
      const searchPromises = targetProviders.map(async (provider) => {
        try {
          const res = await provider.search(trimmed, {
            ...options,
            signal: abortCtrl.signal
          })
          return { providerId: provider.id, results: res }
        } catch (err: any) {
          if (err.name === 'AbortError') return { providerId: provider.id, results: [] }
          console.warn(`[SearchEngine] Provider "${provider.name}" failed:`, err)
          return { providerId: provider.id, results: [] }
        }
      })

      const settled = await Promise.allSettled(searchPromises)

      // If aborted meanwhile, discard
      if (abortCtrl.signal.aborted) {
        return this.results
      }

      const merged: SearchResult[] = []
      const counts: Record<string, number> = {}

      for (const item of settled) {
        if (item.status === 'fulfilled') {
          const { providerId, results } = item.value
          counts[providerId] = results.length
          merged.push(...results)
        }
      }

      // Deduplicate results by title/address
      const seen = new Set<string>()
      const deduped: SearchResult[] = []

      for (const res of merged) {
        const key = res.title.trim().toUpperCase()
        if (!seen.has(key)) {
          seen.add(key)
          deduped.push(res)
        }
      }

      this.results = deduped
      this.providerCounts = counts
      this.isSearching = false
      return deduped
    } catch {
      if (!abortCtrl.signal.aborted) {
        this.isSearching = false
      }
      return this.results
    }
  }

  cancelInFlight() {
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
  }
}

export const searchEngine = new SearchEngine()
