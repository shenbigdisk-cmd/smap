import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../../types'
import type { IDataAdapter } from './IDataAdapter'
import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Converts Esri REST geometry (rings, paths, x/y) to standard GeoJSON geometry
 */
export function esriGeometryToGeoJson(esriGeom: any, geomType?: string): any {
  if (!esriGeom) return null

  // Already GeoJSON geometry
  if (esriGeom.type && (esriGeom.coordinates || esriGeom.geometries)) {
    return esriGeom
  }

  // Polygon (rings)
  if (esriGeom.rings && Array.isArray(esriGeom.rings)) {
    if (esriGeom.rings.length === 1) {
      return {
        type: 'Polygon',
        coordinates: esriGeom.rings
      }
    }

    // Determine if multiple outer rings exist (MultiPolygon)
    // In Esri JSON, exterior rings are clockwise; interior rings (holes) are counter-clockwise
    const polygons: number[][][][] = []
    let currentPoly: number[][][] | null = null

    for (const ring of esriGeom.rings) {
      if (isClockwise(ring)) {
        if (currentPoly) polygons.push(currentPoly)
        currentPoly = [ring]
      } else {
        if (currentPoly) {
          currentPoly.push(ring)
        } else {
          currentPoly = [ring]
        }
      }
    }
    if (currentPoly) polygons.push(currentPoly)

    if (polygons.length <= 1) {
      return {
        type: 'Polygon',
        coordinates: esriGeom.rings
      }
    }

    return {
      type: 'MultiPolygon',
      coordinates: polygons
    }
  }

  // Polyline (paths)
  if (esriGeom.paths && Array.isArray(esriGeom.paths)) {
    if (esriGeom.paths.length === 1) {
      return {
        type: 'LineString',
        coordinates: esriGeom.paths[0]
      }
    }
    return {
      type: 'MultiLineString',
      coordinates: esriGeom.paths
    }
  }

  // Point (x, y)
  if (esriGeom.x !== undefined && esriGeom.y !== undefined) {
    return {
      type: 'Point',
      coordinates: [esriGeom.x, esriGeom.y]
    }
  }

  // MultiPoint (points)
  if (esriGeom.points && Array.isArray(esriGeom.points)) {
    return {
      type: 'MultiPoint',
      coordinates: esriGeom.points
    }
  }

  return null
}

function isClockwise(ring: [number, number][]): boolean {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1])
  }
  return sum > 0
}

/**
 * Converts GeoJSON geometry or envelope to Esri REST spatial filter payload
 */
export function geoJsonToEsriGeometry(geom: any): { geometryType: string; geometry: any } {
  if (!geom) {
    return { geometryType: 'esriGeometryPoint', geometry: '' }
  }

  // Envelope array [minx, miny, maxx, maxy]
  if (Array.isArray(geom) && geom.length === 4) {
    return {
      geometryType: 'esriGeometryEnvelope',
      geometry: geom.join(',')
    }
  }

  const g = geom.type === 'Feature' ? geom.geometry : geom

  if (g.type === 'Point') {
    return {
      geometryType: 'esriGeometryPoint',
      geometry: `${g.coordinates[0]},${g.coordinates[1]}`
    }
  }

  if (g.type === 'LineString') {
    return {
      geometryType: 'esriGeometryPolyline',
      geometry: JSON.stringify({
        paths: [g.coordinates],
        spatialReference: { wkid: 4326 }
      })
    }
  }

  if (g.type === 'MultiLineString') {
    return {
      geometryType: 'esriGeometryPolyline',
      geometry: JSON.stringify({
        paths: g.coordinates,
        spatialReference: { wkid: 4326 }
      })
    }
  }

  if (g.type === 'Polygon') {
    return {
      geometryType: 'esriGeometryPolygon',
      geometry: JSON.stringify({
        rings: g.coordinates,
        spatialReference: { wkid: 4326 }
      })
    }
  }

  if (g.type === 'MultiPolygon') {
    // Flatten multi-polygon outer and inner rings into single rings array for Esri polygon
    const rings = g.coordinates.flat(1)
    return {
      geometryType: 'esriGeometryPolygon',
      geometry: JSON.stringify({
        rings,
        spatialReference: { wkid: 4326 }
      })
    }
  }

  return {
    geometryType: 'esriGeometryPolygon',
    geometry: JSON.stringify(g)
  }
}

/**
 * Normalizes ArcGIS REST MapServer and FeatureServer interactions
 * Supports merged multi-sublayer identify, tolerance envelopes for lines/points,
 * 512px tile resolution, and resilient fallback to Esri JSON.
 */
export class EsriRestAdapter implements IDataAdapter {
  /**
   * Single layer identify - delegates to identifyBatch for consistent tolerance and MapServer /identify handling
   */
  async identify(
    layer: OperationalLayer,
    coordinate: [number, number],
    point: { x: number; y: number },
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    return this.identifyBatch([layer], coordinate, point, map)
  }

  /**
   * Merged identify across multiple layers:
   * Layers from the same MapServer are consolidated into a SINGLE /MapServer/identify call
   * with pixel tolerance and map extent, which accurately identifies lines, points and polygons.
   */
  async identifyBatch(
    layers: OperationalLayer[],
    coordinate: [number, number],
    point: { x: number; y: number },
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    if (!layers || layers.length === 0) return []

    // 1. Group layers by MapServer endpoint vs FeatureServer / standalone endpoints
    const mapServerGroups = new Map<string, OperationalLayer[]>()
    const featureLayers: OperationalLayer[] = []

    for (const layer of layers) {
      const rawUrl =
        layer.feature_service?.collection_url ||
        layer.feature_service?.url ||
        layer.data?.url ||
        layer.render?.url ||
        layer.url

      if (!rawUrl) continue

      const mapServerBase = this.extractMapServerBase(rawUrl)
      if (mapServerBase) {
        const group = mapServerGroups.get(mapServerBase) || []
        group.push(layer)
        mapServerGroups.set(mapServerBase, group)
      } else {
        featureLayers.push(layer)
      }
    }

    const promises: Promise<QueryResultFeature[]>[] = []

    // 2. Execute merged /MapServer/identify per MapServer service
    for (const [baseUrl, groupLayers] of mapServerGroups.entries()) {
      promises.push(this.identifyMapServerService(baseUrl, groupLayers, coordinate, map))
    }

    // 3. Execute individual /query for FeatureServer / standalone layers
    for (const fl of featureLayers) {
      promises.push(this.identifyFeatureLayer(fl, coordinate, map))
    }

    const results = await Promise.all(promises)
    return results.flat()
  }

  /**
   * Calls ArcGIS MapServer /identify endpoint, querying all specified sublayers in one request.
   */
  private async identifyMapServerService(
    baseUrl: string,
    layers: OperationalLayer[],
    coordinate: [number, number],
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    const sublayerIds = layers
      .map((l) => (l.serviceLayerId !== undefined ? l.serviceLayerId : this.extractSublayerIdFromUrl(l.url || '')))
      .filter((id): id is number => id !== null && id !== undefined)

    if (sublayerIds.length === 0) {
      sublayerIds.push(0)
    }

    const identifyUrl = new URL(`${baseUrl}/identify`)
    identifyUrl.searchParams.set('geometry', `${coordinate[0]},${coordinate[1]}`)
    identifyUrl.searchParams.set('geometryType', 'esriGeometryPoint')
    identifyUrl.searchParams.set('sr', '4326')
    // Standard ArcGIS identify syntax: all:0,2,4 or visible:0,2,4
    identifyUrl.searchParams.set('layers', `all:${sublayerIds.join(',')}`)
    identifyUrl.searchParams.set('tolerance', '8') // 8px tolerance allows clicking on lines and boundaries
    identifyUrl.searchParams.set('returnGeometry', 'true')
    identifyUrl.searchParams.set('f', 'json')

    // Current map canvas dimensions and bounds for accurate pixel tolerance
    if (map) {
      const bounds = map.getBounds()
      identifyUrl.searchParams.set(
        'mapExtent',
        `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
      )
      const canvas = map.getCanvas()
      identifyUrl.searchParams.set('imageDisplay', `${canvas.width || 1024},${canvas.height || 768},96`)
    } else {
      identifyUrl.searchParams.set('mapExtent', '140.96,-39.16,149.98,-33.98')
      identifyUrl.searchParams.set('imageDisplay', '1024,768,96')
    }

    try {
      const res = await fetch(identifyUrl.toString())
      if (!res.ok) return []
      const data = await res.json()
      if (data.error || !Array.isArray(data.results)) {
        if (data.error) console.warn('ArcGIS /identify error:', data.error)
        return []
      }

      return data.results.map((item: any, idx: number) => {
        const itemLayerId = item.layerId
        const itemLayerName = item.layerName

        // Match back to the corresponding OperationalLayer
        const matchedLayer =
          layers.find((l) => l.serviceLayerId === itemLayerId) ||
          layers.find((l) => l.title?.toLowerCase() === itemLayerName?.toLowerCase()) ||
          layers[0]

        const props = item.attributes || {}
        const displayField =
          item.displayFieldName ||
          matchedLayer.feature_service?.display_field ||
          matchedLayer.data?.displayField ||
          'name'
        const pk =
          matchedLayer.feature_service?.id_field ||
          matchedLayer.data?.primaryKey ||
          'OBJECTID'

        const titleVal =
          props[displayField] ||
          item.value ||
          props.NAME ||
          props.LGA_NAME ||
          props.LOCALITY_NAME ||
          props[pk] ||
          `Feature #${idx + 1}`

        const subtitle =
          props.zone_description ||
          props.description ||
          props.lga ||
          props.LGA_NAME ||
          props.LOCALITY_NAME ||
          props.POSTCODE ||
          item.layerName ||
          ''

        const geometry = esriGeometryToGeoJson(item.geometry, item.geometryType)

        return {
          id: String(item.attributes?.[pk] || `${matchedLayer.id}-${idx}`),
          layerId: matchedLayer.id,
          layerTitle: matchedLayer.title || item.layerName || 'ArcGIS Layer',
          title: String(titleVal),
          subtitle: String(subtitle),
          geometry,
          properties: props
        }
      })
    } catch (err) {
      console.warn(`[EsriRestAdapter] Merged identify failed for ${baseUrl}:`, err)
      return []
    }
  }

  /**
   * Fallback identify on FeatureServer or standalone feature layers via /query
   */
  private async identifyFeatureLayer(
    layer: OperationalLayer,
    coordinate: [number, number],
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    const rawUrl =
      layer.feature_service?.collection_url ||
      layer.feature_service?.url ||
      layer.data?.url ||
      layer.url
    if (!rawUrl) return []

    const queryUrl = new URL(rawUrl.endsWith('/query') ? rawUrl : `${rawUrl}/query`)

    // For polyline or point layers, create a small tolerance envelope around the click point
    const geomType = (layer.geometryType || '').toLowerCase()
    const zoom = map ? map.getZoom() : 14
    if (geomType === 'line' || geomType === 'point' || !geomType) {
      const pixelTolerance = 8
      const deltaLng = (pixelTolerance * 360) / (512 * Math.pow(2, zoom))
      const deltaLat = deltaLng * Math.cos((coordinate[1] * Math.PI) / 180)
      const bbox = [
        coordinate[0] - deltaLng,
        coordinate[1] - deltaLat,
        coordinate[0] + deltaLng,
        coordinate[1] + deltaLat
      ]
      queryUrl.searchParams.set('geometry', bbox.join(','))
      queryUrl.searchParams.set('geometryType', 'esriGeometryEnvelope')
    } else {
      queryUrl.searchParams.set('geometry', `${coordinate[0]},${coordinate[1]}`)
      queryUrl.searchParams.set('geometryType', 'esriGeometryPoint')
    }

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
      let response = await fetch(queryUrl.toString())
      if (!response.ok) return []
      let data = await response.json()

      // If server doesn't support GeoJSON, fallback to f=json
      if (data.error && data.error.code === 400) {
        queryUrl.searchParams.set('f', 'json')
        response = await fetch(queryUrl.toString())
        if (!response.ok) return []
        data = await response.json()
      }

      if (data.error) return []

      const rawFeatures = data.features || []
      return this.mapFeatures(layer, rawFeatures)
    } catch (err) {
      console.warn(`[EsriRestAdapter] FeatureLayer identify failed for ${layer.id}:`, err)
      return []
    }
  }

  /**
   * Executes attribute and spatial query on ArcGIS REST layer
   */
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

    // Ensure endpoint points to layer query, e.g. /MapServer/0/query
    let endpoint = rawUrl.trim().replace(/\/+$/, '')
    if (endpoint.endsWith('/MapServer') || endpoint.endsWith('/FeatureServer')) {
      const subId = layer.serviceLayerId ?? 0
      endpoint = `${endpoint}/${subId}/query`
    } else if (!endpoint.endsWith('/query')) {
      endpoint = `${endpoint}/query`
    }

    const params = new URLSearchParams()

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

    params.set('where', whereClause)
    params.set('f', 'geojson')
    params.set('outSR', '4326')
    params.set('returnGeometry', 'true')
    params.set('resultRecordCount', String(query.limit || 50))

    const outFields =
      layer.feature_service?.queryable_fields?.join(',') ||
      layer.data?.outFields?.join(',') ||
      '*'
    params.set('outFields', outFields)

    // 2. Spatial Criteria
    if (query.spatialCriteria) {
      const sc = query.spatialCriteria
      if (sc.mode === 'bbox' && Array.isArray(sc.geometry)) {
        params.set('geometry', sc.geometry.join(','))
        params.set('geometryType', 'esriGeometryEnvelope')
        params.set('inSR', '4326')
        params.set('spatialRel', 'esriSpatialRelIntersects')
      } else if (sc.mode === 'polygon' && sc.geometry) {
        const esriGeom = geoJsonToEsriGeometry(sc.geometry)
        params.set('geometry', esriGeom.geometry)
        params.set('geometryType', esriGeom.geometryType)
        params.set('inSR', '4326')
        params.set('spatialRel', 'esriSpatialRelIntersects')
      } else if (sc.mode === 'radius' && sc.center && sc.radiusMeters) {
        params.set('geometry', `${sc.center[0]},${sc.center[1]}`)
        params.set('geometryType', 'esriGeometryPoint')
        params.set('distance', String(sc.radiusMeters))
        params.set('units', 'esriSRUnit_Meter')
        params.set('inSR', '4326')
        params.set('spatialRel', 'esriSpatialRelIntersects')
      }
    }

    // 3. Resilient Fetch: Use POST when query length > 1500 chars to avoid HTTP 414 Request-URI Too Long
    const paramStr = params.toString()
    let response: Response
    if (paramStr.length > 1500) {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: paramStr
      })
    } else {
      response = await fetch(`${endpoint}?${paramStr}`)
    }

    if (!response.ok) {
      throw new Error(`Esri Query failed with HTTP ${response.status}: ${response.statusText}`)
    }

    let data = await response.json()

    // If server does not support GeoJSON, fallback to standard Esri JSON
    if (data.error && (data.error.code === 400 || String(data.error.message).includes('format'))) {
      params.set('f', 'json')
      const retryResponse = await fetch(`${endpoint}?${params.toString()}`)
      if (retryResponse.ok) {
        data = await retryResponse.json()
      }
    }

    if (data.error) {
      throw new Error(`ArcGIS Server Error: ${data.error.message || 'Query failed'}`)
    }

    const features = this.mapFeatures(layer, data.features || [])

    return {
      layerId: layer.id,
      layerTitle: layer.title,
      timestamp: Date.now(),
      features,
      totalCount: features.length
    }
  }

  /**
   * Helper to normalize both GeoJSON and Esri JSON features into QueryResultFeature
   */
  private mapFeatures(layer: OperationalLayer, rawFeatures: any[]): QueryResultFeature[] {
    const displayField =
      layer.feature_service?.display_field || layer.data?.displayField || 'name'
    const pk = layer.feature_service?.id_field || layer.data?.primaryKey || 'OBJECTID'

    return rawFeatures.map((feat: any, idx: number) => {
      // GeoJSON vs Esri JSON properties
      const props = feat.properties || feat.attributes || {}
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

      // Normalize geometry: GeoJSON coordinates vs Esri rings/paths/x,y
      const geometry = feat.geometry
        ? esriGeometryToGeoJson(feat.geometry)
        : null

      return {
        id: String(feat.id || props[pk] || `feat-${idx}`),
        layerId: layer.id,
        layerTitle: layer.title,
        title: String(titleVal),
        subtitle: String(subtitle),
        geometry,
        properties: props
      }
    })
  }

  private extractMapServerBase(url: string): string | null {
    const match = url.match(/^(https?:\/\/.+?\/MapServer)(\/.*)?$/i)
    return match ? match[1] : null
  }

  private extractSublayerIdFromUrl(url: string): number | null {
    const match = url.match(/\/MapServer\/(\d+)/i)
    return match ? parseInt(match[1], 10) : null
  }
}
