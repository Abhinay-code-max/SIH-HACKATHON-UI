import { memo, useEffect, useRef } from 'react';
import L from 'leaflet';

export type BreachSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BreachAlertPayload {
  id: string;
  latitude: number;
  longitude: number;
  severity: BreachSeverity;
  timestamp: string | number | Date;
}

interface BreachPingOverlayProps {
  map: L.Map | null;
  alerts: readonly BreachAlertPayload[];
  onDismiss?: (alertId: string) => void;
  ttlMs?: number;
}

const PING_STYLE_ID = 'borderwatch-breach-ping-style';
const SEVERITY_COLORS: Record<BreachSeverity, string> = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };

function installPingStyles() {
  if (document.getElementById(PING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PING_STYLE_ID;
  style.textContent = '@keyframes borderwatch-breach-pulse{0%{transform:scale(.35);opacity:1}80%{transform:scale(2.2);opacity:0}100%{opacity:0}}.borderwatch-breach-ping{position:relative;width:16px;height:16px;border-radius:50%;background:var(--ping-color);box-shadow:0 0 12px var(--ping-color)}.borderwatch-breach-ping:before{content:"";position:absolute;inset:0;border:2px solid var(--ping-color);border-radius:50%;animation:borderwatch-breach-pulse 1.45s ease-out infinite}.borderwatch-breach-dismiss{margin-top:6px;width:100%;border:1px solid #475569;background:#0f172a;color:#e2e8f0;padding:4px;cursor:pointer;font:700 10px ui-monospace,monospace}';
  document.head.appendChild(style);
}

function BreachPingOverlay({ map, alerts, onDismiss, ttlMs = 10_000 }: BreachPingOverlayProps) {
  const expiredIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!map) return;
    installPingStyles();
    const layerGroup = L.layerGroup().addTo(map);
    const timers: number[] = [];
    const dismiss = (alertId: string, marker?: L.Marker) => {
      expiredIdsRef.current.add(alertId);
      marker?.remove();
      onDismiss?.(alertId);
    };

    alerts.forEach((alert) => {
      if (expiredIdsRef.current.has(alert.id)) return;
      const expiresIn = ttlMs - Math.max(0, Date.now() - new Date(alert.timestamp).getTime());
      if (expiresIn <= 0) { expiredIdsRef.current.add(alert.id); onDismiss?.(alert.id); return; }
      const color = SEVERITY_COLORS[alert.severity];
      const marker = L.marker([alert.latitude, alert.longitude], {
        icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html: `<div class="borderwatch-breach-ping" style="--ping-color:${color}"></div>` }),
        keyboard: false,
        zIndexOffset: 900
      }).addTo(layerGroup);
      const popup = document.createElement('div');
      popup.innerHTML = `<strong>${alert.severity} BREACH</strong><br><small>${alert.id}</small><button type="button" class="borderwatch-breach-dismiss">DISMISS PING</button>`;
      popup.querySelector('button')?.addEventListener('click', () => dismiss(alert.id, marker));
      marker.bindPopup(popup, { closeButton: false });
      marker.on('click', () => marker.openPopup());
      timers.push(window.setTimeout(() => dismiss(alert.id, marker), expiresIn));
    });

    return () => { timers.forEach((timer) => window.clearTimeout(timer)); layerGroup.remove(); };
  }, [alerts, map, onDismiss, ttlMs]);

  return null;
}

export default memo(BreachPingOverlay);
