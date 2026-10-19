import type { CSSProperties, ReactNode } from 'react';
import { playerMark } from '@rene/contracts';

export function PlayerName({ name, mark, children }: { name: string; mark?: number; children?: ReactNode }) {
  const palette = playerMark(mark);
  return <span className={`player-identity ${palette ? 'has-player-mark' : ''}`} data-player-mark={palette ? mark : undefined} title={name} style={palette ? { '--player-color': palette.color, '--player-ink': palette.ink, '--player-foreground': palette.foreground } as CSSProperties : undefined}>
    {palette && <span className="player-token" aria-label={`Repère ${mark! + 1}`}>{mark! + 1}</span>}<span className="player-name">{children ?? name}</span>
  </span>;
}
