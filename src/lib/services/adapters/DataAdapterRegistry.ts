import type { IDataAdapter } from './IDataAdapter'
import { EsriRestAdapter } from './EsriRestAdapter'
import { GeoJsonClientAdapter } from './GeoJsonClientAdapter'
import { MvtClientAdapter } from './MvtClientAdapter'
import { WmsGetFeatureInfoAdapter } from './WmsGetFeatureInfoAdapter'
import type { LayerCapabilities, OperationalLayer } from '../../types'

class DataAdapterRegistry {
  private adapters = new Map<string, IDataAdapter>()
  public geoJsonAdapter: GeoJsonClientAdapter

  constructor() {
    this.geoJsonAdapter = new GeoJsonClientAdapter()
    this.adapters.set('geojson-client', this.geoJsonAdapter)
    this.adapters.set('esri-rest', new EsriRestAdapter())
    this.adapters.set('mvt-client', new MvtClientAdapter())
    this.adapters.set('wms', new WmsGetFeatureInfoAdapter())
  }

  getAdapter(name: string): IDataAdapter {
    const adapter = this.adapters.get(name)
    if (!adapter) {
      // Default fallback to GeoJSON or Esri
      return this.geoJsonAdapter
    }
    return adapter
  }

  registerAdapter(name: string, adapter: IDataAdapter) {
    this.adapters.set(name, adapter)
  }

  /**
   * Resolves the exact capabilities a layer supports based on its data adapter,
   * format, and endpoints.
   */
  resolveLayerCapabilities(layer: Partial<OperationalLayer>): LayerCapabilities {
    const adapter = layer.data?.adapter || (layer.format === 'esri-feature' ? 'esri-rest' : 'geojson-client')

    let baseCaps: LayerCapabilities

    switch (adapter) {
      case 'mvt-client':
        // Vector Tiles without companion query endpoint only support viewport Identify
        baseCaps = {
          identify: true,
          queryAttribute: false,
          querySpatial: false,
          buffer: false,
          export: false,
          table: false
        }
        break

      case 'wms':
        // Standard WMS only supports point GetFeatureInfo Identify
        baseCaps = {
          identify: true,
          queryAttribute: false,
          querySpatial: false,
          buffer: false,
          export: false,
          table: false
        }
        break

      case 'esri-rest':
        // Esri FeatureServer / MapServer supports full attribute & geometry queries
        baseCaps = {
          identify: true,
          queryAttribute: true,
          querySpatial: true,
          buffer: true,
          export: true,
          table: true
        }
        break

      case 'geojson-client':
      default:
        // Local GeoJSON layers support all client-side queries and geometry operations
        baseCaps = {
          identify: true,
          queryAttribute: true,
          querySpatial: true,
          buffer: true,
          export: true,
          table: true
        }
        break
    }

    // Merge with any custom capabilities explicitly configured on the layer
    return {
      ...baseCaps,
      ...(layer.capabilities || {})
    }
  }
}

export const dataAdapterRegistry = new DataAdapterRegistry()
