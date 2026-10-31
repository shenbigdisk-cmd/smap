import { MAP_CONFIG } from '../config/map.config'

/**
 * Spherical & Geodesic utilities for GIS map measurements.
 * Configured for GDA2020 / Map Grid of Australia (MGA2020) with null datum transformation
 * from Web Mercator / WGS84 coordinates.
 */

// GRS80 Ellipsoid parameters (GDA2020 standard)
const GRS80_A = 6378137.0 // Semi-major axis (meters)
const GRS80_INV_F = 298.257222101 // Inverse flattening
const GRS80_F = 1 / GRS80_INV_F
const GRS80_E2 = 2 * GRS80_F - GRS80_F * GRS80_F // Eccentricity squared

const EARTH_RADIUS = GRS80_A

/**
 * Calculates Great Circle distance between two [lng, lat] coordinates in meters.
 */
export function calculateDistanceMeters(p1: [number, number], p2: [number, number]): number {
  const [lon1, lat1] = p1
  const [lon2, lat2] = p2

  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const rLat1 = (lat1 * Math.PI) / 180
  const rLat2 = (lat2 * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS * c
}

/**
 * Calculates total polyline length in meters.
 */
export function calculatePathLengthMeters(points: [number, number][]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistanceMeters(points[i], points[i + 1])
  }
  return total
}

/**
 * Calculates geodesic polygon area in square meters using the Chamberlain-Duquette (1964) algorithm.
 * Robust across all polygon shapes, winding directions, and sizes.
 */
export function calculatePolygonAreaM2(points: [number, number][]): number {
  if (points.length < 3) return 0

  const n = points.length
  let total = 0
  const rad = Math.PI / 180

  for (let i = 0; i < n; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % n]

    const lon1 = p1[0] * rad
    const lat1 = p1[1] * rad
    const lon2 = p2[0] * rad
    const lat2 = p2[1] * rad

    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }

  const area = Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2)
  return isNaN(area) ? 0 : area
}

/**
 * Formats metric distance nicely (e.g. "124 m" or "3.42 km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString()} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

/**
 * Formats metric area nicely (e.g. "725 m²" or "4.21 ha").
 */
export function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${Math.round(sqMeters).toLocaleString()} m²`
  }
  const hectares = sqMeters / 10000
  if (hectares < 100) {
    return `${hectares.toFixed(2)} ha`
  }
  return `${(sqMeters / 1000000).toFixed(2)} km² (${hectares.toFixed(1)} ha)`
}

/**
 * Projects Geographic coordinates to Map Grid of Australia 2020 (MGA2020)
 * using Redfearn's formulas on the GRS80 ellipsoid with a null transformation (no datum shift)
 * from Web Mercator / WGS84 coordinates.
 */
export function latLngToMGA2020(
  lng: number,
  lat: number,
  zone: number = MAP_CONFIG.coordinates?.defaultZone ?? 55
): { easting: number; northing: number; zone: number } {
  const centralMeridian = zone * 6 - 183
  const phi = (lat * Math.PI) / 180
  const lam = (lng * Math.PI) / 180
  const lam0 = (centralMeridian * Math.PI) / 180
  const omega = lam - lam0

  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const tanPhi = Math.tan(phi)

  const a = GRS80_A
  const e2 = GRS80_E2
  const k0 = 0.9996
  const falseEasting = 500000
  const falseNorthing = 10000000

  const A0 = 1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256
  const A2 = (3 / 8) * (e2 + (e2 * e2) / 4 + (15 * e2 * e2 * e2) / 128)
  const A4 = (15 / 256) * (e2 * e2 + (3 * e2 * e2 * e2) / 4)
  const A6 = (35 / 3072) * (e2 * e2 * e2)

  const m = a * (A0 * phi - A2 * Math.sin(2 * phi) + A4 * Math.sin(4 * phi) - A6 * Math.sin(6 * phi))

  const rho = (a * (1 - e2)) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5)
  const nu = a / Math.sqrt(1 - e2 * sinPhi * sinPhi)
  const psi = nu / rho
  const t = tanPhi

  const w2 = omega * omega
  const w3 = w2 * omega
  const w4 = w2 * w2
  const w5 = w4 * omega
  const w6 = w3 * w3
  const c = cosPhi
  const c3 = c * c * c
  const c5 = c3 * c * c

  const termE1 = omega * c
  const termE2 = ((w3 * c3) / 6) * (psi - t * t)
  const termE3 =
    ((w5 * c5) / 120) *
    (4 * psi * psi * psi * (1 - 6 * t * t) +
      psi * psi * (1 + 8 * t * t) -
      2 * psi * t * t +
      t * t * t * t)

  const easting = falseEasting + k0 * nu * (termE1 + termE2 + termE3)

  const termN1 = (w2 * c * c) / 2
  const termN2 = ((w4 * c3 * c) / 24) * (4 * psi * psi + psi - t * t)
  const termN3 =
    ((w6 * c5 * c) / 720) *
    (61 - 58 * t * t + t * t * t * t + 270 * psi - 330 * t * t * psi)

  const northing = falseNorthing + k0 * (m + nu * t * (termN1 + termN2 + termN3))

  return {
    easting: Math.round(easting),
    northing: Math.round(northing),
    zone
  }
}

/**
 * Formats coordinates strictly for GDA2020 standards as configured in app.config.json.
 * Null transformation from Web Mercator to GDA2020.
 */
export function formatCoordinates(
  lng: number,
  lat: number,
  zone: number = MAP_CONFIG.coordinates?.defaultZone ?? 55
): {
  mga2020: string
  gda2020LatLng: string
  pillText: string
  latLng: string
  mga55: string
  dms: string
  datum: string
} {
  const { easting, northing } = latLngToMGA2020(lng, lat, zone)

  const latStr = `${Math.abs(lat).toFixed(6)}° ${lat < 0 ? 'S' : 'N'}`
  const lngStr = `${Math.abs(lng).toFixed(6)}° ${lng < 0 ? 'W' : 'E'}`
  const gda2020LatLng = `${latStr}, ${lngStr} (GDA2020)`
  const mga2020 = `E: ${easting.toLocaleString()} m  N: ${northing.toLocaleString()} m (MGA2020 Z${zone})`
  const pillText = `E: ${easting.toLocaleString()}  N: ${northing.toLocaleString()} (GDA2020 Z${zone})`

  return {
    mga2020,
    gda2020LatLng,
    pillText,
    latLng: gda2020LatLng,
    mga55: mga2020,
    dms: gda2020LatLng,
    datum: MAP_CONFIG.coordinates?.labels?.datum ?? 'GDA2020 (GRS80 / Null Transform)'
  }
}
