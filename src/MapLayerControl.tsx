import React from 'react';

export interface MapLayerState {
  satelliteTiles: boolean;
  securityZones: boolean;
  fovCones: boolean;
  patrolRoutes: boolean;
  gridCoordinates: boolean;
}

interface MapLayerControlProps {
  layers: MapLayerState;
  onToggleLayer: (layerKey: keyof MapLayerState) => void;
}

export const MapLayerControl: React.FC<MapLayerControlProps> = React.memo(({
  layers,
  onToggleLayer,
}) => {
  const layerOptions: { key: keyof MapLayerState; label: string; icon: string }[] = [
    { key: 'satelliteTiles', label: 'Satellite Tiles', icon: '🛰️' },
    { key: 'securityZones', label: 'Security Zones', icon: '🛡️' },
    { key: 'fovCones', label: 'Camera FOV Cones', icon: '📐' },
    { key: 'patrolRoutes', label: 'Patrol Routes', icon: '👮' },
    { key: 'gridCoordinates', label: 'Grid Coordinates', icon: '🌐' },
  ];

  return (
    <div className="absolute top-4 right-4 z-[1000] w-60 rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
          Map Layers
        </span>
        <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
          GIS Controller
        </span>
      </div>

      <div className="space-y-1.5">
        {layerOptions.map(({ key, label, icon }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800/60"
          >
            <div className="flex items-center space-x-2">
              <span className="text-sm">{icon}</span>
              <span className="font-medium text-slate-200">{label}</span>
            </div>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => onToggleLayer(key)}
              className="h-4 w-4 cursor-pointer rounded border-slate-700 bg-slate-800 text-sky-500 accent-sky-500 focus:ring-sky-400 focus:ring-offset-slate-900"
            />
          </label>
        ))}
      </div>
    </div>
  );
});

MapLayerControl.displayName = 'MapLayerControl';