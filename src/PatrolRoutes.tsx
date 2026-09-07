import { memo, useEffect, useRef } from 'react';
import L from 'leaflet';

export interface PatrolCheckpoint {
  id: string;
  position: L.LatLngExpression;
  status: 'CLEARED' | 'PENDING' | 'MISSED';
}

export interface PatrolRoute {
  id: string;
  guardName: string;
  checkpoints: readonly PatrolCheckpoint[];
  durationMs?: number;
}

interface PatrolRoutesProps {
  map: L.Map | null;
  routes: readonly PatrolRoute[];
}

const ROUTE_COLOR = '#67e8f9';
const CHECKPOINT_COLORS: Record<PatrolCheckpoint['status'], string> = { CLEARED: '#22c55e', PENDING: '#eab308', MISSED: '#ef4444' };

function interpolateRoute(checkpoints: readonly PatrolCheckpoint[], progress: number): L.LatLng | null {
  if (checkpoints.length === 0) return null;
  if (checkpoints.length === 1) return L.latLng(checkpoints[0].position);
  const points = checkpoints.map((checkpoint) => L.latLng(checkpoint.position));
  const segmentProgress = progress * (points.length - 1);
  const segmentIndex = Math.min(Math.floor(segmentProgress), points.length - 2);
  const localProgress = segmentProgress - segmentIndex;
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  return L.latLng(start.lat + (end.lat - start.lat) * localProgress, start.lng + (end.lng - start.lng) * localProgress);
}

function guardIcon(): L.DivIcon {
  return L.divIcon({
    className: 'borderwatch-guard-marker',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: '<div style="width:12px;height:12px;border:2px solid #d8f9ff;border-radius:50%;background:#22d3ee;box-shadow:0 0 10px #22d3ee"></div>'
  });
}

function PatrolRoutes({ map, routes }: PatrolRoutesProps) {
  const routesRef = useRef(routes);
  routesRef.current = routes;

  useEffect(() => {
    if (!map) return;
    const layerGroup = L.layerGroup().addTo(map);
    const guardMarkers = new Map<string, L.Marker>();
    routes.forEach((route) => {
      const positions = route.checkpoints.map((checkpoint) => checkpoint.position);
      if (positions.length > 1) L.polyline(positions, { color: ROUTE_COLOR, weight: 2, opacity: 0.8, dashArray: '8 7' }).addTo(layerGroup);
      route.checkpoints.forEach((checkpoint) => {
        const color = CHECKPOINT_COLORS[checkpoint.status];
        L.circleMarker(checkpoint.position, { radius: 5, color, fillColor: color, fillOpacity: 0.9, weight: 1.5 })
          .bindTooltip(`<strong>${route.guardName}</strong><br>Route: ${route.id}<br>Checkpoint: ${checkpoint.status}`, { direction: 'top', className: 'borderwatch-patrol-tooltip' })
          .addTo(layerGroup);
      });
      const start = interpolateRoute(route.checkpoints, 0);
      if (start) guardMarkers.set(route.id, L.marker(start, { icon: guardIcon(), keyboard: false, zIndexOffset: 700 }).bindTooltip(`${route.guardName} · Route ${route.id}`, { direction: 'top', offset: [0, -10] }).addTo(layerGroup));
    });

    let animationFrameId = 0;
    const animate = (now: number) => {
      routesRef.current.forEach((route) => {
        const marker = guardMarkers.get(route.id);
        const position = interpolateRoute(route.checkpoints, (now % (route.durationMs ?? 30_000)) / (route.durationMs ?? 30_000));
        if (marker && position) marker.setLatLng(position);
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animationFrameId); layerGroup.remove(); };
  }, [map, routes]);

  return null;
}

export default memo(PatrolRoutes);
