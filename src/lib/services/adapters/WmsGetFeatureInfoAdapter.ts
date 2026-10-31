import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../../types'
import type { IDataAdapter } from './IDataAdapter'
import type { Map as MapLibreMap } from 'maplibre-gl'

export class WmsGetFeatureInfoAdapter implements IDataAdapter {
  async identify(
    layer: OperationalLayer,
    _coordinate: [number, number],
    point: { x: number; y: number },
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]> {
    if (!map) return []
    const rawUrl = layer.data?.url || layer.url
    if (!rawUrl) return []

    const bounds = map.getBounds()
    const size = map.getCanvas()

    const wmsUrl = new URL(rawUrl)
    wmsUrl.searchParams.set('SERVICE', 'WMS')
    wmsUrl.searchParams.set('VERSION', '1.1.1')
    wmsUrl.searchParams.set('REQUEST', 'GetFeatureInfo')
    wmsUrl.searchParams.set('LAYERS', String(layer.data?.serviceLayerId || layer.id))
    wmsUrl.searchParams.set('QUERY_LAYERS', String(layer.data?.serviceLayerId || layer.id))
    wmsUrl.searchParams.set('INFO_FORMAT', 'application/json')
    wmsUrl.searchParams.set('SRS', 'EPSG:4326')
    wmsUrl.searchParams.set(
      'BBOX',
      `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
    )
    wmsUrl.searchParams.set('WIDTH', String(size.width))
    wmsUrl.searchParams.set('HEIGHT', String(size.height))
    wmsUrl.searchParams.set('X', String(Math.round(point.x)))
    wmsUrl.searchParams.set('Y', String(Math.round(point.y)))

    try {
      const response = await fetch(wmsUrl.toString())
      if (!response.ok) return []
      const data = await response.json()
      const displayField = layer.data?.displayField || 'name'

      return (data.features || []).map((feat: any, idx: number) => {
        const props = feat.properties || {}
        return {
          id: feat.id || `wms-${idx}`,
          layerId: layer.id,
          layerTitle: layer.title,
          title: String(props[displayField] || props.NAME || `WMS Feature #${idx + 1}`),
          subtitle: String(props.DESCRIPTION || props.category || ''),
          geometry: feat.geometry,
          properties: props
        }
      })
    } catch {
      return []
    }
  }

  async query(
    layer: OperationalLayer,
    _query: QueryDefinition,
    _map: MapLibreMap | null
  ): Promise<QueryResultCollection> {
    throw new Error(`Layer '${layer.title}' is a WMS service and only supports point Identify.`)
  }
}
