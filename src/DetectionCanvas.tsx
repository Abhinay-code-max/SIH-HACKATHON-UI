import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { GeofenceZone } from './App';

export interface Point { x: number; y: number; }
export interface BoundingBox {
  id: string; x: number; y: number; w: number; h: number; label: string; confidence: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface DetectionCanvasProps {
  cameraId: number;
  videoUrl: string;
  zones: GeofenceZone[];
  setZones: React.Dispatch<React.SetStateAction<GeofenceZone[]>>;
  isDrawing: boolean;
  alarmActive: boolean;
  onBreachDetected: (box: BoundingBox, zone: GeofenceZone) => void;
  visionMode?: 'cyan' | 'thermal' | 'night';
  drawingTool?: 'polygon' | 'circle' | 'tripwire';
  height?: string | number;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 240;

function DetectionCanvas({ cameraId, videoUrl, zones, setZones, isDrawing, alarmActive, onBreachDetected, visionMode = 'cyan', drawingTool = 'polygon', height = '240px' }: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointsRef = useRef<Point[]>([]);
  const mousePosRef = useRef<Point | null>(null);
  const dragRef = useRef<{ zoneId: string; pointIndex: number; point: Point } | null>(null);
  const draggedRef = useRef(false);
  const hoverRef = useRef<{ zoneId: string; pointIndex: number } | null>(null);
  const zonesRef = useRef(zones);
  const drawingRef = useRef(isDrawing);
  const alarmRef = useRef(alarmActive);
  const callbackRef = useRef(onBreachDetected);
  const visionRef = useRef(visionMode);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    zonesRef.current = zones;
    drawingRef.current = isDrawing;
    alarmRef.current = alarmActive;
    callbackRef.current = onBreachDetected;
    visionRef.current = visionMode;
  }, [zones, isDrawing, alarmActive, onBreachDetected, visionMode]);

  const isPointInPolygon = useCallback((point: Point, vertices: Point[]) => {
    let inside = false;
    for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
      const current = vertices[index]; const prior = vertices[previous];
      if (((current.y > point.y) !== (prior.y > point.y)) && (point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x)) inside = !inside;
    }
    return inside;
  }, []);

  const isPointInZone = useCallback((point: Point, zone: GeofenceZone) => {
    if (zone.type === 'circle' && zone.points[1]) {
      const radius = Math.hypot(zone.points[1].x - zone.points[0].x, zone.points[1].y - zone.points[0].y);
      return Math.hypot(point.x - zone.points[0].x, point.y - zone.points[0].y) <= radius;
    }
    if (zone.type === 'tripwire' && zone.points[1]) {
      const [start, end] = zone.points; const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      return Math.abs((end.y - start.y) * point.x - (end.x - start.x) * point.y + end.x * start.y - end.y * start.x) / length < 12;
    }
    return zone.points.length >= 3 && isPointInPolygon(point, zone.points);
  }, [isPointInPolygon]);

  const toCanvasPoint = useCallback((event: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * CANVAS_WIDTH / rect.width, y: (event.clientY - rect.top) * CANVAS_HEIGHT / rect.height };
  }, []);

  const completeZone = useCallback(() => {
    const points = activePointsRef.current;
    const minimumPoints = drawingTool === 'polygon' ? 3 : 2;
    if (points.length < minimumPoints) return;
    setZones((current) => [...current, { id: `z-${Date.now()}`, name: `${drawingTool.toUpperCase()} ${current.length + 1}`, color: drawingTool === 'tripwire' ? '#f59e0b' : '#22d3ee', type: drawingTool, points: [...points] }]);
    activePointsRef.current = [];
    mousePosRef.current = null;
  }, [drawingTool, setZones]);

  const undoPoint = useCallback(() => { activePointsRef.current.pop(); }, []);
  const resetZone = useCallback(() => { activePointsRef.current = []; mousePosRef.current = null; dragRef.current = null; }, []);

  const findHandle = useCallback((point: Point) => {
    for (const zone of zonesRef.current) {
      if (zone.type === 'circle') continue;
      for (let index = 0; index < zone.points.length; index += 1) {
        const vertex = zone.points[index];
        if (Math.hypot(vertex.x - point.x, vertex.y - point.y) <= 9) return { zoneId: zone.id, pointIndex: index };
      }
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(event);
    mousePosRef.current = point;
    if (dragRef.current) { dragRef.current.point = point; return; }
    hoverRef.current = findHandle(point);
  }, [findHandle, toCanvasPoint]);

  const commitDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    setZones((current) => current.map((zone) => zone.id === drag.zoneId
      ? { ...zone, points: zone.points.map((point, index) => index === drag.pointIndex ? drag.point : point) }
      : zone));
    dragRef.current = null;
  }, [setZones]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const handle = findHandle(toCanvasPoint(event));
    if (!handle) return;
    event.stopPropagation();
    const zone = zonesRef.current.find((entry) => entry.id === handle.zoneId);
    if (zone) { dragRef.current = { ...handle, point: zone.points[handle.pointIndex] }; draggedRef.current = true; }
  }, [findHandle, toCanvasPoint]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedRef.current) { draggedRef.current = false; event.stopPropagation(); return; }
    if (!drawingRef.current) return;
    event.stopPropagation();
    const point = toCanvasPoint(event);
    const handle = findHandle(point);
    if (handle) {
      const zone = zonesRef.current.find((entry) => entry.id === handle.zoneId);
      if (zone) dragRef.current = { ...handle, point: zone.points[handle.pointIndex] };
      return;
    }
    const points = activePointsRef.current;
    if (drawingTool === 'polygon' && points.length >= 3 && Math.hypot(points[0].x - point.x, points[0].y - point.y) <= 12) { completeZone(); return; }
    points.push(point);
    if ((drawingTool === 'circle' || drawingTool === 'tripwire') && points.length === 2) completeZone();
  }, [completeZone, drawingTool, findHandle, toCanvasPoint]);

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || drawingTool !== 'polygon') return;
    event.preventDefault(); event.stopPropagation(); completeZone();
  }, [completeZone, drawingTool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); undoPoint(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoPoint]);

  useEffect(() => {
    const canvas = canvasRef.current; const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let animationFrame = 0;
    const drawZone = (zone: GeofenceZone, override?: Point) => {
      const points = zone.points.map((point, index) => dragRef.current?.zoneId === zone.id && dragRef.current.pointIndex === index ? dragRef.current.point : point);
      if (points.length < 2) return;
      context.beginPath();
      if (zone.type === 'circle' && points[1]) context.arc(points[0].x, points[0].y, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), 0, Math.PI * 2);
      else { context.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => context.lineTo(point.x, point.y)); if (zone.type !== 'tripwire') context.closePath(); }
      context.strokeStyle = zone.color; context.fillStyle = `${zone.color}24`; context.lineWidth = 1.5; context.setLineDash(zone.type === 'tripwire' ? [7, 4] : []); if (zone.type !== 'tripwire') context.fill(); context.stroke(); context.setLineDash([]);
      if (zone.type !== 'circle') points.forEach((point, index) => { context.beginPath(); context.arc(point.x, point.y, 4, 0, Math.PI * 2); context.fillStyle = hoverRef.current?.zoneId === zone.id && hoverRef.current.pointIndex === index ? '#ffffff' : zone.color; context.shadowColor = zone.color; context.shadowBlur = 10; context.fill(); context.shadowBlur = 0; });
      void override;
    };
    const loop = () => {
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      zonesRef.current.forEach((zone) => drawZone(zone));
      const active = activePointsRef.current; const cursor = mousePosRef.current;
      if (drawingRef.current && active.length) {
        context.beginPath(); context.moveTo(active[0].x, active[0].y); active.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        if (cursor) context.lineTo(cursor.x, cursor.y);
        context.strokeStyle = '#67e8f9'; context.lineWidth = 1.5; context.setLineDash([6, 5]); context.stroke(); context.setLineDash([]);
        active.forEach((point, index) => { context.beginPath(); context.arc(point.x, point.y, 5, 0, Math.PI * 2); context.fillStyle = index === 0 ? '#ffffff' : '#22d3ee'; context.fill(); });
      }
      if (cameraId === 1) {
        const box: BoundingBox = { id: 'det-1', x: 100, y: 80, w: 120, h: 140, label: 'INTRUDER #101', confidence: .94, threatLevel: 'CRITICAL' };
        const color = alarmRef.current ? '#fb3b4b' : '#22d3ee'; context.strokeStyle = color; context.lineWidth = 2;
        [[box.x, box.y, 1, 1], [box.x + box.w, box.y, -1, 1], [box.x, box.y + box.h, 1, -1], [box.x + box.w, box.y + box.h, -1, -1]].forEach(([x, y, dx, dy]) => { context.beginPath(); context.moveTo(x, y + dy * 14); context.lineTo(x, y); context.lineTo(x + dx * 14, y); context.stroke(); });
        context.font = '10px monospace'; context.fillStyle = color; context.fillText(`TGT-${box.id} 14.2m`, box.x, box.y - 7); context.beginPath(); context.moveTo(160, 150); context.lineTo(204, 130); context.stroke();
        const center = { x: 160, y: 150 }; zonesRef.current.forEach((zone) => { if (isPointInZone(center, zone)) callbackRef.current(box, zone); });
      }
      animationFrame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [cameraId, isPointInZone]);

  const filter = visionMode === 'thermal' ? 'contrast(1.8) saturate(2.8) hue-rotate(310deg)' : visionMode === 'night' ? 'grayscale(1) sepia(1) hue-rotate(70deg) saturate(4) brightness(.85)' : 'contrast(1.1) saturate(1.15)';
  const isBreached = cameraId === 1 && zones.some((zone) => isPointInZone({ x: 160, y: 150 }, zone));

  return <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', backgroundColor: '#020617' }}>
    <video
      src={videoUrl}
      autoPlay
      loop
      muted
      playsInline
      onLoadedData={() => setVideoLoaded(true)}
      onError={() => setVideoError(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter,
        opacity: videoLoaded ? 1 : 0,
        transition: 'opacity 0.25s ease'
      }}
    />
    {!videoLoaded && !videoError && (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040d1a',
        color: '#38bdf8',
        fontSize: '10px',
        letterSpacing: '0.08em',
        gap: '6px',
        zIndex: 1
      }}>
        <div style={{ width: '14px', height: '14px', border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span>SIGNAL ACQUIRING...</span>
      </div>
    )}
    {videoError && (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0507',
        color: '#ef4444',
        fontSize: '10px',
        letterSpacing: '0.08em',
        zIndex: 1
      }}>
        FEED UNAVAILABLE
      </div>
    )}
    {/* eslint-disable-next-line react/refs */}
    <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseLeave={() => { mousePosRef.current = null; hoverRef.current = null; }} onMouseUp={commitDrag} onClick={handleCanvasClick} onDoubleClick={handleDoubleClick} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: dragRef.current ? 'grabbing' : isDrawing ? 'crosshair' : 'default', zIndex: 2 }} />
    <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,8,17,.78)', color: '#67e8f9', padding: '3px 6px', fontSize: 10, zIndex: 3 }}>CAM-{String(cameraId).padStart(2, '0')} // LIVE</div>
    {isDrawing && <><div style={{ position: 'absolute', top: 28, left: 8, background: 'rgba(0,8,17,.78)', color: '#d8f9ff', padding: '4px 6px', fontSize: 9, pointerEvents: 'none', zIndex: 3 }}>Click to add point • Double-click to close</div><div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 3 }}><button className="c2-button" onClick={(event) => { event.stopPropagation(); undoPoint(); }}>UNDO POINT</button><button className="c2-button" onClick={(event) => { event.stopPropagation(); completeZone(); }}>COMPLETE ZONE</button><button className="c2-button" onClick={(event) => { event.stopPropagation(); resetZone(); }}>RESET ZONE</button></div></>}

    <div style={{ position: 'absolute', right: 8, bottom: 8, padding: '3px 7px', borderRadius: 999, background: isBreached ? '#dc2626' : '#16a34a', color: '#fff', fontSize: 10, fontWeight: 700, zIndex: 3 }}>{isBreached ? 'BREACH' : 'CLEAR'}</div>
  </div>;
}

export default memo(DetectionCanvas);
