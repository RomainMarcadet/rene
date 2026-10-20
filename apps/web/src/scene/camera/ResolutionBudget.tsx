import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
/** Bounded reductions sampled over three seconds; HUD text keeps its native resolution. */
export function nextResolution(quality: number, averageFrameSeconds: number) {
  return averageFrameSeconds > 1 / 35 ? Math.max(.7, Math.round((quality - .15) * 100) / 100) : quality;
}
export function ResolutionBudget({ quality, paused, onQuality }: { quality: number; paused: boolean; onQuality: (quality: number) => void }) {
  const sample = useRef({ seconds: 0, frames: 0 });
  useFrame((_state, dt) => {
    if (paused || document.hidden || dt > .25) { sample.current.seconds = 0; sample.current.frames = 0; return; }
    const s = sample.current; s.seconds += dt; s.frames++;
    if (s.seconds >= 3) { const next = nextResolution(quality, s.seconds / s.frames); s.seconds = 0; s.frames = 0; if (next !== quality) onQuality(next); }
  });
  return null;
}
