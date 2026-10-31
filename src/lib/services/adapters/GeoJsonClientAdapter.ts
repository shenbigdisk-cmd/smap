import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../../types'
import type { IDataAdapter } from './IDataAdapter'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { calculateDistanceMeters } from '../../utils/geodesy'

export class GeoJsonClientAdapter implements IDataAdapter {
  private featureStore = new Map<string, any[]>()

  registerFeatures(layerId: string, features: any[]) {
    this.featureStore.set(layerId, features)
  }

  async identify(
    layer: OperationalLayer,
    coordinate: [number, number],
    _point: { x: number; y: number },
    _map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    const rawFeatures = this.getLayerFeatures(layer)
    if (!rawFeatures || rawFeatures.length === 0) return []

    const matches: QueryResultFeature[] = []
    const displayField = layer.data?.displayField || 'address'

    for (let idx = 0; idx < rawFeatures.length; idx++) {
      const feat = rawFeatures[idx]
      const geom = feat.geometry
      if (!geom) continue

      let isInside = false

      if (geom.type === 'Polygon') {
        isInside = this.pointInPolygon(coordinate, geom.coordinates[0])
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          if (this.pointInPolygon(coordinate, poly[0])) {
            isInside = true
            break
          }
        }
      } else if (geom.type === 'LineString') {
        isInside = this.pointNearPolyline(coordinate, geom.coordinates as [number, number][])
      } else if (geom.type === 'MultiLineString') {
        for (const line of geom.coordinates) {
          if (this.pointNearPolyline(coordinate, line as [number, number][])) {
            isInside = true
            break
          }
        }
      } else if (geom.type === 'Point') {
        const dist = calculateDistanceMeters(coordinate, geom.coordinates as [number, number])
        isInside = dist < 20 // 20m tolerance for points
      }

      if (isInside) {
        const props = feat.properties || {}
        matches.push({
          id: feat.id || props.id || props.spi || `feat-${idx}`,
          layerId: layer.id,
          layerTitle: layer.title,
          title: String(props[displayField] || props.title || props.name || `Feature #${idx + 1}`),
          subtitle: String(props.zone_code || props.municipality || props.locality || props.category || ''),
          geometry: geom,
          properties: props
        })
      }
    }

    return matches
  }

  async query(
    layer: OperationalLayer,
    query: QueryDefinition,
    _map: MapLibreMap | null
  ): Promise<QueryResultCollection> {
    const rawFeatures = this.getLayerFeatures(layer)
    let filtered = [...rawFeatures]

    // 1. Attribute filtering
    if (query.attributeRules && query.attributeRules.length > 0) {
      const activeRules = query.attributeRules.filter(
        (r) => r.value !== '' && r.value !== undefined && r.value !== null
      )

      if (activeRules.length > 0) {
        filtered = filtered.filter((feat) => {
          const props = feat.properties || {}
          const matchFn = (rule: typeof activeRules[0]) => {
            const rawVal = props[rule.field]
            if (rawVal === undefined || rawVal === null) return false

            const valStr = String(rawVal).toLowerCase()
            const targetStr = String(rule.value).toLowerCase().trim()

            switch (rule.operator) {
              case '=':
                return typeof rawVal === 'number'
                  ? rawVal === Number(rule.value)
                  : valStr === targetStr
              case '!=':
                return typeof rawVal === 'number'
                  ? rawVal !== Number(rule.value)
                  : valStr !== targetStr
              case 'contains':
                return valStr.includes(targetStr)
              case 'starts_with':
                return valStr.startsWith(targetStr)
              case '>':
                return Number(rawVal) > Number(rule.value)
              case '<':
                return Number(rawVal) < Number(rule.value)
              case '>=':
                return Number(rawVal) >= Number(rule.value)
              case '<=':
                return Number(rawVal) <= Number(rule.value)
              default:
                return valStr === targetStr
            }
          }

          if (query.attributeOperator === 'OR') {
            return activeRules.some(matchFn)
          }
          return activeRules.every(matchFn)
        })
      }
    }

    // 2. Spatial filtering
    if (query.spatialCriteria) {
      const sc = query.spatialCriteria
      if (sc.mode === 'bbox' && Array.isArray(sc.geometry)) {
        const [minx, miny, maxx, maxy] = sc.geometry
        filtered = filtered.filter((feat) => {
          const center = this.getFeatureCenter(feat)
          if (!center) return false
          return center[0] >= minx && center[0] <= maxx && center[1] >= miny && center[1] <= maxy
        })
      } else if (sc.mode === 'radius' && sc.center && sc.radiusMeters) {
        const [cx, cy] = sc.center
        const rad = sc.radiusMeters
        filtered = filtered.filter((feat) => {
          const center = this.getFeatureCenter(feat)
          if (!center) return false
          return calculateDistanceMeters([cx, cy], center) <= rad
        })
      } else if (sc.mode === 'polygon' && sc.geometry) {
        const ring = sc.geometry.coordinates?.[0] || sc.geometry
        if (Array.isArray(ring)) {
          filtered = filtered.filter((feat) => {
            const center = this.getFeatureCenter(feat)
            if (!center) return false
            return this.pointInPolygon(center, ring)
          })
        }
      }
    }

    const displayField = layer.data?.displayField || 'address'
    const limit = query.limit || 50
    const features: QueryResultFeature[] = filtered.slice(0, limit).map((feat, idx) => {
      const props = feat.properties || {}
      return {
        id: feat.id || props.id || props.spi || `feat-${idx}`,
        layerId: layer.id,
        layerTitle: layer.title,
        title: String(props[displayField] || props.title || props.name || `Feature #${idx + 1}`),
        subtitle: String(props.zone_code || props.municipality || props.locality || props.category || ''),
        geometry: feat.geometry,
        properties: props
      }
    })

    return {
      layerId: layer.id,
      layerTitle: layer.title,
      timestamp: Date.now(),
      features,
      totalCount: filtered.length,
      source: 'query'
    }
  }

  private getLayerFeatures(layer: OperationalLayer): any[] {
    if (this.featureStore.has(layer.id)) {
      return this.featureStore.get(layer.id) || []
    }
    return []
  }

  private pointNearPolyline(
    point: [number, number],
    line: [number, number][],
    toleranceMeters = 25
  ): boolean {
    if (!line || line.length < 2) return false
    for (let i = 0; i < line.length - 1; i++) {
      const p1 = line[i]
      const p2 = line[i + 1]
      if (this.distanceToSegmentMeters(point, p1, p2) <= toleranceMeters) {
        return true
      }
    }
    return false
  }

  private distanceToSegmentMeters(
    p: [number, number],
    a: [number, number],
    b: [number, number]
  ): number {
    const [px, py] = p
    const [ax, ay] = a
    const [bx, by] = b
    const dx = bx - ax
    const dy = by - ay
    if (dx === 0 && dy === 0) {
      return calculateDistanceMeters(p, a)
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    const proj: [number, number] = [ax + t * dx, ay + t * dy]
    return calculateDistanceMeters(p, proj)
  }

  private pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
    const x = point[0]
    const y = point[1]
    let inside = false

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0]
      const yi = ring[i][1]
      const xj = ring[j][0]
      const yj = ring[j][1]

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }

    return inside
  }

  private getFeatureCenter(feat: any): [number, number] | null {
    if (feat.center) return feat.center
    const geom = feat.geometry
    if (!geom) return null
    if (geom.type === 'Point') return geom.coordinates as [number, number]
    if (geom.type === 'Polygon' && geom.coordinates?.[0]?.[0]) {
      return geom.coordinates[0][0]
    }
    return null
  }
}
