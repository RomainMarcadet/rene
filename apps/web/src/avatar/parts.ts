export type Vector = [number, number, number];
export type Tone = 'skin' | 'hair' | 'accessory' | 'ink' | 'cream' | 'red' | 'yellow' | 'eye' | 'lens';
export interface Part { kind: 'sphere' | 'box' | 'cone' | 'cylinder' | 'torus'; at: Vector; scale: Vector; tone: Tone; tilt?: number; arc?: number }
export const ball = (at: Vector, scale: Vector, tone: Tone, tilt = 0): Part => ({ kind: 'sphere', at, scale, tone, tilt });
export const box = (at: Vector, scale: Vector, tone: Tone, tilt = 0): Part => ({ kind: 'box', at, scale, tone, tilt });
export const cone = (at: Vector, scale: Vector, tone: Tone, tilt = 0): Part => ({ kind: 'cone', at, scale, tone, tilt });
export const cylinder = (at: Vector, scale: Vector, tone: Tone): Part => ({ kind: 'cylinder', at, scale, tone });
export const ring = (at: Vector, scale: Vector, tone: Tone, arc = Math.PI * 2, tilt = 0): Part => ({ kind: 'torus', at, scale, tone, arc, tilt });
