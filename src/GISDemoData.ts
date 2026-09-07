import type { BorderCamera } from './CameraMarkers';
import type { SecurityZoneCollection } from './MapZonesOverlay';
import type { BreachAlertPayload } from './BreachPingOverlay';
import type { PatrolRoute } from './PatrolRoutes';
import type { TargetJourney } from './JourneyTracker';

export const gisCameras: BorderCamera[] = [
  {
    id: 'CAM-01',
    name: 'SECTOR CAM 01',
    position: [28.6139, 77.2090],
    heading: 45,
    status: 'ONLINE',
    fovDegrees: 70,
    rangeMeters: 900,
    sectorId: 'ALPHA',
  },
  {
    id: 'CAM-02',
    name: 'SECTOR CAM 02',
    position: [28.6200, 77.2200],
    heading: 110,
    status: 'ONLINE',
    fovDegrees: 65,
    rangeMeters: 800,
    sectorId: 'BRAVO',
  },
  {
    id: 'CAM-03',
    name: 'SECTOR CAM 03',
    position: [28.6050, 77.2250],
    heading: 210,
    status: 'OFFLINE',
    fovDegrees: 60,
    rangeMeters: 700,
    sectorId: 'CHARLIE',
  },
  {
    id: 'CAM-04',
    name: 'SECTOR CAM 04',
    position: [28.5950, 77.2120],
    heading: 320,
    status: 'ONLINE',
    fovDegrees: 75,
    rangeMeters: 850,
    sectorId: 'DELTA',
  },
];

export const gisZones: SecurityZoneCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'ZONE-01',
        name: 'NORMAL SECTOR',
        sectorId: 'ALPHA',
        threatStatus: 'NORMAL',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.198, 28.608],
          [77.214, 28.608],
          [77.214, 28.620],
          [77.198, 28.620],
          [77.198, 28.608],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ZONE-02',
        name: 'RESTRICTED SECTOR',
        sectorId: 'BRAVO',
        threatStatus: 'RESTRICTED',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.214, 28.608],
          [77.230, 28.608],
          [77.230, 28.620],
          [77.214, 28.620],
          [77.214, 28.608],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ZONE-03',
        name: 'CRITICAL SECTOR',
        sectorId: 'CHARLIE',
        threatStatus: 'CRITICAL',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.205, 28.592],
          [77.222, 28.592],
          [77.222, 28.605],
          [77.205, 28.605],
          [77.205, 28.592],
        ]],
      },
    },
  ],
};

export const gisBreaches: BreachAlertPayload[] = [
  {
    id: 'BREACH-001',
    latitude: 28.598,
    longitude: 77.215,
    severity: 'CRITICAL',
    timestamp: Date.now(),
  },
];

export const gisPatrolRoutes: PatrolRoute[] = [
  {
    id: 'PATROL-01',
    guardName: 'GUARD ALPHA',
    durationMs: 20000,
    checkpoints: [
  {
    id: 'CP-01',
    position: [28.613, 77.205],
    status: 'CLEARED',
  },
  {
    id: 'CP-02',
    position: [28.617, 77.215],
    status: 'CLEARED',
  },
  {
    id: 'CP-03',
    position: [28.610, 77.225],
    status: 'PENDING',
  },
  {
    id: 'CP-04',
    position: [28.600, 77.218],
    status: 'PENDING',
    },
   ],
  },
];

export const gisJourneys: TargetJourney[] = [
  {
    id: 'TARGET-001',
    cameraIds: ['CAM-01', 'CAM-02', 'CAM-04'],
    active: true,
    color: '#ef4444',
  },
];