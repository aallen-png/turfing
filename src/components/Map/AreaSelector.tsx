import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { AreaSelection, DrawMode } from '../../types';

interface AreaSelectorProps {
  drawMode: DrawMode;
  onAreaSelected: (area: AreaSelection) => void;
}

export function AreaSelector({ drawMode, onAreaSelected }: AreaSelectorProps) {
  const map = useMap();
  const drawnLayersRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const currentDrawControlRef = useRef<L.Control.Draw | null>(null);

  useEffect(() => {
    const drawnItems = drawnLayersRef.current;
    map.addLayer(drawnItems);

    return () => {
      map.removeLayer(drawnItems);
    };
  }, [map]);

  useEffect(() => {
    // Remove previous draw control if exists
    if (currentDrawControlRef.current) {
      map.removeControl(currentDrawControlRef.current);
      currentDrawControlRef.current = null;
    }

    // Clear any existing drawn layers
    drawnLayersRef.current.clearLayers();

    if (drawMode === 'none') {
      return;
    }

    // Configure draw control based on mode
    const drawOptions: L.Control.DrawConstructorOptions = {
      position: 'topright',
      draw: {
        polyline: false,
        marker: false,
        circlemarker: false,
        polygon: drawMode === 'polygon' ? {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: '#3b82f6',
            fillOpacity: 0.2,
          }
        } : false,
        circle: drawMode === 'radius' ? {
          shapeOptions: {
            color: '#3b82f6',
            fillOpacity: 0.2,
          }
        } : false,
        rectangle: false,
      },
      edit: {
        featureGroup: drawnLayersRef.current,
        remove: true,
      }
    };

    const drawControl = new L.Control.Draw(drawOptions);
    map.addControl(drawControl);
    currentDrawControlRef.current = drawControl;

    // Handle draw created event
    const onDrawCreated = (e: any) => {
      const layer = e.layer;
      drawnLayersRef.current.clearLayers(); // Clear previous drawings
      drawnLayersRef.current.addLayer(layer);

      const bounds = layer.getBounds();

      if (e.layerType === 'circle') {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        onAreaSelected({
          type: 'radius',
          bounds,
          center,
          radius,
        });
      } else if (e.layerType === 'polygon') {
        const coordinates = layer.getLatLngs()[0];
        onAreaSelected({
          type: 'polygon',
          bounds,
          coordinates,
        });
      }
    };

    // Handle draw deleted event
    const onDrawDeleted = () => {
      // Could notify parent that area was cleared if needed
    };

    map.on(L.Draw.Event.CREATED, onDrawCreated);
    map.on(L.Draw.Event.DELETED, onDrawDeleted);

    return () => {
      if (currentDrawControlRef.current) {
        map.removeControl(currentDrawControlRef.current);
      }
      map.off(L.Draw.Event.CREATED, onDrawCreated);
      map.off(L.Draw.Event.DELETED, onDrawDeleted);
    };
  }, [drawMode, map, onAreaSelected]);

  return null;
}
