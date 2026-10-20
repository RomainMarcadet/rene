import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3, type OrthographicCamera } from 'three';
import { canMoveInPhase, socialParticipantAllowed, type RoomSnapshot } from '@rene/contracts';
import { move, send, useGame } from '../store';
import { getPose } from '../poses';
import { selectSocialTarget, useSocialSelection } from '../socialSelection';
import { Avatar } from './Avatar';
import { Salon } from './Salon';
import { isEditing } from '../keyboard';
import type { ClearArea } from '../components/useRoomViewport';
export function useReducedMotion() { const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches); useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []); return reduced; }
function Camera({ room, playerId, clearArea, compact, reduced }: { room: RoomSnapshot; playerId: string; clearArea: ClearArea; compact: boolean; reduced: boolean }) {
  const { camera, size } = useThree();
  const vectors = useRef({ right: new Vector3(), up: new Vector3(), target: new Vector3(), position: new Vector3() });
  useEffect(() => { camera.position.set(11, 13, 17); camera.lookAt(0, .4, 0); }, [camera]);
  useFrame((_state, dt) => {
    const cam = camera as OrthographicCamera;
    const vote = room.game?.phase === 'vote' || room.game?.phase === 'tiebreak';
    const focus = room.players.find(p => p.id === (room.game?.phase === 'description' ? room.game.turnPlayerId : playerId));
    const amount = compact ? 1 : .15;
    const { right, up, target, position } = vectors.current;
    const focusPosition = focus ? getPose(focus.id, focus.position) : undefined;
    target.set(vote ? 0 : (focusPosition?.x ?? 0) * amount, compact ? .4 : 2.1, vote ? 0 : (focusPosition?.z ?? 0) * amount);
    // Keep silhouettes readable when the clue grid grows; the floor may extend behind HUD panels.
    const zoom = Math.max(compact ? 10 : 30, Math.min(70, clearArea.width / (compact ? 10 : 18), clearArea.height / (compact ? 8 : 9)));
    right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
    // Translate parallel to the image plane: retain the original orthographic angle.
    target.addScaledVector(right, (size.width / 2 - clearArea.left - clearArea.width / 2) / zoom);
    target.addScaledVector(up, (clearArea.top + clearArea.height / 2 - size.height / 2) / zoom);
    position.copy(target); position.x += 11; position.y += 12.6; position.z += 17;
    cam.position.lerp(position, reduced ? 1 : 1 - Math.exp(-4 * dt));
    const nextZoom = reduced || Math.abs(cam.zoom - zoom) < .001 ? zoom : MathUtils.damp(cam.zoom, zoom, 4, dt);
    if (cam.zoom !== nextZoom) { cam.zoom = nextZoom; cam.updateProjectionMatrix(); }
  });
  return null;
}
export default function Hub({ room, playerId, speaking, clearArea, compact, controlsVisible }: { room: RoomSnapshot; playerId: string; speaking: string[]; clearArea: ClearArea; compact: boolean; controlsVisible: boolean }) {
  const keys = useRef(new Set<string>()); const touch = useRef({ x: 0, z: 0 }); const reduced = useReducedMotion(); const offset = useGame(s => s.offset); const voteTarget = useGame(s => s.secret?.voteTarget); const freeMovement = canMoveInPhase(room.game?.phase);
  const socialTarget = useSocialSelection(s => s.targetId);
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  useEffect(() => { if (!controlsVisible) touch.current = { x: 0, z: 0 }; }, [controlsVisible]);
  useEffect(() => {
    const blocked = (target: EventTarget | null) => isEditing(target) || !!document.querySelector('dialog[open]');
    const down = (event: KeyboardEvent) => { if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || blocked(event.target)) return; const key = event.key.toLowerCase(); if (['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); keys.current.add(key); } };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase()); const reset = () => { keys.current.clear(); touch.current = { x: 0, z: 0 }; };
    const focus = () => { if (blocked(document.activeElement)) reset(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset); document.addEventListener('focusin', focus);
    const interval = setInterval(() => { if (!freeMovement || blocked(document.activeElement)) { reset(); return; } const pressed = (...values: string[]) => values.some(key => keys.current.has(key)); let x = touch.current.x + Number(pressed('d', 'arrowright')) - Number(pressed('q', 'a', 'arrowleft')); let z = touch.current.z + Number(pressed('s', 'arrowdown')) - Number(pressed('z', 'w', 'arrowup')); const length = Math.hypot(x, z); if (length) { x /= length; z /= length; move(x, z); } }, 67);
    return () => { clearInterval(interval); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); document.removeEventListener('focusin', focus); reset(); };
  }, [freeMovement]);
  const vote = room.game?.phase === 'vote' || room.game?.phase === 'tiebreak';
  const me = room.players.find(p => p.id === playerId);
  return <><div className="hub-canvas"><Canvas orthographic frameloop={visible ? 'always' : 'never'} camera={{ position: [11, 13, 17], zoom: 27, near: .1, far: 100 }} dpr={[1, compact ? 1 : 1.25]} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} fallback={<div className="scene-fallback">La 3D est indisponible. La partie reste accessible dans les panneaux.</div>}><Salon /><Camera room={room} playerId={playerId} clearArea={clearArea} compact={compact} reduced={reduced} />{room.players.map(p => {
    const selectable = vote && !voteTarget && me?.alive && !me.waiting && p.id !== playerId && room.game!.voteCandidates.includes(p.id);
    const interactable = !vote && me && socialParticipantAllowed(me, room.game?.phase) && p.id !== playerId && p.connected && !p.waiting;
    const description = room.game?.descriptions.find(d => d.playerId === p.id && d.round === room.game!.round);
    const clue = description ? description.timedOut ? 'Tour passé' : description.text : room.game ? p.waiting ? 'Prochaine partie' : 'Indice à venir' : undefined;
    const partnerId = room.social.players[p.id]?.animation?.targetId;
    return <Avatar key={p.id} playerId={p.id} appearance={p.appearance} name={p.name} clue={clue} mark={room.game?.playerMarks[p.id]} position={[p.position.x, 0, p.position.z]} yaw={p.position.yaw} seated={vote} selected={p.id === playerId || p.id === room.game?.turnPlayerId || !vote && p.id === socialTarget} speaking={speaking.includes(p.id)} dead={!p.alive && !p.waiting} winner={room.game?.phase === 'results' && room.game.result?.winnerIds.includes(p.id)} emote={p.emote?.kind} emoteUntil={p.emote ? p.emote.until - offset : undefined} onClick={selectable ? () => void send({ type: 'game.vote', targetId: p.id }) : interactable ? () => selectSocialTarget(p.id) : undefined} onClickLabel={selectable ? `Voter contre ${p.name}` : interactable ? `Interagir avec ${p.name}` : undefined} reducedMotion={reduced} social={room.social.players[p.id]} serverOffset={offset} phase={room.game?.phase} recipient={room.social.interactions.some(i => i.toId === p.id && i.state === 'active')} partnerId={partnerId} partner={room.players.find(other => other.id === partnerId)?.position} />;
  })}</Canvas></div>{freeMovement && controlsVisible && <div className="touch-pad" aria-label="Déplacements tactiles">{([{ name: 'Haut', x: 0, z: -1, icon: '↑' }, { name: 'Gauche', x: -1, z: 0, icon: '←' }, { name: 'Bas', x: 0, z: 1, icon: '↓' }, { name: 'Droite', x: 1, z: 0, icon: '→' }]).map(direction => <button key={direction.name} className={`touch-${direction.name.toLowerCase()}`} aria-label={`Se déplacer : ${direction.name}`} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touch.current = direction; }} onPointerUp={() => { touch.current = { x: 0, z: 0 }; }} onPointerCancel={() => { touch.current = { x: 0, z: 0 }; }} onLostPointerCapture={() => { touch.current = { x: 0, z: 0 }; }}>{direction.icon}</button>)}</div>}</>;
}
