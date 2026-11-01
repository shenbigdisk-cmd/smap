import type {
  OperationalLayer,
  QueryDefinition,
  QueryResultCollection,
  QueryResultFeature
} from '../../types'
import type { Map as MapLibreMap } from 'maplibre-gl'

export interface IDataAdapter {
  /**
   * Identifies features at a clicked map coordinate [lng, lat]
   */
  identify(
    layer: OperationalLayer,
    coordinate: [number, number],
    point: { x: number; y: number },
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]>

  /**
   * Optional batched identify for services that support multi-sublayer identification (e.g. ArcGIS MapServer)
   */
  identifyBatch?(
    layers: OperationalLayer[],
    coordinate: [number, number],
    point: { x: number; y: number },
    map: MapLibreMap | null
  ): Promise<QueryResultFeature[]>

  /**
   * Executes attribute and/or spatial query
   */
  query(
    layer: OperationalLayer,
    query: QueryDefinition,
    map: MapLibreMap | null
  ): Promise<QueryResultCollection>

  /**
   * Fetch full feature by primary key/id
   */
  getFeatureById?(
    layer: OperationalLayer,
    id: string | number
  ): Promise<QueryResultFeature | null>
}
