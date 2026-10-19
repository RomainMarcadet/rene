import { memo, useMemo } from 'react';
import type { AvatarAppearance } from '@rene/contracts';
import { avatarTone, buildAvatarModel } from '../avatar/model';
import type { Part } from '../avatar/parts';

function PartSvg({ part: p, appearance, eliminated }: { part: Part; appearance: AvatarAppearance; eliminated: boolean }) {
  const sx = p.scale[0] * 83; const sy = p.scale[1] * 83;
  const color = avatarTone(p.tone, appearance, eliminated);
  return <g transform={`translate(${90 + p.at[0] * 83} ${90 - p.at[1] * 83}) rotate(${-(p.tilt ?? 0) * 180 / Math.PI})`} fill={color} stroke={p.tone === 'ink' ? 'none' : '#191719'} strokeWidth={p.tone === 'eye' ? 2 : 1.3} strokeLinejoin="round">
    {p.kind === 'sphere' && <ellipse rx={sx} ry={sy} />}
    {p.kind === 'box' && <rect x={-sx / 2} y={-sy / 2} width={sx} height={sy} rx="1" />}
    {p.kind === 'cone' && <path d={`M0 ${-sy / 2} ${sx} ${sy / 2} ${-sx} ${sy / 2}Z`} />}
    {p.kind === 'cylinder' && <path d={`M${-sx} ${-sy / 2} Q0 ${-sy / 2 - 3} ${sx} ${-sy / 2} L${sx} ${sy / 2} Q0 ${sy / 2 + 3} ${-sx} ${sy / 2}Z`} />}
    {p.kind === 'torus' && (p.arc === Math.PI ? <path d={`M${sx} 0 A${sx} ${sy} 0 0 0 ${-sx} 0`} fill="none" stroke={color} strokeWidth={Math.max(2.5, sx * .26)} strokeLinecap="round" /> : <ellipse rx={sx} ry={sy} fill="none" stroke={color} strokeWidth={Math.max(2.5, sx * .26)} />)}
  </g>;
}
export const AvatarPortrait = memo(function AvatarPortrait({ appearance: a, className = '', eliminated = false }: { appearance: AvatarAppearance; className?: string; eliminated?: boolean }) {
  const model = useMemo(() => buildAvatarModel(a, eliminated), [a, eliminated]);
  const minY = Math.min(0, Math.floor(90 - model.top * 83 - 8));
  const features = [...model.eyes, ...model.mouth, ...model.nose, ...model.accessory].sort((a, b) => a.at[2] - b.at[2]);
  const renderPart = (p: Part, i: number) => <PartSvg key={i} part={p} appearance={a} eliminated={eliminated} />;
  return <svg className={`portrait ${eliminated ? 'portrait-eliminated' : ''} ${className}`} viewBox={`0 ${minY} 180 ${200 - minY}`} role="img" aria-label={eliminated ? 'Portrait éliminé · yeux rouges' : 'Votre drôle de tête'} data-appearance={[a.head, a.hair, a.eyes, a.mouth, a.nose, a.accessory].join(':')}>
    <path d="M32 200 42 150 Q88 129 139 150 L151 200" fill={a.body} stroke="#191719" strokeWidth="3" />
    <path d={model.head.path} fill={a.skin} stroke="#191719" strokeWidth="3" strokeLinejoin="round" />
    {model.hair.map(renderPart)}
    {features.map(renderPart)}
  </svg>;
});
