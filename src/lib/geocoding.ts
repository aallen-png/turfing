import { LatLng, LatLngBounds } from 'leaflet';

interface GeocodeResult {
  location: LatLng;
  bounds?: LatLngBounds;
  displayName: string;
  isValid: boolean;
}

/**
 * Geocode a US address using Nominatim (OpenStreetMap)
 * Free service, no API key needed
 */
export async function geocodeUSAddress(address: string): Promise<GeocodeResult | null> {
  try {
    // Add "USA" to ensure we're searching in the US
    const searchQuery = address.includes('USA') || address.includes('US')
      ? address
      : `${address}, USA`;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({
        q: searchQuery,
        format: 'json',
        countrycodes: 'us', // Restrict to US only
        limit: '1',
        addressdetails: '1',
      }),
      {
        headers: {
          'User-Agent': 'TurfingTool/1.0' // Required by Nominatim
        }
      }
    );

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];

      // Validate it's actually in the US
      if (result.address?.country_code !== 'us') {
        return null;
      }

      const location = new LatLng(
        parseFloat(result.lat),
        parseFloat(result.lon)
      );

      let bounds: LatLngBounds | undefined;
      if (result.boundingbox) {
        const [south, north, west, east] = result.boundingbox.map(parseFloat);
        bounds = new LatLngBounds(
          new LatLng(south, west),
          new LatLng(north, east)
        );
      }

      return {
        location,
        bounds,
        displayName: result.display_name,
        isValid: true,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Create a default radius bounds around a point
 */
export function createRadiusBounds(center: LatLng, radiusInMeters: number = 1000): LatLngBounds {
  // Approximate: 1 degree latitude = 111km
  const latOffset = (radiusInMeters / 111000);
  const lngOffset = (radiusInMeters / 111000) / Math.cos(center.lat * Math.PI / 180);

  return new LatLngBounds(
    new LatLng(center.lat - latOffset, center.lng - lngOffset),
    new LatLng(center.lat + latOffset, center.lng + lngOffset)
  );
}
