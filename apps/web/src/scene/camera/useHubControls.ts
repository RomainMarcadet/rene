import { useEffect, useRef, type MutableRefObject } from 'react';
import { canMoveInPhase, type RoomSnapshot } from '@rene/contracts';
import { isEditing } from '../../keyboard';
import { move } from '../../store';
import { cameraRelative, shotKey, type OrbitState } from './math';
export function controlsBlocked(target: EventTarget | null) {
  return isEditing(target) || !!document.querySelector('dialog[open]') || (target instanceof Element && !!target.closest('.room-overlay, .navigation-zone, .communication-zone'));
}
export function useHubControls(room: RoomSnapshot, orbit: MutableRefObject<OrbitState>, visible: boolean, recenter: () => void) {
  const touch = useRef({ x: 0, z: 0 }); const keys = useRef(new Set<string>()); const resetRef = useRef(() => {});
  const onRecenter = useRef(recenter); onRecenter.current = recenter;
  const key = shotKey(room.game); const free = canMoveInPhase(room.game?.phase);
  useEffect(() => { if (!visible || !free) { resetRef.current(); orbit.current.interrupted = key; } }, [visible, free, key, orbit]);
  useEffect(() => {
    const reset = () => { keys.current.clear(); touch.current.x = 0; touch.current.z = 0; }; resetRef.current = reset;
    const down = (event: KeyboardEvent) => {
      if (controlsBlocked(event.target) || !visible) return;
      const value = event.key.toLowerCase();
      if (value === 'r' && !event.repeat) { onRecenter.current(); return; }
      if (['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(value)) { event.preventDefault(); keys.current.add(value); orbit.current.interrupted = key; }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const focus = () => { if (controlsBlocked(document.activeElement)) { reset(); orbit.current.interrupted = key; } };
    const timer = setInterval(() => {
      if (!free || !visible || controlsBlocked(document.activeElement)) { reset(); return; }
      const pressed = (...values: string[]) => values.some(k => keys.current.has(k));
      const x = touch.current.x + Number(pressed('d', 'arrowright')) - Number(pressed('q', 'a', 'arrowleft'));
      const z = touch.current.z + Number(pressed('s', 'arrowdown')) - Number(pressed('z', 'w', 'arrowup'));
      if (x || z) { const direction = cameraRelative(x, z, orbit.current.yaw); move(direction.x, direction.z); }
    }, 67);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', reset); window.addEventListener('resize', reset); window.visualViewport?.addEventListener('resize', reset); document.addEventListener('visibilitychange', reset); document.addEventListener('focusin', focus);
    focus();
    return () => { clearInterval(timer); reset(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset); window.removeEventListener('resize', reset); window.visualViewport?.removeEventListener('resize', reset); document.removeEventListener('visibilitychange', reset); document.removeEventListener('focusin', focus); };
  }, [free, visible, orbit, key]);
  return touch;
}
