export interface Point {
  x: number;
  y: number;
}

export interface GeofenceZone {
  id: string;
  name: string;
  color: string;
  points: Point[];
}

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  confidence: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface IncidentLog {
  id: string;
  timestamp: string;
  cameraId: number;
  label: string;
  threatLevel: string;
  zoneName: string;
}