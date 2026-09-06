import { create } from 'zustand';

export interface Point {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
}

export interface GeofenceZone {
  id: string;
  name: string;
  points: Point[];
  color: string;
  threatLevel: 'RESTRICTED' | 'WARNING' | 'CRITICAL';
}

interface GeofenceState {
  zones: GeofenceZone[];
  isDrawing: boolean;
  currentPoints: Point[];
  selectedColor: string;
  setDrawingMode: (active: boolean) => void;
  addPoint: (point: Point) => void;
  completeZone: (name: string, threatLevel: GeofenceZone['threatLevel']) => void;
  clearCurrentZone: () => void;
  deleteZone: (id: string) => void;
}

export const useGeofenceStore = create<GeofenceState>((set) => ({
  zones: [
    {
      id: 'z-1',
      name: 'Border Line A1',
      color: '#ef4444',
      threatLevel: 'CRITICAL',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.1 },
        { x: 0.45, y: 0.5 },
        { x: 0.12, y: 0.4 },
      ],
    },
  ],
  isDrawing: false,
  currentPoints: [],
  selectedColor: '#ef4444',

  setDrawingMode: (active) => set({ isDrawing: active, currentPoints: [] }),

  addPoint: (point) => set((state) => ({ currentPoints: [...state.currentPoints, point] })),

  completeZone: (name, threatLevel) =>
    set((state) => {
      if (state.currentPoints.length < 3) return state;
      const newZone: GeofenceZone = {
        id: `z-${Date.now()}`,
        name,
        points: state.currentPoints,
        color: threatLevel === 'CRITICAL' ? '#ef4444' : threatLevel === 'WARNING' ? '#f59e0b' : '#3b82f6',
        threatLevel,
      };
      return {
        zones: [...state.zones, newZone],
        currentPoints: [],
        isDrawing: false,
      };
    }),

  clearCurrentZone: () => set({ currentPoints: [] }),
  deleteZone: (id) => set((state) => ({ zones: state.zones.filter((z) => z.id !== id) })),
}));