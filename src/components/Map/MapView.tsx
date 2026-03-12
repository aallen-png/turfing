import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AreaSelector } from './AreaSelector';
import { AreaDisplay } from './AreaDisplay';
import { PacketLayer } from './PacketLayer';
import { AreaSelection, Packet, DrawMode } from '../../types';

// Component to update map center dynamically
function MapController({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  center?: LatLngExpression;
  zoom?: number;
  drawMode: DrawMode;
  onAreaSelected: (area: AreaSelection) => void;
  selectedArea: AreaSelection | null;
  packets: Packet[];
  selectedPacketId: number | null;
  onPacketClick: (packetId: number) => void;
}

export function MapView({
  center = [37.7749, -122.4194], // Default to San Francisco
  zoom = 13,
  drawMode,
  onAreaSelected,
  selectedArea,
  packets,
  selectedPacketId,
  onPacketClick,
}: MapViewProps) {
  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        style={{ background: '#f3f4f6' }}
      >
        <MapController center={center} zoom={zoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AreaDisplay area={selectedArea} />

        <AreaSelector
          drawMode={drawMode}
          onAreaSelected={onAreaSelected}
        />

        <PacketLayer
          packets={packets}
          selectedPacketId={selectedPacketId}
          onPacketClick={onPacketClick}
        />
      </MapContainer>
    </div>
  );
}
