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

    // Haversine distance
    const R = 6371000; // meters
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
 * Estimate doors for a street based on its length
 * Using ~10 houses per 100 meters (one side of street)
 */
function estimateDoorsForStreet(street: StreetSegment): number {
  const length = calculateStreetLength(street);
  // ~10 houses per 100m = 0.1 per meter
  return Math.max(Math.round(length * 0.1), 1);
}

/**
 * Create a tight rectangular boundary around a street
 */
function createStreetBoundary(street: StreetSegment): LatLng[] {
  const coords = street.coordinates;
  if (coords.length === 0) return [];

  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add small padding (about 20 meters)
  const latPadding = 0.0002;
  const lngPadding = 0.0002;

  return [
    new LatLng(minLat - latPadding, minLng - lngPadding),
    new LatLng(minLat - latPadding, maxLng + lngPadding),
    new LatLng(maxLat + latPadding, maxLng + lngPadding),
    new LatLng(maxLat + latPadding, minLng - lngPadding),
    new LatLng(minLat - latPadding, minLng - lngPadding), // Close polygon
  ];
}

/**
 * Create a boundary around multiple streets
 */
function createCombinedBoundary(streets: StreetSegment[]): LatLng[] {
  const allLats: number[] = [];
  const allLngs: number[] = [];

  for (const street of streets) {
    for (const coord of street.coordinates) {
      allLats.push(coord.lat);
      allLngs.push(coord.lng);
    }
  }

  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);

  // Add small padding
  const latPadding = 0.0002;
  const lngPadding = 0.0002;

  return [
    new LatLng(minLat - latPadding, minLng - lngPadding),
    new LatLng(minLat - latPadding, maxLng + lngPadding),
    new LatLng(maxLat + latPadding, maxLng + lngPadding),
    new LatLng(maxLat + latPadding, minLng - lngPadding),
    new LatLng(minLat - latPadding, minLng - lngPadding),
  ];
}

/**
 * Check if two streets are close enough to group together
 */
function areStreetsNearby(street1: StreetSegment, street2: StreetSegment): boolean {
  // Get center points
  const s1Center = getStreetCenter(street1);
  const s2Center = getStreetCenter(street2);

  // Check if within 100 meters
  const distance = s1Center.distanceTo(s2Center);
  return distance < 100;
}

function getStreetCenter(street: StreetSegment): LatLng {
  const coords = street.coordinates;
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);

  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  return new LatLng(centerLat, centerLng);
}

/**
 * Build walkable packets from streets
 */
export function buildWalkableRoutes(
  streets: StreetSegment[],
  targetDoorsPerRoute: number,
  numRoutes: number
): { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] {
  const routes: { streets: StreetSegment[]; doorCount: number; boundary: LatLng[] }[] = [];
  const usedStreetIds = new Set<string>();

  // Sort streets by length (longer first)
  const sortedStreets = [...streets].sort((a, b) => {
    return calculateStreetLength(b) - calculateStreetLength(a);
  });

  for (let i = 0; i < numRoutes; i++) {
    const routeStreets: StreetSegment[] = [];
    let currentDoors = 0;

    // Find first unused street as seed
    let seedStreet: StreetSegment | null = null;
    for (const street of sortedStreets) {
      if (!usedStreetIds.has(street.id)) {
        seedStreet = street;
        break;
      }
    }

    if (!seedStreet) break; // No more streets

    // Add seed street
    routeStreets.push(seedStreet);
    usedStreetIds.add(seedStreet.id);
    currentDoors = estimateDoorsForStreet(seedStreet);

    // Try to add more streets until we reach target
    let searching = true;
    while (searching && currentDoors < targetDoorsPerRoute * 1.2) {
      let bestStreet: StreetSegment | null = null;
      let bestDistance = Infinity;

      // Find closest unused street
      for (const street of sortedStreets) {
        if (usedStreetIds.has(street.id)) continue;

        const streetDoors = estimateDoorsForStreet(street);

        // Skip if it would massively exceed target
        if (currentDoors + streetDoors > targetDoorsPerRoute * 1.5) continue;

        // Check distance to any street in route
        for (const routeStreet of routeStreets) {
          if (areStreetsNearby(street, routeStreet)) {
            const distance = getStreetCenter(street).distanceTo(getStreetCenter(routeStreet));
            if (distance < bestDistance) {
              bestDistance = distance;
              bestStreet = street;
            }
          }
        }
      }

      if (bestStreet && bestDistance < 100) {
        routeStreets.push(bestStreet);
        usedStreetIds.add(bestStreet.id);
        currentDoors += estimateDoorsForStreet(bestStreet);

        // Stop if we're in target range
        if (currentDoors >= targetDoorsPerRoute * 0.8 && currentDoors <= targetDoorsPerRoute * 1.3) {
          searching = false;
        }
      } else {
        searching = false;
      }
    }

    if (routeStreets.length > 0) {
      routes.push({
        streets: routeStreets,
        doorCount: currentDoors,
        boundary: createCombinedBoundary(routeStreets),
      });
    }
  }

  return routes;
}

/**
 * Convert walkable routes to packets
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
