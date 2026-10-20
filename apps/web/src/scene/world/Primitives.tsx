import { avatarGeometry, avatarMaterial } from '../../avatar/PartMeshes';
export function Block({ at, size, color, tilt = 0 }: { at: [number, number, number]; size: [number, number, number]; color: string; tilt?: number }) {
  return <mesh position={at} scale={size} rotation={[0, 0, tilt]} geometry={avatarGeometry.box} material={avatarMaterial(color)} dispose={null} />;
}
export function Ball({ at, size, color }: { at: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={at} scale={size} geometry={avatarGeometry.sphere} material={avatarMaterial(color)} dispose={null} />;
}
