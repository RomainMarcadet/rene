import { useId, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MathUtils, Shape, ShapeGeometry, type Group, type Mesh } from 'three';
import { physicalStage, type AvatarAppearance, type Emote, type Phase, type SocialPlayerState } from '@rene/contracts';
import { PlayerName } from '../components/PlayerName';
import { getPose } from '../poses';
import { personalityPose, characterSeed } from './poses/personality';
import { avatarPose, createPose, type Pose } from './animation';
import { ArticulatedArm, ArticulatedLeg } from './ArticulatedLimbs';
import { AvatarHead, avatarGeometry, avatarMaterial } from '../avatar/PartMeshes';
import { buildAvatarModel } from '../avatar/model';
const star = new Shape();
for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + Math.PI / 2; const r = i % 2 ? .45 : 1; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
star.closePath(); const starGeometry = new ShapeGeometry(star);
interface Props { appearance: AvatarAppearance; position?: [number, number, number]; yaw?: number; gaze?: number | (() => number); identity?: string; playerId?: string; name?: string; clue?: string; mark?: number; speaking?: boolean; selected?: boolean; dead?: boolean; winner?: boolean; emote?: Emote; emoteUntil?: number; onClick?: () => void; onClickLabel?: string; seated?: boolean; reducedMotion?: boolean; social?: SocialPlayerState; serverOffset?: number; phase?: Phase; recipient?: boolean; partnerId?: string; partner?: { x: number; z: number; yaw?: number } }
export function Avatar({ appearance: a, position = [0, 0, 0], yaw = 0, playerId, name, clue, mark, speaking, selected, dead, winner, emote, emoteUntil, onClick, onClickLabel, seated = false, reducedMotion = false, social, serverOffset = 0, phase, recipient, partnerId, partner, gaze = 0, identity = playerId ?? name ?? a.head }: Props) {
  const clueId = useId();
  const seed = useMemo(() => characterSeed(identity), [identity]);
  const face = useRef({ blink: 1, talk: 0, look: 0 });
  const model = useMemo(() => buildAvatarModel(a, dead), [a, dead]);
  const initialPosition = useRef(position);
  const body = useRef<Mesh>(null); const group = useRef<Group>(null); const puppet = useRef<Group>(null); const pelvis = useRef<Group>(null); const head = useRef<Group>(null); const stars = useRef<Group>(null);
  const pose = useRef<Pose>(createPose()); const scratch = useRef<Pose>(createPose());
  const input = useRef<import('./animation').PoseInput>({ time: 0, now: 0, moving: false, reduced: false });
  const fallback = useRef({ x: position[0], z: position[2], yaw });
  const partnerFallback = useRef({ x: 0, z: 0, yaw: 0 });
  Object.assign(fallback.current, { x: position[0], z: position[2], yaw });
  if (partner) Object.assign(partnerFallback.current, partner, { yaw: partner.yaw ?? 0 });
  Object.assign(input.current, { dead, winner, emote, until: emoteUntil === undefined ? undefined : emoteUntil + serverOffset, reduced: reducedMotion, social, phase, morphology: model.head, recipient });
  const stage = physicalStage(social?.physical, Date.now() + serverOffset);
  const status = stage === 'get_up' ? 'Reprend ses esprits' : stage === 'stunned_loop' || stage === 'stun_fall' ? 'À terre' : social && social.protectedUntil > Date.now() + serverOffset ? 'Protégé' : undefined;
  useFrame((state, dt) => {
    if (!group.current || !puppet.current) return;
    const target = playerId ? getPose(playerId, fallback.current) : fallback.current;
    const moving = Math.abs(group.current.position.x - target.x) + Math.abs(group.current.position.z - target.z) > .08;
    group.current.position.x = MathUtils.damp(group.current.position.x, target.x, seated ? 4 : 14, dt); group.current.position.z = MathUtils.damp(group.current.position.z, target.z, seated ? 4 : 14, dt);
    const targetYaw = group.current.rotation.y + Math.atan2(Math.sin(target.yaw - group.current.rotation.y), Math.cos(target.yaw - group.current.rotation.y));
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, targetYaw, 9, dt);
    input.current.time = state.clock.elapsedTime; input.current.now = Date.now() + serverOffset; input.current.moving = moving;
    const p = avatarPose(input.current, pose.current, scratch.current);
    personalityPose(p, input.current.time, a.personality, seed, reducedMotion, !!speaking, typeof gaze === 'function' ? gaze() : gaze, face.current);
    const partnerPosition = partnerId && partner ? getPose(partnerId, partnerFallback.current) : partner;
    const paired = !!social?.animation?.sharedInteractionId && !!partnerPosition && p.state === social.animation.kind;
    const direction = paired ? Math.atan2(partnerPosition!.x - target.x, partnerPosition!.z - target.z) - group.current.rotation.y : 0;
    const toward = Math.atan2(Math.sin(direction), Math.cos(direction));
    const pairOffset = paired && p.state === 'carry' && recipient ? .4 : paired && p.state === 'hug' ? .12 : 0;
    puppet.current.position.y = MathUtils.damp(puppet.current.position.y, p.y, 12, dt);
    puppet.current.position.x = MathUtils.damp(puppet.current.position.x, Math.sin(toward) * pairOffset, 12, dt);
    puppet.current.position.z = MathUtils.damp(puppet.current.position.z, p.z + Math.cos(toward) * pairOffset, 12, dt);
    puppet.current.rotation.set(MathUtils.damp(puppet.current.rotation.x, p.pitch, 12, dt), MathUtils.damp(puppet.current.rotation.y, p.yaw + toward, 12, dt), MathUtils.damp(puppet.current.rotation.z, p.roll, 12, dt));
    if (body.current) body.current.scale.y = MathUtils.damp(body.current.scale.y, p.state === 'kneel' ? 1 - .15 * p.leftKnee / 2.85 : 1, 12, dt);
    if (pelvis.current) pelvis.current.rotation.set(p.pelvisX, p.pelvisY, p.pelvisZ);
    if (head.current) { head.current.rotation.set(p.headX, p.headY, p.headZ); head.current.position.z = MathUtils.damp(head.current.position.z, p.headForward, 18, dt); }
    if (stars.current) { stars.current.visible = p.stars; stars.current.rotation.y = reducedMotion ? 0 : (input.current.now - (social?.physical?.startedAt ?? input.current.now)) / 500; }
  }, -1);
  return <group ref={group} name={`player:${identity}`} position={initialPosition.current} onClick={onClick ? event => { event.stopPropagation(); if (event.delta <= 5) onClick(); } : undefined}>
    {(speaking || selected) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}><ringGeometry args={[.7, .8, 24]} /><meshBasicMaterial color={speaking ? '#65B847' : '#F5E742'} /></mesh>}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .015, 0]} scale={[.75, .5, 1]}><circleGeometry args={[1, 20]} /><meshBasicMaterial color="#191719" transparent opacity={.13} depthWrite={false} /></mesh>
    <group ref={puppet} name="avatar-puppet" scale={dead ? .85 : 1}>
      <ArticulatedLeg side={-1} pose={pose} root={puppet} color={a.body} /><ArticulatedLeg side={1} pose={pose} root={puppet} color={a.body} />
      <group ref={pelvis} position={[0, .45, 0]}><group position={[0, -.45, 0]}>
        <mesh ref={body} position={[0, .7, 0]} geometry={avatarGeometry.body} material={avatarMaterial(a.body)} dispose={null} />
        <ArticulatedArm side={-1} pose={pose} skin={a.skin} body={a.body} /><ArticulatedArm side={1} pose={pose} skin={a.skin} body={a.body} />
        <group position={[0, 1.65, 0]} ref={head}><AvatarHead appearance={a} eliminated={dead} motion={face} /></group>
      </group></group>
      <group ref={stars} visible={false} position={[0, 2.65, 0]}>{[0, 1, 2].map(n => <mesh key={n} position={[Math.cos(n * Math.PI * 2 / 3) * .7, .08 * n, Math.sin(n * Math.PI * 2 / 3) * .7]} rotation={[0, 0, Math.PI / 4]} scale={[.2, .2, .2]} geometry={starGeometry} material={avatarMaterial('#F5E742')} dispose={null} />)}</group>
    </group>
    {name && <Html wrapperClass="avatar-label-anchor" position={[0, dead ? 2 : Math.max(2.9, 1.65 + model.top + .25), 0]} zIndexRange={[8, 1]} style={{ pointerEvents: 'auto', transform: 'translate(-50%, -100%)' }}>
      <button type="button" data-player-id={playerId} className={`avatar-name avatar-label ${selected ? 'self' : ''} ${speaking ? 'talking' : ''}`} onClick={onClick} aria-label={onClickLabel ?? name} aria-describedby={clue || status ? clueId : undefined} tabIndex={onClick ? 0 : -1} title={name}>
        <PlayerName name={name} mark={mark} />
        {(clue || status) && <span id={clueId} role="tooltip" className="avatar-clue">{clue}{status && <small className="social-status">{status}</small>}</span>}
        {speaking && <span className="sr-only">Parle</span>}
      </button>
    </Html>}
  </group>;
}
