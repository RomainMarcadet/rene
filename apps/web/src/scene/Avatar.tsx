import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MathUtils, type Group, type Mesh } from 'three';
import type { AvatarAppearance, Emote } from '@rene/contracts';
import { avatarPose } from './animation';
const ink = '#191719';
function Ball({ at, scale = [1, 1, 1], color }: { at: [number, number, number]; scale?: [number, number, number]; color: string }) { return <mesh position={at} scale={scale}><sphereGeometry args={[1, 12, 10]} /><meshLambertMaterial color={color} flatShading /></mesh>; }
export function Avatar({ appearance: a, position = [0, 0, 0], yaw = 0, name, speaking, selected, dead, winner, emote, emoteUntil, onClick, seated = false, reducedMotion = false }: { appearance: AvatarAppearance; position?: [number, number, number]; yaw?: number; name?: string; speaking?: boolean; selected?: boolean; dead?: boolean; winner?: boolean; emote?: Emote; emoteUntil?: number; onClick?: () => void; seated?: boolean; reducedMotion?: boolean }) {
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
      <mesh ref={leftFoot} position={[-.22, .16, .13]}><boxGeometry args={[.28, .3, .44]} /><meshLambertMaterial color={ink} /></mesh><mesh ref={rightFoot} position={[.22, .16, .13]}><boxGeometry args={[.28, .3, .44]} /><meshLambertMaterial color={ink} /></mesh>
      <mesh position={[0, .7, 0]}><cylinderGeometry args={[.34, .43, 1, 7]} /><meshLambertMaterial color={a.body} flatShading /></mesh>
      {[-1, 1].map((side, i) => <group key={side} ref={i === 0 ? leftArm : rightArm} position={[side * .38, 1, 0]}><mesh position={[side * .08, -.28, 0]} rotation={[0, 0, side * .1]}><cylinderGeometry args={[.105, .09, .65, 7]} /><meshLambertMaterial color={a.body} /></mesh><Ball at={[side * .1, -.65, 0]} scale={[.13, .15, .13]} color={a.skin} /></group>)}
      <group position={[0, 1.65, 0]} ref={head}>
        {a.head === 'square' ? <mesh rotation={[0, 0, -.06]} scale={[1.24, 1.25, .94]}><boxGeometry args={[1, 1, 1]} /><meshLambertMaterial color={a.skin} flatShading /></mesh> : a.head === 'bean' ? <><Ball at={[-.13, .13, 0]} scale={[.53, .8, .43]} color={a.skin} /><Ball at={[.25, -.25, 0]} scale={[.52, .45, .44]} color={a.skin} /></> : <><Ball at={[0, -.2, 0]} scale={[.67, .55, .5]} color={a.skin} /><Ball at={[-.06, .3, -.02]} scale={[.44, .54, .41]} color={a.skin} /></>}
        {[-.27, .29].map((x, i) => <group key={x} position={[x, .16 + i * .04, a.head === 'square' ? .49 : .4]}><Ball at={[0, 0, 0]} scale={[a.eyes === 'tiny' ? .085 : .17, a.eyes === 'sleepy' ? .09 : .21, .075]} color="#F5F2EA" /><Ball at={[.03, 0, .066]} scale={[.042, .064, .024]} color={ink} />{a.accessory === 'glasses' && <mesh position={[0, 0, .06]} scale={[1, 1.2, 1]}><torusGeometry args={[.22, .026, 6, 20]} /><meshLambertMaterial color={ink} /></mesh>}</group>)}
        {a.accessory === 'glasses' && <mesh position={[.01, .18, .52]}><boxGeometry args={[.14, .045, .045]} /><meshLambertMaterial color={ink} /></mesh>}
        <Ball at={[.025, -.07, a.nose === 'long' ? .68 : .5]} scale={a.nose === 'long' ? [.14, .24, .44] : a.nose === 'round' ? [.22, .2, .16] : [.085, .085, .09]} color="#F34531" />
        {a.mouth === 'surprised' ? <Ball at={[.02, -.34, .46]} scale={[.065, .11, .018]} color={ink} /> : a.mouth === 'smile' ? <mesh position={[.025, -.28, .48]} rotation={[0, 0, Math.PI]}><torusGeometry args={[.14, .024, 6, 16, Math.PI]} /><meshLambertMaterial color={ink} /></mesh> : <mesh position={[.015, -.35, .49]} rotation={[0, 0, .07]}><boxGeometry args={[.22, .035, .022]} /><meshLambertMaterial color={ink} /></mesh>}
        {a.hair === 'tuft' && [0, 1, 2].map(i => <Ball key={i} at={[-.22 + i * .15, .68 + (i % 2) * .12, -.05]} scale={[.14, .29, .18]} color={a.hairColor} />)}
        {a.hair === 'flat' && <mesh position={[0, .66, -.08]} rotation={[0, 0, -.09]}><boxGeometry args={[1.14, .23, .88]} /><meshLambertMaterial color={a.hairColor} /></mesh>}
        {a.hair === 'spikes' && [-.35, 0, .35].map(x => <mesh key={x} position={[x, .75, -.05]} rotation={[0, 0, -x]}><coneGeometry args={[.2, .6, 4]} /><meshLambertMaterial color={a.hairColor} /></mesh>)}
        {a.accessory === 'hat' && <group position={[0, .7, 0]} rotation={[0, 0, .1]}><mesh><cylinderGeometry args={[.75, .75, .1, 10]} /><meshLambertMaterial color="#65B847" /></mesh><mesh position={[0, .42, 0]}><cylinderGeometry args={[.35, .39, .8, 7]} /><meshLambertMaterial color="#65B847" /></mesh><mesh position={[0, .1, 0]}><cylinderGeometry args={[.405, .405, .1, 7]} /><meshLambertMaterial color="#F5E742" /></mesh></group>}
        {a.accessory === 'moustache' && [-1, 1].map(side => <Ball key={side} at={[side * .17, -.26, .53]} scale={[.23, .1, .07]} color={ink} />)}
      </group>
    </group>
    {name && <Html center position={[0, dead ? 2 : 2.9, 0]} zIndexRange={[8, 1]} style={{ pointerEvents: 'none' }}><span className={`avatar-name ${selected ? 'self' : ''} ${speaking ? 'talking' : ''}`}>{name}{speaking ? ' ♫' : ''}</span></Html>}
  </group>;
}
