import { LatLngBounds, LatLng } from 'leaflet';
import { Packet } from '../types';
import { fetchStreetNetwork } from './street-network';
import { buildWalkableRoutes, routesToPackets } from './walkable-packets';

// Color palette for packets
const PACKET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
];

/**
 * Calculate the area of a bounds in square meters
 */
function calculateArea(bounds: LatLngBounds): number {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // Approximate calculation using lat/lng difference
  // 1 degree latitude ≈ 111km
  // 1 degree longitude ≈ 111km * cos(latitude)
  const latDiff = ne.lat - sw.lat;
  const lngDiff = ne.lng - sw.lng;
  const avgLat = (ne.lat + sw.lat) / 2;

  const latMeters = latDiff * 111000;
  const lngMeters = lngDiff * 111000 * Math.cos(avgLat * Math.PI / 180);

  return Math.abs(latMeters * lngMeters);
}

/**
 * Estimate housing density based on area characteristics
 * Returns doors per square kilometer
 */
function estimateHousingDensity(bounds: LatLngBounds): number {
  // This is a rough estimate. In a real implementation, we'd use Census data
  // For now, we'll use a moderate suburban density

  // Typical densities:
  // - Urban dense: 5000-10000 doors/km²
  // - Urban medium: 2000-5000 doors/km²
  // - Suburban: 500-2000 doors/km²
  // - Rural: 50-500 doors/km²

  // Default to medium suburban density
  return 1500; // doors per km²
}

/**
 * Generate turf packets based on event configuration using street-aware logic
 */
export async function generatePackets(
  areaBounds: LatLngBounds,
  volunteers: number,
  groupSize: number,
  doorsPerPacket: number
): Promise<Packet[]> {
  // Try street-aware generation first
  try {
    const streetPackets = await generateStreetAwarePackets(
      areaBounds,
      volunteers,
      groupSize,
      doorsPerPacket
    );

    if (streetPackets.length > 0) {
      return streetPackets;
    }
  } catch (error) {
    console.warn('Street-aware generation failed, falling back to grid:', error);
  }

  // Fallback to grid-based generation
  return generateGridPackets(areaBounds, volunteers, groupSize, doorsPerPacket);
}

/**
 * Generate packets using street network data (walkability-optimized)
 */
async function generateStreetAwarePackets(
  areaBounds: LatLngBounds,
  volunteers: number,
  groupSize: number,
  doorsPerPacket: number
): Promise<Packet[]> {
  // Fetch street network data
  const streets = await fetchStreetNetwork(areaBounds);

  if (streets.length === 0) {
    throw new Error('No streets found in area');
  }

  // Calculate number of packets needed
  const packetsNeeded = Math.ceil(volunteers / groupSize);

  // Build walkable routes from connected streets
  const routes = buildWalkableRoutes(streets, doorsPerPacket, packetsNeeded);

  if (routes.length === 0) {
    throw new Error('No walkable routes identified');
  }

  // Convert routes to packets
  const packets = routesToPackets(routes, PACKET_COLORS);

  return packets;
}

/**
 * Fallback: Generate packets using simple grid (old method)
 */
function generateGridPackets(
  areaBounds: LatLngBounds,
  volunteers: number,
  groupSize: number,
  doorsPerPacket: number
): Packet[] {
  // Calculate number of packets needed based on volunteers
  const packetsNeeded = Math.ceil(volunteers / groupSize);

  // Get total area and estimate total doors available
  const totalArea = calculateArea(areaBounds);
  const density = estimateHousingDensity(areaBounds);
  const estimatedTotalDoors = Math.round((totalArea / 1000000) * density);

  // Calculate how many packets we'd need to achieve target doors per packet
  const packetsForTargetDoors = Math.ceil(estimatedTotalDoors / doorsPerPacket);

  // Use the LARGER of the two - this ensures:
  // - We have enough packets for all volunteers
  // - Each packet has close to the target door count
  const totalPackets = Math.max(packetsNeeded, packetsForTargetDoors);

  // Get bounds
  const sw = areaBounds.getSouthWest();
  const ne = areaBounds.getNorthEast();

  // Calculate grid dimensions (try to make packets roughly square-shaped)
  const aspectRatio = (ne.lng - sw.lng) / (ne.lat - sw.lat);
  const cols = Math.ceil(Math.sqrt(totalPackets * aspectRatio));
  const rows = Math.ceil(totalPackets / cols);

  // Calculate cell dimensions
  const latStep = (ne.lat - sw.lat) / rows;
  const lngStep = (ne.lng - sw.lng) / cols;

  const packets: Packet[] = [];
  let packetId = 0;

  // Generate grid cells - but only create as many as we need for volunteers
  for (let row = 0; row < rows && packetId < packetsNeeded; row++) {
    for (let col = 0; col < cols && packetId < packetsNeeded; col++) {
      const cellSw = new LatLng(
        sw.lat + row * latStep,
        sw.lng + col * lngStep
      );
      const cellNe = new LatLng(
        sw.lat + (row + 1) * latStep,
        sw.lng + (col + 1) * lngStep
      );

      const cellBounds = new LatLngBounds(cellSw, cellNe);
      const cellArea = calculateArea(cellBounds);

      // Create packet with polygon coordinates (corners of rectangle)
      const coordinates = [
        [
          cellSw,
          new LatLng(cellSw.lat, cellNe.lng),
          cellNe,
          new LatLng(cellNe.lat, cellSw.lng),
          cellSw, // Close the polygon
        ]
      ];

      // Calculate actual doors in this cell based on its area
      const actualDoorsInCell = Math.round((cellArea / 1000000) * density);

      // Use the actual calculated doors, but ensure it's reasonable
      // (between 50% and 150% of target to handle edge cases)
      const doorCount = Math.max(
        Math.round(doorsPerPacket * 0.5),
        Math.min(actualDoorsInCell, Math.round(doorsPerPacket * 1.5))
      );

      packets.push({
        id: packetId + 1,
        bounds: cellBounds,
        coordinates,
        doorCount: doorCount,
        areaSize: cellArea,
        color: PACKET_COLORS[packetId % PACKET_COLORS.length],
        center: cellBounds.getCenter(),
      });

      packetId++;
    }
  }

  return packets;
}
