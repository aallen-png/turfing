import { Button } from '../ui/button';
import { Packet } from '../../types';
import { Printer } from 'lucide-react';

interface PacketListProps {
  packets: Packet[];
  selectedPacketId: number | null;
  onPacketClick: (packetId: number) => void;
}

export function PacketList({ packets, selectedPacketId, onPacketClick }: PacketListProps) {
  if (packets.length === 0) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  const formatArea = (areaInSqMeters: number): string => {
    // Convert to acres (1 acre = 4046.86 sq meters)
    const acres = areaInSqMeters / 4046.86;
    return acres < 1
      ? `${Math.round(areaInSqMeters)} m²`
      : `${acres.toFixed(2)} acres`;
  };

  const selectedPacket = packets.find(p => p.id === selectedPacketId);

  return (
    <div>
      {/* Print-only header */}
      {selectedPacket && (
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold mb-2">Canvassing Packet #{selectedPacket.id}</h1>
          <div className="text-lg">
            <p><strong>Doors to knock:</strong> {selectedPacket.doorCount}</p>
            <p><strong>Area:</strong> {formatArea(selectedPacket.areaSize)}</p>
          </div>
        </div>
      )}

      {/* Screen view header */}
      <div className="flex items-center justify-between mb-3 print:hidden">
        <div>
          <h3 className="font-semibold">
            {selectedPacketId ? `Packet #${selectedPacketId}` : 'Packets'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {selectedPacketId
              ? `${selectedPacket?.doorCount} doors • Click to deselect`
              : `${packets.length} routes created • Click one to view`
            }
          </p>
        </div>
        {selectedPacketId && (
          <Button
            size="sm"
            variant="default"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print This
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {packets.map((packet) => {
            const isSelected = selectedPacketId === packet.id;
            const isHidden = selectedPacketId !== null && !isSelected;

            if (isHidden) return null;

            return (
              <button
                key={packet.id}
                onClick={() => onPacketClick(packet.id)}
                className={`p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: packet.color }}
                  >
                    {packet.id}
                  </div>
                  <span className="font-medium text-sm">#{packet.id}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {packet.doorCount} doors
                </div>
              </button>
            );
          })}
        </div>
    </div>
  );
}
