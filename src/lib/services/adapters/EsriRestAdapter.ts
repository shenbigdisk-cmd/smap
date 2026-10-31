import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../../types'
import type { IDataAdapter } from './IDataAdapter'
import type { Map as MapLibreMap } from 'maplibre-gl'

export class EsriRestAdapter implements IDataAdapter {
  async identify(
    layer: OperationalLayer,
    coordinate: [number, number],
    _point: { x: number; y: number },
    _map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    const rawUrl =
      layer.feature_service?.collection_url ||
      layer.feature_service?.url ||
      layer.data?.url ||
      layer.url
    if (!rawUrl) return []

    const queryUrl = new URL(rawUrl.endsWith('/query') ? rawUrl : `${rawUrl}/query`)
    queryUrl.searchParams.set('geometry', `${coordinate[0]},${coordinate[1]}`)
    queryUrl.searchParams.set('geometryType', 'esriGeometryPoint')
    queryUrl.searchParams.set('inSR', '4326')
    queryUrl.searchParams.set('outSR', '4326')
    queryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
    queryUrl.searchParams.set('returnGeometry', 'true')
    const outFields =
      layer.feature_service?.queryable_fields?.join(',') ||
      layer.data?.outFields?.join(',') ||
      '*'
    queryUrl.searchParams.set('outFields', outFields)
    queryUrl.searchParams.set('f', 'geojson')
    queryUrl.searchParams.set('resultRecordCount', '10')

    try {
      const response = await fetch(queryUrl.toString())
      if (!response.ok) return []
      const data = await response.json()
      return this.mapFeatures(layer, data.features || [])
    } catch (err) {
      console.warn(`Esri identify failed for layer ${layer.id}:`, err)
      return []
    }
  }

  async query(
    layer: OperationalLayer,
    query: QueryDefinition,
    _map: MapLibreMap | null
  ): Promise<QueryResultCollection> {
    const rawUrl =
      layer.feature_service?.collection_url ||
      layer.feature_service?.url ||
      layer.data?.url ||
      layer.url
    if (!rawUrl) {
      throw new Error(`Layer ${layer.title} has no query endpoint URL configured.`)
    }

    const queryUrl = new URL(rawUrl.endsWith('/query') ? rawUrl : `${rawUrl}/query`)

    // 1. Where Clause
    let whereClause = '1=1'
    if (query.attributeRules && query.attributeRules.length > 0) {
      const clauses = query.attributeRules
        .filter((r) => r.value !== '' && r.value !== undefined && r.value !== null)
        .map((r) => {
          const val = typeof r.value === 'string' ? r.value.trim() : r.value
          switch (r.operator) {
            case '=':
              return typeof val === 'number' ? `${r.field} = ${val}` : `${r.field} = '${val}'`
            case '!=':
              return typeof val === 'number' ? `${r.field} <> ${val}` : `${r.field} <> '${val}'`
            case 'contains':
              return `UPPER(${r.field}) LIKE '%${String(val).toUpperCase()}%'`
            case 'starts_with':
              return `UPPER(${r.field}) LIKE '${String(val).toUpperCase()}%'`
            case '>':
            case '<':
            case '>=':
            case '<=':
              return `${r.field} ${r.operator} ${val}`
            default:
              return `${r.field} = '${val}'`
          }
        })
      if (clauses.length > 0) {
        whereClause = clauses.join(` ${query.attributeOperator || 'AND'} `)
      }
    }

    queryUrl.searchParams.set('where', whereClause)
    queryUrl.searchParams.set('f', 'geojson')
    queryUrl.searchParams.set('outSR', '4326')
    queryUrl.searchParams.set('returnGeometry', 'true')
    queryUrl.searchParams.set('resultRecordCount', String(query.limit || 50))

    const outFields =
      layer.feature_service?.queryable_fields?.join(',') ||
      layer.data?.outFields?.join(',') ||
      '*'
    queryUrl.searchParams.set('outFields', outFields)

    // 2. Spatial Criteria
    if (query.spatialCriteria) {
      const sc = query.spatialCriteria
      if (sc.mode === 'bbox' && Array.isArray(sc.geometry)) {
        queryUrl.searchParams.set('geometry', sc.geometry.join(','))
        queryUrl.searchParams.set('geometryType', 'esriGeometryEnvelope')
        queryUrl.searchParams.set('inSR', '4326')
        queryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
      } else if (sc.mode === 'polygon' && sc.geometry) {
        const rings = sc.geometry.coordinates || sc.geometry
        queryUrl.searchParams.set('geometry', JSON.stringify({ rings }))
        queryUrl.searchParams.set('geometryType', 'esriGeometryPolygon')
        queryUrl.searchParams.set('inSR', '4326')
        queryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
      } else if (sc.mode === 'radius' && sc.center && sc.radiusMeters) {
        queryUrl.searchParams.set('geometry', `${sc.center[0]},${sc.center[1]}`)
        queryUrl.searchParams.set('geometryType', 'esriGeometryPoint')
        queryUrl.searchParams.set('distance', String(sc.radiusMeters))
        queryUrl.searchParams.set('units', 'esriSRUnit_Meter')
        queryUrl.searchParams.set('inSR', '4326')
        queryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
      }
    }

    const response = await fetch(queryUrl.toString())
    if (!response.ok) {
      throw new Error(`Esri Query failed with HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const features = this.mapFeatures(layer, data.features || [])

    return {
      layerId: layer.id,
      layerTitle: layer.title,
      timestamp: Date.now(),
      features,
      totalCount: features.length
    }
  }

  private mapFeatures(layer: OperationalLayer, rawFeatures: any[]): QueryResultFeature[] {
    const displayField =
      layer.feature_service?.display_field || layer.data?.displayField || 'name'
    const pk = layer.feature_service?.id_field || layer.data?.primaryKey || 'OBJECTID'

    return rawFeatures.map((feat: any, idx: number) => {
      const props = feat.properties || {}
      const titleVal = props[displayField] || props.NAME || props[pk] || `Feature #${idx + 1}`
      const subtitle =
        props.zone_description ||
        props.description ||
        props.lga ||
        props.CATEGORY ||
        props.LGA_NAME ||
        props.LOCALITY_NAME ||
        props.POSTCODE ||
        ''

      return {
        id: feat.id || props[pk] || `feat-${idx}`,
        layerId: layer.id,
        layerTitle: layer.title,
        title: String(titleVal),
        subtitle: String(subtitle),
        geometry: feat.geometry,
        properties: props
      }
    })
  }
}
