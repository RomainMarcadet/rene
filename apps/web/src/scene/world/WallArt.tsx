import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Group } from 'three';
import { WORLD_WALLS } from '@rene/contracts';
import { Block, Ball } from './Primitives';
const plane = new PlaneGeometry(1, 1);
/** Printed in the world: CSS perspective overlays ignore the HUD's off-axis frustum. */
function Sign({ title, subtitle, color, size, z }: { title: string; subtitle: string; color: string; size: [number, number, number]; z: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Affiche indisponible.');
    context.fillStyle = color; context.fillRect(0, 0, 512, 256); context.textAlign = 'center'; context.fillStyle = '#F5F2EA';
    context.font = '900 ' + (title.length > 6 ? 47 : 86) + 'px Arial'; context.fillText(title, 256, 115);
    context.font = 'bold 23px Arial'; context.fillText(subtitle, 256, 180);
    const image = new CanvasTexture(canvas); image.colorSpace = SRGBColorSpace; return image;
  }, [title, subtitle, color]);
  const material = useMemo(() => new MeshBasicMaterial({ map: texture, toneMapped: false }), [texture]);
  useEffect(() => () => { material.dispose(); texture.dispose(); }, [texture, material]);
  return <mesh position={[0, 0, z]} scale={size} geometry={plane} material={material} dispose={null} />;
}
export function WallArt() {
  const root = useRef<Group>(null);
  useFrame(({ camera }) => { if (root.current) root.current.visible = camera.position.z > WORLD_WALLS[0].z + 1.5; });
  return <group ref={root} position={[0, 0, WORLD_WALLS[0].z + .17]}>
    <group position={[-4.8, 2.8, 0]} rotation={[0, 0, -.035]}>
      <Block at={[0, 0, 0]} size={[2, 1.3, .05]} color="#191719" />
      <Sign title="ICI, ON DOUTE." subtitle="ENSEMBLE." color="#F34531" size={[1.85, 1.15, 1]} z={.04} />
    </group>
    <group position={[0, 2.8, 0]}>
      <Ball at={[0, 0, 0]} size={[.67, .7, .07]} color="#191719" /><Ball at={[0, 0, .06]} size={[.6, .63, .05]} color="#F5F2EA" />
      <Block at={[.14, .1, .13]} size={[.35, .05, .03]} color="#191719" tilt={.55} />
      <Block at={[0, -.16, .13]} size={[.06, .4, .03]} color="#191719" tilt={-.14} />
      <Ball at={[0, 0, .17]} size={[.07, .07, .03]} color="#F34531" />
    </group>
    <group position={[4.7, 2.8, 0]} rotation={[0, 0, .025]}>
      <Block at={[0, 0, 0]} size={[2.6, 1.1, .06]} color="#191719" />
      <Sign title="RENÉ" subtitle="LA MAUVAISE FOI, CHEZ SOI." color="#087BA0" size={[2.48, 1, 1]} z={.05} />
    </group>
  </group>;
}
