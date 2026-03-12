import { LatLng, LatLngBounds } from 'leaflet';
import { Packet } from '../types';

export interface StreetSegment {
  id: string;
  name: string;
  coordinates: LatLng[];
}

/**
 * Calculate the length of a street segment in meters
 */
function calculateStreetLength(street: StreetSegment): number {
  let totalLength = 0;

  for (let i = 0; i < street.coordinates.length - 1; i++) {
    const p1 = street.coordinates[i];
    const p2 = street.coordinates[i + 1];

    const R = 6371000;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const deltaLat = (p2.lat - p1.lat) * Math.PI / 180;
    const deltaLng = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    totalLength += R * c;
  }

  return totalLength;
}

/**
 * Estimate doors for streets (both sides)
 */
function estimateDoorsForStreets(streets: StreetSegment[]): number {
  const totalLength = streets.reduce((sum, street) => sum + calculateStreetLength(street), 0);
  // ~10 houses per 100m (covering both sides of street)
  return Math.max(Math.round(totalLength * 0.1), 5);
}

/**
 * Check if two streets share an endpoint (are connected)
 */
function streetsAreConnected(street1: StreetSegment, street2: StreetSegment, threshold = 0.0001): boolean {
  const s1Start = street1.coordinates[0];
  const s1End = street1.coordinates[street1.coordinates.length - 1];
  const s2Start = street2.coordinates[0];
  const s2End = street2.coordinates[street2.coordinates.length - 1];

  const distance = (p1: LatLng, p2: LatLng) => {
    return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
  };

  return (
    distance(s1Start, s2Start) < threshold ||
    distance(s1Start, s2End) < threshold ||
    distance(s1End, s2Start) < threshold ||
    distance(s1End, s2End) < threshold
  );
}

/**
 * Create a tight rectangular boundary around streets
 */
function createTightBoundary(streets: StreetSegment[], areaBounds: LatLngBounds): LatLng[] {
  const lats: number[] = [];
  const lngs: number[] = [];

  for (const street of streets) {
    for (const point of street.coordinates) {
      if (areaBounds.contains(point)) {
        lats.push(point.lat);
        lngs.push(point.lng);
      }
    }
  }

  if (lats.length === 0) return [];

  // Very small buffer - just 10 meters
  const buffer = 0.00009;
  const sw = areaBounds.getSouthWest();
  const ne = areaBounds.getNorthEast();

  const minLat = Math.max(Math.min(...lats) - buffer, sw.lat);
  const maxLat = Math.min(Math.max(...lats) + buffer, ne.lat);
  const minLng = Math.max(Math.min(...lngs) - buffer, sw.lng);
  const maxLng = Math.min(Math.max(...lngs) + buffer, ne.lng);

  return [
    new LatLng(minLat, minLng),
    new LatLng(minLat, maxLng),
    new LatLng(maxLat, maxLng),
    new LatLng(maxLat, minLng),
    new LatLng(minLat, minLng),
  ];
}

/**
 * Check if two rectangular polygons overlap
 */
function rectanglesOverlap(rect1: LatLng[], rect2: LatLng[]): boolean {
  if (rect1.length < 4 || rect2.length < 4) return false;

  // Get bounds of each rectangle
  const r1MinLat = Math.min(rect1[0].lat, rect1[2].lat);
  const r1MaxLat = Math.max(rect1[0].lat, rect1[2].lat);
  const r1MinLng = Math.min(rect1[0].lng, rect1[2].lng);
  const r1MaxLng = Math.max(rect1[0].lng, rect1[2].lng);

  const r2MinLat = Math.min(rect2[0].lat, rect2[2].lat);
  const r2MaxLat = Math.max(rect2[0].lat, rect2[2].lat);
  const r2MinLng = Math.min(rect2[0].lng, rect2[2].lng);
  const r2MaxLng = Math.max(rect2[0].lng, rect2[2].lng);

  // Check if rectangles overlap
  return !(
    r1MaxLat <= r2MinLat ||
    r1MinLat >= r2MaxLat ||
    r1MaxLng <= r2MinLng ||
    r1MinLng >= r2MaxLng
  );
}

function getStreetCenter(street: StreetSegment): LatLng {
  const coords = street.coordinates;
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  return new LatLng(
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2
  );
}

/**
 * Build walkable routes with NO overlapping
 */
export function buildWalkableRoutes(
  allStreets: StreetSegment[],
  targetDoorsPerRoute: number,
  numRoutes: number,
  areaBounds: LatLngBounds
): { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] {
  const routes: { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] = [];
  const usedStreetIds = new Set<string>();
  const existingBoundaries: LatLng[][] = [];

  // Filter streets within bounds
  const streets = allStreets.filter(street =>
    street.coordinates.some(coord => areaBounds.contains(coord))
  );

  if (streets.length === 0) return routes;

  // Sort by length (prioritize main streets)
  const sortedStreets = [...streets].sort((a, b) =>
    calculateStreetLength(b) - calculateStreetLength(a)
  );

  const areaCenter = areaBounds.getCenter();

  for (let routeIdx = 0; routeIdx < numRoutes; routeIdx++) {
    // Find unused street closest to center as seed
    let seedStreet: StreetSegment | null = null;
    let minDist = Infinity;

    for (const street of sortedStreets) {
      if (!usedStreetIds.has(street.id)) {
        const dist = getStreetCenter(street).distanceTo(areaCenter);
        if (dist < minDist) {
          minDist = dist;
          seedStreet = street;
        }
      }
    }

    if (!seedStreet) break; // No more streets

    const routeStreets: StreetSegment[] = [seedStreet];
    usedStreetIds.add(seedStreet.id);

    // Build connected walking route
    let searching = true;
    const maxStreetsInRoute = 6; // Limit route size

    while (searching && routeStreets.length < maxStreetsInRoute) {
      const currentDoors = estimateDoorsForStreets(routeStreets);

      // Stop if we've reached target range
      if (currentDoors >= targetDoorsPerRoute * 0.8 && currentDoors <= targetDoorsPerRoute * 1.3) {
        break;
      }

      // Stop if we're over
      if (currentDoors > targetDoorsPerRoute * 1.5) {
        break;
      }

      // Find next connected street
      let bestStreet: StreetSegment | null = null;
      let bestScore = -1;

      for (const street of sortedStreets) {
        if (usedStreetIds.has(street.id)) continue;

        // Check if connected or nearby
        let isConnected = false;
        let minDistanceToRoute = Infinity;

        for (const routeStreet of routeStreets) {
          if (streetsAreConnected(street, routeStreet)) {
            isConnected = true;
            break;
          }

          const dist = getStreetCenter(street).distanceTo(getStreetCenter(routeStreet));
          minDistanceToRoute = Math.min(minDistanceToRoute, dist);
        }

        // Only accept if connected or very close (within 80m)
        if (!isConnected && minDistanceToRoute > 80) continue;

        // Check if adding this would cause overlap
        const testStreets = [...routeStreets, street];
        const testBoundary = createTightBoundary(testStreets, areaBounds);

        if (testBoundary.length < 4) continue;

        // Check against all existing boundaries
        let wouldOverlap = false;
        for (const existingBoundary of existingBoundaries) {
          if (rectanglesOverlap(testBoundary, existingBoundary)) {
            wouldOverlap = true;
            break;
          }
        }

        if (wouldOverlap) continue;

        // Check if it would exceed door limit
        const wouldBeDoors = estimateDoorsForStreets(testStreets);
        if (wouldBeDoors > targetDoorsPerRoute * 1.5) continue;

        // Prefer connected streets, then closer streets
        const score = isConnected ? 1000 - minDistanceToRoute : 500 - minDistanceToRoute;
        if (score > bestScore) {
          bestScore = score;
          bestStreet = street;
        }
      }

      if (bestStreet) {
        routeStreets.push(bestStreet);
        usedStreetIds.add(bestStreet.id);
      } else {
        searching = false;
      }
    }

    // Create final boundary
    const doorCount = estimateDoorsForStreets(routeStreets);
    const boundary = createTightBoundary(routeStreets, areaBounds);

    if (boundary.length >= 4) {
      // Final overlap check
      let overlaps = false;
      for (const existingBoundary of existingBoundaries) {
        if (rectanglesOverlap(boundary, existingBoundary)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        existingBoundaries.push(boundary);
        routes.push({
          streets: routeStreets,
          doorCount,
          boundary,
        });
      }
    }
  }

  return routes;
}

/**
 * Convert routes to packets
 */
export function routesToPackets(
  routes: { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[],
  colors: string[]
): Packet[] {
  return routes.map((route, index) => {
    const boundary = route.boundary;
    const lats = boundary.map(p => p.lat);
    const lngs = boundary.map(p => p.lng);

    const sw = new LatLng(Math.min(...lats), Math.min(...lngs));
    const ne = new LatLng(Math.max(...lats), Math.max(...lngs));

    return {
      id: index + 1,
      bounds: new LatLngBounds(sw, ne),
      coordinates: [boundary],
      doorCount: route.doorCount,
      areaSize: Math.abs((ne.lat - sw.lat) * (ne.lng - sw.lng)) * 111000 * 111000,
      color: colors[index % colors.length],
      center: new LatLng((Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2),
    };
  });
}
