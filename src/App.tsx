import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DetectionCanvas from './DetectionCanvas';
import GISPanel from './GISPanel';
import { useAudioSiren } from './useAudioSiren';
import TacticalRadar from './TacticalRadar';
import AuditLogPanel from './AuditLogPanel';
import SystemHealthMonitor from './SystemHealthMonitor';
import { useAuditStore } from './useAuditStore';
import { SECTORS } from './constants';
import type { BoundingBox, Point } from './DetectionCanvas';

export interface GeofenceZone {
  id: string;
  name: string;
  color: string;
  points: Point[];
  type?: 'polygon' | 'circle' | 'tripwire';
}

export interface IncidentLog {
  id: string;
  timestamp: string;
  cameraId: number;
  label: string;
  threatLevel: string;
  zoneName: string;
}

/** Formats a numeric camera id as a zero-padded 2-digit string. */
function padCamId(id: number): string {
  return String(id).padStart(2, '0');
}

class FeedErrorBoundary extends React.Component<{ cameraId: number; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100%', minHeight: '110px', display: 'grid', placeItems: 'center', fontSize: '11px', color: '#ef4444', background: '#050811' }}>
          CAM-{padCamId(this.props.cameraId)} OFFLINE
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'command' | 'map' | 'analytics'>('command');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<string>('');

  // UI collapse state — local only, no need for global store
  const [commandHeaderCollapsed, setCommandHeaderCollapsed] = useState(false);
  const [operationsPanelCollapsed, setOperationsPanelCollapsed] = useState(false);

  // Optimized clock ticking precisely every 1000ms
  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date().toLocaleTimeString() + ' UTC');
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const videoSources = useMemo(() => [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
  ], []);

  const totalCameras = 30;
  const allCameras = useMemo(() => Array.from({ length: totalCameras }, (_, i) => {
    const id = i + 1;
    return {
      id,
      name: `SECTOR CAM ${padCamId(id)}`,
      url: videoSources[i % videoSources.length]
    };
  }), [videoSources]);

  const [zones, setZones] = useState<GeofenceZone[]>(() => {
    try {
      const saved = localStorage.getItem('borderwatch_zones');
      return saved ? JSON.parse(saved) : [{
        id: 'z1',
        name: 'PERIMETER ALPHA',
        color: '#ef4444',
        points: [{ x: 50, y: 50 }, { x: 300, y: 50 }, { x: 350, y: 250 }, { x: 80, y: 220 }]
      }];
    } catch {
      return [];
    }
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const { sirenActive, toggleSiren, startSiren, stopSiren } = useAudioSiren();
  const [alarmActive, setAlarmActive] = useState(false);
  const { addEvent } = useAuditStore();
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);

  const [maximizedCameraId, setMaximizedCameraId] = useState<number | null>(null);
  const [pipMode, setPipMode] = useState<number>(1);
  const [gridSize, setGridSize] = useState<number>(4);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [selectedQuickCam, setSelectedQuickCam] = useState<string>('1');
  const [visionMode, setVisionMode] = useState<'cyan' | 'thermal' | 'night'>('cyan');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportedBreachesRef = useRef(new Set<string>());

  // Sync siren with alarmActive
  useEffect(() => {
    if (!alarmActive && sirenActive) stopSiren();
  }, [alarmActive, sirenActive, stopSiren]);

  useEffect(() => {
    localStorage.setItem('borderwatch_zones', JSON.stringify(zones));
  }, [zones]);

  const handleBreachDetected = useCallback((box: BoundingBox, zone: GeofenceZone, camId: number) => {
    const breachKey = `${camId}:${box.id}:${zone.id}`;
    if (reportedBreachesRef.current.has(breachKey)) return;
    reportedBreachesRef.current.add(breachKey);

    const newIncident: IncidentLog = {
      id: `INC-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString(),
      cameraId: camId,
      label: box.label,
      threatLevel: box.threatLevel,
      zoneName: zone.name
    };

    setIncidents(prev => [newIncident, ...prev].slice(0, 30));

    addEvent({
      severity: box.threatLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      category: 'BREACH',
      message: `Breach detected by CAM-${padCamId(camId)}: ${box.label} in ${zone.name}`,
      sector: zone.name,
      source: `CAM-${padCamId(camId)}`,
      metadata: { boxId: box.id }
    });

    if (alarmActive) startSiren();
  }, [alarmActive, startSiren, addEvent]);

  const currentVisibleCameras = useMemo(() => {
    const start = pageIndex * gridSize;
    return allCameras.slice(start, start + gridSize);
  }, [allCameras, pageIndex, gridSize]);

  const totalPages = Math.ceil(totalCameras / gridSize);

  const radarTargets = useMemo(() => incidents.map((inc, i) => ({
    id: inc.id,
    angle: (i * 45) % 360,
    distance: 0.3 + ((i * 7) % 10) * 0.06,
    label: `CAM-${padCamId(inc.cameraId)}`,
    severity: (inc.threatLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING') as any
  })), [incidents]);

  const [nlQuery, setNlQuery] = useState('');
  const { parseSecurityQuery } = useAuditStore();
  const handleNLQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    try {
      parseSecurityQuery(nlQuery, [...SECTORS]);
      setNlQuery('');
      setActiveTab('analytics');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* ignore gracefully */ }
  };

  const handleZoneFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const importedZones: GeofenceZone[] = Array.isArray(parsed) ? parsed : parsed.zones ?? [];
        if (importedZones.length === 0) return;
        setZones(prev => {
          const existingIds = new Set(prev.map(z => z.id));
          const newZones = importedZones.filter(z => !existingIds.has(z.id));
          return [...prev, ...newZones];
        });
      } catch {
        console.warn('[BorderWatch] Failed to parse imported zone JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const isDark = theme === 'dark';
  const bgMain  = isDark ? '#050811' : '#f1f5f9';
  const bgCard  = isDark ? 'rgba(5,16,25,.92)' : '#ffffff';
  const textColor  = isDark ? '#d8f9ff' : '#0f172a';
  const borderCol  = isDark ? '#155e75' : '#cbd5e1';
  const navBg   = isDark ? '#070f1a' : '#ffffff';
  const mutedText  = isDark ? 'rgba(216,249,255,0.55)' : '#64748b';
  const accentBlue = isDark ? '#38bdf8' : '#0284c7';
  const hasAlert   = incidents.length > 0;

  // Camera tile height: grows when header or sidebar are collapsed
  const camHeight = gridSize === 4
    ? (commandHeaderCollapsed ? '280px' : '220px')
    : gridSize === 9
      ? (commandHeaderCollapsed ? '200px' : '150px')
      : (commandHeaderCollapsed ? '140px' : '110px');

  return (
    <div style={{ backgroundColor: bgMain, color: textColor, minHeight: '100vh', fontFamily: 'ui-monospace, monospace', display: 'flex', flexDirection: 'column' }}>

      {/* ══════════════════════════════════════════════════════
          TOP NAVIGATION BAR — always visible, thin and tactical
         ══════════════════════════════════════════════════════ */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 14px',
        backgroundColor: navBg,
        borderBottom: `1px solid ${borderCol}`,
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Brand + threat badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '13px', margin: 0, letterSpacing: '0.06em', color: accentBlue }}>
              BORDERWATCH <span style={{ opacity: 0.6, fontSize: '10px' }}>COMMAND PRO</span>
            </h1>
            <span style={{ fontSize: '9px', color: hasAlert ? '#ef4444' : '#10b981', letterSpacing: '0.04em' }}>
              {hasAlert ? `⚠ THREAT DETECTED — ${incidents.length} INCIDENT${incidents.length !== 1 ? 'S' : ''}` : '● 30 PERIMETER NODES SECURE'}
            </span>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setActiveTab('command')} style={navBtnStyle(activeTab === 'command', isDark)}>🛡️ Command Matrix</button>
          <button onClick={() => setActiveTab('map')} style={navBtnStyle(activeTab === 'map', isDark)}>🗺️ GIS Map</button>
          <button onClick={() => setActiveTab('analytics')} style={navBtnStyle(activeTab === 'analytics', isDark)}>📊 Audit Logs</button>
        </div>

        {/* Right cluster: JUMP + clock + theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Camera jump selector — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isDark ? '#071923' : '#e2e8f0', padding: '3px 6px', borderRadius: '3px', border: `1px solid ${borderCol}` }}>
            <span style={{ fontSize: '9px', opacity: 0.7 }}>JUMP:</span>
            <select
              value={selectedQuickCam}
              onChange={(e) => {
                const camId = Number(e.target.value);
                setSelectedQuickCam(e.target.value);
                setMaximizedCameraId(camId);
                setPipMode(1);
              }}
              style={{ background: 'transparent', color: textColor, border: 'none', fontSize: '10px', cursor: 'pointer', outline: 'none' }}
            >
              {allCameras.map(c => (
                <option key={c.id} value={c.id} style={{ background: isDark ? '#0f172a' : '#fff' }}>CAM-{padCamId(c.id)}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 7px', background: isDark ? '#0b1329' : '#e0f2fe', color: accentBlue, borderRadius: '3px', border: `1px solid ${borderCol}`, letterSpacing: '0.03em' }}>
            🕒 {currentTime || '--:--:-- UTC'}
          </div>

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ padding: '4px 8px', background: isDark ? '#1e293b' : '#cbd5e1', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', color: isDark ? '#facc15' : '#1e293b' }}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════
          CONTENT AREA
         ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ─── COMMAND MATRIX TAB ─── */}
        {activeTab === 'command' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ┌─ COLLAPSIBLE COMMAND HEADER ──────────────────────── */}
            {commandHeaderCollapsed ? (
              /* COMPACT HEADER — shows only essential camera controls */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                background: navBg,
                borderBottom: `1px solid ${borderCol}`,
                flexShrink: 0,
              }}>
                {/* Grid size */}
                <span style={{ fontSize: '9px', color: mutedText }}>GRID:</span>
                <button className="c2-button" style={{ background: gridSize === 4 ? '#0284c7' : undefined, padding: '3px 6px' }} onClick={() => { setGridSize(4); setPageIndex(0); }}>2×2</button>
                <button className="c2-button" style={{ background: gridSize === 9 ? '#0284c7' : undefined, padding: '3px 6px' }} onClick={() => { setGridSize(9); setPageIndex(0); }}>3×3</button>
                <button className="c2-button" style={{ background: gridSize === 16 ? '#0284c7' : undefined, padding: '3px 6px' }} onClick={() => { setGridSize(16); setPageIndex(0); }}>4×4</button>
                {/* Pagination */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                  <button className="c2-button" style={{ padding: '3px 6px' }} onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>◀</button>
                  <span style={{ fontSize: '10px', color: accentBlue, minWidth: '42px', textAlign: 'center' }}>{pageIndex + 1}/{totalPages}</span>
                  <button className="c2-button" style={{ padding: '3px 6px' }} onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex >= totalPages - 1}>▶</button>
                </div>
                {/* Alarm indicator in compact mode */}
                {alarmActive && (
                  <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 'bold', animation: 'pulse 1s infinite', marginLeft: '4px' }}>⚠ ALARM</span>
                )}
                {sirenActive && (
                  <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 'bold', animation: 'pulse 0.5s infinite', marginLeft: '4px' }}>🔊 SIREN</span>
                )}
                {/* Expand button */}
                <button
                  onClick={() => setCommandHeaderCollapsed(false)}
                  aria-label="Expand command controls"
                  title="Expand command controls"
                  style={{ marginLeft: 'auto', padding: '3px 8px', background: 'transparent', border: `1px solid ${borderCol}`, color: accentBlue, borderRadius: '3px', cursor: 'pointer', fontSize: '11px', lineHeight: 1 }}
                >
                  ▼ CONTROLS
                </button>
              </div>
            ) : (
              /* FULL COMMAND HEADER */
              <div style={{
                background: bgCard,
                borderBottom: `1px solid ${borderCol}`,
                flexShrink: 0,
              }}>
                {/* Stats strip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', borderBottom: `1px solid ${borderCol}` }}>
                  {[
                    { label: 'TOTAL FEEDS', value: '30/30', color: '#06b6d4' },
                    { label: 'THREAT STATUS', value: hasAlert ? 'ALERT' : 'SECURE', color: hasAlert ? '#ef4444' : '#10b981' },
                    { label: 'LATENCY', value: '14ms', color: textColor },
                    { label: 'ACTIVE ZONES', value: `${zones.length} Units`, color: accentBlue },
                  ].map((stat, i) => (
                    <div key={i} style={{ flex: 1, padding: '6px 14px', borderRight: i < 3 ? `1px solid ${borderCol}` : 'none' }}>
                      <div style={{ fontSize: '8px', color: mutedText, letterSpacing: '0.08em', marginBottom: '2px' }}>{stat.label}</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                    </div>
                  ))}
                  {/* Collapse button tucked at the right of the stats strip */}
                  <button
                    onClick={() => setCommandHeaderCollapsed(true)}
                    aria-label="Collapse command controls"
                    title="Collapse command controls — maximize camera area"
                    style={{ padding: '4px 12px', background: 'transparent', border: 'none', borderLeft: `1px solid ${borderCol}`, color: mutedText, cursor: 'pointer', fontSize: '11px', alignSelf: 'stretch', flexShrink: 0 }}
                  >
                    ▲ HIDE
                  </button>
                </div>

                {/* Controls toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', flexWrap: 'wrap' }}>
                  {/* Grid controls */}
                  <span style={{ fontSize: '9px', color: mutedText }}>GRID:</span>
                  <button className="c2-button" style={{ background: gridSize === 4 ? '#0284c7' : undefined }} onClick={() => { setGridSize(4); setPageIndex(0); }}>2×2</button>
                  <button className="c2-button" style={{ background: gridSize === 9 ? '#0284c7' : undefined }} onClick={() => { setGridSize(9); setPageIndex(0); }}>3×3</button>
                  <button className="c2-button" style={{ background: gridSize === 16 ? '#0284c7' : undefined }} onClick={() => { setGridSize(16); setPageIndex(0); }}>4×4</button>

                  <div style={{ width: '1px', height: '18px', background: borderCol, margin: '0 2px' }} />

                  {/* Pagination */}
                  <button className="c2-button" onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>◀</button>
                  <span style={{ fontSize: '10px', color: accentBlue, minWidth: '50px', textAlign: 'center', fontWeight: 'bold' }}>
                    {pageIndex + 1} / {totalPages}
                  </span>
                  <button className="c2-button" onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex >= totalPages - 1}>▶</button>

                  <div style={{ width: '1px', height: '18px', background: borderCol, margin: '0 2px' }} />

                  {/* Vision mode */}
                  <select value={visionMode} onChange={(e) => setVisionMode(e.target.value as any)} className="c2-button">
                    <option value="cyan">CYAN</option>
                    <option value="thermal">THERMAL</option>
                    <option value="night">NIGHT</option>
                  </select>

                  {/* Alarm + Siren */}
                  <button onClick={() => setAlarmActive(!alarmActive)} className="c2-button" style={{ background: alarmActive ? '#7f1d1d' : undefined, borderColor: alarmActive ? '#ef4444' : undefined, color: alarmActive ? '#ef4444' : undefined }}>
                    {alarmActive ? '🔴 ALARM ON' : 'ALARM OFF'}
                  </button>
                  <button onClick={toggleSiren} className="c2-button" style={{ background: sirenActive ? '#7f1d1d' : undefined, borderColor: sirenActive ? '#ef4444' : undefined, color: sirenActive ? '#ef4444' : undefined, animation: sirenActive ? 'pulse 1s infinite' : 'none' }}>
                    {sirenActive ? '🔊 STOP SIREN' : 'TEST SIREN'}
                  </button>
                  <button onClick={() => setIsDrawing(!isDrawing)} className="c2-button" style={{ background: isDrawing ? '#451a03' : undefined, borderColor: isDrawing ? '#f59e0b' : undefined, color: isDrawing ? '#f59e0b' : undefined }}>
                    {isDrawing ? '✏ DONE' : 'GEOFENCE'}
                  </button>

                  <div style={{ width: '1px', height: '18px', background: borderCol, margin: '0 2px' }} />

                  {/* NL query */}
                  <form onSubmit={handleNLQuerySubmit} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="e.g. Show critical..."
                      value={nlQuery}
                      onChange={(e) => setNlQuery(e.target.value)}
                      style={{ width: '130px', background: isDark ? '#0b1329' : '#fff', border: `1px solid ${borderCol}`, padding: '4px 8px', borderRadius: '3px', color: textColor, fontSize: '10px', outline: 'none' }}
                    />
                    <button type="submit" className="c2-button">QUERY</button>
                  </form>
                </div>
              </div>
            )}
            {/* └─ END COLLAPSIBLE COMMAND HEADER ───────────────────── */}

            {/* ┌─ CAMERA GRID + COLLAPSIBLE OPERATIONS SIDEBAR ──────── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

              {/* CAMERA GRID — takes all available space */}
              <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: gridSize === 4 ? 'repeat(2, 1fr)' : gridSize === 9 ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
                  gap: '6px',
                  height: '100%',
                }}>
                  {currentVisibleCameras.map(cam => (
                    <CameraCell
                      key={cam.id}
                      cam={cam}
                      zones={zones}
                      setZones={setZones}
                      isDrawing={isDrawing}
                      alarmActive={alarmActive}
                      visionMode={visionMode}
                      height={camHeight}
                      borderCol={borderCol}
                      onSelect={() => { setMaximizedCameraId(cam.id); setPipMode(1); }}
                      onBreachDetected={(box, zone) => handleBreachDetected(box, zone, cam.id)}
                    />
                  ))}
                </div>
              </div>

              {/* OPERATIONS SIDEBAR */}
              {operationsPanelCollapsed ? (
                /* COLLAPSED — thin vertical tab strip */
                <div style={{
                  width: '28px',
                  flexShrink: 0,
                  background: navBg,
                  borderLeft: `1px solid ${borderCol}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: '8px',
                  gap: '8px',
                }}>
                  <button
                    onClick={() => setOperationsPanelCollapsed(false)}
                    aria-label="Expand operations panel"
                    title="Expand operations panel"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: accentBlue,
                      cursor: 'pointer',
                      fontSize: '14px',
                      lineHeight: 1,
                      padding: '4px',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: '0.1em',
                    }}
                  >
                    ◀ OPS
                  </button>
                  {/* Compact alert indicators when collapsed */}
                  {incidents.length > 0 && (
                    <div style={{ fontSize: '9px', color: '#ef4444', fontWeight: 'bold', writingMode: 'vertical-rl', letterSpacing: '0.06em' }}>
                      {incidents.length} INC
                    </div>
                  )}
                </div>
              ) : (
                /* EXPANDED OPERATIONS PANEL */
                <div style={{
                  width: '264px',
                  flexShrink: 0,
                  borderLeft: `1px solid ${borderCol}`,
                  background: navBg,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  {/* Sidebar header with collapse toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderBottom: `1px solid ${borderCol}`,
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '9px', color: accentBlue, fontWeight: 'bold', letterSpacing: '0.1em' }}>OPERATIONS</span>
                    <button
                      onClick={() => setOperationsPanelCollapsed(true)}
                      aria-label="Collapse operations panel"
                      title="Collapse operations panel — maximize cameras"
                      style={{ background: 'transparent', border: 'none', color: mutedText, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '2px 4px' }}
                    >
                      ▶
                    </button>
                  </div>

                  {/* Sidebar content — scrollable */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {/* SECTOR STATUS */}
                    <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '9px', color: accentBlue, fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '6px' }}>SECTOR STATUS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                        {SECTORS.map(sec => {
                          const isBreached = incidents.some(inc => inc.zoneName.toUpperCase().includes(sec) || (inc.threatLevel === 'CRITICAL' && incidents.length > 0));
                          return (
                            <div key={sec} style={{
                              background: isDark ? '#0a1628' : '#f8fafc',
                              padding: '5px 6px',
                              borderRadius: '3px',
                              textAlign: 'center',
                              fontSize: '9px',
                              border: `1px solid ${isBreached ? '#ef4444' : borderCol}`,
                            }}>
                              <div style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>{sec}</div>
                              <div style={{ color: isBreached ? '#ef4444' : '#10b981', marginTop: '1px' }}>{isBreached ? '⚠ ALERT' : '✓ SECURE'}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* TACTICAL RADAR */}
                    <TacticalRadar hasAlert={hasAlert} targets={radarTargets} />

                    {/* ZONES */}
                    <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '9px', color: accentBlue, fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '6px' }}>ZONES ({zones.length})</div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ width: '100%', padding: '4px', background: '#0284c7', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', marginBottom: '6px', letterSpacing: '0.05em' }}
                      >
                        IMPORT JSON
                      </button>
                      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleZoneFileImport} />
                      <div style={{ maxHeight: '80px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {zones.length === 0 ? (
                          <div style={{ opacity: 0.45, fontSize: '9px', textAlign: 'center', padding: '8px 0' }}>No zones defined.</div>
                        ) : zones.map(z => (
                          <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? '#0a1628' : '#f8fafc', padding: '3px 6px', borderRadius: '3px', fontSize: '9px' }}>
                            <span style={{ color: z.color, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{z.name}</span>
                            <button onClick={() => setZones(zones.filter(x => x.id !== z.id))} style={{ background: '#dc2626', border: 'none', color: '#fff', padding: '1px 5px', borderRadius: '2px', cursor: 'pointer', fontSize: '9px', flexShrink: 0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* INCIDENT LOG */}
                    <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '8px', borderRadius: '4px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100px' }}>
                      <div style={{ fontSize: '9px', color: accentBlue, fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '6px' }}>
                        INCIDENT LOG {incidents.length > 0 && <span style={{ color: '#ef4444' }}>({incidents.length})</span>}
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {incidents.length === 0 ? (
                          <div style={{ opacity: 0.4, fontSize: '9px', textAlign: 'center', padding: '12px 0' }}>No active breaches.</div>
                        ) : incidents.map(inc => (
                          <div key={inc.id} style={{
                            background: isDark ? '#0a1628' : '#f8fafc',
                            borderLeft: `3px solid ${inc.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`,
                            padding: '4px 6px',
                            borderRadius: '2px',
                            fontSize: '9px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: mutedText, marginBottom: '2px' }}>
                              <span>{inc.timestamp}</span>
                              <span>CAM-{padCamId(inc.cameraId)}</span>
                            </div>
                            <div style={{ fontWeight: 'bold', color: inc.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b' }}>{inc.label}</div>
                            <div style={{ color: mutedText, fontSize: '8px', marginTop: '1px' }}>{inc.zoneName}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
            {/* └─ END CAMERA GRID + SIDEBAR ─────────────────────────── */}

          </div>
        )}

        {/* ─── GIS MAP TAB ─── */}
        {activeTab === 'map' && (
          <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
            <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '16px', borderRadius: '6px' }}>
              <h2 style={{ fontSize: '14px', color: accentBlue, margin: '0 0 12px 0', letterSpacing: '0.05em' }}>GIS SECTOR MAP — 30-NODE TELEMETRY</h2>
              <GISPanel
                onCameraSelect={(cameraId) => {
                  const numericId = Number(cameraId.replace(/\D/g, ''));
                  if (numericId >= 1 && numericId <= 30) {
                    setMaximizedCameraId(numericId);
                    setPipMode(1);
                    setActiveTab('command');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* ─── AUDIT LOGS TAB ─── */}
        {activeTab === 'analytics' && (
          <div style={{ flex: 1, display: 'flex', gap: '12px', padding: '12px', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AuditLogPanel isDark={isDark} />
            </div>
            <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SystemHealthMonitor isDark={isDark} />
            </div>
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════
          PiP / FOCUS MODAL
         ══════════════════════════════════════════════════════ */}
      {maximizedCameraId !== null && (
        <div
          onClick={() => setMaximizedCameraId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(2,6,23,0.95)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: 'min(1100px, 100%)', backgroundColor: '#000', border: '1px solid #38bdf8', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 0 40px rgba(56,189,248,0.15)' }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#070f1a', borderBottom: '1px solid #155e75' }}>
              <strong style={{ color: accentBlue, fontSize: '11px', letterSpacing: '0.06em' }}>
                {pipMode === 1 ? `CAM-${padCamId(maximizedCameraId)} · FOCUS MONITOR` : 'QUAD-SPLIT PiP SURVEILLANCE MATRIX'}
              </strong>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => setPipMode(pipMode === 1 ? 4 : 1)} style={{ padding: '3px 8px', backgroundColor: '#0284c7', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                  {pipMode === 1 ? 'QUAD-SPLIT (PiP)' : 'SINGLE FOCUS'}
                </button>
                <button onClick={() => setMaximizedCameraId(null)} style={{ padding: '3px 8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '3px', cursor: 'pointer', fontSize: '9px' }}>✕ CLOSE</button>
              </div>
            </div>

            {pipMode === 1 ? (
              <FeedErrorBoundary cameraId={maximizedCameraId}>
                <DetectionCanvas
                  cameraId={maximizedCameraId}
                  videoUrl={allCameras[maximizedCameraId - 1].url}
                  zones={zones}
                  setZones={setZones}
                  isDrawing={isDrawing}
                  alarmActive={alarmActive}
                  onBreachDetected={(box, zone) => handleBreachDetected(box, zone, maximizedCameraId)}
                  visionMode={visionMode}
                  height="68vh"
                />
              </FeedErrorBoundary>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px', padding: '3px', background: '#020617', height: '68vh' }}>
                {[maximizedCameraId, (maximizedCameraId % 30) + 1, ((maximizedCameraId + 1) % 30) + 1, ((maximizedCameraId + 2) % 30) + 1].map((camId, idx) => (
                  <div key={camId} style={{ position: 'relative', border: '1px solid #155e75', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '4px', left: '4px', zIndex: 2, background: 'rgba(0,0,0,0.85)', padding: '2px 6px', fontSize: '9px', color: accentBlue, borderRadius: '2px', letterSpacing: '0.04em' }}>
                      CAM-{padCamId(camId)} {idx === 0 ? '[PRIMARY]' : '[PiP]'}
                    </div>
                    <FeedErrorBoundary cameraId={camId}>
                      <DetectionCanvas
                        cameraId={camId}
                        videoUrl={allCameras[camId - 1].url}
                        zones={zones}
                        setZones={setZones}
                        isDrawing={false}
                        alarmActive={alarmActive}
                        onBreachDetected={(box, zone) => handleBreachDetected(box, zone, camId)}
                        visionMode={visionMode}
                        height="calc(34vh - 4px)"
                      />
                    </FeedErrorBoundary>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CameraCell — individual camera tile in the surveillance grid.
   Extracted to avoid inline complexity; keeps existing logic intact.
───────────────────────────────────────────────────────────── */
interface CameraCellProps {
  cam: { id: number; name: string; url: string };
  zones: GeofenceZone[];
  setZones: React.Dispatch<React.SetStateAction<GeofenceZone[]>>;
  isDrawing: boolean;
  alarmActive: boolean;
  visionMode: 'cyan' | 'thermal' | 'night';
  height: string;
  borderCol: string;
  onSelect: () => void;
  onBreachDetected: (box: BoundingBox, zone: GeofenceZone) => void;
}

function CameraCell({ cam, zones, setZones, isDrawing, alarmActive, visionMode, height, borderCol, onSelect, onBreachDetected }: CameraCellProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative',
        border: `1px solid ${borderCol}`,
        borderRadius: '3px',
        overflow: 'hidden',
        backgroundColor: '#020617',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#38bdf8'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = borderCol; }}
    >
      <FeedErrorBoundary cameraId={cam.id}>
        <DetectionCanvas
          cameraId={cam.id}
          videoUrl={cam.url}
          zones={zones}
          setZones={setZones}
          isDrawing={isDrawing}
          alarmActive={alarmActive}
          onBreachDetected={onBreachDetected}
          visionMode={visionMode}
          drawingTool="polygon"
          height={height}
        />
      </FeedErrorBoundary>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   navBtnStyle — navigation tab button styles
───────────────────────────────────────────────────────────── */
const navBtnStyle = (active: boolean, isDark: boolean) => ({
  backgroundColor: active ? '#0284c7' : (isDark ? '#071923' : '#e2e8f0'),
  color: active ? '#ffffff' : (isDark ? '#67e8f9' : '#334155'),
  border: '1px solid',
  borderColor: active ? '#38bdf8' : (isDark ? '#155e75' : '#cbd5e1'),
  padding: '5px 12px',
  borderRadius: '3px',
  cursor: 'pointer',
  fontWeight: '700',
  fontSize: '10px',
  fontFamily: 'ui-monospace, monospace',
  transition: 'all 0.15s',
});