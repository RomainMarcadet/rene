import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MathUtils, type OrthographicCamera } from 'three';
import { canMoveInPhase, type RoomSnapshot } from '@rene/contracts';
import { move, send, useGame } from '../store';
import { Avatar } from './Avatar';
import { Salon } from './Salon';
import { isEditing } from '../keyboard';
import type { ClearArea } from '../components/useRoomViewport';
export function useReducedMotion() { const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches); useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []); return reduced; }
function Camera({ room }: { room: RoomSnapshot }) {
  const { camera, size } = useThree();
  useEffect(() => { const cam = camera as OrthographicCamera; cam.zoom = Math.min(size.width / 20, size.height / 13.3); cam.updateProjectionMatrix(); }, [camera, size]);
  const lookAt = useRef({ x: 0, z: 0 });
  useFrame((_state, dt) => { const speaker = room.game?.phase === 'description' ? room.players.find(p => p.id === room.game?.turnPlayerId) : null; lookAt.current.x = MathUtils.damp(lookAt.current.x, (speaker?.position.x ?? 0) * .2, 2, dt); lookAt.current.z = MathUtils.damp(lookAt.current.z, (speaker?.position.z ?? 0) * .2, 2, dt); camera.lookAt(lookAt.current.x, .4, lookAt.current.z); });
  return null;
}
export default function Hub({ room, playerId, speaking, controlsVisible }: { room: RoomSnapshot; playerId: string; speaking: string[]; clearArea: ClearArea; compact: boolean; controlsVisible: boolean }) {
  const keys = useRef(new Set<string>()); const touch = useRef({ x: 0, z: 0 }); const reduced = useReducedMotion(); const offset = useGame(s => s.offset); const voteTarget = useGame(s => s.secret?.voteTarget); const freeMovement = canMoveInPhase(room.game?.phase);
  useEffect(() => {
    const blocked = (target: EventTarget | null) => isEditing(target) || !!document.querySelector('dialog[open]');
    const down = (event: KeyboardEvent) => { if (blocked(event.target)) return; const key = event.key.toLowerCase(); if (['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); keys.current.add(key); } };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase()); const reset = () => { keys.current.clear(); touch.current = { x: 0, z: 0 }; };
    const focus = () => { if (blocked(document.activeElement)) reset(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset); document.addEventListener('focusin', focus);
    const interval = setInterval(() => { if (!freeMovement || blocked(document.activeElement)) { reset(); return; } const pressed = (...values: string[]) => values.some(key => keys.current.has(key)); let x = touch.current.x + Number(pressed('d', 'arrowright')) - Number(pressed('q', 'a', 'arrowleft')); let z = touch.current.z + Number(pressed('s', 'arrowdown')) - Number(pressed('z', 'w', 'arrowup')); const length = Math.hypot(x, z); if (length) { x /= length; z /= length; move(x, z); } }, 67);
    return () => { clearInterval(interval); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); document.removeEventListener('focusin', focus); reset(); };
  }, [freeMovement]);
  const vote = room.game?.phase === 'vote' || room.game?.phase === 'tiebreak';
  const me = room.players.find(p => p.id === playerId);
  return <><div className="hub-canvas"><Canvas orthographic camera={{ position: [11, 13, 17], zoom: 27, near: .1, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} fallback={<div className="scene-fallback">La 3D est indisponible. La partie reste accessible ci-dessous.</div>}><Salon /><Camera room={room} />{room.players.map(p => {
    const selectable = vote && !voteTarget && me?.alive && !me.waiting && p.id !== playerId && room.game!.voteCandidates.includes(p.id);
    return <Avatar key={p.id} appearance={p.appearance} name={p.name} position={[p.position.x, 0, p.position.z]} yaw={p.position.yaw} seated={vote} selected={p.id === playerId || p.id === room.game?.turnPlayerId} speaking={speaking.includes(p.id)} dead={!p.alive && !p.waiting} winner={room.game?.phase === 'results' && room.game.result?.winnerIds.includes(p.id)} emote={p.emote?.kind} emoteUntil={p.emote ? p.emote.until - offset : undefined} onClick={selectable ? () => void send({ type: 'game.vote', targetId: p.id }) : undefined} reducedMotion={reduced} />;
  })}</Canvas></div>{freeMovement && controlsVisible && <div className="touch-pad" aria-label="Déplacements tactiles">{([{ name: 'Haut', x: 0, z: -1, icon: '↑' }, { name: 'Gauche', x: -1, z: 0, icon: '←' }, { name: 'Bas', x: 0, z: 1, icon: '↓' }, { name: 'Droite', x: 1, z: 0, icon: '→' }]).map(direction => <button key={direction.name} className={`touch-${direction.name.toLowerCase()}`} aria-label={`Se déplacer : ${direction.name}`} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touch.current = direction; }} onPointerUp={() => { touch.current = { x: 0, z: 0 }; }} onPointerCancel={() => { touch.current = { x: 0, z: 0 }; }} onLostPointerCapture={() => { touch.current = { x: 0, z: 0 }; }}>{direction.icon}</button>)}</div>}</>;
}
