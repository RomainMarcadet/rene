import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MathUtils, type Group, type Mesh } from 'three';
import type { AvatarAppearance, Emote } from '@rene/contracts';
import { avatarPose } from './animation';
import { AvatarHead, avatarGeometry, avatarMaterial } from '../avatar/PartMeshes';
import { buildAvatarModel } from '../avatar/model';
const ink = '#191719';
function Ball({ at, scale = [1, 1, 1], color }: { at: [number, number, number]; scale?: [number, number, number]; color: string }) { return <mesh position={at} scale={scale} geometry={avatarGeometry.sphere} material={avatarMaterial(color)} dispose={null} />; }
export function Avatar({ appearance: a, position = [0, 0, 0], yaw = 0, name, speaking, selected, dead, winner, emote, emoteUntil, onClick, seated = false, reducedMotion = false }: { appearance: AvatarAppearance; position?: [number, number, number]; yaw?: number; name?: string; speaking?: boolean; selected?: boolean; dead?: boolean; winner?: boolean; emote?: Emote; emoteUntil?: number; onClick?: () => void; seated?: boolean; reducedMotion?: boolean }) {
  const model = useMemo(() => buildAvatarModel(a, dead), [a, dead]);
  const initialPosition = useRef(position);
  const group = useRef<Group>(null); const puppet = useRef<Group>(null); const head = useRef<Group>(null); const leftArm = useRef<Group>(null); const rightArm = useRef<Group>(null); const leftFoot = useRef<Mesh>(null); const rightFoot = useRef<Mesh>(null);
  useFrame((state, dt) => {
    if (!group.current || !puppet.current) return;
    const time = state.clock.elapsedTime; const moving = Math.abs(group.current.position.x - position[0]) + Math.abs(group.current.position.z - position[2]) > .08;
    group.current.position.x = MathUtils.damp(group.current.position.x, position[0], seated ? 4 : 14, dt); group.current.position.z = MathUtils.damp(group.current.position.z, position[2], seated ? 4 : 14, dt);
    const targetYaw = group.current.rotation.y + Math.atan2(Math.sin(yaw - group.current.rotation.y), Math.cos(yaw - group.current.rotation.y));
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, targetYaw, 9, dt);
    const pose = avatarPose({ time, now: Date.now(), moving, dead, winner, emote, until: emoteUntil, reduced: reducedMotion });
    puppet.current.position.y = MathUtils.damp(puppet.current.position.y, pose.y, 10, dt);
    puppet.current.position.z = MathUtils.damp(puppet.current.position.z, pose.z, 10, dt);
    puppet.current.rotation.z = MathUtils.damp(puppet.current.rotation.z, pose.roll, 6, dt);
    puppet.current.rotation.y = MathUtils.damp(puppet.current.rotation.y, pose.yaw, 9, dt);
    if (head.current) head.current.rotation.set(pose.headX, pose.headY, pose.headZ);
    if (leftArm.current) leftArm.current.rotation.set(pose.leftX, 0, pose.leftZ);
    if (rightArm.current) { rightArm.current.rotation.set(pose.rightX, 0, pose.rightZ); rightArm.current.scale.y = pose.rightScale; rightArm.current.position.y = 1 + pose.rightLift; }
    if (leftFoot.current) leftFoot.current.rotation.x = pose.leftFoot;
    if (rightFoot.current) rightFoot.current.rotation.x = pose.rightFoot;

  });
  return <group ref={group} position={initialPosition.current} onClick={onClick ? event => { event.stopPropagation(); onClick(); } : undefined}>
    {(speaking || selected) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}><ringGeometry args={[.7, .8, 32]} /><meshBasicMaterial color={speaking ? '#65B847' : '#F5E742'} /></mesh>}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .015, 0]} scale={[.75, .5, 1]}><circleGeometry args={[1, 20]} /><meshBasicMaterial color="#191719" transparent opacity={.13} depthWrite={false} /></mesh>
    <group ref={puppet} scale={dead ? .85 : 1}>
      <mesh ref={leftFoot} position={[-.22, .16, .13]} scale={[.28, .3, .44]} geometry={avatarGeometry.box} material={avatarMaterial(ink)} dispose={null} /><mesh ref={rightFoot} position={[.22, .16, .13]} scale={[.28, .3, .44]} geometry={avatarGeometry.box} material={avatarMaterial(ink)} dispose={null} />
      <mesh position={[0, .7, 0]} geometry={avatarGeometry.body} material={avatarMaterial(a.body)} dispose={null} />
      {[-1, 1].map((side, i) => <group key={side} ref={i === 0 ? leftArm : rightArm} position={[side * .38, 1, 0]}><mesh position={[side * .08, -.28, 0]} rotation={[0, 0, side * .1]} geometry={avatarGeometry.arm} material={avatarMaterial(a.body)} dispose={null} /><Ball at={[side * .1, -.65, 0]} scale={[.13, .15, .13]} color={a.skin} /></group>)}
      <group position={[0, 1.65, 0]} ref={head}>
        <AvatarHead appearance={a} eliminated={dead} />
      </group>
    </group>
    {name && <Html center position={[0, dead ? 2 : Math.max(2.9, 1.65 + model.top + .25), 0]} zIndexRange={[8, 1]} style={{ pointerEvents: 'none' }}><span className={`avatar-name ${selected ? 'self' : ''} ${speaking ? 'talking' : ''}`}>{name}{speaking ? ' ♫' : ''}</span></Html>}
  </group>;
}
