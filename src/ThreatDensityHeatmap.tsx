import { useEffect } from 'react';
import L from 'leaflet';
import type { BreachAlertPayload } from './BreachPingOverlay';

interface ThreatDensityHeatmapProps {
  map: L.Map | null;
  active: boolean;
  incidents: readonly BreachAlertPayload[];
}

export default function ThreatDensityHeatmap({ map, active, incidents }: ThreatDensityHeatmapProps) {
  useEffect(() => {
    if (!map || !active || incidents.length === 0) return;

    const layerGroup = L.layerGroup();

    // Group incidents by proximity to calculate density
    // For a simple demo, we'll draw concentric circles around each incident
    // where multiple incidents overlap, opacity builds up naturally
    
    incidents.forEach(inc => {
      let color = '#10b981'; // Green (low)
      let radius = 200; // meters
      
      if (inc.severity === 'CRITICAL') {
        color = '#ef4444'; // Red (high)
        radius = 500;
      } else if (inc.severity === 'HIGH') {
        color = '#f97316';
        radius = 400;
      } else if (inc.severity === 'MEDIUM') {
        color = '#f59e0b'; // Yellow (med)
        radius = 300;
      }

      // Draw a "density" blip (soft circle)
      L.circle([inc.latitude, inc.longitude], {
        radius: radius,
        color: 'transparent',
        fillColor: color,
        fillOpacity: 0.15,
        interactive: false
      }).addTo(layerGroup);
      
      // Core density
      L.circle([inc.latitude, inc.longitude], {
        radius: radius * 0.4,
        color: 'transparent',
        fillColor: color,
        fillOpacity: 0.3,
        interactive: false
      }).addTo(layerGroup);
    });

    layerGroup.addTo(map);

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [map, active, incidents]);

  return null;
}
