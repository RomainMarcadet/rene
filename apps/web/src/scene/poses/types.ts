export interface Pose {
  state: string; y: number; z: number; roll: number; yaw: number; pitch: number;
  headX: number; headY: number; headZ: number; headForward: number;
  leftX: number; leftZ: number; rightX: number; rightZ: number; rightScale: number; rightLift: number;
  leftFoot: number; rightFoot: number; leftHip: number; rightHip: number; leftKnee: number; rightKnee: number;
  legSpread: number; pelvisX: number; pelvisY: number; pelvisZ: number;
  ik: boolean; lx: number; ly: number; lz: number; rx: number; ry: number; rz: number; leftPalm: number; rightPalm: number;
  stars: boolean;
}
export interface Morphology { width: number; depth: number; crown: number }
export const NEUTRAL: Pose = { state: 'idle', y: 0, z: 0, roll: 0, yaw: 0, pitch: 0, headX: 0, headY: 0, headZ: 0, headForward: 0, leftX: .08, leftZ: .08, rightX: 0, rightZ: -.08, rightScale: 1, rightLift: 0, leftFoot: 0, rightFoot: 0, leftHip: 0, rightHip: 0, leftKnee: 0, rightKnee: 0, legSpread: 0, pelvisX: 0, pelvisY: 0, pelvisZ: 0, ik: false, lx: -.48, ly: .35, lz: 0, rx: .48, ry: .35, rz: 0, leftPalm: 0, rightPalm: 0, stars: false };
export const createPose = (): Pose => ({ ...NEUTRAL });
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function hands(p: Pose, lx: number, ly: number, lz: number, rx: number, ry: number, rz: number) { p.ik = true; p.lx = lx; p.ly = ly; p.lz = lz; p.rx = rx; p.ry = ry; p.rz = rz; }
export function ground(p: Pose, amount: number) { p.y = .43 * amount; p.roll = -1.5 * amount; p.pitch = -.12 * amount; p.leftX = -1.2 * amount; p.rightX = .7 * amount; p.leftHip = .35 * amount; p.rightKnee = .65 * amount; }
export type PoseBuilder = (p: Pose, elapsed: number, duration: number, reduced: boolean, morphology: Morphology, recipient?: boolean) => void;
