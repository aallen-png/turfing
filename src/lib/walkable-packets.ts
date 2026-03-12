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
 * Create a walking boundary around streets (following the street shape)
 */
function createWalkingBoundary(streets: StreetSegment[], areaBounds: LatLngBounds): LatLng[] {
  // Collect all street points
  const allPoints: LatLng[] = [];

  for (const street of streets) {
    for (const point of street.coordinates) {
      // Only include points within bounds
      if (areaBounds.contains(point)) {
        allPoints.push(point);

        // Add buffer points around each street point (creates walkable area on both sides)
        const buffer = 0.00015; // ~15 meters
        const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]; // 4 directions

        for (const angle of angles) {
          const bufferedPoint = new LatLng(
            point.lat + buffer * Math.cos(angle),
            point.lng + buffer * Math.sin(angle)
          );

          if (areaBounds.contains(bufferedPoint)) {
            allPoints.push(bufferedPoint);
          }
        }
      }
    }
  }

  if (allPoints.length < 3) {
    // Fallback to bounding box
    return createBoundingBox(streets, areaBounds);
  }

  // Create convex hull
  return createConvexHull(allPoints);
}

/**
 * Create a simple bounding box
 */
function createBoundingBox(streets: StreetSegment[], areaBounds: LatLngBounds): LatLng[] {
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

  const buffer = 0.00015;
  const sw = areaBounds.getSouthWest();
  const ne = areaBounds.getNorthEast();

  return [
    new LatLng(Math.max(Math.min(...lats) - buffer, sw.lat), Math.max(Math.min(...lngs) - buffer, sw.lng)),
    new LatLng(Math.max(Math.min(...lats) - buffer, sw.lat), Math.min(Math.max(...lngs) + buffer, ne.lng)),
    new LatLng(Math.min(Math.max(...lats) + buffer, ne.lat), Math.min(Math.max(...lngs) + buffer, ne.lng)),
    new LatLng(Math.min(Math.max(...lats) + buffer, ne.lat), Math.max(Math.min(...lngs) - buffer, sw.lng)),
    new LatLng(Math.max(Math.min(...lats) - buffer, sw.lat), Math.max(Math.min(...lngs) - buffer, sw.lng)),
  ];
}

/**
 * Convex hull using Gift wrapping algorithm
 */
function createConvexHull(points: LatLng[]): LatLng[] {
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

      if (next === current || cross > 0 ||
          (cross === 0 && distanceSquared(current, p) > distanceSquared(current, next))) {
        next = p;
      }
    }

    current = next;
  } while (current !== leftmost && hull.length < points.length);

  return hull;
}

function distanceSquared(a: LatLng, b: LatLng): number {
  return Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2);
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
 * Build walkable routes that make sense for humans
 */
export function buildWalkableRoutes(
  allStreets: StreetSegment[],
  targetDoorsPerRoute: number,
  numRoutes: number,
  areaBounds: LatLngBounds
): { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] {
  const routes: { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] = [];
  const usedStreetIds = new Set<string>();

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

  for (let i = 0; i < numRoutes; i++) {
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

    if (!seedStreet) break;

    const routeStreets: StreetSegment[] = [seedStreet];
    usedStreetIds.add(seedStreet.id);

    // Build connected walking route
    let addedAny = true;
    while (addedAny && routeStreets.length < 8) {
      addedAny = false;
      const currentDoors = estimateDoorsForStreets(routeStreets);

      // Stop if we've reached target range
      if (currentDoors >= targetDoorsPerRoute * 0.8 && currentDoors <= targetDoorsPerRoute * 1.3) {
        break;
      }

      // Stop if we're way over
      if (currentDoors > targetDoorsPerRoute * 1.5) {
        break;
      }

      // Find connected streets
      for (const street of sortedStreets) {
        if (usedStreetIds.has(street.id)) continue;

        // Check if connected to any street in route
        let isConnected = false;
        for (const routeStreet of routeStreets) {
          if (streetsAreConnected(street, routeStreet)) {
            isConnected = true;
            break;
          }
        }

        // Also accept nearby streets (within 100m)
        if (!isConnected) {
          for (const routeStreet of routeStreets) {
            if (getStreetCenter(street).distanceTo(getStreetCenter(routeStreet)) < 100) {
              isConnected = true;
              break;
            }
          }
        }

        if (isConnected) {
          const wouldBeDoors = estimateDoorsForStreets([...routeStreets, street]);
          if (wouldBeDoors <= targetDoorsPerRoute * 1.5) {
            routeStreets.push(street);
            usedStreetIds.add(street.id);
            addedAny = true;
            break;
          }
        }
      }
    }

    const doorCount = estimateDoorsForStreets(routeStreets);
    const boundary = createWalkingBoundary(routeStreets, areaBounds);

    if (boundary.length >= 3) {
      routes.push({
        streets: routeStreets,
        doorCount,
        boundary,
      });
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
