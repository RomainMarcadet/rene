import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { canMoveInPhase, type RoomSnapshot } from '@rene/contracts';
import { send, useGame } from '../store';
import { speakerGaze } from './poses/personality';
import { Avatar } from './Avatar';
import { World } from './world/World';
import { CameraDirector } from './camera/CameraDirector';
import { ResolutionBudget } from './camera/ResolutionBudget';
import { useHubControls, controlsBlocked } from './camera/useHubControls';
import { Joystick } from './camera/Joystick';
import { shotKey, TPS, type OrbitState } from './camera/math';
import type { ClearArea } from '../components/useRoomViewport';
import { useReducedMotion } from './useReducedMotion';
export { useReducedMotion } from './useReducedMotion';
export default function Hub({ room, playerId, speaking, clearArea, compact, controlsVisible, paused = false }: { room: RoomSnapshot; playerId: string; speaking: string[]; clearArea: ClearArea; compact: boolean; controlsVisible: boolean; paused?: boolean }) {
  const reduced = useReducedMotion(); const offset = useGame(s => s.offset); const voteTarget = useGame(s => s.secret?.voteTarget);
  const orbit = useRef<OrbitState>({ yaw: Math.PI, viewYaw: Math.PI, pitch: TPS.pitch, interrupted: '', overview: false });
  const [quality, setQuality] = useState(1);
  const [overview, setOverview] = useState(false); const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const vote = !canMoveInPhase(room.game?.phase); const me = room.players.find(p => p.id === playerId);
  const touch = useHubControls(room, orbit, controlsVisible, () => recenter());
  useEffect(() => { if (!controlsVisible || vote) drag.current = null; }, [controlsVisible, vote]);
  useEffect(() => {
    const reset = () => { drag.current = null; }; const focus = () => { if (controlsBlocked(document.activeElement)) reset(); };
    window.addEventListener('blur', reset); window.addEventListener('resize', reset); window.visualViewport?.addEventListener('resize', reset); document.addEventListener('visibilitychange', reset); document.addEventListener('focusin', focus);
    return () => { window.removeEventListener('blur', reset); window.removeEventListener('resize', reset); window.visualViewport?.removeEventListener('resize', reset); document.removeEventListener('visibilitychange', reset); document.removeEventListener('focusin', focus); };
  }, []);
  const recenter = () => { orbit.current.yaw = (me?.position.yaw ?? 0) + Math.PI; orbit.current.pitch = TPS.pitch; orbit.current.interrupted = shotKey(room.game); orbit.current.overview = false; setOverview(false); };
  return <><div className="hub-canvas" onPointerDown={e => {
    if (vote || !controlsVisible || document.querySelector('dialog[open]') || e.button !== 0 || drag.current || !(e.target instanceof HTMLCanvasElement)) return;
    e.target.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }} onPointerMove={e => {
    const d = drag.current; if (!d || vote || d.id !== e.pointerId || !controlsVisible || controlsBlocked(document.activeElement)) return;
    orbit.current.yaw -= (e.clientX - d.x) * .006;
    orbit.current.pitch = Math.max(TPS.minPitch, Math.min(TPS.maxPitch, orbit.current.pitch + (e.clientY - d.y) * .004));
    orbit.current.interrupted = shotKey(room.game); d.x = e.clientX; d.y = e.clientY;
  }} onPointerUp={e => { if (drag.current?.id === e.pointerId) drag.current = null; }} onPointerCancel={e => { if (drag.current?.id === e.pointerId) drag.current = null; }} onLostPointerCapture={e => { if (drag.current?.id === e.pointerId) drag.current = null; }}>
    <Canvas frameloop={paused ? 'demand' : 'always'} onCreated={({ gl }) => { gl.domElement.tabIndex = 0; gl.domElement.setAttribute('aria-label', 'Scène : glisser pour regarder, ZQSD ou WASD pour marcher, R pour recentrer'); }} camera={{ position: [4, 4, -6], fov: TPS.fov, near: .08, far: 180 }} dpr={Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)) * quality} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} fallback={<div className="scene-fallback">La 3D est indisponible. La partie reste accessible dans les panneaux.</div>}>
      <ResolutionBudget quality={quality} paused={paused} onQuality={setQuality} />
      <World /><CameraDirector room={room} playerId={playerId} area={clearArea} orbit={orbit} reduced={reduced} />
      {room.players.map(p => {
        const selectable = vote && !voteTarget && me?.alive && !me.waiting && p.id !== playerId && room.game!.voteCandidates.includes(p.id);
        return <Avatar key={p.id} identity={p.id} gaze={speakerGaze(p, room.players, speaking)} appearance={p.appearance} name={p.name} mark={room.game?.playerMarks[p.id]} position={[p.position.x, 0, p.position.z]} yaw={p.position.yaw} seated={vote} selected={p.id === playerId || p.id === room.game?.turnPlayerId} speaking={speaking.includes(p.id)} dead={!p.alive && !p.waiting} winner={room.game?.phase === 'results' && room.game.result?.winnerIds.includes(p.id)} emote={p.emote?.kind} emoteUntil={p.emote ? p.emote.until - offset : undefined} onClick={selectable ? () => void send({ type: 'game.vote', targetId: p.id }) : undefined} reducedMotion={reduced} social={room.social.players[p.id]} serverOffset={offset} phase={room.game?.phase} recipient={room.social.interactions.some(i => i.toId === p.id && i.state === 'active')} partner={room.players.find(other => other.id === room.social.players[p.id]?.animation?.targetId)?.position} />;
      })}
    </Canvas>
  </div>
  {controlsVisible && <div className="camera-controls" style={{ left: Math.max(12, clearArea.left + 8), top: Math.max(80, clearArea.top + 8) }}>
    <button aria-label="Recentrer la caméra" title="Recentrer · R" disabled={vote} onClick={recenter}>◎<span>Moi · R</span></button>
    {!compact && <button aria-label="Vue collective" disabled={vote} aria-pressed={overview} onClick={() => { setOverview(!overview); orbit.current.overview = !overview; }}>▦<span>Ensemble</span></button>}
  </div>}
  <Joystick value={touch} visible={!vote && controlsVisible} area={clearArea} />
  </>;
}
