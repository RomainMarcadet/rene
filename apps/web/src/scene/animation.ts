import { emoteDuration, type Emote } from '@rene/contracts';

export type AnimationState = 'idle' | 'walking' | 'waving' | 'suspect' | 'dancing' | 'eliminated' | 'celebrating';
export function avatarPose({ time, now, moving, dead, winner, emote, until, reduced }: { time: number; now: number; moving: boolean; dead?: boolean; winner?: boolean; emote?: Emote; until?: number; reduced: boolean }) {
  const active = emote && (until === undefined || now < until) ? emote : undefined;
  const state: AnimationState = dead ? 'eliminated' : winner ? 'celebrating' : active === 'wave' ? 'waving' : active === 'suspect' ? 'suspect' : active === 'dance' ? 'dancing' : moving ? 'walking' : 'idle';
  const dancing = state === 'dancing' || state === 'celebrating';
  const t = until === undefined ? time : (now - (until - emoteDuration(active ?? 'wave'))) / 1000;
  const blend = reduced || until === undefined ? 1 : Math.max(0, Math.min(1, t / .18, (until - now) / 180));
  const pose = { state, y: 0, z: 0, roll: 0, yaw: 0, headX: 0, headY: 0, headZ: 0, leftX: .08, leftZ: .08, rightX: 0, rightZ: -.08, rightScale: 1, rightLift: 0, leftFoot: 0, rightFoot: 0 };
  if (dead) { pose.y = reduced ? -.2 : -.55; pose.roll = reduced ? -.35 : -1.2; return pose; }
  if (!reduced) {
    pose.y = moving ? Math.abs(Math.sin(time * 12)) * .12 : dancing ? Math.abs(Math.sin(time * 7)) * .24 : 0;
    pose.roll = dancing ? Math.sin(time * 7) * .17 : 0;
    pose.headZ = Math.sin(time * 2) * .03;
    pose.leftX = moving ? Math.sin(time * 12) * .55 : dancing ? Math.sin(time * 8) * 1.2 : .08;
    pose.rightX = moving ? -Math.sin(time * 12) * .55 : 0;
    pose.leftFoot = moving ? Math.sin(time * 12) * .35 : 0; pose.rightFoot = -pose.leftFoot;
  }
  if (dancing) pose.rightZ = -.9;
  if (state === 'waving') {
    // Positive Z lifts the right hand OUTSIDE the head, around the shoulder pivot.
    pose.rightZ = -.08 + (2.33 + (reduced ? 0 : Math.sin(t * 13) * .15)) * blend;
    pose.rightX = -.35 * blend;
    // These deliberately short arms otherwise never reach above the huge head.
    pose.rightScale = 1 + 1.3 * blend; pose.rightLift = .18 * blend;
  }
  if (state === 'suspect') {
    pose.headZ = .3 * blend; pose.headX = .15 * blend;
    pose.headY = (reduced ? -.65 : -.65 + Math.sin(t * 3) * .25) * blend;
    pose.yaw = -.25 * blend; pose.z = -.22 * blend;
    pose.leftX = -1.1 * blend; pose.leftZ = .4 * blend; pose.rightX = -.55 * blend; pose.rightZ = -.45 * blend;
  }
  return pose;
}
