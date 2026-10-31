/**
 * Geodesic spatial buffering utilities.
 * Generates an accurate polygon buffer around a coordinate or polygon centroid.
 */

const EARTH_RADIUS = 6378137

/**
 * Creates a geodesic circle polygon buffer around a [lng, lat] point.
 * @param center [lng, lat]
 * @param radiusMeters buffer distance in meters
 * @param steps number of vertices (default 48 for smooth geometry)
 */
export function createPointBufferPolygon(
  center: [number, number],
  radiusMeters: number,
  steps = 48
): number[][][] {
  const [lng, lat] = center
  const coordinates: [number, number][] = []

  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const dByR = radiusMeters / EARTH_RADIUS

  for (let i = 0; i <= steps; i++) {
    const bearing = (i * 360) / steps
    const bearingRad = (bearing * Math.PI) / 180

    const pLat = Math.asin(
      Math.sin(latRad) * Math.cos(dByR) +
        Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearingRad)
    )

    const pLng =
      lngRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(dByR) * Math.cos(latRad),
        Math.cos(dByR) - Math.sin(latRad) * Math.sin(pLat)
      )

    coordinates.push([(pLng * 180) / Math.PI, (pLat * 180) / Math.PI])
  }

  return [coordinates]
}
