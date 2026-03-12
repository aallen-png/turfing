import { LatLngBounds, LatLng } from 'leaflet';

export interface StreetSegment {
  id: string;
  name: string;
  coordinates: LatLng[];
  type: string; // residential, tertiary, etc.
}

export interface Block {
  id: string;
  streets: StreetSegment[];
  bounds: LatLngBounds;
  estimatedHouses: number;
  center: LatLng;
}

/**
 * Fetch street network data from OpenStreetMap using Overpass API
 */
export async function fetchStreetNetwork(bounds: LatLngBounds): Promise<StreetSegment[]> {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // Overpass API query for residential streets only
  // Exclude highways, motorways, and major roads
  const query = `
    [out:json][timeout:25];
    (
      way["highway"="residential"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
      way["highway"="unclassified"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
      way["highway"="living_street"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
    );
    out geom;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    const data = await response.json();

    const segments: StreetSegment[] = [];

    for (const element of data.elements) {
      if (element.type === 'way' && element.geometry) {
        const coordinates = element.geometry.map((node: any) =>
          new LatLng(node.lat, node.lon)
        );

        segments.push({
          id: element.id.toString(),
          name: element.tags?.name || 'Unnamed Street',
          coordinates,
          type: element.tags?.highway || 'residential',
        });
      }
    }

    return segments;
  } catch (error) {
    console.error('Error fetching street network:', error);
    return [];
  }
}

/**
 * Group street segments into walkable blocks
 * A block is typically a small area with a few streets
 */
export function groupIntoBlocks(segments: StreetSegment[]): Block[] {
  const blocks: Block[] = [];
  const processedSegments = new Set<string>();

  const existingBlocks: Block[] = [];

  // Group nearby segments together - each segment only in ONE block
  for (const segment of segments) {
    if (processedSegments.has(segment.id)) continue;

    const relatedSegments = [segment];
    processedSegments.add(segment.id);

    const segCenter = getSegmentCenter(segment);

    // Find segments that are nearby (create compact, non-overlapping blocks)
    for (const other of segments) {
      if (processedSegments.has(other.id)) continue;

      // Check if segments are close together
      const otherCenter = getSegmentCenter(other);
      const distance = segCenter.distanceTo(otherCenter);

      // Group if within 100 meters and limit block size (smaller, tighter blocks)
      if (distance < 100 && relatedSegments.length < 3) {
        relatedSegments.push(other);
        processedSegments.add(other.id);
      }
    }

    // Calculate block bounds and center
    const allCoords = relatedSegments.flatMap(s => s.coordinates);
    if (allCoords.length === 0) continue;

    const lats = allCoords.map(c => c.lat);
    const lngs = allCoords.map(c => c.lng);

    const blockBounds = new LatLngBounds(
      new LatLng(Math.min(...lats), Math.min(...lngs)),
      new LatLng(Math.max(...lats), Math.max(...lngs))
    );

    // Check if this block overlaps with any existing block
    let overlapsExisting = false;
    for (const existingBlock of existingBlocks) {
      if (boundsOverlap(blockBounds, existingBlock.bounds)) {
        overlapsExisting = true;
        break;
      }
    }

    // Skip this block if it overlaps
    if (overlapsExisting) continue;

    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Estimate houses based on street length
    const totalLength = relatedSegments.reduce((sum, seg) =>
      sum + calculateSegmentLength(seg), 0
    );
    // Assume ~3 houses per 100 meters of street (more conservative)
    // This accounts for both sides but also gaps, driveways, etc.
    const estimatedHouses = Math.round((totalLength / 100) * 3);

    const newBlock: Block = {
      id: `block-${existingBlocks.length}`,
      streets: relatedSegments,
      bounds: blockBounds,
      estimatedHouses: Math.max(estimatedHouses, 3), // Minimum 3 houses per block
      center: new LatLng(centerLat, centerLng),
    };

    existingBlocks.push(newBlock);
  }

  return existingBlocks;
}

/**
 * Check if two bounding boxes overlap
 */
function boundsOverlap(bounds1: LatLngBounds, bounds2: LatLngBounds): boolean {
  return !(
    bounds1.getEast() < bounds2.getWest() ||
    bounds1.getWest() > bounds2.getEast() ||
    bounds1.getNorth() < bounds2.getSouth() ||
    bounds1.getSouth() > bounds2.getNorth()
  );
}

/**
 * Get the center point of a street segment
 */
function getSegmentCenter(segment: StreetSegment): LatLng {
  const coords = segment.coordinates;
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);

  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  return new LatLng(centerLat, centerLng);
}

/**
 * Calculate street segment length in meters
 */
function calculateSegmentLength(segment: StreetSegment): number {
  let totalLength = 0;

  for (let i = 0; i < segment.coordinates.length - 1; i++) {
    const p1 = segment.coordinates[i];
    const p2 = segment.coordinates[i + 1];

    // Haversine formula for distance
    const R = 6371000; // Earth radius in meters
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
