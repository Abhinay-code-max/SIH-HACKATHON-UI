import { useEffect } from 'react';

export const CAMERA_FOCUS_EVENT = 'borderwatch:focus-camera';

// eslint-disable-next-line react-refresh/only-export-components
export function focusCameraStream(cameraId: string) {
  window.dispatchEvent(new CustomEvent<string>(CAMERA_FOCUS_EVENT, { detail: cameraId }));
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMapFeedLink(onCameraSelect: (cameraId: string) => void) {
  useEffect(() => {
    const handleFocus = (event: Event) => onCameraSelect((event as CustomEvent<string>).detail);
    window.addEventListener(CAMERA_FOCUS_EVENT, handleFocus);
    return () => window.removeEventListener(CAMERA_FOCUS_EVENT, handleFocus);
  }, [onCameraSelect]);
}

/** Mount beside a video wall to focus the selected map camera without prop drilling. */
export default function MapFeedLink({ onCameraSelect }: { onCameraSelect: (cameraId: string) => void }) {
  useMapFeedLink(onCameraSelect);
  return null;
}
