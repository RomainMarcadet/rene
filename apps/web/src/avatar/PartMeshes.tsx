import { memo, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { FaceMotion } from '../scene/poses/personality';
import { BoxGeometry, ConeGeometry, CylinderGeometry, MeshLambertMaterial, SphereGeometry, TorusGeometry } from 'three';
import type { AvatarAppearance } from '@rene/contracts';
import { avatarTone, buildAvatarModel } from './model';
import type { Part } from './parts';

// Unit geometries and the finite colour palette are shared across all twelve players.
export const avatarGeometry = {
  sphere: new SphereGeometry(1, 12, 10), box: new BoxGeometry(1, 1, 1), cone: new ConeGeometry(1, 1, 4),
  cylinder: new CylinderGeometry(1, 1, 1, 10), torus: new TorusGeometry(1, .13, 6, 20), arc: new TorusGeometry(1, .15, 6, 16, Math.PI),
  body: new CylinderGeometry(.34, .43, 1, 7), arm: new CylinderGeometry(.105, .09, .65, 7),
};
const materials = new Map<string, MeshLambertMaterial>();
export function avatarMaterial(color: string) {
  let material = materials.get(color);
  if (!material) { material = new MeshLambertMaterial({ color, flatShading: true }); materials.set(color, material); }
  return material;
}
function PartMesh({ part, appearance, eliminated }: { part: Part; appearance: AvatarAppearance; eliminated: boolean }) {
  return <mesh geometry={part.kind === 'torus' && part.arc === Math.PI ? avatarGeometry.arc : avatarGeometry[part.kind]} material={avatarMaterial(avatarTone(part.tone, appearance, eliminated))} position={part.at} scale={part.scale} rotation={[0, 0, part.tilt ?? 0]} dispose={null} />;
}
export const AvatarHead = memo(function AvatarHead({ appearance, eliminated = false, motion }: { appearance: AvatarAppearance; eliminated?: boolean; motion?: MutableRefObject<FaceMotion> }) {
  const model = useMemo(() => buildAvatarModel(appearance, eliminated), [appearance, eliminated]);
  const eyes = useRef<Group>(null); const mouth = useRef<Group>(null);
  useFrame(() => {
    if (eyes.current) { eyes.current.scale.y = eliminated ? 1 : motion?.current.blink ?? 1; eyes.current.position.x = eliminated ? 0 : motion?.current.look ?? 0; }
    if (mouth.current) mouth.current.scale.y = 1 + (motion?.current.talk ?? 0);
  });
  return <group name={`appearance:${appearance.head}:${appearance.hair}:${appearance.eyes}:${appearance.mouth}:${appearance.nose}:${appearance.accessory}`}>
    {[...model.head.parts, ...model.hair, ...model.nose, ...model.accessory].map((part, index) => <PartMesh key={index} part={part} appearance={appearance} eliminated={eliminated} />)}
    <group ref={eyes}>{model.eyes.map((part, index) => <PartMesh key={index} part={part} appearance={appearance} eliminated={eliminated} />)}</group>
    <group ref={mouth}>{model.mouth.map((part, index) => <PartMesh key={index} part={part} appearance={appearance} eliminated={eliminated} />)}</group>
  </group>;
});
