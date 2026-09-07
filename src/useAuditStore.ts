import { create } from 'zustand';

export type SecuritySeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface AuditEvent {
  id: string;
  timestamp: number;
  severity: SecuritySeverity;
  category: string;
  message: string;
  sector?: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
}

export interface AuditFilterState {
  severity: SecuritySeverity | 'ALL';
  sector: string | 'ALL';
  startDate: number | null;
  endDate: number | null;
  category: string | 'ALL';
}

interface AuditStore {
  events: AuditEvent[];
  filters: AuditFilterState;
  
  // Actions
  addEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  setFilters: (filters: Partial<AuditFilterState>) => void;
  resetFilters: () => void;
  
  // Parsers
  parseSecurityQuery: (query: string, availableSectors: string[]) => void;
}

const DEFAULT_FILTERS: AuditFilterState = {
  severity: 'ALL',
  sector: 'ALL',
  startDate: null,
  endDate: null,
  category: 'ALL',
};

export const useAuditStore = create<AuditStore>((set) => ({
  events: [],
  filters: DEFAULT_FILTERS,

  addEvent: (eventData) => set((state) => {
    const newEvent: AuditEvent = {
      ...eventData,
      id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    // Keep max 500 events to prevent infinite memory growth
    const updatedEvents = [newEvent, ...state.events].slice(0, 500);
    return { events: updatedEvents };
  }),

  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  parseSecurityQuery: (query: string, availableSectors: string[]) => {
    const q = query.toLowerCase();
    
    // Default filters
    const newFilters: Partial<AuditFilterState> = {
      severity: 'ALL',
      sector: 'ALL',
      category: 'ALL',
      startDate: null,
      endDate: null,
    };

    let understood = false;

    // Severity matching
    if (q.includes('critical')) { newFilters.severity = 'CRITICAL'; understood = true; }
    else if (q.includes('warning') || q.includes('warnings')) { newFilters.severity = 'WARNING'; understood = true; }
    else if (q.includes('error') || q.includes('errors')) { newFilters.severity = 'ERROR'; understood = true; }
    else if (q.includes('info') || q.includes('informational')) { newFilters.severity = 'INFO'; understood = true; }

    // Category matching
    if (q.includes('breach')) { newFilters.category = 'BREACH'; understood = true; }
    else if (q.includes('motion')) { newFilters.category = 'MOTION'; understood = true; }
    else if (q.includes('camera')) { newFilters.category = 'CAMERA'; understood = true; }
    else if (q.includes('detection')) { newFilters.category = 'DETECTION'; understood = true; }
    else if (q.includes('geofence')) { newFilters.category = 'GEOFENCE'; understood = true; }
    else if (q.includes('patrol')) { newFilters.category = 'PATROL'; understood = true; }
    else if (q.includes('journey')) { newFilters.category = 'JOURNEY'; understood = true; }
    else if (q.includes('system') || q.includes('health')) { newFilters.category = 'SYSTEM'; understood = true; }
    else if (q.includes('siren')) { newFilters.category = 'SIREN'; understood = true; }

    // Sector matching
    for (const sector of availableSectors) {
      if (q.includes(sector.toLowerCase())) {
        newFilters.sector = sector;
        understood = true;
        break;
      }
    }

    // Date matching
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (q.includes('today')) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      newFilters.startDate = startOfDay.getTime();
      understood = true;
    } else if (q.includes('yesterday')) {
      const startOfYesterday = new Date(now - day);
      startOfYesterday.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date(now - day);
      endOfYesterday.setHours(23, 59, 59, 999);
      newFilters.startDate = startOfYesterday.getTime();
      newFilters.endDate = endOfYesterday.getTime();
      understood = true;
    } else if (q.includes('last hour')) {
      newFilters.startDate = now - (60 * 60 * 1000);
      understood = true;
    } else if (q.includes('last 24 hours') || q.includes('recent')) {
      newFilters.startDate = now - day;
      understood = true;
    }

    if (understood) {
      set((state) => ({ filters: { ...state.filters, ...newFilters } }));
    }
    
    if (!understood && q.trim().length > 0) {
      throw new Error('Unable to interpret query. Try "Show critical breaches near Sector 4".');
    }
  },
}));
