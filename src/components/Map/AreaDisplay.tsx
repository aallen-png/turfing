import { Circle, Polygon } from 'react-leaflet';
import { AreaSelection } from '../../types';

interface AreaDisplayProps {
  area: AreaSelection | null;
}

export function AreaDisplay({ area }: AreaDisplayProps) {
  if (!area) return null;

  if (area.type === 'radius' && area.center && area.radius) {
    return (
      <Circle
        center={area.center}
        radius={area.radius}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        }}
      />
    );
  }

  if (area.type === 'polygon' && area.coordinates) {
    return (
      <Polygon
        positions={area.coordinates}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        }}
      />
    );
  }

  return null;
}
