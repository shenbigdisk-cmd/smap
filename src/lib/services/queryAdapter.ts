import type {
  OperationalLayer,
  ParcelFeature,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../types'
import { calculatePathLengthMeters } from '../utils/geodesy'

/**
 * Service to execute attribute and spatial queries across both
 * ArcGIS REST services and local GeoJSON layers.
 */
export async function executeLayerQuery(
  layer: OperationalLayer,
  query: QueryDefinition,
  localParcels: ParcelFeature[] = []
): Promise<QueryResultCollection> {
  if (layer.format === 'esri-feature' && layer.url) {
    return queryEsriRestLayer(layer, query)
  }
  return queryLocalParcels(layer, query, localParcels)
}

/**
 * Query an ArcGIS REST MapServer / FeatureServer endpoint
 */
async function queryEsriRestLayer(
  layer: OperationalLayer,
  query: QueryDefinition
): Promise<QueryResultCollection> {
  const queryUrl = new URL(layer.url + '/query')

  // 1. Formulate SQL Where Clause
  let whereClause = '1=1'
  if (query.attributeRules && query.attributeRules.length > 0) {
    const clauses = query.attributeRules
      .filter((r) => r.value !== '' && r.value !== undefined && r.value !== null)
      .map((r) => {
        const val = typeof r.value === 'string' ? r.value.trim() : r.value
        switch (r.operator) {
          case '=':
            return typeof val === 'number'
              ? `${r.field} = ${val}`
              : `${r.field} = '${val}'`
          case '!=':
            return typeof val === 'number'
              ? `${r.field} <> ${val}`
              : `${r.field} <> '${val}'`
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

  const outFields = layer.queryConfig?.outFields?.join(',') || '*'
  queryUrl.searchParams.set('outFields', outFields)

  // 2. Spatial Geometry Filtering
  if (query.spatialCriteria) {
    const sc = query.spatialCriteria
    if (sc.mode === 'bbox' && Array.isArray(sc.geometry)) {
      // Bounding box format: minx,miny,maxx,maxy
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
  const displayField = layer.queryConfig?.displayField || 'zone_code'

  const features: QueryResultFeature[] = (data.features || []).map((feat: any, idx: number) => {
    const props = feat.properties || {}
    const titleVal = props[displayField] || props.NAME || props.OBJECTID || `Feature #${idx + 1}`
    const subtitle =
      props.zone_description || props.lga || props.DESCRIPTION || ''

    return {
      id: feat.id || props.OBJECTID || props.vdpid || `feat-${idx}`,
      layerId: layer.id,
      title: String(titleVal),
      subtitle: String(subtitle),
      geometry: feat.geometry,
      properties: props
    }
  })

  return {
    layerId: layer.id,
    layerTitle: layer.title,
    timestamp: Date.now(),
    features,
    totalCount: features.length
  }
}

/**
 * Client-side query for local GeoJSON parcels and layers
 */
function queryLocalParcels(
  layer: OperationalLayer,
  query: QueryDefinition,
  parcels: ParcelFeature[]
): QueryResultCollection {
  let matched = [...parcels]

  // 1. Attribute filtering
  if (query.attributeRules && query.attributeRules.length > 0) {
    const activeRules = query.attributeRules.filter(
      (r) => r.value !== '' && r.value !== undefined && r.value !== null
    )

    if (activeRules.length > 0) {
      const isAnd = (query.attributeOperator || 'AND') === 'AND'
      matched = matched.filter((p) => {
        const testRule = (r: typeof activeRules[0]) => {
          let propVal: any = undefined
          if (r.field === 'address') propVal = p.address
          else if (r.field === 'spi') propVal = p.spi
          else if (r.field === 'lotPlan') propVal = p.lotPlan
          else if (r.field === 'lga') propVal = p.lga
          else if (r.field === 'areaM2') propVal = p.areaM2
          else if (r.field === 'zone.code') propVal = p.zone?.code

          if (propVal === undefined) return false

          const targetStr = String(r.value).trim().toLowerCase()
          const valStr = String(propVal).trim().toLowerCase()

          switch (r.operator) {
            case '=':
              return valStr === targetStr
            case '!=':
              return valStr !== targetStr
            case 'contains':
              return valStr.includes(targetStr)
            case 'starts_with':
              return valStr.startsWith(targetStr)
            case '>':
              return Number(propVal) > Number(r.value)
            case '<':
              return Number(propVal) < Number(r.value)
            case '>=':
              return Number(propVal) >= Number(r.value)
            case '<=':
              return Number(propVal) <= Number(r.value)
            default:
              return valStr === targetStr
          }
        }

        return isAnd ? activeRules.every(testRule) : activeRules.some(testRule)
      })
    }
  }

  // 2. Spatial filtering
  if (query.spatialCriteria) {
    const sc = query.spatialCriteria
    if (sc.mode === 'bbox' && Array.isArray(sc.geometry)) {
      const [minx, miny, maxx, maxy] = sc.geometry
      matched = matched.filter((p) => {
        const [lng, lat] = p.center
        return lng >= minx && lng <= maxx && lat >= miny && lat <= maxy
      })
    } else if (sc.mode === 'radius' && sc.center && sc.radiusMeters) {
      matched = matched.filter((p) => {
        const d = calculatePathLengthMeters([sc.center!, p.center])
        return d <= sc.radiusMeters!
      })
    }
  }

  const limit = query.limit || 50
  const sliced = matched.slice(0, limit)

  const features: QueryResultFeature[] = sliced.map((p) => ({
    id: p.id,
    layerId: layer.id,
    title: p.address,
    subtitle: `${p.zone.code} • ${p.lga} • SPI ${p.spi}`,
    geometry: p.geometry,
    properties: {
      address: p.address,
      spi: p.spi,
      lotPlan: p.lotPlan,
      lga: p.lga,
      areaM2: p.areaM2,
      zone: p.zone.code,
      zoneName: p.zone.name
    }
  }))

  return {
    layerId: layer.id,
    layerTitle: layer.title,
    timestamp: Date.now(),
    features,
    totalCount: features.length
  }
}
