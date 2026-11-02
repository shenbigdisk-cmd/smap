import type { SearchResult } from '../../../types'
import { formatCoordinates } from '../../../utils/geodesy'
import type { ISearchProvider, SearchOptions } from '../types'

export class CoordinateSearchProvider implements ISearchProvider {
  readonly id: string
  readonly name: string
  readonly type = 'coordinates'
  enabled: boolean
  priority: number

  constructor(options: {
    id?: string
    name?: string
    enabled?: boolean
    priority?: number
  } = {}) {
    this.id = options.id || 'coordinates'
    this.name = options.name || 'Coordinates'
    this.enabled = options.enabled !== false
    this.priority = options.priority ?? 0
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    // Match patterns:
    // 1. "-37.8136, 144.9631" or "-37.8136 144.9631" (Lat, Lng)
    // 2. "144.9631, -37.8136" (Lng, Lat)
    const match = trimmed.match(/^([-+]?\d{1,3}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/)
    if (!match) return []

    const num1 = parseFloat(match[1])
    const num2 = parseFloat(match[2])
    if (isNaN(num1) || isNaN(num2)) return []

    let lat: number | null = null
    let lng: number | null = null

    // Determine lat vs lng based on typical Victoria bounds (-39.2 to -34.0 Lat, 140.9 to 150.0 Lng)
    if (num1 >= -45 && num1 <= -30 && num2 >= 135 && num2 <= 155) {
      lat = num1
      lng = num2
    } else if (num2 >= -45 && num2 <= -30 && num1 >= 135 && num1 <= 155) {
      lng = num1
      lat = num2
    } else if (num1 >= -90 && num1 <= 90 && num2 >= -180 && num2 <= 180) {
      lat = num1
      lng = num2
    }

    if (lat === null || lng === null) return []

    const coordPill = formatCoordinates(lng, lat).pillText

    return [
      {
        id: `coord-${lng.toFixed(5)}-${lat.toFixed(5)}`,
        title: `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        subtitle: `${coordPill} | Direct Coordinate Navigation`,
        category: 'coordinate' as const,
        center: [lng, lat],
        zoom: 17,
        sourceId: this.id,
        sourceName: this.name,
        score: 100
      }
    ]
  }
}
