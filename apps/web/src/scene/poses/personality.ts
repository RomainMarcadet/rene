import type { Personality, Position, PublicPlayer } from '@rene/contracts';
import type { Pose } from './types';
export function characterSeed(id: string) { let n = 0; for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0; return n % 997 / 997 * Math.PI * 2; }
export interface FaceMotion { blink: number; talk: number; look: number }
/** Secondary layer never changes state/feet targets or overrides a voluntary/physical pose. */
export function personalityPose(p: Pose, time: number, personality: Personality, seed: number, reduced: boolean, speaking: boolean, gaze: number, face: FaceMotion) {
  const base = p.state === 'idle' || p.state === 'walking';
  const social = base || p.state === 'waving' || p.state === 'suspect' || p.state === 'celebrating' || p.state === 'dancing';
  const t = time + seed;
  // Speech is independent of the skeleton: a voluntary pose must not silence the face.
  face.blink = 1; face.talk = speaking ? reduced ? .25 : .3 + Math.abs(Math.sin(time * 13)) * .9 : 0; face.look = 0;
  if (!social) return;
  if (!reduced) {
    const period = personality === 'nervous' ? 2.6 : 4.7; const blink = (t % period);
    face.blink = blink < .16 ? Math.max(.09, Math.abs(blink - .08) / .08) : 1;
    face.look = Math.sin(t * (personality === 'nervous' ? 2.5 : .5)) * .018;
  }
  if (base) {
    const energy = personality === 'impassive' ? .15 : personality === 'nervous' ? 1.4 : .7;
    if (!reduced) { p.y += Math.sin(t * 1.9) * .012 * energy; p.headZ += Math.sin(t * 1.3) * .035 * energy; }
    if (personality === 'proud') { p.headX -= .12; p.pitch -= .035; }
    if (personality === 'relaxed') { p.headZ += .08; p.pitch += .04; p.leftZ += .07; }
    if (p.state === 'walking' && !reduced) {
      const rate = personality === 'nervous' ? 17 : personality === 'relaxed' ? 8 : 12;
      p.leftFoot = Math.sin(time * rate) * (personality === 'proud' ? .5 : .35); p.rightFoot = -p.leftFoot;
      p.leftX = p.leftFoot * 1.6; p.rightX = -p.leftX;
      p.roll += Math.sin(time * rate / 2) * (personality === 'relaxed' ? .075 : .025);
    }
  }
  // Suspicion already owns the head turn. Voice can animate the mouth without steering that pose.
  if (p.state !== 'suspect') p.headY += Math.max(-.45, Math.min(.45, gaze));
}
export function speakerGaze(player: PublicPlayer, players: PublicPlayer[], speaking: string[], position: (id: string, fallback: Position) => Position = (_id, fallback) => fallback) {
  const origin = position(player.id, player.position);
  let best: PublicPlayer | undefined; let distance = 36;
  for (const p of players) if (p.id !== player.id && p.connected && speaking.includes(p.id)) {
    const target = position(p.id, p.position);
    const d = (target.x - origin.x) ** 2 + (target.z - origin.z) ** 2;
    if (d < distance || d === distance && p.id < (best?.id ?? '')) { best = p; distance = d; }
  }
  if (!best) return 0;
  const target = position(best.id, best.position);
  const yaw = Math.atan2(target.x - origin.x, target.z - origin.z) - origin.yaw;
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}
