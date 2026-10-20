import { create } from 'zustand';
import type { Position, PublicPlayer } from '@rene/contracts';

/** High-frequency movement stays outside the authoritative room/UI snapshot. */
export const usePoses = create<{ positions: Record<string, Position> }>(() => ({ positions: {} }));

const samePose = (a: Position | undefined, b: Position) => a?.x === b.x && a.z === b.z && a.yaw === b.yaw;

export function getPose(playerId: string, fallback: Position): Position {
  return usePoses.getState().positions[playerId] ?? fallback;
}

/** A full snapshot is authoritative, including placement at the voting table. */
export function resetPoses(players: readonly Pick<PublicPlayer, 'id' | 'position'>[] = []) {
  const previous = usePoses.getState().positions;
  const positions = Object.fromEntries(players.map(player => [player.id, samePose(previous[player.id], player.position) ? previous[player.id] : player.position]));
  if (Object.keys(previous).length === players.length && players.every(player => positions[player.id] === previous[player.id])) return;
  usePoses.setState({ positions });
}

export function applyPoses(incoming: Readonly<Record<string, Position>>) {
  const previous = usePoses.getState().positions;
  let positions = previous;
  for (const [id, position] of Object.entries(incoming)) {
    // Do not retain late packets from a departed player or another room.
    if (!Object.hasOwn(previous, id) || samePose(previous[id], position)) continue;
    if (positions === previous) positions = { ...previous };
    positions[id] = position;
  }
  if (positions !== previous) usePoses.setState({ positions });
}
