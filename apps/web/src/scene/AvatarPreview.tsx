import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrthographicCamera } from 'three';
import type { AvatarAppearance } from '@rene/contracts';
import { Avatar } from './Avatar';
import { buildAvatarModel } from '../avatar/model';

function FitPreview({ height }: { height: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as OrthographicCamera;
    cam.zoom = Math.min(62, size.width / 3.1, size.height / (height + .5));
    cam.updateProjectionMatrix();
  }, [camera, size, height]);
  return null;
}

export default function AvatarPreview({ appearance }: { appearance: AvatarAppearance }) {
  const height = useMemo(() => 1.65 + buildAvatarModel(appearance).top + .2, [appearance]);
  return <Canvas orthographic camera={{ position: [2.5, 1.8, 7], zoom: 58 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'low-power' }} fallback={<p className="hint">La 3D est indisponible. Le portrait reste visible.</p>}>
    <color attach="background" args={['#F5F2EA']} /><ambientLight intensity={2} /><directionalLight position={[3, 5, 4]} intensity={2.2} />
    <FitPreview height={height} />
    <group position={[0, -height / 2, 0]}><Avatar appearance={appearance} reducedMotion /></group>
    <OrbitControls target={[0, 0, 0]} enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.9} />
  </Canvas>;
}
