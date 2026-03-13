import { LatLngBounds, LatLng } from 'leaflet';

export interface EventConfig {
  startingLocation: string;
  volunteers: number;
  groupSize: number;
  doorsPerPacket: number;
  carAvailability?: 'all' | 'some' | 'none';
  mapCenter?: LatLng;
  mapZoom?: number;
}

export interface Packet {
  id: number;
  bounds: LatLngBounds;
  coordinates: LatLng[][];
  doorCount: number;
  areaSize: number; // in sq meters
  color: string;
  center: LatLng;
}

export interface AreaSelection {
  type: 'radius' | 'polygon';
  bounds: LatLngBounds;
  coordinates?: LatLng[];
  radius?: number;
  center?: LatLng;
}

export type DrawMode = 'none' | 'radius' | 'polygon';
