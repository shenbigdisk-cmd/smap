/**
 * Spherical & Geodesic utilities for GIS map measurements.
 */

const EARTH_RADIUS = 6378137 // WGS84 major radius in meters

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
 * Calculates geodesic polygon area on the WGS84 sphere in square meters.
 */
export function calculatePolygonAreaM2(points: [number, number][]): number {
  if (points.length < 3) return 0

  let totalAngle = 0
  const n = points.length

  for (let i = 0; i < n; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]

    const bearing1 = getBearing(p2, p1)
    const bearing2 = getBearing(p2, p3)

    let angle = bearing2 - bearing1
    if (angle < 0) angle += 360
    totalAngle += angle
  }

  const sphericalExcess = (totalAngle - (n - 2) * 180) * (Math.PI / 180)
  const area = Math.abs(sphericalExcess * EARTH_RADIUS * EARTH_RADIUS)
  return isNaN(area) ? 0 : area
}

function getBearing(from: [number, number], to: [number, number]): number {
  const [lon1, lat1] = from.map((d) => (d * Math.PI) / 180)
  const [lon2, lat2] = to.map((d) => (d * Math.PI) / 180)

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)

  const brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
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
 * Formats coordinates for Victoria (GDA2020 / WGS84 Lat/Lng and MGA Zone 55 Easting/Northing approximation).
 */
export function formatCoordinates(lng: number, lat: number): {
  latLng: string
  mga55: string
  dms: string
} {
  const latStr = `${Math.abs(lat).toFixed(6)}° ${lat < 0 ? 'S' : 'N'}`
  const lngStr = `${Math.abs(lng).toFixed(6)}° ${lng < 0 ? 'W' : 'E'}`

  // Simple UTM Zone 55S projection approximation for central Victoria (meridian 147°E)
  const falseEasting = 500000
  const falseNorthing = 10000000
  const centralMeridian = 147.0

  const k0 = 0.9996
  const dLon = ((lng - centralMeridian) * Math.PI) / 180
  const rLat = (lat * Math.PI) / 180

  const easting = Math.round(
    falseEasting + k0 * EARTH_RADIUS * dLon * Math.cos(rLat)
  )
  const northing = Math.round(
    falseNorthing + k0 * EARTH_RADIUS * rLat
  )

  const toDms = (val: number, isLat: boolean) => {
    const abs = Math.abs(val)
    const deg = Math.floor(abs)
    const minFloat = (abs - deg) * 60
    const min = Math.floor(minFloat)
    const sec = ((minFloat - min) * 60).toFixed(1)
    const dir = isLat ? (val < 0 ? 'S' : 'N') : val < 0 ? 'W' : 'E'
    return `${deg}°${min}'${sec}" ${dir}`
  }

  return {
    latLng: `${latStr}, ${lngStr}`,
    mga55: `E: ${easting.toLocaleString()}  N: ${northing.toLocaleString()} (MGA55)`,
    dms: `${toDms(lat, true)}, ${toDms(lng, false)}`
  }
}
