import type { AvatarAppearance } from '@rene/contracts';
import { ball, box, cone, ring, type Part } from './parts';

export interface HeadDefinition {
  parts: Part[]; path: string; crown: number; width: number; depth: number;
  faceZ: number; faceWidth: number; faceHeight: number; faceY: number; bottom: number;
}
const head = (parts: Part[], path: string, crown = .7, width = .65, depth = .45, faceZ = .45, faceWidth = 1, faceHeight = 1, faceY = 0, bottom = -.75): HeadDefinition => ({ parts, path, crown, width, depth, faceZ, faceWidth, faceHeight, faceY, bottom });
export const HEAD_VISUALS: Record<AvatarAppearance['head'], HeadDefinition> = {
  pear: head([ball([0, -.2, 0], [.67, .55, .5], 'skin'), ball([-.06, .3, -.02], [.44, .54, .41], 'skin')], 'M82 21 Q125 21 125 65 Q168 134 117 157 Q50 173 29 133 Q14 110 44 68 Q49 19 82 21', .7),
  square: head([box([0, 0, 0], [1.24, 1.25, .94], 'skin', -.06)], 'M44 34 Q86 20 130 37 L137 131 Q133 157 104 155 L50 151 Q30 151 32 125 L29 57 Q29 35 44 34', .64, .65, .47, .49, 1, 1, 0, -.64),
  bean: head([ball([-.13, .13, 0], [.53, .8, .43], 'skin'), ball([.25, -.25, 0], [.52, .45, .44], 'skin')], 'M112 24 Q154 38 136 83 Q167 130 112 151 Q42 179 30 111 Q15 74 53 54 Q72 6 112 24', .8, .74, .44, .42),
  egg: head([ball([-.04, .08, 0], [.55, .86, .48], 'skin', -.1)], 'M83 17 C129 8 151 85 138 125 Q125 164 82 154 C25 151 26 83 47 39 Q62 16 83 17', .87, .55, .48, .46, .9, 1.05),
  potato: head([ball([-.13, -.05, 0], [.74, .57, .5], 'skin'), ball([.3, .22, -.04], [.44, .44, .44], 'skin')], 'M39 55 Q52 30 84 41 Q127 14 149 64 Q165 101 141 139 Q100 165 43 139 Q12 110 39 55', .57, .84, .5, .49, 1.15, .82, -.03, -.62),
  peanut: head([ball([-.08, .4, 0], [.53, .52, .44], 'skin'), ball([.12, -.34, 0], [.61, .49, .46], 'skin')], 'M82 18 Q147 16 126 77 Q114 93 142 113 Q156 155 101 160 Q36 173 37 127 Q40 108 58 88 Q20 57 49 30 Q62 17 82 18', .86, .72, .46, .44, .87, .83, -.08, -.82),
  wedge: head([cone([0, -.02, 0], [.84, 1.55, .57], 'skin', -.11)], 'M91 19 Q100 14 106 28 L157 139 Q157 152 140 152 L37 147 Q23 146 29 132Z', .73, .82, .5, .36, .8, .75, -.19, -.8),
  mushroom: head([ball([0, .35, -.04], [.85, .42, .5], 'skin'), box([.04, -.3, 0], [.67, .9, .67], 'skin', .05)], 'M90 25 Q159 20 163 77 Q163 95 121 94 L127 151 Q88 165 58 149 L62 95 Q12 96 21 69 Q31 23 90 25', .74, .84, .5, .46, 1.1, .7, .21, -.75),
  tall: head([box([-.05, .08, 0], [.85, 1.8, .83], 'skin', .09)], 'M58 13 117 19 132 164 53 157 40 40Z', .96, .51, .42, .44, .72, 1.1, -.02, -.85),
};

export const HAIR_VISUALS: Record<AvatarAppearance['hair'], Part[]> = {
  none: [],
  tuft: [0, 1, 2].map(i => ball([-.22 + i * .15, .05 + (i % 2) * .12, -.05], [.14, .29, .18], 'hair')),
  flat: [box([0, -.04, -.08], [1.14, .23, .88], 'hair', -.09)],
  spikes: [-.35, 0, .35].map(x => cone([x, .05, -.05], [.2, .6, .2], 'hair', -x)),
  bowl: [ball([0, -.02, -.05], [.66, .25, .5], 'hair'), box([0, -.16, .36], [1.12, .19, .18], 'hair')],
  fringe: [-.36, -.13, .12, .35].map((x, i) => box([x, -.17 - i * .025, .34], [.25, .55 - i * .06, .22], 'hair', .1)),
  sidepart: [ball([-.16, -.02, .02], [.55, .21, .43], 'hair', -.3), box([-.42, -.26, .14], [.18, .52, .22], 'hair', -.22)],
  bun: [ball([0, -.08, -.05], [.57, .17, .44], 'hair'), ball([.08, .23, -.22], [.3, .31, .3], 'hair')],
  buns: [-1, 1].map(side => ball([side * .55, -.03, -.05], [.28, .3, .3], 'hair')),
  mohawk: [-.28, 0, .28].map(z => cone([0, .18, z], [.15, .65, .19], 'hair')),
  curls: [-.5, -.25, 0, .25, .5].map((x, i) => ball([x, i % 2 ? .06 : -.04, .01], [.21, .21, .33], 'hair')),
  bob: [ball([0, -.07, -.09], [.63, .24, .5], 'hair'), ...[-1, 1].map(side => box([side * .55, -.46, -.07], [.24, .75, .65], 'hair', side * -.08))],
};

export interface EyeDefinition { width: number; height: number; tilt?: number; pupilX?: number; pupilY?: number; brow?: number; closed?: boolean }
export const EYE_VISUALS: Record<AvatarAppearance['eyes'], [EyeDefinition, EyeDefinition]> = {
  wide: [{ width: .17, height: .21 }, { width: .17, height: .21 }],
  sleepy: [{ width: .17, height: .09 }, { width: .17, height: .09 }],
  tiny: [{ width: .085, height: .21 }, { width: .085, height: .21 }],
  uneven: [{ width: .2, height: .25 }, { width: .12, height: .12 }],
  wink: [{ width: .17, height: .21 }, { width: .17, height: .025, closed: true }],
  worried: [{ width: .16, height: .19, brow: .35 }, { width: .16, height: .19, brow: -.35 }],
  angry: [{ width: .18, height: .12, brow: -.4 }, { width: .18, height: .12, brow: .4 }],
  dreamy: [{ width: .18, height: .16, pupilY: .07 }, { width: .18, height: .16, pupilY: .07 }],
  sideways: [{ width: .21, height: .14, pupilX: -.09 }, { width: .21, height: .14, pupilX: -.09 }],
};
export const MOUTH_VISUALS: Record<AvatarAppearance['mouth'], Part[]> = {
  flat: [box([.015, -.35, .04], [.22, .035, .022], 'ink', .07)],
  smile: [ring([.025, -.28, .04], [.14, .14, .14], 'ink', Math.PI, Math.PI)],
  surprised: [ball([.02, -.34, .04], [.065, .11, .018], 'ink')],
  frown: [ring([.02, -.42, .04], [.16, .12, .14], 'ink', Math.PI)],
  grin: [box([.01, -.34, .04], [.37, .17, .025], 'ink', -.05), box([.01, -.31, .059], [.31, .08, .018], 'cream', -.05)],
  pout: [ball([.035, -.34, .055], [.09, .055, .035], 'red'), box([.035, -.34, .09], [.09, .02, .01], 'ink')],
  crooked: [box([.02, -.34, .04], [.29, .035, .022], 'ink', .32)],
  tooth: [ball([.02, -.34, .04], [.16, .09, .02], 'ink'), box([-.02, -.3, .067], [.085, .08, .02], 'cream')],
  tongue: [ball([.02, -.33, .04], [.16, .08, .022], 'ink'), ball([.08, -.4, .068], [.075, .11, .02], 'red')],
};
export const NOSE_VISUALS: Record<AvatarAppearance['nose'], Part[]> = {
  none: [],
  long: [ball([.025, -.07, .24], [.14, .24, .44], 'red')],
  round: [ball([.025, -.07, .08], [.22, .2, .16], 'red')],
  small: [ball([.025, -.07, .06], [.085, .085, .09], 'red')],
  hook: [ball([.03, -.04, .18], [.12, .18, .26], 'red', -.2), ball([.08, -.2, .28], [.11, .17, .12], 'red')],
  snout: [box([.025, -.08, .17], [.36, .16, .36], 'red', -.05), ...[-.07, .1].map(x => ball([x, -.09, .36], [.035, .025, .015], 'ink'))],
};
