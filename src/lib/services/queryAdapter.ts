import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../types'
import { dataAdapterRegistry } from './adapters/DataAdapterRegistry'
import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Universal query dispatcher: delegates to the appropriate data adapter
 * (ArcGIS REST, GeoJSON Client, MVT Client, WMS)
 */
export async function executeLayerQuery(
  layer: OperationalLayer,
  query: QueryDefinition,
  map: MapLibreMap | null = null
): Promise<QueryResultCollection> {
  const adapterName =
    layer.data?.adapter ||
    (layer.feature_service?.type === 'esri_rest' || layer.format === 'esri-feature'
      ? 'esri-rest'
      : 'geojson-client')
  const adapter = dataAdapterRegistry.getAdapter(adapterName)
  return adapter.query(layer, query, map)
}

/**
 * Universal identify dispatcher: identifies features across any layer
 */
export async function identifyLayerAtCoordinate(
  layer: OperationalLayer,
  coordinate: [number, number],
  point: { x: number; y: number },
  map: MapLibreMap | null = null
): Promise<QueryResultFeature[]> {
  const adapterName =
    layer.data?.adapter ||
    (layer.feature_service?.type === 'esri_rest' || layer.format === 'esri-feature'
      ? 'esri-rest'
      : 'geojson-client')
  const adapter = dataAdapterRegistry.getAdapter(adapterName)
  return adapter.identify(layer, coordinate, point, map)
}
