import { memo, useEffect } from 'react';
import L from 'leaflet';
import { focusCameraStream } from './MapFeedLink';

export type CameraStatus = 'ONLINE' | 'OFFLINE';

export interface BorderCamera {
  id: string;
  name: string;
  position: L.LatLngExpression;
  heading: number;
  status: CameraStatus;
  fovDegrees?: number;
  rangeMeters?: number;
  sectorId?: string;
  previewUrl?: string;
}

interface CameraMarkersProps {
  map: L.Map | null;
  cameras: readonly BorderCamera[];
  activeCameraIds?: readonly string[];
  showFovCones?: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;

function destinationPoint(origin: L.LatLng, bearingDegrees: number, distanceMeters: number): L.LatLng {
  const bearing = bearingDegrees * Math.PI / 180;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const latitude = origin.lat * Math.PI / 180;
  const longitude = origin.lng * Math.PI / 180;
  const targetLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing));
  const targetLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude), Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude));
  return L.latLng(targetLatitude * 180 / Math.PI, targetLongitude * 180 / Math.PI);
}

function fieldOfViewPoints(camera: BorderCamera): L.LatLng[] {
  const origin = L.latLng(camera.position);
  const halfFov = (camera.fovDegrees ?? 64) / 2;
  const range = camera.rangeMeters ?? 650;
  return [origin, destinationPoint(origin, camera.heading - halfFov, range), destinationPoint(origin, camera.heading, range), destinationPoint(origin, camera.heading + halfFov, range), origin];
}

function cameraIcon(camera: BorderCamera, isActive: boolean): L.DivIcon {
  const color = camera.status === 'ONLINE' ? '#22d3ee' : '#fb3b4b';
  const glow = camera.status === 'ONLINE' ? 'rgba(34,211,238,.75)' : 'rgba(251,59,75,.75)';
  return L.divIcon({
    className: 'borderwatch-camera-pin',
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    html: `<svg width="34" height="42" viewBox="0 0 34 42" aria-label="${camera.name}" role="img" xmlns="http://www.w3.org/2000/svg">${isActive ? '<circle cx="17" cy="16" r="13" fill="none" stroke="#fb3b4b" stroke-width="2" stroke-dasharray="3 2"><animate attributeName="r" values="10;15;10" dur="1.2s" repeatCount="indefinite"/></circle>' : ''}<path d="M17 1C8.8 1 2.2 7.6 2.2 15.8c0 11.1 14.8 24.7 14.8 24.7s14.8-13.6 14.8-24.7C31.8 7.6 25.2 1 17 1Z" fill="#050811" stroke="${color}" stroke-width="2" style="filter:drop-shadow(0 0 5px ${glow})"/><circle cx="17" cy="16" r="6" fill="${color}"/><path d="M11 16h12M17 10v12" stroke="#050811" stroke-width="1.5"/></svg>`
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function cameraPopup(camera: BorderCamera): HTMLDivElement {
  const card = document.createElement('div');
  card.style.cssText = 'width:190px;background:#050811;color:#d8f9ff;font:11px ui-monospace,monospace;padding:8px;border:1px solid #155e75;';
  const preview = camera.previewUrl
    ? `<video src="${escapeHtml(camera.previewUrl)}" muted autoplay loop playsinline style="width:100%;height:72px;object-fit:cover;border:1px solid #164e63"></video>`
    : '<div style="height:72px;display:grid;place-items:center;background:#071923;color:#67e8f9;border:1px solid #164e63">LIVE FEED</div>';
  card.innerHTML = `${preview}<strong style="display:block;margin-top:7px">${escapeHtml(camera.name)}</strong><span style="color:#94a3b8">${escapeHtml(camera.sectorId ?? 'SECTOR UNASSIGNED')} · ${camera.status}</span><button type="button" style="display:block;width:100%;margin-top:8px;padding:6px;background:#083344;color:#67e8f9;border:1px solid #22d3ee;font:700 10px ui-monospace,monospace;cursor:pointer">FOCUS STREAM</button>`;
  card.querySelector('button')?.addEventListener('click', () => focusCameraStream(camera.id));
  return card;
}

function CameraMarkers({ map, cameras, activeCameraIds = [], showFovCones = true, }: CameraMarkersProps) {
  useEffect(() => {
    if (!map) return;
    const layerGroup = L.layerGroup().addTo(map);
    cameras.forEach((camera) => {
      const color = camera.status === 'ONLINE' ? '#22d3ee' : '#fb3b4b';
      if (showFovCones){L.polygon(fieldOfViewPoints(camera), { color, weight: 1, fillColor: color, fillOpacity: camera.status === 'ONLINE' ? 0.13 : 0.09, interactive: false }).addTo(layerGroup);}
      L.marker(camera.position, { icon: cameraIcon(camera, activeCameraIds.includes(camera.id)), riseOnHover: true })
        .bindTooltip(`${camera.name} · ${camera.status}`, { direction: 'top', offset: [0, -32], className: 'borderwatch-camera-tooltip' })
        .bindPopup(cameraPopup(camera), { closeButton: false, minWidth: 190 })
        .on('click', () => focusCameraStream(camera.id))
        .addTo(layerGroup);
    });
    return () => { layerGroup.remove(); };
  }, [activeCameraIds, cameras, map, showFovCones]);

  return null;
}

export default memo(CameraMarkers);
