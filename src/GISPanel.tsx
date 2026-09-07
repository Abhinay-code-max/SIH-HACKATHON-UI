import BorderMap from './BorderMap';

import {
  gisCameras,
  gisZones,
  gisBreaches,
  gisPatrolRoutes,
  gisJourneys,
} from './GISDemoData';

interface GISPanelProps {
  onCameraSelect?: (cameraId: string) => void;
}

export default function GISPanel({
  onCameraSelect,
}: GISPanelProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '620px',
        border: '1px solid #155e75',
        borderRadius: '6px',
        overflow: 'hidden',
        background: '#050811',
      }}
    >
      <BorderMap
        cameras={gisCameras}
        center={[28.610, 77.215]}
        zoom={13}
        onCameraSelect={onCameraSelect}
        zones={gisZones}
        showSectorLabels={true}
        showBoundingOutlines={true}
        breachAlerts={gisBreaches}
        patrolRoutes={gisPatrolRoutes}
        targetJourneys={gisJourneys}
      />
    </div>
  );
}