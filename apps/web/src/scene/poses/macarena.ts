import { ANIMATION_IDS, MACARENA_BEAT_MS as BEAT, MACARENA_MEASURE_MS as MEASURE, type AnimationId } from '@rene/contracts';
import { clamp, ease, hands, mix, NEUTRAL, type Morphology, type Pose } from './types';
export const MACARENA_STEPS = ANIMATION_IDS.filter(id => id.startsWith('macarena_') && id !== 'macarena_full');
/** Cumulative arm targets: later beats retain the preceding hand placements. */
function step(p: Pose, index: number, m: Morphology) {
  hands(p, -.48, .35, 0, .48, .35, 0);
  if (index >= 0) { p.rx = .5; p.ry = 1.05; p.rz = 1.1; p.rightPalm = Math.PI / 2; }
  if (index >= 1) { p.lx = -.5; p.ly = 1.05; p.lz = 1.1; p.leftPalm = Math.PI / 2; }
  if (index >= 2) p.rightPalm = -Math.PI / 2;
  if (index >= 3) p.leftPalm = -Math.PI / 2;
  if (index >= 4) { p.rx = -.4; p.ry = 1.1; p.rz = .4; p.rightPalm = 0; }
  if (index >= 5) { p.lx = .4; p.ly = 1.1; p.lz = .45; p.leftPalm = 0; }
  if (index >= 6) { p.rx = m.width + .18; p.ry = 1.65 + m.crown * .65; p.rz = -m.depth - .22; }
  if (index >= 7) { p.lx = -m.width - .18; p.ly = 1.65 + m.crown * .65; p.lz = -m.depth - .22; }
  if (index >= 8) { p.rx = -.4; p.ry = .5; p.rz = .3; }
  if (index >= 9) { p.lx = .4; p.ly = .5; p.lz = .35; }
  if (index >= 10) { p.rx = .45; p.ry = .5; p.rz = -.35; }
  if (index >= 11) { p.lx = -.45; p.ly = .5; p.lz = -.35; }
}
const handFields = ['lx', 'ly', 'lz', 'rx', 'ry', 'rz', 'leftPalm', 'rightPalm'] as const;
export function macarenaPose(p: Pose, previous: Pose, kind: AnimationId, elapsed: number, reduced: boolean, m: Morphology) {
  const full = kind === 'macarena_full'; const phase = full ? elapsed % MEASURE : elapsed;
  const beat = full ? Math.min(15, Math.floor(phase / BEAT)) : Math.max(0, MACARENA_STEPS.indexOf(kind));
  const index = Math.min(beat, 11);
  step(p, index, m);
  const nextCycle = full && elapsed >= MEASURE && beat === 0;
  step(previous, nextCycle ? 11 : full ? index - (beat <= 11 ? 1 : 0) : beat < 12 ? index - 1 : -1, m);
  if (nextCycle) { p.lx = previous.lx; p.ly = previous.ly; p.lz = previous.lz; p.leftPalm = previous.leftPalm; }
  if (full && elapsed >= MEASURE && beat === 1) { previous.lx = -.45; previous.ly = .5; previous.lz = -.35; previous.leftPalm = 0; }
  const blend = reduced ? 1 : ease(full ? (phase % BEAT) / (BEAT * .65) : elapsed / 350);
  for (const key of handFields) {
    if (!full && beat < 12) p[key] = elapsed < 200 ? mix(NEUTRAL[key], previous[key], ease(elapsed / 200)) : mix(previous[key], p[key], ease((elapsed - 200) / 250));
    else p[key] = mix(previous[key], p[key], blend);
  }
  const hips = full ? beat >= 12 && beat <= 14 : kind === 'macarena_hips';
  if (hips) {
    const envelope = full ? ease((phase - BEAT * 12) / 180) * ease((BEAT * 15 - phase) / 180) : ease(elapsed / 200) * ease((3000 - elapsed) / 200);
    p.pelvisX = (reduced ? .1 : Math.sin(phase / BEAT * Math.PI * 2) * .14) * envelope;
    p.pelvisZ = (reduced ? .08 : Math.cos(phase / BEAT * Math.PI * 2) * .14) * envelope;
  }
  const jump = full ? beat === 15 : kind === 'macarena_jump';
  if (jump && !reduced) { const a = full ? (phase % BEAT) / BEAT : clamp(elapsed / 1000); p.y = Math.sin(a * Math.PI) * .3; p.yaw = -ease(a) * Math.PI / 2; p.leftKnee = Math.sin(a * Math.PI) * .45; p.rightKnee = p.leftKnee; }
  if (full && !reduced) p.yaw -= Math.floor(elapsed / MEASURE) * Math.PI / 2;
}
