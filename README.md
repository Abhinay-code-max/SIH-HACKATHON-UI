# BorderWatch Command Pro — SIH-HACKATHON-UI

**BORDER SENTINEL** — Smart India Hackathon 2024 Frontend  
Tactical real-time border surveillance command system with 30-camera matrix, GIS sector map, AI-driven audit logging, and system health monitoring.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| State | Zustand 5 |
| Mapping | Leaflet 1.9 |
| Icons | Lucide React |
| Styling | Tailwind CSS v4 + inline styles |
| Audio | Web Audio API (siren) |
| Linting | Oxlint |

---

## Features

### 🛡️ Command Matrix (Tab 1)
- 30-camera surveillance grid with pagination
- Grid layouts: 2×2, 3×3, 4×4
- Click any camera to open it in focus/PiP modal
- PiP quad-split 4-camera view
- Camera JUMP selector (instant navigation to any cam)
- Geofence drawing on camera feeds (polygon, circle, tripwire)
- Vision mode filter: CYAN / THERMAL / NIGHT
- Real-time breach detection overlay (cam 1 demo)
- Alarm + Audio Siren controls
- Incident log sidebar
- Sector status panel (ALPHA/BRAVO/CHARLIE/DELTA)
- Animated Tactical Radar with breach targets
- Zone JSON import

### 🗺️ GIS Map (Tab 2)
- Interactive Leaflet map centred on New Delhi
- Camera markers with FOV cones and status colours
- Security zone polygons (NORMAL / RESTRICTED / CRITICAL)
- Breach ping overlay with pulsing animation
- Animated patrol route with guard movement
- Target journey tracker (animated dashed lines)
- Layer control panel (satellite tiles, zones, FOV, patrol, grid, topo, heatmap)
- Map-to-command feed linking (click camera in map → opens in Command Matrix)

### 📊 Audit Logs (Tab 3)
- Real-time audit event stream (from Zustand store)
- Filter by: severity, sector, date range, category
- Natural-language query parser ("Show critical breaches near ALPHA")
- CSV export with timestamped filename
- System Health Monitor (CPU, memory, latency, uptime — simulated)

### General
- Dark / Light theme toggle
- Error boundaries per camera feed
- localStorage persistence for geofence zones

---

## Installation

```bash
# Prerequisites: Node.js ≥ 18, npm ≥ 10
git clone https://github.com/Abhinay-code-max/SIH-HACKATHON-UI.git
cd SIH-HACKATHON-UI
npm install
```

## Run Locally

```bash
npm run dev
# Opens at http://localhost:5173
```

## Production Build

```bash
npm run build
# Output: dist/
npm run preview   # preview production build locally
```

## Lint

```bash
npm run lint
# Uses oxlint — see .oxlintrc.json for rule configuration
```

---

## Environment Variables

No environment variables are required. The application runs fully client-side.  
All demo data (cameras, zones, patrol routes, breach alerts) is defined in `src/GISDemoData.ts`.

---

## Current Status & Known Backend Dependencies

| Feature | Status |
|---|---|
| Camera matrix UI | ✅ Fully functional (mock video feeds) |
| Geofence drawing | ✅ Fully functional (localStorage persisted) |
| GIS Leaflet map | ✅ Fully functional (requires internet for tiles) |
| Breach detection | ✅ Simulated on CAM-01 |
| Patrol animation | ✅ Animated client-side |
| Audit log + filters | ✅ Fully functional |
| NL query | ✅ Keyword-based client-side parser |
| System health | ✅ Simulated (random jitter) |
| Audio siren | ✅ Web Audio API — works without backend |
| CSV export | ✅ Client-side download |
| Real camera feeds | ⚙️ Requires RTSP → HLS server integration |
| Real AI detection | ⚙️ Requires Python inference backend |
| Socket.io live events | ⚙️ `socket.io-client` installed, integration pending |
| Backend auth | ⚙️ Not yet integrated |
| Production deployment | ⚙️ Needs reverse proxy + CDN for camera streams |

---

## Project Structure

```
src/
├── App.tsx                  Main application shell (3 tabs)
├── constants.ts             Shared constants (SECTORS)
├── types.ts                 Shared TypeScript types
│
├── DetectionCanvas.tsx      Camera feed with geofence overlay
├── GISPanel.tsx             GIS map tab wrapper
├── BorderMap.tsx            Leaflet map component
│   ├── CameraMarkers.tsx    Camera pins + FOV cones
│   ├── MapZonesOverlay.tsx  Security zone polygons
│   ├── BreachPingOverlay.tsx Pulsing breach alerts
│   ├── PatrolRoutes.tsx     Animated guard patrol
│   ├── JourneyTracker.tsx   Target movement paths
│   ├── MapFeedLink.tsx      Map→command camera event bus
│   └── MapLayerControl.tsx  Layer toggle panel
│
├── AuditLogPanel.tsx        Audit log + filter + NL query + CSV
├── TacticalRadar.tsx        Animated canvas radar
├── SystemHealthMonitor.tsx  CPU/memory/latency dashboard
├── ThreatDensityHeatmap.tsx Leaflet breach heatmap circles
│
├── useAuditStore.ts         Zustand audit event store
├── useGeofenceStore.ts      Zustand geofence zone store (planned integration)
├── useAudioSiren.ts         Web Audio API siren hook
│
└── GISDemoData.ts           All demo/mock data for GIS features
```

---

## Contributors

- **Lead5** (Mahita Boyanapalli) — Base application, GIS system, camera markers, map overlays, geofence drawing, patrol routes, journey tracking
- **Lead4** — Performance optimizations, mini-radar, PiP quad-split, camera matrix pagination
- **Lead6** — Audit log panel, Tactical Radar (animated canvas), System Health Monitor, Threat Density Heatmap, Zustand audit store, Web Audio siren

---

*Demo-ready for Smart India Hackathon presentation.*
