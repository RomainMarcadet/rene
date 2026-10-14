import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MathUtils, type OrthographicCamera } from 'three';
import type { RoomSnapshot } from '@rene/contracts';
import { move, send, useGame } from '../store';
import { Avatar } from './Avatar';
import { Salon } from './Salon';
export function useReducedMotion() { const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches); useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []); return reduced; }
function Camera({ room }: { room: RoomSnapshot }) {
  const { camera, size } = useThree();
  useEffect(() => { const cam = camera as OrthographicCamera; cam.zoom = Math.min(size.width / 20, size.height / 13.3); cam.updateProjectionMatrix(); }, [camera, size]);
  const lookAt = useRef({ x: 0, z: 0 });
  useFrame((_state, dt) => { const speaker = room.game?.phase === 'description' ? room.players.find(p => p.id === room.game?.turnPlayerId) : null; lookAt.current.x = MathUtils.damp(lookAt.current.x, (speaker?.position.x ?? 0) * .2, 2, dt); lookAt.current.z = MathUtils.damp(lookAt.current.z, (speaker?.position.z ?? 0) * .2, 2, dt); camera.lookAt(lookAt.current.x, .4, lookAt.current.z); });
  return null;
}
export default function Hub({ room, playerId, speaking }: { room: RoomSnapshot; playerId: string; speaking: string[] }) {
  const keys = useRef(new Set<string>()); const touch = useRef({ x: 0, z: 0 }); const reduced = useReducedMotion(); const offset = useGame(s => s.offset); const voteTarget = useGame(s => s.secret?.voteTarget); const freeMovement = !room.game || room.game.phase === 'results';
  useEffect(() => {
    const blocked = (target: EventTarget | null) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable || !!document.querySelector('dialog[open]'));
    const down = (event: KeyboardEvent) => { if (blocked(event.target)) return; const key = event.key.toLowerCase(); if (['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); keys.current.add(key); } };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase()); const reset = () => { keys.current.clear(); touch.current = { x: 0, z: 0 }; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset);
    const interval = setInterval(() => { if (!freeMovement) return; const pressed = (...values: string[]) => values.some(key => keys.current.has(key)); let x = touch.current.x + Number(pressed('d', 'arrowright')) - Number(pressed('q', 'a', 'arrowleft')); let z = touch.current.z + Number(pressed('s', 'arrowdown')) - Number(pressed('z', 'w', 'arrowup')); const length = Math.hypot(x, z); if (length) { x /= length; z /= length; move(x, z); } }, 67);
    return () => { clearInterval(interval); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); };
  }, [freeMovement]);
  const vote = room.game?.phase === 'vote' || room.game?.phase === 'tiebreak';
  const alivePlayers = room.players.filter(p => p.alive && !p.waiting); const me = room.players.find(p => p.id === playerId);
  return <><div className="hub-canvas"><Canvas orthographic camera={{ position: [11, 13, 17], zoom: 27, near: .1, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} fallback={<div className="scene-fallback">La 3D est indisponible. La partie reste accessible ci-dessous.</div>}><Salon /><Camera room={room} />{room.players.map(p => {
    const seat = alivePlayers.findIndex(a => a.id === p.id); const angle = seat / Math.max(1, alivePlayers.length) * Math.PI * 2;
    const seated = vote && seat >= 0; const x = seated ? Math.cos(angle) * 2.75 : p.position.x; const z = seated ? Math.sin(angle) * 2.75 : p.position.z;
    const selectable = vote && !voteTarget && me?.alive && !me.waiting && p.id !== playerId && room.game!.voteCandidates.includes(p.id);
    return <Avatar key={p.id} appearance={p.appearance} name={p.name} position={[x, 0, z]} yaw={seated ? Math.atan2(-x, -z) : p.position.yaw} selected={p.id === playerId || p.id === room.game?.turnPlayerId} speaking={speaking.includes(p.id)} dead={!p.alive && !p.waiting} winner={room.game?.phase === 'results' && room.game.result?.winnerIds.includes(p.id)} emote={p.emote?.kind} emoteUntil={p.emote ? p.emote.until - offset : undefined} onClick={selectable ? () => void send({ type: 'game.vote', targetId: p.id }) : undefined} reducedMotion={reduced} />;
  })}</Canvas></div>{freeMovement && <div className="touch-pad" aria-label="Déplacements tactiles">{([{ name: 'Haut', x: 0, z: -1, icon: '↑' }, { name: 'Gauche', x: -1, z: 0, icon: '←' }, { name: 'Bas', x: 0, z: 1, icon: '↓' }, { name: 'Droite', x: 1, z: 0, icon: '→' }]).map(direction => <button key={direction.name} className={`touch-${direction.name.toLowerCase()}`} aria-label={`Se déplacer : ${direction.name}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); touch.current = direction; }} onPointerUp={() => { touch.current = { x: 0, z: 0 }; }} onPointerCancel={() => { touch.current = { x: 0, z: 0 }; }} onLostPointerCapture={() => { touch.current = { x: 0, z: 0 }; }}>{direction.icon}</button>)}</div>}</>;
}
