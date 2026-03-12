import { Polygon, Tooltip } from 'react-leaflet';
import { Packet } from '../../types';
import L from 'leaflet';

interface PacketLayerProps {
  packets: Packet[];
  selectedPacketId: number | null;
  onPacketClick: (packetId: number) => void;
}

export function PacketLayer({ packets, selectedPacketId, onPacketClick }: PacketLayerProps) {
  return (
    <>
      {packets.map((packet) => {
        const isSelected = packet.id === selectedPacketId;
        const isHidden = selectedPacketId !== null && !isSelected;

        // Don't render hidden packets
        if (isHidden) return null;

        return (
          <Polygon
            key={packet.id}
            positions={packet.coordinates}
            pathOptions={{
              color: packet.color,
              fillColor: packet.color,
              fillOpacity: isSelected ? 0.4 : 0.25,
              weight: isSelected ? 4 : 2,
            }}
            eventHandlers={{
              click: () => onPacketClick(packet.id),
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({
                  fillOpacity: 0.5,
                  weight: 4,
                });
              },
              mouseout: (e) => {
                const layer = e.target;
                if (!isSelected) {
                  layer.setStyle({
                    fillOpacity: 0.25,
                    weight: 2,
                  });
                } else {
                  layer.setStyle({
                    fillOpacity: 0.4,
                    weight: 4,
                  });
                }
              },
            }}
          >
            <Tooltip
              permanent
              direction="center"
              className="packet-label"
              opacity={1}
            >
              <div className="text-center font-bold text-sm">
                {packet.id}
              </div>
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
