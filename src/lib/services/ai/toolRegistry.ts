import { mapStore } from '../../stores/mapStore.svelte'
import { SAMPLE_PARCELS, SEARCH_INDEX } from '../../data/sampleData'
import { MAP_CONFIG } from '../../config/map.config'
import type { AIToolDefinition, AIToolExecutionResult } from './types'

export interface RegisteredTool {
  definition: AIToolDefinition
  execute: (args: Record<string, any>) => Promise<AIToolExecutionResult>
}

class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  constructor() {
    this.registerBuiltInTools()
  }

  register(tool: RegisteredTool) {
    this.tools.set(tool.definition.name, tool)
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }

  getAllDefinitions(): AIToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  async execute(name: string, args: Record<string, any>): Promise<AIToolExecutionResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        toolName: name,
        success: false,
        error: `Tool "${name}" is not registered`
      }
    }
    try {
      return await tool.execute(args)
    } catch (err: any) {
      return {
        toolName: name,
        success: false,
        error: err?.message || 'Execution error'
      }
    }
  }

  private registerBuiltInTools() {
    // 1. Search Property Tool
    this.register({
      definition: {
        name: 'search_property',
        description: 'Locates a property by address, Standard Parcel Identifier (SPI), Lot/Plan, or Council Lot. Automatically pans and highlights the parcel on the map.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The property address or SPI code to locate (e.g., "120 Swanston Street" or "1\\TP842910")'
            }
          },
          required: ['query']
        }
      },
      execute: async ({ query }) => {
        const q = String(query || '').trim().toLowerCase()
        if (!q) {
          return { toolName: 'search_property', success: false, error: 'Query is empty' }
        }

        // Check SAMPLE_PARCELS first
        let found = SAMPLE_PARCELS.find(
          (p) =>
            p.address.toLowerCase().includes(q) ||
            p.spi.toLowerCase().includes(q) ||
            p.lotPlan.toLowerCase().includes(q)
        )

        // If not in sample parcels, check search index
        if (!found) {
          const match = SEARCH_INDEX.find(
            (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
          )
          if (match && match.parcelId) {
            found = SAMPLE_PARCELS.find((p) => p.id === match.parcelId)
          }
        }

        // Fallback to top sample parcel if query asks for a general search
        if (!found && SAMPLE_PARCELS.length > 0 && (q.includes('melbourne') || q.includes('swanston') || q.includes('property'))) {
          found = SAMPLE_PARCELS[0]
        }

        if (found) {
          mapStore.selectParcel(found, false)
          return {
            toolName: 'search_property',
            success: true,
            displaySummary: `Located ${found.address}`,
            data: {
              id: found.id,
              address: found.address,
              spi: found.spi,
              lotPlan: found.lotPlan,
              lga: found.lga,
              areaM2: found.areaM2,
              zone: {
                code: found.zone.code,
                name: found.zone.name
              },
              overlays: found.overlays.map((o) => ({
                code: o.code,
                name: o.name
              }))
            },
            actions: [
              {
                label: 'View Planning Report',
                action: () => {
                  mapStore.reportModalOpen = true
                }
              },
              {
                label: 'Zoom Extent',
                action: () => {
                  if (found) mapStore.selectParcel(found)
                }
              }
            ]
          }
        }

        return {
          toolName: 'search_property',
          success: false,
          error: `No parcel found matching "${query}".`
        }
      }
    })

    // 2. Planning Controls Inspection Tool
    this.register({
      definition: {
        name: 'get_planning_controls',
        description: 'Retrieves Victoria planning scheme zones and planning overlays for the currently selected property or a designated location.',
        parameters: {
          type: 'object',
          properties: {
            addressOrSpi: {
              type: 'string',
              description: 'Optional address or SPI. If omitted, inspects the currently selected property.'
            }
          },
          required: []
        }
      },
      execute: async ({ addressOrSpi }) => {
        let parcel = mapStore.selectedParcel

        if (addressOrSpi) {
          const q = String(addressOrSpi).toLowerCase()
          parcel =
            SAMPLE_PARCELS.find(
              (p) =>
                p.address.toLowerCase().includes(q) ||
                p.spi.toLowerCase().includes(q) ||
                p.lotPlan.toLowerCase().includes(q)
            ) || parcel
          if (parcel) mapStore.selectParcel(parcel, false)
        }

        if (!parcel) {
          return {
            toolName: 'get_planning_controls',
            success: false,
            error: 'No property selected. Specify an address or search for a parcel first.'
          }
        }

        return {
          toolName: 'get_planning_controls',
          success: true,
          displaySummary: `Planning Scheme: ${parcel.zone.code} with ${parcel.overlays.length} overlay(s)`,
          data: {
            property: parcel.address,
            zone: {
              code: parcel.zone.code,
              name: parcel.zone.name,
              category: parcel.zone.category,
              ordinanceUrl: parcel.zone.ordinanceUrl
            },
            overlays: parcel.overlays.map((o) => ({
              code: o.code,
              name: o.name,
              category: o.category,
              ordinanceUrl: o.ordinanceUrl
            }))
          },
          actions: [
            {
              label: 'Open Full Report',
              action: () => {
                mapStore.reportModalOpen = true
              }
            }
          ]
        }
      }
    })

    // 3. Generate Property Report Tool
    this.register({
      definition: {
        name: 'generate_property_report',
        description: 'Opens and prepares the official Victoria Planning Property Report document preview with zoning, overlays, and map extent.',
        parameters: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Optional address to report on before generating the document.'
            }
          },
          required: []
        }
      },
      execute: async ({ address }) => {
        if (address) {
          const q = String(address).toLowerCase()
          const parcel = SAMPLE_PARCELS.find((p) => p.address.toLowerCase().includes(q))
          if (parcel) mapStore.selectParcel(parcel, false)
        }

        if (!mapStore.selectedParcel) {
          // If no parcel selected, default to the top sample parcel
          if (SAMPLE_PARCELS.length > 0) {
            mapStore.selectParcel(SAMPLE_PARCELS[0], false)
          } else {
            return {
              toolName: 'generate_property_report',
              success: false,
              error: 'Please search or select a property first to generate a Planning Property Report.'
            }
          }
        }

        mapStore.reportModalOpen = true

        return {
          toolName: 'generate_property_report',
          success: true,
          displaySummary: `Opened Planning Property Report for ${mapStore.selectedParcel?.address}`,
          data: {
            address: mapStore.selectedParcel?.address,
            spi: mapStore.selectedParcel?.spi,
            zone: mapStore.selectedParcel?.zone.code,
            overlaysCount: mapStore.selectedParcel?.overlays.length
          }
        }
      }
    })

    // 4. Quick Export Tool
    this.register({
      definition: {
        name: 'export_map',
        description: 'Exports the active map canvas with cartographic neatline, scale bar, and coordinates.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      execute: async () => {
        try {
          await mapStore.executeQuickPrint()
          return {
            toolName: 'export_map',
            success: true,
            displaySummary: 'Map export generated and downloaded.'
          }
        } catch (err: any) {
          return {
            toolName: 'export_map',
            success: false,
            error: err?.message || 'Export failed'
          }
        }
      }
    })

    // 5. Toggle Layer Tool
    this.register({
      definition: {
        name: 'toggle_layer',
        description: 'Toggles visibility for a spatial layer (e.g. Planning Scheme, Bushfire, Aerial Photography, Cadastre).',
        parameters: {
          type: 'object',
          properties: {
            layerName: {
              type: 'string',
              description: 'Layer name or category (e.g. "planning", "bushfire", "cadastre", "imagery")'
            },
            visible: {
              type: 'string',
              enum: ['on', 'off', 'toggle'],
              description: 'Desired visibility state'
            }
          },
          required: ['layerName']
        }
      },
      execute: async ({ layerName, visible = 'toggle' }) => {
        const q = String(layerName).toLowerCase()
        const match = mapStore.layers.find(
          (l) => (l.title && l.title.toLowerCase().includes(q)) || l.id.toLowerCase().includes(q)
        )

        if (!match) {
          return {
            toolName: 'toggle_layer',
            success: false,
            error: `Layer matching "${layerName}" not found.`
          }
        }

        const currentlyVisible = mapStore.isLayerVisible(match)
        let shouldBeVisible = !currentlyVisible
        if (visible === 'on') shouldBeVisible = true
        if (visible === 'off') shouldBeVisible = false

        if (currentlyVisible !== shouldBeVisible) {
          mapStore.toggleLayer(match.id)
        }

        const layerTitle = match.title || match.id
        return {
          toolName: 'toggle_layer',
          success: true,
          displaySummary: `Layer "${layerTitle}" is now ${shouldBeVisible ? 'visible' : 'hidden'}.`,
          data: {
            layerId: match.id,
            layerName: layerTitle,
            visible: shouldBeVisible
          }
        }
      }
    })

    // 6. Zoom Extent Tool
    this.register({
      definition: {
        name: 'zoom_to_extent',
        description: 'Navigates the map to Victoria statewide bounds, Melbourne CBD, or the currently selected parcel.',
        parameters: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              enum: ['victoria', 'melbourne', 'selected_parcel'],
              description: 'Destination extent'
            }
          },
          required: ['target']
        }
      },
      execute: async ({ target }) => {
        if (!mapStore.map) {
          return { toolName: 'zoom_to_extent', success: false, error: 'Map is not initialized' }
        }

        if (target === 'victoria') {
          mapStore.zoomToVictoriaExtent()
          return { toolName: 'zoom_to_extent', success: true, displaySummary: 'Fitted map to Victoria statewide extent' }
        } else if (target === 'melbourne') {
          mapStore.map.flyTo({
            center: [144.9631, -37.8136],
            zoom: 14,
            essential: true
          })
          return { toolName: 'zoom_to_extent', success: true, displaySummary: 'Panned to Melbourne CBD' }
        } else if (target === 'selected_parcel' && mapStore.selectedParcel) {
          mapStore.selectParcel(mapStore.selectedParcel, false)
          return { toolName: 'zoom_to_extent', success: true, displaySummary: `Centered on ${mapStore.selectedParcel.address}` }
        }

        return { toolName: 'zoom_to_extent', success: false, error: 'Unknown target or no parcel selected' }
      }
    })

    // 7. Spatial Buffer Tool
    this.register({
      definition: {
        name: 'create_buffer',
        description: 'Creates a spatial radius buffer (in meters) around the currently selected property.',
        parameters: {
          type: 'object',
          properties: {
            radiusMeters: {
              type: 'string',
              description: 'Radius in meters (e.g. 50, 100, 200, 500)'
            }
          },
          required: ['radiusMeters']
        }
      },
      execute: async ({ radiusMeters }) => {
        const radius = Number(radiusMeters) || 100
        if (!mapStore.selectedParcel) {
          if (SAMPLE_PARCELS.length > 0) {
            mapStore.selectParcel(SAMPLE_PARCELS[0], false)
          } else {
            return { toolName: 'create_buffer', success: false, error: 'Select a property first before buffering' }
          }
        }

        mapStore.setBufferRadius(radius)
        return {
          toolName: 'create_buffer',
          success: true,
          displaySummary: `Generated ${radius}m buffer zone around ${mapStore.selectedParcel?.address}`,
          data: {
            radiusMeters: radius,
            center: mapStore.selectedParcel?.center
          }
        }
      }
    })
  }
}

export const toolRegistry = new ToolRegistry()
