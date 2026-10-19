import { ANIMATIONS, emoteDuration, socialPhaseAllowed, type Emote, type SocialPlayerState, type Phase } from '@rene/contracts';
import { createPose, NEUTRAL, type Pose, type Morphology } from './poses/types';
import { attackPoses, physicalPose } from './poses/physics';
import { gesturePoses } from './poses/gestures';
import { macarenaPose } from './poses/macarena';
export { createPose } from './poses/types';
export type { Pose } from './poses/types';
export interface PoseInput { time: number; now: number; moving: boolean; dead?: boolean; winner?: boolean; emote?: Emote; until?: number; reduced: boolean; social?: SocialPlayerState; phase?: Phase; morphology?: Morphology; recipient?: boolean }
const defaultMorphology: Morphology = { width: .65, depth: .45, crown: .7 };

export type AnimationState = 'idle' | 'walking' | 'waving' | 'suspect' | 'dancing' | 'eliminated' | 'celebrating';
export function avatarPose(input: PoseInput, pose: Pose = createPose(), scratch: Pose = createPose()): Pose {
  const { time, now, moving, reduced, social, phase } = input;
  let { dead, winner, emote, until } = input;
  let visualTime = time;
  Object.assign(pose, NEUTRAL); Object.assign(scratch, NEUTRAL);
  if (socialPhaseAllowed(phase)) {
    if (social?.physical && now >= social.physical.startedAt && now < social.physical.endsAt) { physicalPose(pose, social.physical, now, reduced); return pose; }
    const animation = social?.animation;
    if (animation && now >= animation.startedAt && now < animation.endsAt) {
      pose.state = animation.kind;
      const elapsed = now - animation.startedAt; const m = input.morphology ?? defaultMorphology;
      const builder = attackPoses[animation.kind] ?? gesturePoses[animation.kind];
      if (builder) { builder(pose, elapsed, ANIMATIONS[animation.kind].durationMs, reduced, m, input.recipient); return pose; }
      if (animation.kind.startsWith('macarena_')) { macarenaPose(pose, scratch, animation.kind, elapsed, reduced, m); return pose; }
      // Preserve the original three gestures, now with a server-time reference.
      dead = false; winner = false; emote = animation.kind as Emote; until = animation.endsAt; visualTime = elapsed / 1000;
    }
  }
  const active = socialPhaseAllowed(phase) && emote && (until === undefined || now < until) ? emote : undefined;
  const state: AnimationState = dead ? 'eliminated' : winner ? 'celebrating' : active === 'wave' ? 'waving' : active === 'suspect' ? 'suspect' : active === 'dance' ? 'dancing' : moving ? 'walking' : 'idle';
  const dancing = state === 'dancing' || state === 'celebrating';
  const t = until === undefined ? time : (now - (until - emoteDuration(active ?? 'wave'))) / 1000;
  const blend = reduced || until === undefined ? 1 : Math.max(0, Math.min(1, t / .18, (until - now) / 180));
  pose.state = state;
  if (dead) { pose.y = reduced ? -.2 : -.55; pose.roll = reduced ? -.35 : -1.2; return pose; }
  if (!reduced) {
    pose.y = moving ? Math.abs(Math.sin(visualTime * 12)) * .12 : dancing ? Math.abs(Math.sin(visualTime * 7)) * .24 : 0;
    pose.roll = dancing ? Math.sin(visualTime * 7) * .17 : 0;
    pose.headZ = Math.sin(visualTime * 2) * .03;
    pose.leftX = moving ? Math.sin(visualTime * 12) * .55 : dancing ? Math.sin(visualTime * 8) * 1.2 : .08;
    pose.rightX = moving ? -Math.sin(visualTime * 12) * .55 : 0;
    pose.leftFoot = moving ? Math.sin(visualTime * 12) * .35 : 0; pose.rightFoot = -pose.leftFoot;
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
