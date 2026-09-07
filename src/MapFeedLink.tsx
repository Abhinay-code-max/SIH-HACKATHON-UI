import { useEffect } from 'react';

export const CAMERA_FOCUS_EVENT = 'borderwatch:focus-camera';

export function focusCameraStream(cameraId: string) {
  window.dispatchEvent(new CustomEvent<string>(CAMERA_FOCUS_EVENT, { detail: cameraId }));
}

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
