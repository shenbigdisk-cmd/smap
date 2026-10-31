# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Svelte, Vite, TypeScript, MapLibre GL JS

## Users

Primary users are urban planners, land surveyors, spatial analysts, council officers, and citizens exploring land parcels, zoning schemes, planning overlays, and geographic datasets.

## Product Purpose

A modular, reusable WebGIS engine and application template inspired by enterprise spatial portals like VicPlan and Geocortex / VertiGIS Studio Web. It provides a turn-key framework for building interactive map applications with planning-grade discoverability and structured property inspection.

## Positioning

Brings the workflow density, dockable panels, parcel drill-down, and spatial layer control of Geocortex/VicPlan into a fast, reactive Svelte + MapLibre GL JS architecture that is lightweight, modern, and easily configurable.

## Operating Context

- Desktop and field laptop/tablet browser environments.
- Task-oriented workflows: address/parcel lookup, zoning verification, overlay conflict analysis, distance/area measurement, and data attribute review.
- High-density information presentation alongside a full-bleed spatial map canvas.

## Capabilities and Constraints

- Omnibox search with multi-type parsing (addresses, lot/plan numbers, coordinates) and camera fit-bounds.
- Collapsible multi-tab left drawer:
  - **Workflows**: Quick actions ("I want to...", zoom to area, property lookup).
  - **Layers**: Hierarchical layer catalog, visibility toggles, opacity controls, symbology legends.
  - **Results**: Selected feature card, zoning badges, overlays, metadata table.
  - **Tools**: Spatial measurement (distance, polygon area, point coordinate readout).
- Central reactive map canvas powered by MapLibre GL JS with basemap switcher, zoom controls, coordinate/scale bar.
- Modular architecture with core engine components in `src/lib/` driven by a central configuration (`map.config.ts`).

## Brand Commitments

- Visual language inspired by the Victorian Government / VicPlan Geocortex interface: authoritative, utilitarian, calm, high-contrast, professional GIS styling.
- Distinct status and zone badging (e.g., Residential, Commercial, Heritage, Environmental).

## Evidence on Hand

- VicPlan (Victorian Planning Scheme Map viewer) and VertiGIS Geocortex Viewer for HTML5 standard navigation patterns and component hierarchies.

## Product Principles

1. **Map-First Clarity**: The map canvas remains unobstructed and fluid; panels slide, dock, and collapse smoothly without obscuring critical spatial context.
2. **Predictable Navigation**: Search, layer control, and feature inspection follow proven WebGIS patterns familiar to planners and the public.
3. **Modular & Declarative**: Applications and layers are defined via clean TypeScript configuration without hardcoded spatial dependencies.
4. **Resilient Performance**: Rapid vector tile rendering, zero unnecessary reactivity loops, and instant response during zoom, pan, and filter operations.

## Accessibility & Inclusion

Targeting WCAG 2.1 AA compliance: accessible color contrast ratios for badges and overlays, keyboard navigable panels and controls, aria-expanded states on collapsible drawers, and clear focus indicators.
