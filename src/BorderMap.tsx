import React, { useEffect, useMemo, useRef, useState } from 'react';
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
const OFFLINE_TILE_URL = '/tiles/{z}/{x}/{y}.png';
const ONLINE_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

class OfflineFirstTileLayer extends L.TileLayer {
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLImageElement {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    const offlineSource = this.getTileUrl(coords);
    const onlineSource = L.Util.template(ONLINE_TILE_URL, { ...coords, s: 'abc' });
    let usedOnlineFallback = false;
    
    tile.onload = () => done(undefined, tile);
    tile.onerror = () => {
      if (usedOnlineFallback) { 
        done(new Error(`Unable to load map tile ${coords.z}/${coords.x}/${coords.y}`), tile); 
        return; 
      }
      usedOnlineFallback = true;
      tile.src = onlineSource;
    };
    tile.src = offlineSource;
    return tile;
  }
}

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

    new OfflineFirstTileLayer(OFFLINE_TILE_URL, {
      minZoom: 3,
      maxZoom: 19,
      crossOrigin: true,
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
  }, [center, zoom]);

  return (
    <div className={`relative overflow-hidden rounded-sm border border-cyan-900 bg-[#050811] ${className}`}>
      {/* Map Canvas Container */}
      <div ref={containerRef} className="h-full min-h-[360px] w-full" />

      {/* Floating Layer Control Panel */}
      <MapLayerControl layers={layers} onToggleLayer={handleToggleLayer} />

      {/* Conditional Overlays Controlled by Layer Switches */}
      <CameraMarkers map={map} cameras={cameras} activeCameraIds={activeCameraIds} />
      
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
