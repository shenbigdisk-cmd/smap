import type { ServiceDefinition } from '../../types'
import { EsriServiceLoader } from './EsriServiceLoader'
import { GeoJsonLoader } from './GeoJsonLoader'
import { OgcFeaturesLoader } from './OgcFeaturesLoader'
import { PmtilesLoader } from './PmtilesLoader'
import { WmsLoader } from './WmsLoader'
import type { IServiceLoader, RawServiceConfig } from './types'

/**
 * Central orchestrator for the OmniLayer normalization pipeline.
 * Routes raw static configs and dynamic runtime URLs through protocol-specific
 * loaders into the canonical ServiceDefinition model.
 */
export class ServiceLoaderRegistry {
  private static instance: ServiceLoaderRegistry | null = null
  private loaders: IServiceLoader[] = []

  constructor() {
    // Registered in priority order: specialized vector/archive -> cloud protocols -> fallback local
    this.loaders.push(new PmtilesLoader())
    this.loaders.push(new EsriServiceLoader())
    this.loaders.push(new OgcFeaturesLoader())
    this.loaders.push(new WmsLoader())
    this.loaders.push(new GeoJsonLoader())
  }

  static getInstance(): ServiceLoaderRegistry {
    if (!ServiceLoaderRegistry.instance) {
      ServiceLoaderRegistry.instance = new ServiceLoaderRegistry()
    }
    return ServiceLoaderRegistry.instance
  }

  /**
   * Register a custom protocol loader.
   */
  registerLoader(loader: IServiceLoader): void {
    this.loaders.unshift(loader)
  }

  /**
   * Find a suitable loader and compile raw service configuration into a canonical ServiceDefinition.
   */
  async loadService(config: RawServiceConfig): Promise<ServiceDefinition> {
    for (const loader of this.loaders) {
      if (loader.canHandle(config)) {
        return loader.load(config)
      }
    }

    // Default fallback to GeoJSON loader
    const fallback = this.loaders[this.loaders.length - 1]
    return fallback.load(config)
  }

  /**
   * Auto-discover a service from an arbitrary external URL.
   */
  async autoDiscoverService(url: string, typeHint?: string): Promise<ServiceDefinition> {
    const rawConfig: RawServiceConfig = {
      url: url.trim(),
      type: typeHint || this.inferTypeFromUrl(url),
      autoDiscover: true,
      enabled: true
    }
    return this.loadService(rawConfig)
  }

  /**
   * Normalize an array of service configurations in parallel.
   */
  async loadAll(configs: RawServiceConfig[]): Promise<ServiceDefinition[]> {
    const results = await Promise.allSettled(configs.map((c) => this.loadService(c)))
    return results
      .filter((r): r is PromiseFulfilledResult<ServiceDefinition> => r.status === 'fulfilled')
      .map((r) => r.value)
  }

  private inferTypeFromUrl(url: string): string {
    const lower = url.toLowerCase()
    if (lower.includes('/mapserver') || lower.includes('/featureserver')) return 'esri-rest'
    if (lower.includes('/collections')) return 'ogc-api'
    if (lower.includes('service=wms') || lower.includes('/wms')) return 'wms'
    if (lower.includes('service=wmts') || lower.includes('/wmts')) return 'wmts'
    if (lower.endsWith('.pmtiles')) return 'pmtiles'
    return 'geojson-static'
  }
}

export const serviceLoaderRegistry = ServiceLoaderRegistry.getInstance()
