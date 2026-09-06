import { memo, useEffect } from 'react';
import L from 'leaflet';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type ZoneThreatStatus = 'NORMAL' | 'RESTRICTED' | 'CRITICAL';

export interface SecurityZoneProperties {
  id: string;
  name: string;
  sectorId: string;
  threatStatus: ZoneThreatStatus;
}

export type SecurityZoneCollection = FeatureCollection<Polygon | MultiPolygon, SecurityZoneProperties>;

interface MapZonesOverlayProps {
  map: L.Map | null;
  zones: SecurityZoneCollection;
  showSectorLabels?: boolean;
  showBoundingOutlines?: boolean;
}

const ZONE_COLORS: Record<ZoneThreatStatus, string> = {
  NORMAL: '#22c55e',
  RESTRICTED: '#eab308',
  CRITICAL: '#ef4444'
};

function MapZonesOverlay({ map, zones, showSectorLabels = true, showBoundingOutlines = false }: MapZonesOverlayProps) {
  useEffect(() => {
    if (!map) return;
    const zoneGroup = L.layerGroup().addTo(map);
    const geoJsonLayer = L.geoJSON(zones, {
      style: (feature) => {
        const status = feature?.properties?.threatStatus as ZoneThreatStatus | undefined;
        const color = ZONE_COLORS[status ?? 'NORMAL'];
        return { color, weight: 2, opacity: 0.9, fillColor: color, fillOpacity: 0.16 };
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties;
        if (showSectorLabels) {
          layer.bindTooltip(`${properties.name} · ${properties.sectorId}`, { permanent: true, direction: 'center', className: 'borderwatch-zone-label', opacity: 0.9 });
        }
      }
    }).addTo(zoneGroup);

    if (showBoundingOutlines) {
      geoJsonLayer.eachLayer((layer) => {
        if (!(layer instanceof L.Polygon)) return;
        L.rectangle(layer.getBounds(), { color: '#94a3b8', weight: 1, opacity: 0.55, dashArray: '5 4', fill: false, interactive: false }).addTo(zoneGroup);
      });
    }
    return () => { zoneGroup.remove(); };
  }, [map, showBoundingOutlines, showSectorLabels, zones]);

  return null;
}

export default memo(MapZonesOverlay);
