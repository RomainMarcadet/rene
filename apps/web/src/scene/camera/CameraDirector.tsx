import { useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { AvatarAppearance, RoomSnapshot } from '@rene/contracts';
import { buildAvatarModel } from '../../avatar/model';
import type { ClearArea } from '../../components/useRoomViewport';
import { cameraDistance, phaseShot, shotKey, TPS, type OrbitState } from './math';
const heights = new WeakMap<AvatarAppearance, number>();
function avatarHeight(a: AvatarAppearance | undefined) {
  if (!a) return 3.3;
  let height = heights.get(a); if (!height) { height = 1.65 + buildAvatarModel(a).top + .25; heights.set(a, height); } return height;
}
export function CameraDirector({ room, playerId, area, orbit, reduced }: { room: RoomSnapshot; playerId: string; area: ClearArea; orbit: MutableRefObject<OrbitState>; reduced: boolean }) {
  const { camera, size } = useThree();
  const data = useRef({ key: '', since: 0, ready: false, yaw: Math.PI, pitch: TPS.pitch as number, target: new Vector3(), desired: new Vector3(), position: new Vector3(), direction: new Vector3(), boom: TPS.distance as number, hidden: [] as string[] });
  const currentKey = shotKey(room.game);
  useFrame((_state, delta) => {
    const d = data.current; const dt = Math.min(delta, .1); const now = performance.now(); const key = currentKey;
    if (d.key !== key) { d.key = key; d.since = d.ready ? now : now - 10000; }
    const shot = orbit.current.overview ? 'group' : phaseShot(room.game?.phase, now - d.since, orbit.current.interrupted === key, reduced);
    const local = room.players.find(p => p.id === playerId);
    const id = shot === 'speaker' ? room.game?.turnPlayerId : shot === 'elimination' ? room.game?.eliminatedPlayerId : playerId;
    const focus = room.players.find(p => p.id === id && p.connected) ?? local;
    const group = shot === 'group'; let x = focus?.position.x ?? 0; let z = focus?.position.z ?? 0;
    if (group) {
      let count = 0; x = 0; z = 0;
      for (const p of room.players) if (room.game?.phase === 'results' ? p.connected : p.alive && !p.waiting) { x += p.position.x; z += p.position.z; count++; }
      x /= Math.max(1, count); z /= Math.max(1, count);
    }
    const height = avatarHeight(focus?.appearance);
    d.desired.set(x, group ? 1.5 : height * .45, z);
    d.target.lerp(d.desired, reduced || !d.ready ? 1 : 1 - Math.exp(-TPS.damping * dt));
    const cam = camera as PerspectiveCamera;
    cam.setViewOffset(size.width, size.height, size.width / 2 - area.left - area.width / 2, size.height / 2 - area.top - area.height / 2, size.width, size.height);
    const fy = Math.max(.18, area.height / size.height); const fx = Math.max(.2, area.width / size.width); const tan = Math.tan(TPS.fov * Math.PI / 360);
    let distance = Math.max(TPS.distance, height * 1.2 / (2 * tan * fy)); let pitch = orbit.current.pitch; let yaw = orbit.current.yaw;
    if (group) {
      let radius = 3.6;
      for (const p of room.players) if (p.alive || room.game?.phase === 'results') radius = Math.max(radius, Math.hypot(p.position.x - x, p.position.z - z) + 1.5);
      distance = Math.max(10, 1.2 * radius / (tan * Math.min(fy, fx * size.width / size.height))); pitch = .9; yaw = .4;
    }
    d.yaw = reduced || !d.ready ? yaw : MathUtils.damp(d.yaw, d.yaw + Math.atan2(Math.sin(yaw - d.yaw), Math.cos(yaw - d.yaw)), 9, dt);
    d.pitch = reduced || !d.ready ? pitch : MathUtils.damp(d.pitch, pitch, 7, dt);
    orbit.current.viewYaw = d.yaw;
    d.direction.set(Math.sin(d.yaw) * Math.cos(d.pitch), Math.sin(d.pitch), Math.cos(d.yaw) * Math.cos(d.pitch));
    d.hidden.length = 0;
    const safe = group ? distance : cameraDistance(d.target, d.direction, distance, d.hidden);
    d.boom = safe < d.boom || reduced || !d.ready ? safe : MathUtils.damp(d.boom, safe, 4, dt);
    d.position.copy(d.target).addScaledVector(d.direction, d.boom); cam.position.copy(d.position); cam.lookAt(d.target); cam.updateMatrixWorld(); d.ready = true;
    cam.userData.shot = shot; cam.userData.clearArea = area; cam.userData.orbitYaw = orbit.current.yaw;
    cam.userData.hiddenFurniture = d.hidden;
  }, -.5);
  return null;
}
