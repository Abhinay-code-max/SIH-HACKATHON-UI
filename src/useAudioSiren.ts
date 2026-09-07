import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioSiren() {
  const [sirenActive, setSirenActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (oscRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      try { oscRef.current.stop(); } catch (_) {}
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
  }, []);

  const startSiren = useCallback(() => {
    if (sirenActive) return;
    
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    cleanup();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    // European style siren alternates between high and low
    const freqHigh = 900;
    const freqLow = 700;
    
    osc.frequency.setValueAtTime(freqHigh, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    // ramp up to avoid clicks
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    
    oscRef.current = osc;
    gainRef.current = gain;

    let isHigh = true;
    intervalRef.current = window.setInterval(() => {
      if (oscRef.current && audioCtxRef.current) {
        isHigh = !isHigh;
        oscRef.current.frequency.setValueAtTime(isHigh ? freqHigh : freqLow, audioCtxRef.current.currentTime);
      }
    }, 500); // toggle every 500ms

    setSirenActive(true);
  }, [sirenActive, cleanup]);

  const stopSiren = useCallback(() => {
    if (!sirenActive) return;
    
    if (gainRef.current && audioCtxRef.current) {
      // Fade out
      gainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.1);
      setTimeout(() => {
        cleanup();
        setSirenActive(false);
      }, 150);
    } else {
      cleanup();
      setSirenActive(false);
    }
  }, [sirenActive, cleanup]);

  const toggleSiren = useCallback(() => {
    if (sirenActive) {
      stopSiren();
    } else {
      startSiren();
    }
  }, [sirenActive, startSiren, stopSiren]);

  useEffect(() => {
    return () => {
      cleanup();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, [cleanup]);

  return { sirenActive, startSiren, stopSiren, toggleSiren };
}
