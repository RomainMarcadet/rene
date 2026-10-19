import { SOCIAL_COMBAT_CONFIG as C, physicalStage, type PhysicalInstance, type AnimationId } from '@rene/contracts';
import { clamp, ease, ground, hands, type Pose, type PoseBuilder } from './types';

const punch: PoseBuilder = (p, t, _duration, reduced) => {
  const anticipation = ease(t / 100); const strike = ease((t - 100) / 80); const back = 1 - ease((t - 240) / 260);
  const force = (reduced ? .6 : 1) * back;
  hands(p, -.48, .65, .15, .5, 1.05, (-.35 * anticipation * (1 - strike) + 1.6 * strike) * force);
  p.pelvisY = -.22 * anticipation * force + .45 * strike * force; p.headX = -.1 * force;
};
export const attackPoses: Partial<Record<AnimationId, PoseBuilder>> = {
  punch,
  slap: (p, t, d, reduced, m) => { punch(p, t, d, reduced, m); p.rx = .5 - 1.3 * ease((t - 140) / 130) * (1 - ease((t - 330) / 170)); p.ry = 1.8; p.rz *= .9; p.rightPalm = Math.PI / 2; },
  headbutt: (p, t, _d, reduced) => { const a = ease((t - 80) / 100) * (1 - ease((t - 220) / 280)); p.headForward = (reduced ? .18 : .65) * a; p.headX = .65 * a; p.pitch = .2 * a; p.leftX = .7 * a; p.rightX = .7 * a; },
  shove: (p, t, _d, reduced) => { const a = ease(t / 180) * (1 - ease((t - 300) / 200)); hands(p, -.4, 1, (reduced ? .5 : 1.2) * a, .4, 1, (reduced ? .5 : 1.2) * a); p.pitch = .15 * a; },
};
export function physicalPose(p: Pose, physical: PhysicalInstance, now: number, reduced: boolean) {
  const stage = physicalStage(physical, now); const t = now - physical.startedAt;
  p.state = stage;
  if (stage === 'hit_reaction') {
    const recoil = Math.sin(clamp(t / C.hitReactionMs) * Math.PI) * (reduced ? .08 : .35);
    p.pelvisX = -Math.cos(physical.sourceYaw) * recoil; p.pelvisZ = Math.sin(physical.sourceYaw) * recoil;
    p.headX = -recoil; p.headZ = recoil * .4; p.leftX = -.8 * recoil; p.rightX = -.8 * recoil;
  } else if (stage !== 'normal') {
    const amount = stage === 'stun_fall' ? ease(t / C.fallMs) : stage === 'get_up' ? 1 - ease((now - physical.stunEndsAt) / C.recoveryMs) : 1;
    ground(p, reduced ? amount * .45 : amount); p.stars = stage === 'stunned_loop';
    if (!reduced && stage === 'get_up') { p.leftKnee = .9 * amount; p.rightKnee = 1.2 * amount; p.leftHip = -.6 * amount; }
  }
}
