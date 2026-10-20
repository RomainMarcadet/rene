import type { Pose } from './types';
export interface LegLayout { hipY: number; bootY: number; bootZ: number; anchored: boolean; footHeight: number; kneeY: number; kneeZ: number }
export const createLegLayout = (): LegLayout => ({ hipY: .45, bootY: -.12, bootZ: .12, anchored: false, footHeight: .15, kneeY: .27, kneeZ: 0 });
const floorPoses = new Set(['idle', 'walking', 'waving', 'suspect', 'dancing', 'celebrating', 'straddle', 'kneel', 'crouch_taunt', 'moonwalk', 'slip', 'carry', 'hit_reaction', 'facepalm', 'sarcastic_clap', 'laugh', 'point', 'bow', 'dab', 'sleep', 'punch', 'slap', 'headbutt', 'shove', 'arm_back_and_forth', 'head_forward_back']);
/** FK constraint for the deliberately short legs. Ground/jump poses retain free feet. */
export function legLayout(p: Pose, side: number, out: LegLayout, height = p.y) {
  const hip = side > 0 ? p.rightHip : p.leftHip; const knee = side > 0 ? p.rightKnee : p.leftKnee; const foot = side > 0 ? p.rightFoot : p.leftFoot;
  const fold = p.state === 'kneel' ? Math.max(0, Math.min(1, knee / 2.85)) : 0;
  out.bootY = -.12 - .06 * fold; out.bootZ = .12 - .15 * fold;
  out.anchored = floorPoses.has(p.state) && !(p.state === 'carry' && p.y > 0);
  out.footHeight = .15 * Math.abs(Math.cos(foot)) + .22 * Math.abs(Math.sin(foot));
  const y = out.bootY * Math.cos(knee) - out.bootZ * Math.sin(knee) - .18;
  const z = out.bootY * Math.sin(knee) + out.bootZ * Math.cos(knee);
  const ankleY = y * Math.cos(p.legSpread) * Math.cos(hip) - z * Math.sin(hip);
  out.hipY = out.anchored ? out.footHeight - height - ankleY : .45;
  out.kneeY = height + out.hipY - .18 * Math.cos(p.legSpread) * Math.cos(hip);
  out.kneeZ = -.18 * Math.cos(p.legSpread) * Math.sin(hip);
  return out;
}
