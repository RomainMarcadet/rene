import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group, type Mesh, type MeshLambertMaterial } from 'three';
import { WORLD_WALLS } from '@rene/contracts';
export function Walls() {
  const root = useRef<Group>(null);
  useFrame(({ camera }, dt) => {
    root.current?.children.forEach((object, index) => {
      const mesh = object as Mesh; const b = WORLD_WALLS[index]; const material = mesh.material as MeshLambertMaterial;
      const near = index < 2 ? (camera.position.z - b.z) * Math.sign(b.z) > -1.5 : (camera.position.x - b.x) * Math.sign(b.x) > -1.5;
      material.opacity = MathUtils.damp(material.opacity, near ? .06 : 1, 12, Math.min(dt, .1)); material.depthWrite = !near;
      // Skip an almost invisible full-screen foreground surface once the fade is complete.
      mesh.visible = !near || material.opacity > .08;
    });
  });
  return <group ref={root}>{WORLD_WALLS.map((b, i) => <mesh key={b.id} position={[b.x, b.height / 2, b.z]} scale={[b.halfX * 2, b.height, b.halfZ * 2]}><boxGeometry /><meshLambertMaterial color={i % 2 ? '#E8B5C2' : '#F5E742'} transparent /></mesh>)}</group>;
}
