import React, { useState, useMemo } from 'react';
import { useAuditStore } from './useAuditStore';
import type { SecuritySeverity } from './useAuditStore';
import { Download, Filter, Search } from 'lucide-react';

const SECTORS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

export default function AuditLogPanel() {
  const { events, filters, setFilters, resetFilters, parseSecurityQuery } = useAuditStore();
  const [nlQuery, setNlQuery] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.severity !== 'ALL' && event.severity !== filters.severity) return false;
      if (filters.category !== 'ALL' && event.category !== filters.category) return false;
      if (filters.sector !== 'ALL' && event.sector !== filters.sector) return false;
      if (filters.startDate && event.timestamp < filters.startDate) return false;
      if (filters.endDate && event.timestamp > filters.endDate) return false;
      return true;
    });
  }, [events, filters]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredEvents.length === 0) return;
    
    const headers = ['Timestamp', 'Severity', 'Category', 'Message', 'Sector', 'Source', 'Metadata'];
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '""';
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvLines = [headers.map(escapeCSV).join(',')];
    
    for (const event of filteredEvents) {
      const row = [
        new Date(event.timestamp).toISOString(),
        event.severity,
        event.category,
        event.message,
        event.sector || '',
        event.source || '',
        event.metadata || ''
      ];
      csvLines.push(row.map(escapeCSV).join(','));
    }

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const d = new Date();
    const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
    
    link.setAttribute('download', `borderwatch-audit-log-${ts}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // NL Query
  const handleNLQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQueryError(null);
    if (!nlQuery.trim()) return;
    try {
      parseSecurityQuery(nlQuery, SECTORS);
      setNlQuery('');
    } catch (err: any) {
      setQueryError(err.message || 'Unable to interpret query.');
    }
  };

  const getSeverityColor = (severity: SecuritySeverity) => {
    switch (severity) {
      case 'CRITICAL': return '#ef4444';
      case 'ERROR': return '#f97316';
      case 'WARNING': return '#f59e0b';
      case 'INFO': return '#38bdf8';
      default: return '#cbd5e1';
    }
  };

  // Assuming dark mode for the panel to match App's default
  const bgCard = 'rgba(5,16,25,.92)';
  const borderCol = '#155e75';
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Filters Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', background: bgCard, border: `1px solid ${borderCol}`, padding: '12px', borderRadius: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} color="#0ea5e9" />
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0ea5e9' }}>FILTERS</span>
        </div>
        
        <select value={filters.severity} onChange={(e) => setFilters({ severity: e.target.value as any })} className="c2-button">
          <option value="ALL">ALL SEVERITY</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        
        <select value={filters.sector} onChange={(e) => setFilters({ sector: e.target.value as any })} className="c2-button">
          <option value="ALL">ALL SECTORS</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px' }}>FROM:</span>
          <input type="datetime-local" className="c2-button" 
                 value={filters.startDate ? new Date(filters.startDate - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                 onChange={(e) => setFilters({ startDate: e.target.value ? new Date(e.target.value).getTime() : null })} />
          <span style={{ fontSize: '10px' }}>TO:</span>
          <input type="datetime-local" className="c2-button" 
                 value={filters.endDate ? new Date(filters.endDate - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                 onChange={(e) => setFilters({ endDate: e.target.value ? new Date(e.target.value).getTime() : null })} />
        </div>

        <button onClick={resetFilters} className="c2-button" style={{ marginLeft: 'auto' }}>RESET</button>
        <button onClick={handleExportCSV} className="c2-button" style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#0284c7' }}>
          <Download size={12} /> CSV EXPORT
        </button>
      </div>

      {/* NL Query Panel */}
      <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: '12px', borderRadius: '4px' }}>
        <form onSubmit={handleNLQuerySubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Search size={14} color="#0ea5e9" />
          <input 
            type="text" 
            placeholder="e.g. Show critical breaches near Sector 4..." 
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            style={{ flex: 1, background: '#0b1329', border: `1px solid ${borderCol}`, padding: '6px 10px', borderRadius: '4px', color: '#fff', fontSize: '12px', outline: 'none' }}
          />
          <button type="submit" className="c2-button">QUERY</button>
        </form>
        {queryError && (
          <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px', marginLeft: '22px' }}>
            {queryError}
          </div>
        )}
      </div>

      {/* Audit Log Stream */}
      <div style={{ flex: 1, background: bgCard, border: `1px solid ${borderCol}`, borderRadius: '4px', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${borderCol}`, display: 'flex', justifyContent: 'space-between', backgroundColor: '#070f1a' }}>
          <strong style={{ fontSize: '12px', color: '#38bdf8' }}>AUDIT LOG STREAM</strong>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>SHOWING {filteredEvents.length} EVENT{filteredEvents.length !== 1 ? 'S' : ''}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px', fontSize: '12px' }}>
              No security events match the current filters.
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div key={evt.id} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                padding: '8px', 
                background: '#0f172a', 
                borderLeft: `4px solid ${getSeverityColor(evt.severity)}`, 
                borderRadius: '4px', 
                fontSize: '11px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: getSeverityColor(evt.severity), fontWeight: 'bold' }}>[{evt.severity}]</span>
                    <span>{new Date(evt.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {evt.sector && <span>{evt.sector}</span>}
                    {evt.source && <span>{evt.source}</span>}
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#f8fafc' }}>{evt.message}</div>
                <div style={{ opacity: 0.6 }}>CAT: {evt.category} | ID: {evt.id}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
