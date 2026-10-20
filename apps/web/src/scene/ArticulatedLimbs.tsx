import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, MathUtils, Quaternion, Vector3, type Group, type Mesh } from 'three';
import { avatarGeometry, avatarMaterial } from '../avatar/PartMeshes';
import { createLegLayout, legLayout } from './poses/legs';
import type { Pose } from './poses/types';

const UP = new Vector3(0, 1, 0);
function segment(mesh: Mesh | null, from: Vector3, to: Vector3, direction: Vector3) {
  if (!mesh) return;
  mesh.position.copy(from).lerp(to, .5);
  direction.subVectors(to, from); const size = direction.length();
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize()); mesh.scale.y = size / .65;
}
/** One elastic stroke and a mitten: retain the naive silhouette without an elbow rig. */
export function ArticulatedArm({ side, pose, skin, body }: { side: number; pose: RefObject<Pose>; skin: string; body: string }) {
  const finger = useRef<Mesh>(null); const arm = useRef<Mesh>(null); const hand = useRef<Group>(null);
  const v = useMemo(() => ({ shoulder: new Vector3(side * .38, 1, 0), target: new Vector3(side * .48, .35, 0), wanted: new Vector3(), direction: new Vector3(), rotation: new Euler() }), [side]);
  useFrame((_state, dt) => {
    const p = pose.current; const right = side > 0;
    if (finger.current) finger.current.visible = p.state === 'point';
    if (p.ik) v.wanted.set(right ? p.rx : p.lx, right ? p.ry : p.ly, right ? p.rz : p.lz);
    else {
      v.rotation.set(right ? p.rightX : p.leftX, 0, right ? p.rightZ : p.leftZ);
      v.wanted.set(side * .1, -.65 * (right ? p.rightScale : 1), 0).applyEuler(v.rotation).add(v.shoulder);
      if (right) v.wanted.y += p.rightLift;
    }
    v.target.lerp(v.wanted, 1 - Math.exp(-18 * dt));
    segment(arm.current, v.shoulder, v.target, v.direction);
    if (hand.current) { hand.current.position.copy(v.target); hand.current.rotation.x = MathUtils.damp(hand.current.rotation.x, right ? p.rightPalm : p.leftPalm, 18, dt); }
  });
  return <>
    <mesh name="avatar-arm" ref={arm} geometry={avatarGeometry.arm} material={avatarMaterial(body)} dispose={null} />
    <group name="avatar-hand" ref={hand}>
      {side > 0 && <mesh ref={finger} visible={false} position={[0, .19, 0]} scale={[.08, .25, .08]} geometry={avatarGeometry.box} material={avatarMaterial(skin)} dispose={null} />}
      <mesh scale={[.18, .19, .08]} geometry={avatarGeometry.sphere} material={avatarMaterial(skin)} dispose={null} />
    </group>
  </>;
}
export function ArticulatedLeg({ side, pose, color, root }: { side: number; pose: RefObject<Pose>; color: string; root: RefObject<Group | null> }) {
  const layout = useRef(createLegLayout());
  const rotations = useMemo(() => ({ parent: new Quaternion(), foot: new Quaternion(), euler: new Euler() }), []);
  const hip = useRef<Group>(null); const knee = useRef<Group>(null); const boot = useRef<Mesh>(null);
  useFrame(() => {
    const p = pose.current; const right = side > 0;
    if (hip.current) hip.current.rotation.set(right ? p.rightHip : p.leftHip, 0, side * p.legSpread);
    if (knee.current) knee.current.rotation.x = right ? p.rightKnee : p.leftKnee;
    const l = legLayout(p, side, layout.current, root.current?.position.y ?? p.y);
    if (hip.current) hip.current.position.y = l.hipY;
    if (boot.current) {
      boot.current.position.set(0, l.bootY, l.bootZ);
      const foot = right ? p.rightFoot : p.leftFoot;
      if (l.anchored && hip.current && knee.current) {
        rotations.parent.copy(hip.current.quaternion).multiply(knee.current.quaternion).invert();
        rotations.euler.set(foot, 0, 0); rotations.foot.setFromEuler(rotations.euler);
        boot.current.quaternion.copy(rotations.parent).multiply(rotations.foot);
      } else boot.current.rotation.set(foot, 0, 0);
    }
  });
  return <group ref={hip} position={[side * .22, .45, 0]}>
    <mesh position={[0, -.09, 0]} scale={[.9, .28, .9]} geometry={avatarGeometry.arm} material={avatarMaterial(color)} dispose={null} />
    <group ref={knee} position={[0, -.18, 0]}>
      <mesh position={[0, -.08, 0]} scale={[.85, .25, .85]} geometry={avatarGeometry.arm} material={avatarMaterial(color)} dispose={null} />
      <mesh ref={boot} position={[0, -.12, .12]} scale={[.28, .3, .44]} geometry={avatarGeometry.box} material={avatarMaterial('#191719')} dispose={null} />
    </group>
  </group>;
}
