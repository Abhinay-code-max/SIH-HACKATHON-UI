import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DetectionCanvas from './DetectionCanvas';
import GISPanel from './GISPanel';
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

const SECTORS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

class FeedErrorBoundary extends React.Component<{ cameraId: number; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div style={{ height: '180px', display: 'grid', placeItems: 'center', fontSize: '11px', color: '#ef4444' }}>CAM-{this.props.cameraId < 10 ? `0${this.props.cameraId}` : this.props.cameraId} OFFLINE</div>;
    }
    return this.props.children;
  }
}

import { useAudioSiren } from './useAudioSiren';
import TacticalRadar from './TacticalRadar';
import AuditLogPanel from './AuditLogPanel';
import SystemHealthMonitor from './SystemHealthMonitor';
import { useAuditStore } from './useAuditStore';

export default function App() {
  const [activeTab, setActiveTab] = useState<'command' | 'map' | 'analytics'>('command');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<string>('');

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
      name: `SECTOR CAM ${id < 10 ? `0${id}` : id}`,
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

  // Sync siren with alarmActive setting if triggered
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

    // Emit to Audit Log Store
    addEvent({
      severity: box.threatLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      category: 'BREACH',
      message: `Breach detected by CAM-${camId}: ${box.label} in ${zone.name}`,
      sector: zone.name, // Using zone name as sector equivalent here
      source: `CAM-${camId}`,
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
    label: `CAM-${inc.cameraId}`,
    severity: (inc.threatLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING') as any
  })), [incidents]);

  const [nlQuery, setNlQuery] = useState('');
  const { parseSecurityQuery } = useAuditStore();
  const handleNLQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    try {
      parseSecurityQuery(nlQuery, ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA']);
      setNlQuery('');
      setActiveTab('analytics');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // Ignore query failures gracefully from toolbar
    }
  };

  const isDark = theme === 'dark';
  const bgMain = isDark ? '#050811' : '#f1f5f9';
  const bgCard = isDark ? 'rgba(5,16,25,.92)' : '#ffffff';
  const textColor = isDark ? '#d8f9ff' : '#0f172a';
  const borderCol = isDark ? '#155e75' : '#cbd5e1';
  const navBg = isDark ? '#070f1a' : '#ffffff';

  return (
    <div style={{ backgroundColor: bgMain, color: textColor, minHeight: '100vh', fontFamily: 'ui-monospace, monospace' }}>
      
      {/* TOP NAVIGATION COMMAND BAR */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: navBg, borderBottom: `1px solid ${borderCol}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h1 style={{ fontSize: '15px', margin: 0, color: isDark ? '#38bdf8' : '#0284c7' }}>BORDERWATCH COMMAND <span style={{ fontSize: '9px', opacity: 0.7 }}>PRO 30-CAM</span></h1>
            <span style={{ fontSize: '9px', color: '#10b981' }}>● 30 PERIMETER NODES ACTIVE</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setActiveTab('command')} style={navBtnStyle(activeTab === 'command', isDark)}>🛡️ Command Matrix</button>
          <button onClick={() => setActiveTab('map')} style={navBtnStyle(activeTab === 'map', isDark)}>🗺️ GIS Map</button>
          <button onClick={() => setActiveTab('analytics')} style={navBtnStyle(activeTab === 'analytics', isDark)}>📊 Audit Logs</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isDark ? '#071923' : '#e2e8f0', padding: '3px 6px', borderRadius: '4px', border: `1px solid ${borderCol}` }}>
            <span style={{ fontSize: '9px', opacity: 0.8 }}>JUMP:</span>
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
                <option key={c.id} value={c.id} style={{ background: isDark ? '#0f172a' : '#fff' }}>CAM-{c.id < 10 ? `0${c.id}` : c.id}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', background: isDark ? '#0b1329' : '#e0f2fe', color: isDark ? '#38bdf8' : '#0369a1', borderRadius: '4px', border: `1px solid ${borderCol}` }}>
            🕒 {currentTime || 'Loading...'}
          </div>

          <button 
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ padding: '5px 10px', background: isDark ? '#1e293b' : '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: isDark ? '#facc15' : '#1e293b' }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* DASHBOARD CONTENT CONTAINER */}
      <div style={{ padding: '12px' }}>
        {activeTab === 'command' && (
          <div>
            {/* STATS BAR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 12px', marginBottom: '10px', background: bgCard, border: `1px solid ${borderCol}`, borderRadius: '6px' }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(100px, 1fr))', gap: '12px' }}>
                <div><small style={{ opacity: 0.7 }}>TOTAL FEEDS</small><div style={{ color: '#06b6d4', fontSize: '18px', fontWeight: 800 }}>30/30</div></div>
                <div><small style={{ opacity: 0.7 }}>THREAT STATUS</small><div style={{ color: incidents.length ? '#ef4444' : '#10b981', fontSize: '18px', fontWeight: 800 }}>{incidents.length ? 'ALERT' : 'SECURE'}</div></div>
                <div><small style={{ opacity: 0.7 }}>LATENCY</small><div style={{ fontSize: '16px', fontWeight: 'bold' }}>14ms</div></div>
                <div><small style={{ opacity: 0.7 }}>ACTIVE ZONES</small><div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>{zones.length} Units</div></div>
              </div>
            </div>

            {/* CONTROLS TOOLBAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, marginRight: '4px' }}>GRID:</span>
                <button className="c2-button" style={{ background: gridSize === 4 ? '#0284c7' : undefined }} onClick={() => { setGridSize(4); setPageIndex(0); }}>2x2</button>
                <button className="c2-button" style={{ background: gridSize === 9 ? '#0284c7' : undefined }} onClick={() => { setGridSize(9); setPageIndex(0); }}>3x3</button>
                <button className="c2-button" style={{ background: gridSize === 16 ? '#0284c7' : undefined }} onClick={() => { setGridSize(16); setPageIndex(0); }}>4x4</button>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="c2-button" onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>◀</button>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold' }}>{pageIndex + 1} / {totalPages}</span>
                <button className="c2-button" onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex >= totalPages - 1}>▶</button>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <form onSubmit={handleNLQuerySubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginRight: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="e.g. Show critical..." 
                    value={nlQuery}
                    onChange={(e) => setNlQuery(e.target.value)}
                    style={{ width: '140px', background: isDark ? '#0b1329' : '#fff', border: `1px solid ${borderCol}`, padding: '4px 8px', borderRadius: '3px', color: textColor, fontSize: '10px', outline: 'none' }}
                  />
                </form>

                <select value={visionMode} onChange={(e) => setVisionMode(e.target.value as any)} className="c2-button">
                  <option value="cyan">CYAN</option><option value="thermal">THERMAL</option><option value="night">NIGHT</option>
                </select>
                <button onClick={() => setAlarmActive(!alarmActive)} className="c2-button" style={{ background: alarmActive ? '#ef4444' : undefined }}>
                  {alarmActive ? 'ALARM ON' : 'ALARM OFF'}
                </button>
                <button onClick={toggleSiren} className="c2-button" style={{ background: sirenActive ? '#ef4444' : undefined, animation: sirenActive ? 'pulse 1s infinite' : 'none' }}>
                  {sirenActive ? 'STOP SIREN' : 'TEST SIREN'}
                </button>
                <button onClick={() => setIsDrawing(!isDrawing)} className="c2-button" style={{ background: isDrawing ? '#f59e0b' : undefined, color: isDrawing ? '#000' : undefined }}>
                  {isDrawing ? 'DONE' : 'GEOFENCE'}
                </button>
              </div>
            </div>

            {/* MAIN GRID & SIDEBAR SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: gridSize === 4 ? 'repeat(2, 1fr)' : gridSize === 9 ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
                {currentVisibleCameras.map(cam => (
                  <div key={cam.id} onClick={() => { setMaximizedCameraId(cam.id); setPipMode(1); }} style={{ position: 'relative', border: `1px solid ${borderCol}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', top: '4px', left: '4px', zIndex: 2, background: 'rgba(0,0,0,0.8)', padding: '2px 5px', fontSize: '9px', color: '#38bdf8', borderRadius: '2px' }}>
                      {cam.name}
                    </div>
                    <FeedErrorBoundary cameraId={cam.id}>
                      <DetectionCanvas
                        cameraId={cam.id}
                        videoUrl={cam.url}
                        zones={zones}
                        setZones={setZones}
                        isDrawing={isDrawing}
                        alarmActive={alarmActive}
                        onBreachDetected={(box, zone) => handleBreachDetected(box, zone, cam.id)}
                        visionMode={visionMode}
                        drawingTool="polygon"
                        height={gridSize === 4 ? '220px' : gridSize === 9 ? '150px' : '110px'}
                      />
                    </FeedErrorBoundary>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '10px', borderRadius: '4px' }}>
                  <h3 style={{ fontSize: '12px', margin: '0 0 8px 0', opacity: 0.8 }}>SECTOR RADAR</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                    {SECTORS.map(sec => {
                      const isBreached = incidents.some(inc => inc.zoneName.toUpperCase().includes(sec) || (inc.threatLevel === 'CRITICAL' && incidents.length > 0));
                      return (
                        <div key={sec} style={{ background: isDark ? '#0f172a' : '#f8fafc', padding: '6px', borderRadius: '3px', textAlign: 'center', fontSize: '10px', border: `1px solid ${isBreached ? '#ef4444' : borderCol}` }}>
                          <div style={{ fontWeight: 'bold' }}>{sec}</div>
                          <div style={{ color: isBreached ? '#ef4444' : '#10b981' }}>{isBreached ? 'ALERT' : 'SECURE'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <TacticalRadar 
                  hasAlert={incidents.length > 0} 
                  targets={radarTargets}
                />

                <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '10px', borderRadius: '4px' }}>
                  <h3 style={{ fontSize: '12px', margin: '0 0 8px 0', opacity: 0.8 }}>ZONES ({zones.length})</h3>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '4px', background: '#0284c7', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>IMPORT JSON</button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" />
                  </div>
                  <div style={{ maxHeight: '90px', overflowY: 'auto' }}>
                    {zones.map(z => (
                      <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? '#0f172a' : '#f8fafc', padding: '4px 6px', borderRadius: '3px', marginBottom: '4px', fontSize: '10px' }}>
                        <span style={{ color: z.color, fontWeight: 'bold' }}>{z.name}</span>
                        <button onClick={() => setZones(zones.filter(x => x.id !== z.id))} style={{ background: '#dc2626', border: 'none', color: '#fff', padding: '1px 5px', borderRadius: '2px', cursor: 'pointer', fontSize: '9px' }}>X</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '10px', borderRadius: '4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '12px', margin: '0 0 8px 0', opacity: 0.8 }}>INCIDENT LOGS</h3>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {incidents.length === 0 ? (
                      <div style={{ opacity: 0.5, fontSize: '10px', textAlign: 'center', marginTop: '20px' }}>No active breaches recorded.</div>
                    ) : (
                      incidents.map(inc => (
                        <div key={inc.id} style={{ background: isDark ? '#0f172a' : '#f8fafc', borderLeft: `3px solid ${inc.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`, padding: '4px 6px', borderRadius: '2px', fontSize: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
                            <span>{inc.timestamp}</span>
                            <span>CAM-{inc.cameraId}</span>
                          </div>
                          <div style={{ fontWeight: 'bold' }}>{inc.label}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '20px', borderRadius: '6px' }}>
            <h2 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0 }}>GIS Sector Map & 30-Node Telemetry</h2>
          <GISPanel
  onCameraSelect={(cameraId) => {
    const numericId = Number(cameraId.replace(/\D/g, ''));
    if (numericId >= 1 && numericId <= 30) {
      setMaximizedCameraId(numericId);
      setPipMode(1);
    }
  }}
/>
</div>
        )}

        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', gap: '12px', height: 'calc(100vh - 140px)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AuditLogPanel />
            </div>
            <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SystemHealthMonitor />
            </div>
          </div>
        )}
      </div>

      {/* PiP & MAXIMIZED MULTI-VIEW MODAL */}
      {maximizedCameraId !== null && (
        <div onClick={() => setMaximizedCameraId(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'rgba(2, 6, 23, 0.92)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(1100px, 100%)', backgroundColor: '#000', border: '1px solid #38bdf8', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#0f172a' }}>
              <strong style={{ color: '#38bdf8', fontSize: '12px' }}>
                {pipMode === 1 ? `CAM-${maximizedCameraId < 10 ? `0${maximizedCameraId}` : maximizedCameraId} · FOCUS MONITOR` : 'QUAD-SPLIT PiP SURVEILLANCE MATRIX'}
              </strong>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => setPipMode(pipMode === 1 ? 4 : 1)} style={{ padding: '3px 8px', backgroundColor: '#0284c7', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                  {pipMode === 1 ? 'SWITCH TO PiP (4-SPLIT)' : 'SINGLE FOCUS'}
                </button>
                <button onClick={() => setMaximizedCameraId(null)} style={{ padding: '3px 8px', backgroundColor: '#334155', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px' }}>CLOSE</button>
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
                  height="65vh"
                />
              </FeedErrorBoundary>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', padding: '4px', background: '#000', height: '65vh' }}>
                {[maximizedCameraId, (maximizedCameraId % 30) + 1, ((maximizedCameraId + 1) % 30) + 1, ((maximizedCameraId + 2) % 30) + 1].map((camId, idx) => (
                  <div key={camId} style={{ position: 'relative', border: '1px solid #155e75', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '4px', left: '4px', zIndex: '2' as any, background: 'rgba(0,0,0,0.8)', padding: '2px 5px', fontSize: '9px', color: '#38bdf8' }}>
                      CAM-{camId < 10 ? `0${camId}` : camId} {idx === 0 ? '[PRIMARY]' : '[PiP SUB]'}
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
                        height="calc(32.5vh - 2px)"
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
  transition: 'all 0.2s',
});

const styleTag = document.createElement('style');
styleTag.innerHTML = `
  .c2-button { border: 1px solid #155e75; background: #071923; color: #67e8f9; padding: 5px 8px; font: 700 10px ui-monospace; letter-spacing: .08em; cursor: pointer; text-transform: uppercase; border-radius: 3px; }
  .c2-button:hover { box-shadow: 0 0 10px rgba(34,211,238,.45); }
`;
document.head.appendChild(styleTag);