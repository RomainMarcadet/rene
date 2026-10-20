import { HEADWEAR, type AvatarAppearance } from '@rene/contracts';
import { EYE_VISUALS, HAIR_VISUALS, HEAD_VISUALS, MOUTH_VISUALS, NOSE_VISUALS, type HeadDefinition } from './catalog';
import { ball, box, cone, cylinder, ring, type Part, type Tone } from './parts';

type AccessoryBuilder = (head: HeadDefinition, appearance: AvatarAppearance) => Part[];
/** Surface anchors, rather than a fixed face plane, also fit the narrow/concave heads. */
export function headSurface(head: HeadDefinition, x: number, y: number): number {
  return Math.max(0, ...head.parts.map(p => {
    const c = Math.cos(p.tilt ?? 0); const s = Math.sin(p.tilt ?? 0);
    const px = (x - p.at[0]) * c + (y - p.at[1]) * s;
    const py = -(x - p.at[0]) * s + (y - p.at[1]) * c;
    if (p.kind === 'sphere') { const r = 1 - (px / p.scale[0]) ** 2 - (py / p.scale[1]) ** 2; return r > 0 ? p.at[2] + p.scale[2] * Math.sqrt(r) : 0; }
    if (p.kind === 'box') return Math.abs(px) <= p.scale[0] / 2 && Math.abs(py) <= p.scale[1] / 2 ? p.at[2] + p.scale[2] / 2 : 0;
    const taper = .5 - py / p.scale[1];
    return taper >= 0 && taper <= 1 ? p.at[2] + Math.max(0, taper - Math.abs(px) / p.scale[0]) * p.scale[2] : 0;
  }));
}
function headSide(head: HeadDefinition, y: number, side: number) {
  return side * Math.max(...head.parts.map(p => {
    const dy = y - p.at[1];
    const width = p.kind === 'sphere' ? p.scale[0] * Math.sqrt(Math.max(0, 1 - (dy / p.scale[1]) ** 2)) : p.kind === 'cone' ? p.scale[0] * Math.max(0, .5 - dy / p.scale[1]) : p.scale[0] / 2;
    return side * p.at[0] + width;
  }));
}
const spectacles = (head: HeadDefinition, a: AvatarAppearance, shades = false): Part[] => {
  const specs = EYE_VISUALS[a.eyes];
  return specs.flatMap((eye, i) => {
    const x = i ? .29 : -.27; const y = .16 + i * .04;
    const radius = Math.max(.22, eye.width + .045, eye.height + .035);
    const px = x * head.faceWidth; const py = y * head.faceHeight + head.faceY; const z = headSurface(head, px, py) + .13;
    return [ring([px, py, z], [radius * head.faceWidth, radius * head.faceHeight, .2], 'accessory'),
      ...(shades ? [ball([px, py, z - .005], [(radius - .025) * head.faceWidth, (radius - .025) * head.faceHeight, .02], 'lens')] : [])];
  }).concat(box([.01, .18 * head.faceHeight + head.faceY, headSurface(head, 0, .18 * head.faceHeight + head.faceY) + .13], [.14 * head.faceWidth, .045, .045], 'accessory'));
};
const ACCESSORY_VISUALS: Record<AvatarAppearance['accessory'], AccessoryBuilder> = {
  none: () => [],
  glasses: (h, a) => spectacles(h, a),
  sunglasses: (h, a) => spectacles(h, a, true),
  hat: h => [cylinder([0, h.crown + .08, 0], [h.width + .12, .1, h.depth + .15], 'accessory'), cylinder([0, h.crown + .52, 0], [.36, .8, .36], 'accessory'), cylinder([0, h.crown + .2, 0], [.375, .1, .375], 'yellow')],
  moustache: h => [-1, 1].map(side => {
    const x = side * .17 * h.faceWidth; const y = -.26 * h.faceHeight + h.faceY;
    return ball([x, y, headSurface(h, x, y) + .055], [.23 * h.faceWidth, .1, .07], 'accessory');
  }),
  monocle: (h, a) => {
    const size = Math.max(.23, EYE_VISUALS[a.eyes][1].height + .045);
    const z = headSurface(h, .29 * h.faceWidth, .2 * h.faceHeight + h.faceY) + .13;
    return [ring([.29 * h.faceWidth, .2 * h.faceHeight + h.faceY, z], [size * h.faceWidth, size * h.faceHeight, .2], 'accessory'), box([.53 * h.faceWidth, -.07 + h.faceY, z], [.022, .5, .025], 'accessory', -.08)];
  },
  beret: h => [ball([-.08, h.crown + .12, 0], [h.width + .04, .18, h.depth + .05], 'accessory', .12), box([-.12, h.crown + .31, 0], [.065, .15, .07], 'accessory', -.2)],
  cap: h => [ball([0, h.crown + .03, -.04], [h.width * .94, .26, h.depth + .05], 'accessory'), box([.13, h.crown - .03, h.depth + .18], [h.width * 1.55, .08, .65], 'accessory', -.04)],
  crown: h => [cylinder([0, h.crown + .08, 0], [h.width * .86, .18, h.depth], 'accessory'), ...[-.4, 0, .4].map(x => cone([x * h.width / .65, h.crown + .3, h.depth * .62], [.15, .45, .14], 'accessory')), ball([0, h.crown + .3, h.depth + .015], [.065, .07, .025], 'red')],
  beanie: h => [ball([0, h.crown + .09, -.04], [h.width, .3, h.depth + .08], 'accessory'), box([0, h.crown - .04, h.depth * .8], [h.width * 1.8, .15, .16], 'accessory'), ball([.03, h.crown + .43, -.03], [.14, .15, .14], 'accessory')],
  earrings: h => [-1, 1].map(side => ring([headSide(h, -.25, side) - side * .03, -.25, .03], [.13, .2, .18], 'accessory')),
  bowtie: h => [cone([-.17, h.bottom - .09, .4], [.16, .3, .12], 'accessory', Math.PI / 2), cone([.17, h.bottom - .09, .4], [.16, .3, .12], 'accessory', -Math.PI / 2), ball([0, h.bottom - .09, .47], [.09, .1, .06], 'accessory')],
  eyepatch: h => [ball([-.27 * h.faceWidth, .16 * h.faceHeight + h.faceY, headSurface(h, -.27 * h.faceWidth, .16 * h.faceHeight + h.faceY) + .13], [.22 * h.faceWidth, .22 * h.faceHeight, .05], 'accessory'), box([0, .27 + h.faceY, headSurface(h, 0, .27 + h.faceY) + .08], [h.width * 1.8, .035, .04], 'accessory', .16)],
  flower: h => {
    const x = headSide(h, h.crown - .3, -1) + .03;
    return [box([x, h.crown - .15, .13], [.035, .48, .035], 'accessory', -.3), ...[0, 1, 2, 3, 4].map(i => ball([x - .07 + Math.cos(i * Math.PI * 2 / 5) * .14, h.crown + .05 + Math.sin(i * Math.PI * 2 / 5) * .14, .15], [.11, .11, .04], 'accessory')), ball([x - .07, h.crown + .05, .2], [.08, .08, .04], 'yellow')];
  },
};

export function avatarTone(tone: Tone, a: AvatarAppearance, eliminated: boolean): string {
  const colors: Record<Tone, string> = { skin: a.skin, hair: a.hairColor, accessory: a.accessoryColor, ink: '#191719', cream: '#F5F2EA', red: '#F34531', yellow: '#F5E742', eye: eliminated ? '#F34531' : '#F5F2EA', lens: eliminated ? '#F34531' : a.accessoryColor };
  return colors[tone];
}
export function buildAvatarModel(a: AvatarAppearance, eliminated = false) {
  const head = HEAD_VISUALS[a.head]; const headwear = (HEADWEAR as readonly string[]).includes(a.accessory);
  const fitFace = (part: Part): Part => {
    const x = part.at[0] * head.faceWidth; const y = part.at[1] * head.faceHeight + head.faceY;
    return { ...part, at: [x, y, part.at[2] + headSurface(head, x, y)], scale: [part.scale[0] * head.faceWidth, part.scale[1] * head.faceHeight, part.scale[2]] };
  };
  const eyeTop = Math.max(...EYE_VISUALS[a.eyes].map((eye, i) => (.16 + i * .04 + eye.height) * head.faceHeight + head.faceY)) + .04;
  const hair = HAIR_VISUALS[a.hair].map(part => {
    const height = part.scale[1] * (headwear ? .25 : 1);
    const y = head.crown + part.at[1] * (headwear ? .25 : 1);
    // Bangs have a fringe line above the eyes, including the high mushroom face.
    const lift = part.at[2] > .2 && part.kind === 'box' ? Math.max(0, eyeTop - (y - height / 2)) : 0;
    return { ...part,
      at: [part.at[0] * head.width / .65, y + lift, part.at[2] * head.depth / .45] as [number, number, number],
      scale: [part.scale[0] * head.width / .65, height, part.scale[2] * head.depth / .45] as [number, number, number],
    };
  });
  const eyes = EYE_VISUALS[a.eyes].flatMap((eye, i) => {
    const x = i ? .29 : -.27; const y = .16 + i * .04;
    const white = fitFace(ball([x, y, 0], [eye.width, eliminated ? Math.max(.11, eye.height) : eye.height, .075], 'eye', eye.tilt));
    return [white,
      ...(!eye.closed || eliminated ? [ball([white.at[0] + (eye.pupilX ?? .03) * head.faceWidth, white.at[1] + (eye.pupilY ?? 0) * head.faceHeight, white.at[2] + .09], [.042 * head.faceWidth, .064 * head.faceHeight, .024], 'ink')] : []),
      ...(eliminated || eye.brow !== undefined ? [fitFace(box([x, y + eye.height + .07, .025], [.29, .04, .025], 'ink', eliminated ? (i ? .3 : -.3) : eye.brow))] : []),
    ];
  });
  const mouth = MOUTH_VISUALS[a.mouth].map(fitFace); const nose = NOSE_VISUALS[a.nose].map(fitFace);
  let accessory = ACCESSORY_VISUALS[a.accessory](head, a);
  // The patch changes colour on elimination too, keeping the red-eye state readable.
  if (eliminated && a.accessory === 'eyepatch') accessory = accessory.map((p, i) => i ? p : { ...p, tone: 'eye' });
  const parts = [...head.parts, ...hair, ...eyes, ...mouth, ...nose, ...accessory];
  const top = Math.max(...parts.map(p => p.at[1] + (p.kind === 'box' || p.kind === 'cone' || p.kind === 'cylinder' ? p.scale[1] / 2 : p.scale[1])));
  return { head, hair, eyes, mouth, nose, accessory, parts, top };
}
