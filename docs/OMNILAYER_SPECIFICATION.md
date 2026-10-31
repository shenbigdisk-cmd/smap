# OmniLayer Specification: Dual-Channel Spatial Architecture (DCSA)

The **OmniLayer Specification** establishes the canonical foundation for all spatial layers, rendering pipelines, and analytical services in the WebGIS framework. 

It solves the fundamental mismatch between high-speed visual rendering (GPU canvas) and rich spatial intelligence (attribute queries, buffers, joins, identify) by decoupling them into two cooperating channels.

---

## 1. The Core Paradigm: Dual-Channel Architecture

Traditional WebGIS systems force layers into monolithic, backend-specific types (`EsriLayer`, `WmsLayer`, `GeoJsonLayer`), creating leaky abstractions and bloated tool code.

The **Dual-Channel Spatial Architecture (DCSA)** separates every spatial layer into two independent, purpose-built engines:

```
                            ┌────────────────────────────────────────┐
                            │        Canonical Layer Contract        │
                            │                (OmniLayer)             │
                            └───────────────────┬────────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
        ┌─────────────────────────┐                           ┌─────────────────────────┐
        │     RENDER CHANNEL      │                           │     FEATURE CHANNEL     │
        │      (layer.render)     │                           │ (layer.feature_service) │
        ├─────────────────────────┤                           ├─────────────────────────┤
        │ • 60 FPS GPU Rendering  │                           │ • Spatial Intersect     │
        │ • PMTiles / Vector Tile │                           │ • Geodesic Buffers      │
        │ • WMS / WMTS Tile Cache │                           │ • SQL Attribute Filter  │
        │ • MapServer Dynamic PNG │                           │ • Table Inspector       │
        │ • MapLibre GL Integration│                          │ • Full Unclipped Schema │
        └─────────────────────────┘                           └─────────────────────────┘
```

### The Three Golden Rules of OmniLayer:
1. **MapCanvas only speaks Render**: The map canvas (`MapCanvas.svelte`) consumes **only** `layer.render`. It never issues SQL queries or cares what database powers the layer.
2. **Tools only speak Feature Service**: Analytical tools (`QueryModule.svelte`, `ResultsModule.svelte`, Buffer, Table) consume **only** `layer.feature_service`. They never inspect canvas styles or vertex buffers directly.
3. **Capabilities Matrix drives the UI**: Toolbars, buttons, and context menus read `layer.capabilities` to determine feature availability without hardcoded type checks (`layer.type === 'esri'`).

---

## 2. Canonical Layer Specification Schema

Every layer in the application store conforms strictly to this TypeScript contract:

```typescript
export interface OmniLayerDefinition {
  /** Unique layer identifier (e.g. 'vic_planning_zones') */
  readonly id: string

  /** Parent service identifier */
  readonly serviceId: string

  /** Human-readable title */
  readonly title: string

  /** Operational status: if false, completely omitted from network calls and memory */
  readonly enabled: boolean

  /** Visual visibility: if true, rendered on map canvas */
  readonly visible: boolean

  /** Layer opacity (0.0 to 1.0) */
  readonly opacity: number

  /** Visual Rendering Specification (Render Channel) */
  readonly render: LayerRenderDescriptor

  /** Feature & Query Specification (Feature Channel) */
  readonly feature_service?: FeatureServiceDescriptor

  /** Capabilities Matrix */
  readonly capabilities: LayerCapabilitiesMatrix
}
```

### 2.1 The Render Channel (`render`)
Controls how pixels and geometries are drawn onto the MapLibre canvas:

```typescript
export type LayerRenderType =
  | 'pmtiles'       // Cloud-optimized PMTiles archive (Vector or Raster)
  | 'vector_tile'   // Mapbox / XYZ Vector Tiles (MVT/PBF)
  | 'raster_tile'   // Slippy XYZ raster tiles
  | 'wms'           // OGC Web Map Service (dynamic raster export)
  | 'wmts'          // OGC Web Map Tile Service (pre-rendered tile matrix)
  | 'esri_export'   // ArcGIS MapServer dynamic export (/export)
  | 'esri_tile'     // ArcGIS MapServer pre-cached fused tiles (/tile/{z}/{y}/{x})
  | 'geojson'       // Client-side GeoJSON vector rendering

export interface LayerRenderDescriptor {
  readonly type: LayerRenderType
  readonly url: string
  readonly source_layer?: string      // Required for vector tiles / PMTiles
  readonly layers?: string | number   // Sublayer ID for WMS or MapServer
  readonly format?: string            // e.g. 'image/png', 'png32'
  readonly transparent?: boolean
  readonly minzoom?: number
  readonly maxzoom?: number
  readonly paint?: Record<string, unknown>
  readonly layout?: Record<string, unknown>
}
```

### 2.2 The Feature Channel (`feature_service`)
Controls how attributes, geometry hits, and queries are executed:

```typescript
export type FeatureServiceType =
  | 'ogc_features'  // OGC API - Features (e.g. pg_featureserv, ldproxy, pygeoapi)
  | 'wfs'           // OGC Web Feature Service (1.1.0 or 2.0.0)
  | 'esri_rest'     // ArcGIS REST API (/FeatureServer/{id} or /MapServer/{id}/query)
  | 'geojson_local' // In-memory client-side GeoJSON dataset

export interface FeatureServiceDescriptor {
  readonly type: FeatureServiceType
  readonly collection_url: string
  readonly id_field?: string          // Primary key (e.g. 'pfi', 'OBJECTID', 'id')
  readonly display_field?: string     // Primary label for search and popups
  readonly queryable_fields?: readonly string[]
  readonly fields?: readonly LayerFieldSchema[]
}
```

### 2.3 The Capabilities Matrix (`capabilities`)
Explicitly informs UI tools what operations the layer supports:

```typescript
export interface LayerCapabilitiesMatrix {
  /** Point hit-test: 'server' (GetFeatureInfo/ArcGIS identify), 'client' (canvas query), or false */
  readonly identify: 'server' | 'client' | false

  /** Supports attribute SQL / filtering */
  readonly query: boolean

  /** Supports spatial buffer queries */
  readonly buffer: boolean

  /** Supports GeoJSON/CSV tabular export */
  readonly export: boolean

  /** Supports tabular grid inspection */
  readonly table: boolean
}
```

---

## 3. Real-World Architectural Configurations

### Pattern A: Modern Cloud-Native (PMTiles + OGC API Features)
High-performance statutory zoning: PMTiles provides 60fps vector tile rendering; `pg_featureserv` provides Postgres/PostGIS SQL queries.

```json
{
  "id": "vic_planning_zones",
  "title": "Planning Scheme Zones",
  "enabled": true,
  "visible": true,
  "opacity": 0.7,
  "render": {
    "type": "pmtiles",
    "url": "https://cdn.example.gov.au/tiles/planning_zones.pmtiles",
    "source_layer": "zones",
    "minzoom": 6,
    "maxzoom": 17,
    "paint": {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.6
    }
  },
  "capabilities": {
    "identify": "server",
    "query": true,
    "buffer": true,
    "export": true,
    "table": true
  },
  "feature_service": {
    "type": "ogc_features",
    "collection_url": "https://api.example.gov.au/pg_featureserv/collections/public.vic_planning_zones",
    "id_field": "pfi",
    "display_field": "zone_code",
    "queryable_fields": ["zone_code", "lga_name", "gaz_date", "status"]
  }
}
```

### Pattern B: Enterprise ESRI (MapServer + FeatureServer Companion)
Enterprise GIS standard: MapServer provides server-side cartographic raster export; FeatureServer provides GeoJSON attribute queries.

```json
{
  "id": "vic_crown_land",
  "title": "Crown Land Reserves",
  "enabled": true,
  "visible": true,
  "opacity": 0.8,
  "render": {
    "type": "esri_export",
    "url": "https://spatial.planning.vic.gov.au/gis/rest/services/Crown_Land_Reserves/MapServer",
    "layers": "show:0",
    "format": "png32",
    "transparent": true
  },
  "capabilities": {
    "identify": "server",
    "query": true,
    "buffer": true,
    "export": true,
    "table": true
  },
  "feature_service": {
    "type": "esri_rest",
    "collection_url": "https://spatial.planning.vic.gov.au/gis/rest/services/Crown_Land_Reserves/FeatureServer/0",
    "id_field": "OBJECTID",
    "display_field": "PARCEL_SPI",
    "queryable_fields": ["PARCEL_SPI", "RESERVE_NAME", "TENURE_STATUS"]
  }
}
```

### Pattern C: Open Standards (OGC WMS + WFS Companion)
GeoServer standard: WMS delivers dynamic map images; WFS provides feature selection and geometry extraction.

```json
{
  "id": "heritage_overlays",
  "title": "Heritage Protection Overlays",
  "enabled": true,
  "visible": true,
  "opacity": 0.65,
  "render": {
    "type": "wms",
    "url": "https://geoserver.example.org/geoserver/wms",
    "layers": "planning:heritage_overlays",
    "format": "image/png",
    "transparent": true
  },
  "capabilities": {
    "identify": "server",
    "query": true,
    "buffer": true,
    "export": true,
    "table": true
  },
  "feature_service": {
    "type": "wfs",
    "collection_url": "https://geoserver.example.org/geoserver/wfs",
    "id_field": "gml_id",
    "queryable_fields": ["overlay_code", "name", "significance"]
  }
}
```

---

## 4. The Loader / Normalization Pipeline

To eliminate manual configuration, **Service Loaders** inspect external server endpoints and dynamically generate OmniLayer definitions:

```
[Raw URL / Config] ──► [ServiceLoaderRegistry] ──► [Specific Loader] ──► [OmniLayer Definition] ──► [mapStore]
```

### Pluggable Loaders:
1. **`EsriServiceLoader`**:
   - Fetches `/MapServer?f=json` or `/FeatureServer?f=json`.
   - Inspects `singleFusedMapCache`: if `true`, sets `render.type = 'esri_tile'`, else `'esri_export'`.
   - Introspects field definitions (`esriFieldTypeString`, `esriFieldTypeInteger`) and populates `queryable_fields`.
   - Checks companion `/FeatureServer` automatically.
2. **`OgcFeaturesLoader`**:
   - Fetches `/collections`.
   - Inspects geometry schemas and `/queryables`.
   - Normalizes collections into queryable OmniLayers.
3. **`WmsLoader` / `WmtsLoader`**:
   - Parses `GetCapabilities` XML.
   - Configures layer names, coordinate projections, and `GetFeatureInfo` identify flags.
4. **`PmtilesLoader`**:
   - Reads PMTiles header (vector vs raster, source layers, zoom extents).
   - Generates GPU-accelerated MapLibre vector sources.

---

## 5. Service Lifecycle & Resilient Disabling

### Service vs. Layer States:
- **`enabled: false` (Hard Kill)**:
  - Completely unmounts MapLibre canvas sources and layers.
  - Aborts pending network requests.
  - Skips layer from query indexing and table generation.
  - Can be toggled with 1-click in the UI or set statically in `app.config.json`.
- **`visible: false` (Soft Mute)**:
  - Source remains mounted; canvas visibility is hidden (`layout: { visibility: 'none' }`).

### Circuit Breakers:
- Remote server calls (ESRI, WMS) run under a strict 4-second abort timeout.
- Unreachable or CORS-blocked services transition to `status: 'offline'` without freezing map boot or blocking local services.
