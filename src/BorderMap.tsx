import  { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import CameraMarkers from './CameraMarkers';
import MapFeedLink from './MapFeedLink';
import MapZonesOverlay from './MapZonesOverlay';
import BreachPingOverlay from './BreachPingOverlay';
import PatrolRoutes from './PatrolRoutes';
import JourneyTracker from './JourneyTracker';

import { MapLayerControl } from './MapLayerControl';
import type { MapLayerState } from './MapLayerControl';

import type { BorderCamera } from './CameraMarkers';
import type { SecurityZoneCollection } from './MapZonesOverlay';
import type { BreachAlertPayload } from './BreachPingOverlay';
import type { PatrolRoute } from './PatrolRoutes';
import type { TargetJourney } from './JourneyTracker';

interface BorderMapProps {
  cameras: readonly BorderCamera[];
  center?: L.LatLngExpression;
  zoom?: number;
  className?: string;
  onCameraSelect?: (cameraId: string) => void;
  zones?: SecurityZoneCollection;
  showSectorLabels?: boolean;
  showBoundingOutlines?: boolean;
  breachAlerts?: readonly BreachAlertPayload[];
  onDismissBreach?: (alertId: string) => void;
  patrolRoutes?: readonly PatrolRoute[];
  targetJourneys?: readonly TargetJourney[];
}

const DEFAULT_CENTER: L.LatLngExpression = [28.6139, 77.209];

const ONLINE_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TOPOGRAPHIC_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
const GRID_SIZE = 0.01;



export default function BorderMap({
  cameras,
  center = DEFAULT_CENTER,
  zoom = 10,
  className = '',
  onCameraSelect,
  zones,
  showSectorLabels,
  showBoundingOutlines,
  breachAlerts = [],
  onDismissBreach,
  patrolRoutes = [],
  targetJourneys = [],
}: BorderMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  // Map Layer Visibility Controls (Function #17)
  const [layers, setLayers] = useState<MapLayerState>({
    satelliteTiles: true,
    securityZones: true,
    fovCones: true,
    patrolRoutes: true,
    gridCoordinates: false,
    topographicTiles: false,
  });

  const handleToggleLayer = (layerKey: keyof MapLayerState) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const cameraPositions = useMemo(
    () => Object.fromEntries(cameras.map((camera) => [camera.id, camera.position])),
    [cameras]
  );
  
  const activeCameraIds = useMemo(
    () => [
      ...new Set(
        targetJourneys
          .filter((journey) => journey.active !== false)
          .flatMap((journey) => journey.cameraIds)
      ),
    ],
    [targetJourneys]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const leafletMap = L.map(container, {
      center,
      zoom,
      zoomControl: false,
      preferCanvas: true,
      attributionControl: false,
    });
    mapRef.current = leafletMap;

  L.tileLayer(ONLINE_TILE_URL, {
  minZoom: 3,
  maxZoom: 19,
}).addTo(leafletMap);



    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);
    setMap(leafletMap);

    const observer = new ResizeObserver(() => leafletMap.invalidateSize({ animate: false }));
    observer.observe(container);

    return () => {
      observer.disconnect();
      leafletMap.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  useEffect(() => {
  if (!map) return;

  const satelliteLayer = L.tileLayer(SATELLITE_TILE_URL, {
    minZoom: 3,
    maxZoom: 19,
    opacity: 1,
  });

  if (layers.satelliteTiles) {
    satelliteLayer.addTo(map);
  }

  return () => {
    map.removeLayer(satelliteLayer);
  };
}, [map, layers.satelliteTiles]);

useEffect(() => {
  if (!map) return;

  const topographicLayer = L.tileLayer(TOPOGRAPHIC_TILE_URL, {
    minZoom: 3,
    maxZoom: 19,
    opacity: 1,
  });

  if (layers.topographicTiles) {
    topographicLayer.addTo(map);
  }

  return () => {
    map.removeLayer(topographicLayer);
  };
}, [map, layers.topographicTiles]);


useEffect(() => {
  if (!map || !layers.gridCoordinates) return;

  const gridLayer = L.layerGroup();

  const bounds = map.getBounds();
  const south = Math.floor(bounds.getSouth() / GRID_SIZE) * GRID_SIZE;
  const north = Math.ceil(bounds.getNorth() / GRID_SIZE) * GRID_SIZE;
  const west = Math.floor(bounds.getWest() / GRID_SIZE) * GRID_SIZE;
  const east = Math.ceil(bounds.getEast() / GRID_SIZE) * GRID_SIZE;

  for (let lat = south; lat <= north; lat += GRID_SIZE) {
    L.polyline(
      [[lat, west], [lat, east]],
      {
        color: '#38bdf8',
        weight: 1,
        opacity: 0.25,
        interactive: false,
      }
    ).addTo(gridLayer);
  }

  for (let lng = west; lng <= east; lng += GRID_SIZE) {
    L.polyline(
      [[south, lng], [north, lng]],
      {
        color: '#38bdf8',
        weight: 1,
        opacity: 0.25,
        interactive: false,
      }
    ).addTo(gridLayer);
  }

  gridLayer.addTo(map);

  return () => {
    map.removeLayer(gridLayer);
  };
}, [map, layers.gridCoordinates]);

  return (
    <div className={`relative overflow-hidden rounded-sm border border-cyan-900 bg-[#050811] ${className}`}>
      {/* Map Canvas Container */}
      <div ref={containerRef} style={{ height: '620px', width: '100%' }} />

      {/* Floating Layer Control Panel */}
      <MapLayerControl layers={layers} onToggleLayer={handleToggleLayer} />

      {/* Conditional Overlays Controlled by Layer Switches */}
      <CameraMarkers map={map} cameras={cameras} activeCameraIds={activeCameraIds} showFovCones={layers.fovCones} />
      
      {layers.securityZones && zones && (
        <MapZonesOverlay
          map={map}
          zones={zones}
          showSectorLabels={showSectorLabels}
          showBoundingOutlines={showBoundingOutlines}
        />
      )}

      <BreachPingOverlay map={map} alerts={breachAlerts} onDismiss={onDismissBreach} />

      {layers.patrolRoutes && <PatrolRoutes map={map} routes={patrolRoutes} />}

      <JourneyTracker map={map} journeys={targetJourneys} cameraPositions={cameraPositions} />

      {onCameraSelect && <MapFeedLink onCameraSelect={onCameraSelect} />}
    </div>
  );
}
