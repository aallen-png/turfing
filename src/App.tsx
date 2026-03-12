import { useState } from 'react';
import { MapView } from './components/Map/MapView';
import { ChatSetup } from './components/ConversationalSetup/ChatSetup';
import { PacketList } from './components/PacketList/PacketList';
import { Button } from './components/ui/button';
import { AreaSelection, Packet, DrawMode, EventConfig } from './types';
import { generatePackets } from './lib/packet-generator';
import { createRadiusBounds } from './lib/geocoding';
import { Circle, Square } from 'lucide-react';
import { LatLng } from 'leaflet';

function App() {
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [selectedArea, setSelectedArea] = useState<AreaSelection | null>(null);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.7749, -122.4194]); // SF default
  const [mapZoom, setMapZoom] = useState<number>(13);

  const handleAreaSelected = (area: AreaSelection) => {
    setSelectedArea(area);
    setPackets([]); // Clear packets when new area is selected
  };

  const handleGenerate = async (config: EventConfig) => {
    if (!selectedArea) return;

    try {
      const generatedPackets = await generatePackets(
        selectedArea.bounds,
        config.volunteers,
        config.groupSize,
        config.doorsPerPacket
      );

      setPackets(generatedPackets);
      setDrawMode('none'); // Exit draw mode after generation
    } catch (error) {
      console.error('Error generating packets:', error);
      // Could show error to user here
    }
  };

  const handlePacketClick = (packetId: number) => {
    setSelectedPacketId(packetId === selectedPacketId ? null : packetId);
  };

  const handleMapCenterChange = (center: LatLng, zoom: number) => {
    setMapCenter([center.lat, center.lng]);
    setMapZoom(zoom);
  };

  const handleAutoSelectArea = (center: LatLng, radiusMeters: number) => {
    // Create a circular area around the given center point
    const bounds = createRadiusBounds(center, radiusMeters);

    // Create the area selection
    const area: AreaSelection = {
      type: 'radius',
      bounds: bounds,
      center: center,
      radius: radiusMeters,
    };

    setSelectedArea(area);
    setPackets([]); // Clear any existing packets
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Minimal Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Turfing Tool</h1>

        {/* Draw mode controls - minimal */}
        <div className="flex gap-2">
          <Button
            variant={drawMode === 'radius' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDrawMode(drawMode === 'radius' ? 'none' : 'radius')}
          >
            <Circle className="h-4 w-4 mr-1" />
            Radius
          </Button>
          <Button
            variant={drawMode === 'polygon' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDrawMode(drawMode === 'polygon' ? 'none' : 'polygon')}
          >
            <Square className="h-4 w-4 mr-1" />
            Polygon
          </Button>
        </div>
      </header>

      {/* Main Content - Chat left, Map right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Interface */}
        <aside className="w-96 border-r flex flex-col bg-background">
          <ChatSetup
            onComplete={handleGenerate}
            hasAreaSelected={selectedArea !== null}
            onMapCenterChange={handleMapCenterChange}
            onAutoSelectArea={handleAutoSelectArea}
          />
        </aside>

        {/* Right: Map and Packets */}
        <main className="flex-1 flex flex-col">
          {/* Map */}
          <div className="flex-1 relative">
            <MapView
              center={mapCenter}
              zoom={mapZoom}
              drawMode={drawMode}
              onAreaSelected={handleAreaSelected}
              selectedArea={selectedArea}
              packets={packets}
              selectedPacketId={selectedPacketId}
              onPacketClick={handlePacketClick}
            />
          </div>

          {/* Packet List - Bottom panel when packets exist */}
          {packets.length > 0 && (
            <div className="border-t bg-background p-4 max-h-64 overflow-y-auto">
              <PacketList
                packets={packets}
                selectedPacketId={selectedPacketId}
                onPacketClick={handlePacketClick}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
