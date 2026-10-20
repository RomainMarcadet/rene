import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import type { ClearArea } from '../../components/useRoomViewport';
import { controlsBlocked } from './useHubControls';
export function Joystick({ value, visible, area }: { value: MutableRefObject<{ x: number; z: number }>; visible: boolean; area: ClearArea }) {
  const pointer = useRef<number | null>(null); const [knob, setKnob] = useState({ x: 0, y: 0 });
  const shown = visible && area.width >= 100 && area.height >= 140;
  const size = Math.min(92, area.height < 250 ? 72 : 92);
  const release = useCallback(() => { pointer.current = null; value.current.x = 0; value.current.z = 0; setKnob({ x: 0, y: 0 }); }, [value]);
  useEffect(() => { if (!shown) release(); }, [shown, release]);
  useEffect(() => {
    const focus = () => { if (controlsBlocked(document.activeElement)) release(); };
    window.addEventListener('blur', release); window.addEventListener('resize', release); window.visualViewport?.addEventListener('resize', release); document.addEventListener('focusin', focus);
    return () => { window.removeEventListener('blur', release); window.removeEventListener('resize', release); window.visualViewport?.removeEventListener('resize', release); document.removeEventListener('focusin', focus); value.current.x = 0; value.current.z = 0; };
  }, [value, release]);
  const update = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / 32; let z = (e.clientY - r.top - r.height / 2) / 32;
    const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length;
    value.current.x = Math.abs(x) < .12 ? 0 : x; value.current.z = Math.abs(z) < .12 ? 0 : z; setKnob({ x: x * 25, y: z * 25 });
  };
  if (!shown) return null;
  return <div className="joystick" aria-label="Joystick de déplacement" style={{ left: area.left + 8, top: area.top + area.height - size - 8, bottom: 'auto', width: size, height: size }} onPointerDown={e => { e.preventDefault(); if (pointer.current !== null) return; pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e); }} onPointerMove={update} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}>✣</span></div>;
}
