import type { SearchResult } from '../../../types'
import type { ISearchProvider, SearchOptions } from '../types'

export class EsriGeocoderProvider implements ISearchProvider {
  readonly id: string
  readonly name: string
  readonly type = 'esri-geocoder'
  enabled: boolean
  priority: number
  private url: string

  constructor(options: {
    id?: string
    name?: string
    url?: string
    enabled?: boolean
    priority?: number
  } = {}) {
    this.id = options.id || 'vicmap-geocoder'
    this.name = options.name || 'Vicmap Address'
    this.url = (
      options.url ||
      'https://corp-geo.mapshare.vic.gov.au/arcgis/rest/services/Geocoder/VMAddressEZIAdd/GeocodeServer'
    ).replace(/\/+$/, '')
    this.enabled = options.enabled !== false
    this.priority = options.priority ?? 1
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) return []

    const limit = options.limit || 8
    const endpoint = `${this.url}/findAddressCandidates?SingleLine=${encodeURIComponent(trimmed)}&outSR=4326&maxLocations=${limit}&f=json`

    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: options.signal
      })

      if (!res.ok) return []

      const data = await res.json()
      if (!Array.isArray(data.candidates)) return []

      return data.candidates
        .filter((c: any) => c.location && typeof c.location.x === 'number' && typeof c.location.y === 'number')
        .map((candidate: any, index: number) => {
          const score = typeof candidate.score === 'number' ? Math.round(candidate.score) : 100
          const extent = candidate.extent
            ? ([candidate.extent.xmin, candidate.extent.ymin, candidate.extent.xmax, candidate.extent.ymax] as [number, number, number, number])
            : undefined

          return {
            id: `vicmap-${index}-${candidate.address.replace(/\s+/g, '-').toLowerCase()}`,
            title: candidate.address,
            subtitle: `Victorian Address Cadastre (${score}% match)`,
            category: 'address' as const,
            center: [candidate.location.x, candidate.location.y] as [number, number],
            zoom: 17.5,
            extent,
            sourceId: this.id,
            sourceName: this.name,
            score
          }
        })
    } catch (err: any) {
      if (err.name === 'AbortError') return []
      console.warn(`[EsriGeocoderProvider] Geocode request failed for "${query}":`, err)
      return []
    }
  }
}
