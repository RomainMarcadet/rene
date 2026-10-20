import type { CSSProperties, ReactNode } from 'react';
import { playerMark } from '@rene/contracts';

/** Use the public identity palette on a card without changing the avatar's colours. */
export function playerMarkStyle(mark?: number): CSSProperties | undefined {
  const palette = playerMark(mark);
  return palette ? { '--player-color': palette.color, '--player-ink': palette.ink, '--player-foreground': palette.foreground } as CSSProperties : undefined;
}

export function PlayerName({ name, mark, children }: { name: string; mark?: number; children?: ReactNode }) {
  const palette = playerMark(mark);
  return <span className={`player-identity ${palette ? 'has-player-mark' : ''}`} data-player-mark={palette ? mark : undefined} title={name} style={playerMarkStyle(mark)}>
    <span className="player-name">{children ?? name}</span>
  </span>;
}
