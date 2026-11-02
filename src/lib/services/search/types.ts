import type { SearchResult } from '../../types'

export interface SearchOptions {
  limit?: number
  center?: [number, number]
  bbox?: [number, number, number, number]
  signal?: AbortSignal
}

export interface ISearchProvider {
  readonly id: string
  readonly name: string
  readonly type: string
  enabled: boolean
  priority: number
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
}

export interface SearchProviderConfig {
  id: string
  name: string
  type: 'esri-geocoder' | 'local-parcels' | 'coordinates' | 'photon' | 'custom'
  url?: string
  enabled?: boolean
  priority?: number
  params?: Record<string, any>
}

export interface SearchEngineConfig {
  defaultProviderId?: string
  providers: SearchProviderConfig[]
}
