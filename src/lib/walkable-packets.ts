import { LatLng, LatLngBounds } from 'leaflet';
import { Packet } from '../types';

export interface StreetSegment {
  id: string;
  name: string;
  coordinates: LatLng[];
}

/**
 * Calculate the length of a street segment in meters using Haversine
 */
function calculateStreetLength(street: StreetSegment): number {
  let totalLength = 0;

  for (let i = 0; i < street.coordinates.length - 1; i++) {
    const p1 = street.coordinates[i];
    const p2 = street.coordinates[i + 1];

    const R = 6371000; // Earth radius in meters
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    totalLength += R * c;
  }

  return totalLength;
}

/**
 * Calculate doors for a single street
 * More conservative: ~8 houses per 100m (both sides, accounting for gaps)
 */
function calculateDoorsForStreet(street: StreetSegment): number {
  const lengthMeters = calculateStreetLength(street);
  return Math.max(Math.round((lengthMeters / 100) * 8), 1);
}

/**
 * Get center point of street
 */
function getStreetCenter(street: StreetSegment): LatLng {
  const lats = street.coordinates.map(c => c.lat);
  const lngs = street.coordinates.map(c => c.lng);
  return new LatLng(
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2
  );
}

/**
 * Check if two streets share endpoints (connected at intersection)
 */
function streetsConnected(s1: StreetSegment, s2: StreetSegment): boolean {
  const threshold = 0.0001; // ~10 meters

  const ends1 = [s1.coordinates[0], s1.coordinates[s1.coordinates.length - 1]];
  const ends2 = [s2.coordinates[0], s2.coordinates[s2.coordinates.length - 1]];

  for (const e1 of ends1) {
    for (const e2 of ends2) {
      const dist = Math.sqrt(
        Math.pow(e1.lat - e2.lat, 2) + Math.pow(e1.lng - e2.lng, 2)
      );
      if (dist < threshold) return true;
    }
  }
  return false;
}

/**
 * Create a polygon boundary that wraps around street coordinates
 * Uses a buffer approach to create walkable area on both sides
 */
function createStreetPolygon(streets: StreetSegment[], areaBounds: LatLngBounds): LatLng[] {
  const allPoints: LatLng[] = [];

  // Collect all street points and add buffered points
  for (const street of streets) {
    for (const point of street.coordinates) {
      if (!areaBounds.contains(point)) continue;

      allPoints.push(point);

      // Add 8 buffer points around each street point (~20m radius)
      const buffer = 0.00018; // ~20 meters
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const buffered = new LatLng(
          point.lat + buffer * Math.cos(angle),
          point.lng + buffer * Math.sin(angle)
        );
        if (areaBounds.contains(buffered)) {
          allPoints.push(buffered);
        }
      }
    }
  }

  if (allPoints.length < 3) {
    return createBoundingBox(streets, areaBounds);
  }

  // Create convex hull for natural boundary
  return convexHull(allPoints);
}

/**
 * Simple bounding box fallback
 */
function createBoundingBox(streets: StreetSegment[], areaBounds: LatLngBounds): LatLng[] {
  const lats: number[] = [];
  const lngs: number[] = [];

  for (const street of streets) {
    for (const pt of street.coordinates) {
      if (areaBounds.contains(pt)) {
        lats.push(pt.lat);
        lngs.push(pt.lng);
      }
    }
  }

  if (lats.length === 0) return [];

  const pad = 0.00015;
  return [
    new LatLng(Math.min(...lats) - pad, Math.min(...lngs) - pad),
    new LatLng(Math.min(...lats) - pad, Math.max(...lngs) + pad),
    new LatLng(Math.max(...lats) + pad, Math.max(...lngs) + pad),
    new LatLng(Math.max(...lats) + pad, Math.min(...lngs) - pad),
    new LatLng(Math.min(...lats) - pad, Math.min(...lngs) - pad),
  ];
}

/**
 * Convex hull using gift wrapping
 */
function convexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return points;

  // Find leftmost point
  let leftmost = points[0];
  for (const p of points) {
    if (p.lng < leftmost.lng || (p.lng === leftmost.lng && p.lat < leftmost.lat)) {
      leftmost = p;
    }
  }

  const hull: LatLng[] = [];
  let current = leftmost;

  do {
    hull.push(current);
    let next = points[0];

    for (const p of points) {
      if (p === current) continue;

      const cross = (next.lat - current.lat) * (p.lng - current.lng) -
                   (next.lng - current.lng) * (p.lat - current.lat);

      if (next === current || cross > 0) {
        next = p;
      }
    }

    current = next;
  } while (current !== leftmost && hull.length < points.length);

  return hull;
}

/**
 * Check if any street in group1 is already used
 */
function anyStreetUsed(streets: StreetSegment[], usedIds: Set<string>): boolean {
  return streets.some(s => usedIds.has(s.id));
}

/**
 * Build walkable routes with strict door target
 */
export function buildWalkableRoutes(
  allStreets: StreetSegment[],
  targetDoors: number,
  numRoutes: number,
  areaBounds: LatLngBounds
): { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] {
  const routes: { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] = [];
  const usedStreetIds = new Set<string>();

  // Filter streets within bounds
  const streets = allStreets.filter(s =>
    s.coordinates.some(c => areaBounds.contains(c))
  );

  if (streets.length === 0) return routes;

  // Sort by length descending (main streets first)
  const sortedStreets = [...streets].sort((a, b) =>
    calculateStreetLength(b) - calculateStreetLength(a)
  );

  const areaCenter = areaBounds.getCenter();

  // Strict door range: 80-130% of target
  const minDoors = Math.floor(targetDoors * 0.8);
  const maxDoors = Math.ceil(targetDoors * 1.3);

  for (let i = 0; i < numRoutes; i++) {
    // Find closest unused street to center
    let seedStreet: StreetSegment | null = null;
    let minDist = Infinity;

    for (const street of sortedStreets) {
      if (usedStreetIds.has(street.id)) continue;

      const dist = getStreetCenter(street).distanceTo(areaCenter);
      if (dist < minDist) {
        minDist = dist;
        seedStreet = street;
      }
    }

    if (!seedStreet) break;

    // Start route with seed
    const routeStreets: StreetSegment[] = [seedStreet];
    usedStreetIds.add(seedStreet.id);
    let currentDoors = calculateDoorsForStreet(seedStreet);

    // Build route by adding connected/nearby streets
    let keepSearching = true;
    const maxStreetsPerRoute = 5;

    while (keepSearching && routeStreets.length < maxStreetsPerRoute && currentDoors < maxDoors) {
      let bestStreet: StreetSegment | null = null;
      let bestScore = -Infinity;

      for (const candidate of sortedStreets) {
        if (usedStreetIds.has(candidate.id)) continue;

        const candidateDoors = calculateDoorsForStreet(candidate);
        const totalDoors = currentDoors + candidateDoors;

        // Skip if it would exceed max
        if (totalDoors > maxDoors) continue;

        // Check connection/proximity to existing route
        let isConnected = false;
        let minDistToRoute = Infinity;

        for (const routeStreet of routeStreets) {
          if (streetsConnected(candidate, routeStreet)) {
            isConnected = true;
            break;
          }
          const dist = getStreetCenter(candidate).distanceTo(getStreetCenter(routeStreet));
          minDistToRoute = Math.min(minDistToRoute, dist);
        }

        // Only accept if connected or within 75m
        if (!isConnected && minDistToRoute > 75) continue;

        // Score: prefer connected streets, then closer streets, then streets that get us closer to target
        const connectionScore = isConnected ? 1000 : 500;
        const distanceScore = -minDistToRoute;
        const targetScore = totalDoors >= minDoors ? 100 : 0; // Bonus if we hit target
        const score = connectionScore + distanceScore + targetScore;

        if (score > bestScore) {
          bestScore = score;
          bestStreet = candidate;
        }
      }

      if (bestStreet) {
        routeStreets.push(bestStreet);
        usedStreetIds.add(bestStreet.id);
        currentDoors += calculateDoorsForStreet(bestStreet);

        // Stop if we're in the good range
        if (currentDoors >= minDoors && currentDoors <= maxDoors) {
          keepSearching = false;
        }
      } else {
        keepSearching = false;
      }
    }

    // Only accept routes that meet minimum
    if (currentDoors >= minDoors * 0.9) { // Allow slightly below if we tried
      const boundary = createStreetPolygon(routeStreets, areaBounds);

      if (boundary.length >= 3) {
        routes.push({
          streets: routeStreets,
          doorCount: currentDoors,
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
