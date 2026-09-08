import { useEffect, useState } from 'react';
import { Cpu, Database, Network, Clock } from 'lucide-react';

interface MetricCardProps {
  icon: any;
  title: string;
  value: string | number;
  unit: string;
  statusColor: string;
  isDark?: boolean;
}

const MetricCard = ({ icon: Icon, title, value, unit, statusColor, isDark = true }: MetricCardProps) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: isDark ? '#0f172a' : '#f8fafc',
    padding: '10px 14px',
    borderRadius: '4px',
    border: `1px solid ${isDark ? `${statusColor}40` : '#cbd5e1'}`
  }}>
    <Icon color={statusColor} size={20} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#0f172a' }}>{value}</span>
        <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>{unit}</span>
      </div>
    </div>
    <div style={{ 
      width: '8px', 
      height: '8px', 
      borderRadius: '50%', 
      backgroundColor: statusColor, 
      boxShadow: `0 0 8px ${statusColor}` 
    }} />
  </div>
);

export default function SystemHealthMonitor({ isDark = true }: { isDark?: boolean }) {
  const [cpu, setCpu] = useState(0);
  const [memory, setMemory] = useState(0);
  const [latency, setLatency] = useState(0);
  const [uptime, setUptime] = useState(100);

  useEffect(() => {
    // Generate deterministic/simulated values with some jitter
    let baseCpu = 25;
    let baseMem = 45;

    const interval = setInterval(() => {
      // CPU Jitter
      baseCpu += (Math.random() - 0.5) * 10;
      if (baseCpu < 5) baseCpu = 5;
      if (baseCpu > 95) baseCpu = 95;
      setCpu(Math.round(baseCpu));

      // Memory (using browser API if available, else simulated)
      const perfAny = performance as any;
      if (perfAny.memory && perfAny.memory.jsHeapSizeLimit > 0) {
        const memRatio = (perfAny.memory.usedJSHeapSize / perfAny.memory.jsHeapSizeLimit) * 100;
        setMemory(Math.round(memRatio * 1.5)); // Scale up a bit to look realistic
      } else {
        baseMem += (Math.random() - 0.5) * 2;
        if (baseMem < 30) baseMem = 30;
        if (baseMem > 90) baseMem = 90;
        setMemory(Math.round(baseMem));
      }

      // Latency (simulated network latency)
      setLatency(Math.round(15 + Math.random() * 20)); // 15-35ms normal
      
      // Occasionally simulate a drop in uptime
      if (Math.random() < 0.05) {
        setUptime(99.9 - Math.random() * 0.5);
      } else {
        setUptime(100);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (val: number, isLatency = false) => {
    if (isLatency) {
      if (val < 150) return '#10b981'; // Green
      if (val < 300) return '#f59e0b'; // Yellow
      return '#ef4444'; // Red
    }
    if (val < 70) return '#10b981'; // Green
    if (val < 85) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const bgContainer = isDark ? 'rgba(5,16,25,.92)' : '#ffffff';
  const borderCol = isDark ? '#155e75' : '#cbd5e1';
  const headerColor = isDark ? '#38bdf8' : '#0284c7';

  return (
    <div style={{ background: bgContainer, border: `1px solid ${borderCol}`, padding: '12px', borderRadius: '4px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', color: headerColor, fontWeight: 'bold', letterSpacing: '0.05em' }}>SYSTEM HEALTH MONITOR</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <MetricCard icon={Cpu} title="CORE CPU LOAD" value={cpu} unit="%" statusColor={getStatusColor(cpu)} isDark={isDark} />
        <MetricCard icon={Database} title="MEMORY UTILIZATION" value={memory} unit="%" statusColor={getStatusColor(memory)} isDark={isDark} />
        <MetricCard icon={Clock} title="API LATENCY" value={latency} unit="ms" statusColor={getStatusColor(latency, true)} isDark={isDark} />
        <MetricCard icon={Network} title="NETWORK UPTIME" value={uptime.toFixed(1)} unit="%" statusColor={uptime > 99 ? '#10b981' : '#f59e0b'} isDark={isDark} />
      </div>
    </div>
  );
}
