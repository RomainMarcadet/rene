import type { AnimationId } from '@rene/contracts';
import { ease, ground, hands, type PoseBuilder } from './types';

const bodyEnvelope = (t: number, d: number) => Math.min(ease(t / 300), ease((d - t) / 450));
export const gesturePoses: Partial<Record<AnimationId, PoseBuilder>> = {
  play_dead: (p, t, d, reduced) => ground(p, bodyEnvelope(t, d) * (reduced ? .45 : 1)),
  faint: (p, t, d, reduced) => { const a = bodyEnvelope(t, d); p.headZ = -.4 * a; p.leftZ = 1.2 * a; ground(p, ease((t - 900) / 550) * ease((d - t) / 600) * (reduced ? .45 : 1)); },
  straddle: (p, t, d, reduced) => { const a = bodyEnvelope(t, d); p.y = (-.15 + (reduced ? 0 : Math.sin(t / 150) * .06)) * a; p.legSpread = .7 * a; p.leftKnee = .6 * a; p.rightKnee = .6 * a; hands(p, -.5, .65, .45, .5, .65, .45); },
  kneel: (p, t, d) => { const a = bodyEnvelope(t, d); p.y = -.28 * a; p.leftHip = -1.3 * a; p.rightHip = -1.3 * a; p.leftKnee = 2.85 * a; p.rightKnee = 2.85 * a; hands(p, -.08, .9, .6, .08, .9, .6); p.headX = -.25 * a; },
  arm_back_and_forth: (p, t, _d, reduced) => { hands(p, -.48, .35, 0, .65, .9, reduced ? .6 : .55 + Math.sin(t / 145) * .4); p.rightPalm = .45; },
  head_forward_back: (p, t, _d, reduced) => { p.headForward = reduced ? .22 : .27 + Math.sin(t / 170) * .28; },
  crouch_taunt: (p, t, d, reduced) => { const a = bodyEnvelope(t, d) * (reduced ? .6 : .5 + Math.sin(t / 125) * .5); p.y = -.18 * a; p.leftHip = -1.1 * a; p.rightHip = -1.1 * a; p.leftKnee = 1.9 * a; p.rightKnee = 1.9 * a; p.headX = .15 * a; },
  facepalm: (p, t, d, _r, m) => { const a = bodyEnvelope(t, d); hands(p, -.48, .35, 0, .1, 1.85, m.depth + .2); p.headX = .25 * a; p.headZ = -.15 * a; },
  sarcastic_clap: (p, t, _d, reduced) => { const spread = reduced ? .12 : .08 + (1 + Math.sin(t / 180)) * .25; hands(p, -spread, 1.1, .7, spread, 1.1, .7); p.headY = .25; },
  laugh: (p, t, d, reduced) => { const a = bodyEnvelope(t, d); p.pelvisX = .55 * a; p.headX = .25 * a; p.y = reduced ? 0 : Math.sin(t / 90) * .035 * a; hands(p, -.22, .7, .4, .22, .7, .4); },
  point: p => { hands(p, -.48, .35, 0, .45, 1.05, 1.35); p.headY = -.2; p.rightPalm = Math.PI / 2; },
  bow: (p, t, d) => { const a = bodyEnvelope(t, d); p.pelvisX = .7 * a; p.leftX = .5 * a; p.rightX = .5 * a; },
  dab: p => { hands(p, -1.1, 2, .2, -.4, 1.85, .65); p.headX = .4; p.headZ = -.3; },
  moonwalk: (p, t, _d, reduced) => { p.pitch = -.18; p.leftHip = reduced ? .2 : Math.sin(t / 220) * .35; p.rightHip = -p.leftHip; p.leftFoot = -.25; p.rightFoot = -.25; p.leftKnee = Math.max(0, p.leftHip); p.rightKnee = Math.max(0, p.rightHip); p.z = reduced ? 0 : Math.sin(t / 440) * .1; },
  failed_breakdance: (p, t, d, reduced) => { const floor = ease((t - 600) / 400) * ease((d - t) / 600); ground(p, floor * (reduced ? .45 : 1)); p.yaw = reduced ? 0 : Math.sin(t / 300) * Math.PI * floor; p.legSpread = .8 * floor; p.leftKnee = .8 * floor; p.rightX = -1.8 * floor; },
  sleep: (p, t, d, reduced) => { const wake = ease((t - d + 500) / 150) * ease((d - t) / 300); p.headX = .45 * bodyEnvelope(t, d) - .7 * wake; p.roll = reduced ? .08 : Math.sin(t / 700) * .1; p.leftZ = -.8 * wake; p.rightZ = .8 * wake; },
  slip: (p, t, d, reduced) => { const a = ease((t - 400) / 300) * ease((d - t) / 600); p.y = -.18 * a; p.pitch = -.25 * a; p.leftHip = -1.3 * a; p.rightHip = -1.3 * a; p.leftKnee = .3 * a; p.rightKnee = .3 * a; p.z = reduced ? 0 : -.3 * a; p.leftZ = -1.2 * a; p.rightZ = 1.2 * a; },
  hug: (p, t, d, _r, _m, recipient) => { const a = bodyEnvelope(t, d); hands(p, -.6, 1.1, .7, .6, 1.1, .7); p.leftPalm = -1.2; p.rightPalm = 1.2; p.pitch = (recipient ? -.08 : .08) * a; },
  carry: (p, t, d, reduced, _m, recipient) => { const a = bodyEnvelope(t, d); if (recipient) { p.y = (reduced ? .25 : .65) * a; p.roll = -.7 * a; p.legSpread = .35 * a; p.leftKnee = 1.1 * a; p.rightKnee = 1.1 * a; } else { p.leftKnee = .4 * a; p.rightKnee = .4 * a; p.y = -.1 * a; hands(p, -.65, 1.4, .55, .65, 1.4, .55); } },
};
