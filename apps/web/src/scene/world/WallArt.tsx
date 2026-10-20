import { Html } from '@react-three/drei';
import { Block, Ball } from './Primitives';
export function WallArt() {
  return <group position={[0, 0, -5.48]}>
    <group position={[-4.8, 2.8, 0]}>
      <Block at={[0, 0, 0]} size={[2, 1.3, .05]} color="#191719" tilt={-.035} />
      <Block at={[0, 0, .04]} size={[1.85, 1.15, .05]} color="#F34531" tilt={-.035} />
      <Html transform pointerEvents="none" zIndexRange={[1, 0]} position={[0, 0, .09]} distanceFactor={3} style={{ pointerEvents: 'none' }}><div className="world-sign">ICI, ON DOUTE.<br /><em>ENSEMBLE.</em></div></Html>
    </group>
    <group position={[0, 2.8, 0]}>
      <Ball at={[0, 0, 0]} size={[.67, .7, .07]} color="#191719" /><Ball at={[0, 0, .06]} size={[.6, .63, .05]} color="#F5F2EA" />
      <Block at={[.14, .1, .13]} size={[.35, .05, .03]} color="#191719" tilt={.55} />
      <Block at={[0, -.16, .13]} size={[.06, .4, .03]} color="#191719" tilt={-.14} />
      <Ball at={[0, 0, .17]} size={[.07, .07, .03]} color="#F34531" />
    </group>
    <group position={[4.7, 2.8, 0]}>
      <Block at={[0, 0, 0]} size={[2.6, 1.1, .06]} color="#087BA0" tilt={.025} />
      <Html transform pointerEvents="none" zIndexRange={[1, 0]} position={[0, 0, .08]} distanceFactor={4} style={{ pointerEvents: 'none' }}><div className="world-sign">RENÉ<br /><em>la mauvaise foi, chez soi.</em></div></Html>
    </group>
  </group>;
}
