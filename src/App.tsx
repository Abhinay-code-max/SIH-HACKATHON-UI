import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DetectionCanvas from './DetectionCanvas';
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

class FeedErrorBoundary extends React.Component<{ cameraId: number; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ height: '240px', display: 'grid', placeItems: 'center', backgroundColor: '#0f172a', color: '#f87171', fontSize: '12px' }}>CAM-0{this.props.cameraId} UNAVAILABLE</div>;
    }
    return this.props.children;
  }
}

function TacticalRadar() {
  const radarRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = radarRef.current;
    const context = canvas?.getContext('2d');
    if (!context || !canvas) return;
    let frame = 0;
    const draw = () => {
      const { width, height } = canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 6;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = '#155e75';
      context.lineWidth = 1;
      [0.33, 0.66, 1].forEach((scale) => { context.beginPath(); context.arc(centerX, centerY, radius * scale, 0, Math.PI * 2); context.stroke(); });
      context.beginPath(); context.moveTo(centerX - radius, centerY); context.lineTo(centerX + radius, centerY); context.moveTo(centerX, centerY - radius); context.lineTo(centerX, centerY + radius); context.stroke();
      const angle = (frame % 240) * (Math.PI * 2 / 240);
      const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(34,211,238,.30)'); gradient.addColorStop(1, 'rgba(34,211,238,0)');
      context.fillStyle = gradient; context.beginPath(); context.moveTo(centerX, centerY); context.arc(centerX, centerY, radius, angle - 0.45, angle); context.closePath(); context.fill();
      context.strokeStyle = '#22d3ee'; context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius); context.stroke();
      [[0.62, 0.25], [0.28, 0.68], [0.74, 0.7]].forEach(([x, y], index) => { const pulse = 3 + Math.sin(frame / 9 + index) * 2; context.fillStyle = index === 0 ? '#fb3b4b' : '#22d3ee'; context.beginPath(); context.arc(x * width, y * height, pulse, 0, Math.PI * 2); context.fill(); });
      frame += 1; requestAnimationFrame(draw);
    };
    const animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, []);
  return <canvas ref={radarRef} width={108} height={108} style={{ width: 108, height: 108 }} />;
}

export default function App() {
  const videoStreams = [
    { label: 'PERIMETER NORTH', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    { label: 'RIVER CROSSING', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
    { label: 'EAST CHECKPOINT', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4' }
  ];

  const [zones, setZones] = useState<GeofenceZone[]>(() => {
    const saved = localStorage.getItem('borderwatch_zones');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'z1',
            name: 'PERIMETER ALPHA',
            color: '#ef4444',
            points: [
              { x: 50, y: 50 },
              { x: 300, y: 50 },
              { x: 350, y: 250 },
              { x: 80, y: 220 }
            ]
          }
        ];
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [maximizedCameraId, setMaximizedCameraId] = useState<number | null>(null);
  const [cameraStreams, setCameraStreams] = useState<Record<number, number>>({ 1: 0, 2: 1, 3: 2, 4: 0 });
  const [layoutMode, setLayoutMode] = useState<'matrix' | 'stage'>('matrix');
  const [primaryCameraId, setPrimaryCameraId] = useState(1);
  const [visionMode, setVisionMode] = useState<'cyan' | 'thermal' | 'night'>('cyan');
  const [drawingTool, setDrawingTool] = useState<'polygon' | 'circle' | 'tripwire'>('polygon');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeOscillatorsRef = useRef(new Set<OscillatorNode>());
  const reportedBreachesRef = useRef(new Set<string>());

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    return audioContextRef.current;
  }, []);

  const stopAlertTones = useCallback(() => {
    activeOscillatorsRef.current.forEach((oscillator) => oscillator.stop());
    activeOscillatorsRef.current.clear();
  }, []);

  const playAlertTone = useCallback(() => {
    if (audioMuted) return;

    const context = getAudioContext();
    void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startTime = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, startTime);
    gain.gain.setValueAtTime(0, startTime);

    // Three short pulses make the alert distinct without a continuously running tone.
    [0, 0.28, 0.56].forEach((offset) => {
      gain.gain.setValueAtTime(0, startTime + offset);
      gain.gain.linearRampToValueAtTime(0.16, startTime + offset + 0.02);
      gain.gain.setValueAtTime(0.16, startTime + offset + 0.13);
      gain.gain.linearRampToValueAtTime(0, startTime + offset + 0.18);
    });

    oscillator.connect(gain);
    gain.connect(context.destination);
    activeOscillatorsRef.current.add(oscillator);
    oscillator.onended = () => activeOscillatorsRef.current.delete(oscillator);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.8);
  }, [audioMuted, getAudioContext]);

  useEffect(() => {
    localStorage.setItem('borderwatch_zones', JSON.stringify(zones));
  }, [zones]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMaximizedCameraId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [stopAlertTones]);

  useEffect(() => () => {
    stopAlertTones();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
  }, []);

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

    setIncidents(prev => {
      if (prev.some(inc => inc.label === box.label && inc.cameraId === camId)) return prev;
      return [newIncident, ...prev].slice(0, 50);
    });

    if (alarmActive) playAlertTone();
  }, [alarmActive, playAlertTone]);

  const breachCallbacks = useMemo<Record<number, (box: BoundingBox, zone: GeofenceZone) => void>>(() => ({
    1: (box, zone) => handleBreachDetected(box, zone, 1),
    2: (box, zone) => handleBreachDetected(box, zone, 2),
    3: (box, zone) => handleBreachDetected(box, zone, 3),
    4: (box, zone) => handleBreachDetected(box, zone, 4)
  }), [handleBreachDetected]);

  const exportCSV = () => {
    if (incidents.length === 0) return;
    const headers = 'ID,Timestamp,Camera,Entity,Threat Level,Zone\n';
    const rows = incidents
      .map(i => `${i.id},${i.timestamp},CAM-0${i.cameraId},${i.label},${i.threatLevel},${i.zoneName}`)
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `borderwatch_audit_log_${Date.now()}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(zones, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geofences.json';
    a.click();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) setZones(imported);
      } catch (err) {
        alert('Invalid Geofence JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="c2-shell" style={{ backgroundColor: '#050811', color: '#d8f9ff', minHeight: '100vh', padding: '14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <style>{`@keyframes c2-scan{from{transform:translateY(-120%)}to{transform:translateY(760%)}} .c2-shell{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px)} .c2-button{border:1px solid #155e75;background:#071923;color:#67e8f9;padding:7px 10px;font:700 10px ui-monospace;letter-spacing:.08em;cursor:pointer;text-transform:uppercase} .c2-button:hover{box-shadow:0 0 14px rgba(34,211,238,.45)} .c2-card{border:1px solid #123544;background:rgba(5,16,25,.92);box-shadow:inset 0 0 20px rgba(34,211,238,.035)}`}</style>
      <div className="c2-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 12px', marginBottom: '12px' }}>
        <TacticalRadar />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '12px' }}>
          <div><small style={{ color: '#5eead4' }}>THREAT LEVEL</small><div style={{ color: incidents.length ? '#fb3b4b' : '#22d3ee', fontSize: '22px', fontWeight: 800 }}>{incidents.length ? '78' : '12'}<span style={{ fontSize: '10px' }}>/100</span></div></div>
          <div><small style={{ color: '#5eead4' }}>SYSTEM LATENCY</small><div style={{ fontSize: '18px' }}>24<span style={{ fontSize: '10px' }}>ms</span></div><div style={{ height: 22, background: 'linear-gradient(135deg,transparent 0 10%,#22d3ee 11% 13%,transparent 14% 25%,#22d3ee 26% 28%,transparent 29%)' }} /></div>
          <div><small style={{ color: '#5eead4' }}>TRACKED ASSETS</small><div style={{ fontSize: '18px' }}>04 <span style={{ color: '#22c55e', fontSize: '10px' }}>LINKED</span></div></div>
        </div>
      </div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', margin: 0, color: '#38bdf8' }}>BORDERWATCH COMMAND <span style={{ fontSize: '12px', color: '#64748b' }}>v2.5 PRO</span></h1>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>SECTOR ALPHA-9 SURVEILLANCE MATRIX</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="c2-button" onClick={() => setLayoutMode((mode) => mode === 'matrix' ? 'stage' : 'matrix')}>{layoutMode === 'matrix' ? 'PRIMARY STAGE' : '2x2 MATRIX'}</button>
          <select value={visionMode} onChange={(event) => setVisionMode(event.target.value as typeof visionMode)} className="c2-button">
            <option value="cyan">STANDARD CYAN</option><option value="thermal">THERMAL IR</option><option value="night">NIGHT VISION</option>
          </select>
          <button
            onClick={() => {
              const nextAlarmState = !alarmActive;
              setAlarmActive(nextAlarmState);
              if (nextAlarmState && !audioMuted) {
                const context = getAudioContext();
                void context.resume();
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: alarmActive ? '#ef4444' : '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {alarmActive ? 'ALARM ACTIVE' : 'ALARM OFF'}
          </button>
          <button
            onClick={() => {
              const nextMutedState = !audioMuted;
              setAudioMuted(nextMutedState);
              if (nextMutedState) stopAlertTones();
            }}
            style={{ padding: '8px 16px', backgroundColor: audioMuted ? '#64748b' : '#0f766e', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {audioMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}
          </button>
          <button
            onClick={() => setIsDrawing(!isDrawing)}
            style={{
              padding: '8px 16px',
              backgroundColor: isDrawing ? '#f59e0b' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {isDrawing ? 'EDITING ZONES...' : 'DRAW GEOFENCE'}
          </button>
          <select value={drawingTool} onChange={(event) => setDrawingTool(event.target.value as typeof drawingTool)} className="c2-button">
            <option value="polygon">POLYGON ZONE</option><option value="circle">CIRCULAR RADIUS</option><option value="tripwire">TRIPWIRE</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '12px' }}>
        {/* 2x2 CAMERA MATRIX */}
        <div style={{ display: 'grid', gridTemplateColumns: layoutMode === 'matrix' ? '1fr 1fr' : 'minmax(0, 7fr) minmax(190px, 3fr)', gridTemplateRows: layoutMode === 'matrix' ? undefined : 'repeat(3, minmax(0, 1fr))', gap: '10px', transition: 'all .35s ease' }}>
          {[...([1, 2, 3, 4] as number[])].sort((left, right) => layoutMode === 'stage' ? (left === primaryCameraId ? -1 : right === primaryCameraId ? 1 : left - right) : left - right).map(id => (
            <div
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`Maximize camera ${id}`}
              onClick={() => { setPrimaryCameraId(id); setLayoutMode('stage'); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setMaximizedCameraId(id);
              }}
              style={{ position: 'relative', gridRow: layoutMode === 'stage' && id === primaryCameraId ? '1 / span 3' : undefined, border: `1px solid ${id === primaryCameraId ? '#22d3ee' : '#1e4653'}`, borderRadius: '3px', overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer', boxShadow: id === primaryCameraId ? '0 0 18px rgba(34,211,238,.24)' : undefined }}
            >
              <select
                value={cameraStreams[id]}
                aria-label={`Select stream for camera ${id}`}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  setCameraStreams((current) => ({ ...current, [id]: Number(event.target.value) }));
                }}
                style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, maxWidth: '150px', padding: '3px 5px', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '3px', fontSize: '10px', cursor: 'pointer' }}
              >
                {videoStreams.map((stream, index) => <option key={stream.label} value={index}>{stream.label}</option>)}
              </select>
              <FeedErrorBoundary cameraId={id}>
                <DetectionCanvas
                  cameraId={id}
                  videoUrl={videoStreams[cameraStreams[id]].url}
                  zones={zones}
                  setZones={setZones}
                  isDrawing={isDrawing}
                  alarmActive={alarmActive}
                  onBreachDetected={breachCallbacks[id]}
                  visionMode={visionMode}
                  drawingTool={drawingTool}
                  height={layoutMode === 'stage' ? (id === primaryCameraId ? 'calc(100vh - 230px)' : 'calc((100vh - 250px) / 3)') : '240px'}
                />
              </FeedErrorBoundary>
            </div>
          ))}
        </div>

        {/* CONTROLS & INCIDENT LOG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* GEOFENCE CONTROLS */}
          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#94a3b8' }}>GEOFENCE MANAGEMENT</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button onClick={exportJSON} style={{ flex: 1, padding: '6px', backgroundColor: '#0284c7', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>EXPORT JSON</button>
              <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '6px', backgroundColor: '#0284c7', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>IMPORT JSON</button>
              <input type="file" ref={fileInputRef} onChange={importJSON} style={{ display: 'none' }} accept=".json" />
            </div>

            {zones.map(z => (
              <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: z.color }}>{z.name}</span>
                <button onClick={() => setZones(zones.filter(x => x.id !== z.id))} style={{ backgroundColor: '#dc2626', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer' }}>DELETE</button>
              </div>
            ))}
          </div>

          {/* AUDIT LOG PANEL */}
          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#94a3b8' }}>INCIDENT AUDIT LOG</h3>
              <button onClick={exportCSV} style={{ padding: '4px 8px', backgroundColor: '#16a34a', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>EXPORT CSV</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {incidents.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No active breaches recorded.</div>
              ) : (
                incidents.map(inc => (
                  <div key={inc.id} style={{ backgroundColor: '#0f172a', borderLeft: `3px solid ${inc.threatLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`, padding: '6px 8px', borderRadius: '2px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span>{inc.timestamp}</span>
                      <span>CAM-0{inc.cameraId}</span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>
                      {inc.label} - <span style={{ color: inc.threatLevel === 'CRITICAL' ? '#44ef83' : '#f59e0b' }}>{inc.threatLevel}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Zone: {inc.zoneName}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {maximizedCameraId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Camera ${maximizedCameraId} expanded view`}
          onClick={() => setMaximizedCameraId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: 'rgba(2, 6, 23, 0.92)' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ position: 'relative', width: 'min(1200px, 100%)', backgroundColor: '#000', border: '1px solid #38bdf8', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 32px rgba(56, 189, 248, 0.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#0f172a' }}>
              <strong style={{ color: '#38bdf8', fontSize: '14px' }}>CAM-0{maximizedCameraId} · EXPANDED LIVE VIEW</strong>
              <button onClick={() => setMaximizedCameraId(null)} style={{ padding: '5px 10px', backgroundColor: '#334155', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>CLOSE</button>
            </div>
            <FeedErrorBoundary cameraId={maximizedCameraId}>
              <DetectionCanvas
                cameraId={maximizedCameraId}
                videoUrl={videoStreams[cameraStreams[maximizedCameraId]].url}
                zones={zones}
                setZones={setZones}
                isDrawing={isDrawing}
                alarmActive={alarmActive}
                onBreachDetected={breachCallbacks[maximizedCameraId]}
                height="min(70vh, 720px)"
              />
            </FeedErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
}
