import { memo, useEffect } from 'react';
import L from 'leaflet';

export interface TargetJourney {
  id: string;
  cameraIds: readonly string[];
  active?: boolean;
  color?: string;
}

interface JourneyTrackerProps {
  map: L.Map | null;
  journeys: readonly TargetJourney[];
  cameraPositions: Readonly<Record<string, L.LatLngExpression>>;
}

function arrowIcon(angle: number, color: string): L.DivIcon {
  return L.divIcon({ className: 'borderwatch-journey-arrow', iconSize: [18, 18], iconAnchor: [9, 9], html: `<div style="color:${color};font-size:20px;line-height:18px;text-shadow:0 0 8px ${color};transform:rotate(${angle}deg)">➤</div>` });
}

function JourneyTracker({ map, journeys, cameraPositions }: JourneyTrackerProps) {
  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const paths: L.Polyline[] = [];
    journeys.filter((journey) => journey.active !== false).forEach((journey) => {
      const positions = journey.cameraIds.map((cameraId) => cameraPositions[cameraId]).filter((position): position is L.LatLngExpression => Boolean(position));
      if (positions.length < 2) return;
      const color = journey.color ?? '#fb3b4b';
      const path = L.polyline(positions, { color, weight: 3, opacity: 0.92, dashArray: '10 8', dashOffset: '0', lineCap: 'round' }).addTo(group);
      paths.push(path);
      for (let index = 0; index < positions.length - 1; index += 1) {
        const start = L.latLng(positions[index]);
        const end = L.latLng(positions[index + 1]);
        const midpoint = L.latLng((start.lat + end.lat) / 2, (start.lng + end.lng) / 2);
        const angle = Math.atan2(end.lng - start.lng, end.lat - start.lat) * 180 / Math.PI;
        L.marker(midpoint, { icon: arrowIcon(angle, color), interactive: false, keyboard: false, zIndexOffset: 650 }).addTo(group);
      }
    });
    let animationFrameId = 0;
    const animate = (timestamp: number) => {
      const offset = -((timestamp / 30) % 18);
      paths.forEach((path) => path.setStyle({ dashOffset: `${offset}` }));
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animationFrameId); group.remove(); };
  }, [cameraPositions, journeys, map]);
  return null;
}

export default memo(JourneyTracker);
