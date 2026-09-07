import { useRef, useEffect, memo } from 'react';
import type { SecuritySeverity } from './useAuditStore';

export interface RadarTarget {
  id: string;
  angle: number; // 0 to 360 degrees
  distance: number; // 0 to 1 (normalized distance from center)
  label?: string;
  severity?: SecuritySeverity;
}

interface TacticalRadarProps {
  targets?: RadarTarget[];
  hasAlert?: boolean;
}

const TacticalRadar = memo(({ targets = [], hasAlert = false }: TacticalRadarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Handle device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const size = 160;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let angle = 0;
    let animationId: number;
    const center = size / 2;
    const radius = (size / 2) - 10;

    const renderRadar = () => {
      // Clear background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, size, size);

      // Radar rings
      ctx.strokeStyle = hasAlert ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      [radius * 0.33, radius * 0.66, radius].forEach(r => {
        ctx.beginPath();
        ctx.arc(center, center, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(center, 10); ctx.lineTo(center, size - 10);
      ctx.moveTo(10, center); ctx.lineTo(size - 10, center);
      ctx.stroke();

      // Rotating Sweep Sector
      angle = (angle + 0.03) % (Math.PI * 2);
      
      // Draw sweep gradient
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle - 0.5, true);
      ctx.lineTo(center, center);
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
      gradient.addColorStop(0, hasAlert ? 'rgba(239, 68, 68, 0.8)' : 'rgba(56, 189, 248, 0.8)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Sweep Line
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hasAlert ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw targets
      targets.forEach(target => {
        const targetRad = (target.angle - 90) * (Math.PI / 180); // -90 so 0 is North
        const targetR = target.distance * radius;
        const tx = center + targetR * Math.cos(targetRad);
        const ty = center + targetR * Math.sin(targetRad);

        // Blip logic based on sweep proximity
        // Diff between current sweep angle and target angle
        let angleDiff = angle - targetRad;
        if (angleDiff < 0) angleDiff += Math.PI * 2;
        
        let opacity = 0.3; // base opacity
        if (angleDiff < 0.8) {
          opacity = 1 - (angleDiff / 0.8) * 0.7; // fade from 1 to 0.3
        }

        ctx.globalAlpha = opacity;
        
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        
        let color = '#38bdf8';
        if (target.severity === 'CRITICAL') color = '#ef4444';
        else if (target.severity === 'ERROR') color = '#f97316';
        else if (target.severity === 'WARNING') color = '#f59e0b';
        else if (target.severity === 'INFO') color = '#10b981';

        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        // Label
        if (target.label) {
          ctx.globalAlpha = opacity * 0.8;
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          ctx.fillText(target.label, tx + 6, ty + 3);
        }
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      });

      animationId = requestAnimationFrame(renderRadar);
    };

    renderRadar();
    return () => cancelAnimationFrame(animationId);
  }, [hasAlert, targets]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(5,16,25,0.8)', padding: '12px', borderRadius: '4px', border: '1px solid #155e75' }}>
      <div style={{ fontSize: '10px', marginBottom: '8px', color: hasAlert ? '#ef4444' : '#38bdf8', fontWeight: 'bold' }}>
        {hasAlert ? '⚠️ SECTOR RADAR [ALERT]' : '📡 SECTOR RADAR [NOMINAL]'}
      </div>
      <canvas ref={canvasRef} style={{ borderRadius: '50%' }} />
    </div>
  );
});

export default TacticalRadar;
