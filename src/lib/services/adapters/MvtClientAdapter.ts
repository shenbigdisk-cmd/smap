import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../../types'
import type { IDataAdapter } from './IDataAdapter'
import type { Map as MapLibreMap } from 'maplibre-gl'

export class MvtClientAdapter implements IDataAdapter {
  async identify(
    layer: OperationalLayer,
    _coordinate: [number, number],
    point: { x: number; y: number },
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    if (!map) return []

    // Find rendered layers associated with this layer
    const candidateLayerIds = [
      layer.id,
      `${layer.id}-fill`,
      `${layer.id}-line`,
      layer.rendering.style.sourceLayer || ''
    ].filter(Boolean)

    const existingLayers = candidateLayerIds.filter((id) => Boolean(map.getLayer(id)))
    if (existingLayers.length === 0) return []

    // Sample within a small 6px box around cursor
    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [point.x - 3, point.y - 3],
      [point.x + 3, point.y + 3]
    ]

    const features = map.queryRenderedFeatures(bbox, {
      layers: existingLayers
    })

    const displayField = layer.data?.displayField || 'name'
    const pk = layer.data?.primaryKey || 'id'

    return features.map((feat, idx) => {
      const props = feat.properties || {}
      const titleVal = props[displayField] || props.NAME || props[pk] || `Vector Feature #${idx + 1}`
      const subtitle = props.description || props.category || props.type || ''

      return {
        id: feat.id || props[pk] || `mvt-${idx}`,
        layerId: layer.id,
        layerTitle: layer.title,
        title: String(titleVal),
        subtitle: String(subtitle),
        geometry: feat.geometry,
        properties: props
      }
    })
  }

  async query(
    layer: OperationalLayer,
    _query: QueryDefinition,
    _map: MapLibreMap | null
  ): Promise<QueryResultCollection> {
    // Vector tile standalone layers explicitly do not support global server queries
    throw new Error(
      `Layer '${layer.title}' is a Vector Tile layer and only supports in-viewport Identify.`
    )
  }
}
